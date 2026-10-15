import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { createDecisionClient, type DecisionClient } from "../../src/lib/interest-matching/decisions";
import { interestOverlap } from "../../src/lib/interest-matching/scoring";
import { proposePair } from "../../src/lib/interest-matching/selection";
import type { WaitingProfile } from "../../src/lib/interest-matching/types";

// Family labels are assigned before matching and never sent to the model.
const families = [
  { family: "outdoors", interests: [["hiking", "climbing"], ["trekking", "bouldering"], ["trail hiking", "rock climbing"], ["backpacking", "mountaineering"], ["walking woodland trails", "camping"], ["summit expeditions", "wilderness weekends"]] },
  { family: "software", interests: [["coding", "devtools"], ["programming", "CLI tools"], ["software development", "developer tools"], ["building compilers", "language servers"], ["open source maintainership", "debugging programs"], ["shipping web applications", "code editors"]] },
  { family: "photography", interests: [["photography", "portraits"], ["taking photos", "portraits"], ["digital photography", "portraits"], ["film cameras", "darkroom printing"], ["street portraits", "camera lenses"], ["long exposure landscapes", "composing pictures"]] },
  { family: "food", interests: [["cooking", "baking"], ["cooking", "sourdough"], ["baking", "sourdough"], ["fermentation", "bread making"], ["recipe experiments", "home made pasta"], ["pastry making", "kitchen experiments"]] },
  { family: "music", interests: [["music", "guitar"], ["music", "songwriting"], ["guitar", "songwriting"], ["jazz improvisation", "playing piano"], ["composing melodies", "recording songs"], ["playing in a band", "live concerts"]] },
];
const fixtures = families.flatMap(({ family, interests }) => interests.map((tags) => ({ family, interests: tags })));
const fixedNow = new Date("2026-10-15T12:00:00Z");
const seeds = [17, 41, 93];
const args = process.argv.slice(2);
const live = args.includes("--live");
function argument(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}
const output = argument("--output");
const maxCalls = Number(argument("--max-calls") ?? "150");
if (!Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > 150) throw new Error("--max-calls must be an integer from 1 to 150");
const allowedFlags = new Set(["--live", "--output", "--max-calls"]);
for (let i = 0; i < args.length; i++) {
  if (!allowedFlags.has(args[i])) throw new Error(`Unknown argument at position ${i + 1}`);
  if (args[i] !== "--live") i++;
}

function shuffled(seed: number) {
  const indices = fixtures.map((_, index) => index);
  let state = seed >>> 0;
  for (let i = indices.length - 1; i > 0; i--) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.map((index, arrival) => ({ entryId: index + 1, userId: index + 1, interests: fixtures[index].interests, joinedAt: new Date(+fixedNow + arrival) }));
}
const metricsSchema = z.object({ count: z.number().int().nonnegative().max(150) });
const counterPath = path.resolve(".local/interest-eval-calls.json");
let totalCalls = 0;
let callsThisRun = 0;
let httpFailures = 0;
let nullVerdicts = 0;
let budgetRejected = 0;
let lock: Awaited<ReturnType<typeof open>> | undefined;
let apiKey: string | undefined;

async function liveClient(): Promise<DecisionClient> {
  return createDecisionClient(async (request, signal) => {
    if (totalCalls >= maxCalls) {
      budgetRejected++;
      throw new Error("Persistent live request budget exhausted");
    }
    totalCalls++;
    callsThisRun++;
    // Reserve the call durably before fetch, including failed or cancelled calls.
    const temporaryPath = `${counterPath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify({ count: totalCalls })}\n`, { mode: 0o600 });
    await rename(temporaryPath, counterPath);
    const response = await fetch("https://api.openai.com/v1/decisions", {
      method: "POST", signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) { httpFailures++; throw new Error(`Decisions HTTP ${response.status}`); }
    return response.json();
  });
}
const offlineClient: DecisionClient = async () => null;
type RunResult = { seed: number; matches: number; waiters: number; sameFamilyPairs: number; sameFamilyFraction: number; meanOverlap: number; relaxedPairs: number };
async function run(seed: number, mode: "fifo" | "deterministic" | "decisions"): Promise<RunResult> {
  let queue: WaitingProfile[] = shuffled(seed);
  const pairs: [WaitingProfile, WaitingProfile][] = [];
  let relaxedPairs = 0;
  let now = new Date(+fixedNow + 1_000);
  const rawDecide = mode === "decisions" ? await liveClient() : offlineClient;
  const decide: DecisionClient = async (request) => {
    const verdict = await rawDecide(request);
    if (mode === "decisions" && !verdict) nullVerdicts++;
    return verdict;
  };
  while (queue.length >= 2) {
    let pair: [WaitingProfile, WaitingProfile];
    if (mode === "fifo") pair = [queue[0], queue[1]];
    else {
      let proposed = await proposePair(queue, now, decide);
      if (!proposed) {
        // No arrivals are simulated after the snapshot. Advance once to the
        // documented relaxation boundary so every even-sized queue can drain.
        now = new Date(+fixedNow + 20_000 + fixtures.length);
        proposed = await proposePair(queue, now, decide);
      }
      if (!proposed) throw new Error("Relaxed queue with at least two people did not produce a pair");
      pair = [proposed.anchor, proposed.partner];
      if (+now - +proposed.anchor.joinedAt >= 20_000) relaxedPairs++;
    }
    pairs.push(pair);
    const used = new Set(pair.map(({ userId }) => userId));
    queue = queue.filter(({ userId }) => !used.has(userId));
  }
  const sameFamilyPairs = pairs.filter(([a, b]) => fixtures[a.userId - 1].family === fixtures[b.userId - 1].family).length;
  return { seed, matches: pairs.length, waiters: queue.length, sameFamilyPairs, sameFamilyFraction: sameFamilyPairs / pairs.length,
    meanOverlap: pairs.reduce((sum, [a, b]) => sum + interestOverlap(a.interests, b.interests).score, 0) / pairs.length, relaxedPairs };
}
function summarize(runs: RunResult[]) {
  const matches = runs.reduce((sum, run) => sum + run.matches, 0);
  return { matches, waiters: runs.reduce((sum, run) => sum + run.waiters, 0), sameFamilyFraction: runs.reduce((sum, run) => sum + run.sameFamilyPairs, 0) / matches,
    meanOverlap: runs.reduce((sum, run) => sum + run.meanOverlap * run.matches, 0) / matches, runs };
}
async function main() {
  if (live) {
    apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("--live requires OPENAI_API_KEY in the environment");
    await mkdir(path.dirname(counterPath), { recursive: true });
    // One process owns the counter throughout the run. A stale lock requires
    // inspection rather than silently risking the shared call budget.
    lock = await open(`${counterPath}.lock`, "wx", 0o600);
    try { totalCalls = metricsSchema.parse(JSON.parse(await readFile(counterPath, "utf8"))).count; }
    catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  const fifo: RunResult[] = [];
  const deterministic: RunResult[] = [];
  const decisions: RunResult[] = [];
  for (const seed of seeds) {
    fifo.push(await run(seed, "fifo"));
    deterministic.push(await run(seed, "deterministic"));
    if (live) decisions.push(await run(seed, "decisions"));
  }
  const result = {
    mode: live ? "live" : "offline", model: "gpt-6-luna", endpoint: "https://api.openai.com/v1/decisions", fixedNow: fixedNow.toISOString(),
    fixtureCount: fixtures.length, familyCount: families.length, seeds,
    interpretation: "Synthetic topic-family agreement only; not evidence of real user satisfaction. Family labels are withheld from matching. All 30 people arrive before pairing; the queue relaxes at 20 seconds if it stalls.",
    fixtures: fixtures.map((fixture, index) => ({ id: index + 1, ...fixture })),
    fifo: summarize(fifo), deterministic: summarize(deterministic), decisions: live ? summarize(decisions) : null,
    liveRequests: { callsThisRun, persistedTotal: live ? totalCalls : null, hardCap: 150, configuredCap: maxCalls, httpFailures, nullVerdicts, budgetRejected },
  };
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (output) { await mkdir(path.dirname(path.resolve(output)), { recursive: true }); await writeFile(output, json); }
  process.stdout.write(json);
}
main().catch(() => {
  // Do not include raw remote errors, response bodies, request data or secrets.
  process.stderr.write("Interest evaluation failed. Check flags, API-key availability, counter JSON and lock ownership.\n");
  process.exitCode = 1;
}).finally(async () => {
  if (lock) { await lock.close(); await rm(`${counterPath}.lock`); }
});
