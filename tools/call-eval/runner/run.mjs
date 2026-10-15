/**
 * Scenario orchestration, ported from Connvo: one RunContext for the run, a
 * fresh queue match per scenario-seed, results collection, and the summary
 * writer. LinkedUp scores H-01..H-14 on its real call room (H-15 and H-16
 * are out of this step's scope; the P checks are replaced by
 * scripts/call-states-shots.mjs).
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { RunContext } from "./context.mjs";
import { loadContracts } from "./contracts.mjs";

const CONTRACTS = loadContracts();

const RUNNER_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(RUNNER_DIR, "..", "out");

export const H_IDS = Array.from({ length: 18 }, (_, i) => `H-${String(i + 1).padStart(2, "0")}`);
export const P_IDS = Array.from({ length: 5 }, (_, i) => `P-0${i + 1}`);
export const ALL_SCENARIOS = [...H_IDS, ...P_IDS];

/** The scenarios this port scores by default. */
export const WIRED_H = H_IDS.slice(0, 14);

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[idx]);
}

async function ensureFixtures(ctx, log) {
  const missing = ["A", "B", "C"].filter((p) => !ctx.fixturesExist(p));
  if (!missing.length) return;
  const script = path.resolve(RUNNER_DIR, "..", "scripts", "generate-fixtures.mjs");
  if (fs.existsSync(script)) {
    log(`fixtures missing for ${missing.join(", ")} — regenerating via generate-fixtures.mjs`);
    execSync(`node ${JSON.stringify(script)}`, { stdio: "inherit" });
  }
  const still = ["A", "B", "C"].filter((p) => !ctx.fixturesExist(p));
  if (still.length) {
    throw new Error(
      `fixtures missing (${still.join(", ")}) and no generator script at ${script} — run the fixtures branch generator first (pnpm call-eval:fixtures)`,
    );
  }
}

async function runOne(ctx, scenarioId, seed, log) {
  try {
    return await runOneInner(ctx, scenarioId, seed, log);
  } finally {
    // Every scenario closes its own browsers; the reviewed bug kept them all
    // open until the sweep ended, dozens of Chromium processes at 5 seeds.
    await ctx.closePeers();
  }
}

async function runOneInner(ctx, scenarioId, seed, log) {
  const t0 = Date.now();
  ctx.setSeed(seed); // shapers re-derive from THIS run's seed (reviewed bug: the constructor seed served every run)
  try {
    if (!scenarioId.startsWith("H")) throw new Error(`${scenarioId}: only H scenarios run in this port`);
    const mod = await import("./scenarios-h.mjs");
    const fn = /** @type {unknown} */ (mod[/** @type {keyof typeof mod} */ (`scenario_${scenarioId.replace("-", "_")}`)]);
    if (typeof fn !== "function") {
      throw new Error(`scenario ${scenarioId} is not implemented in scenarios-h.mjs`);
    }
    await ctx.newMeeting(scenarioId);
    const measurements = await fn(ctx, { seed, log });
    const conds = scenarioId.startsWith("H") ? CONTRACTS.H_PASS_CONDITIONS : CONTRACTS.P_PASS_CONDITIONS;
    const passCondition = (conds instanceof Map ? conds.get(scenarioId) : conds?.[scenarioId]) ?? null;
    return { scenario: scenarioId, transport: ctx.transport, seed, pass: true, passCondition, measurements, failure: null, ms: Date.now() - t0 };
  } catch (err) {
    log(`${scenarioId} seed ${seed} FAILED: ${err?.message}`);
    const conds = scenarioId.startsWith("H") ? CONTRACTS.H_PASS_CONDITIONS : CONTRACTS.P_PASS_CONDITIONS;
    const passCondition = (conds instanceof Map ? conds.get(scenarioId) : conds?.[scenarioId]) ?? null;
    return {
      scenario: scenarioId,
      transport: ctx.transport,
      seed,
      pass: false,
      passCondition,
      measurements: null,
      failure: { message: err?.message ?? String(err), stack: err?.stack?.split("\n").slice(0, 4).join("\n") },
      ms: Date.now() - t0,
    };
  }
}

/**
 * Run a matrix of scenario x seed cells over the given transports.
 * @param {{ transports?: string[], scenarios?: string[], seeds?: number[], baseUrl?: string | null, page?: "bench" | "real", signaling?: "reference" | "convex", log?: (msg: string) => void, write?: boolean, onResult?: (result: any) => void, skipCell?: ((scenario: string, seed: number, transport: string) => boolean) | null }} [options]
 */
export async function runScenarios({ scenarios = ["H-01"], seeds = [1], baseUrl, log = console.log, write = true, turn = null, onResult = /** @type {(result: any) => void} */ (() => {}) } = {}) {
  const results = [];
  const wallStart = Date.now();
  for (const transport of ["p2p-postgres"]) {
    const ctx = new RunContext({ baseUrl, log, turn });
    await ctx.start();
    try {
      if (scenarios.some((s) => s.startsWith("H"))) await ensureFixtures(ctx, log);
      for (const scenarioId of scenarios) {
        for (const seed of seeds) {
          log(`▶ ${scenarioId} seed ${seed} on ${transport}`);
          const result = await runOne(ctx, scenarioId, seed, log);
          results.push(result);
          onResult(result);
        }
      }
    } finally {
      await ctx.stop();
    }
  }
  const wallMs = Date.now() - wallStart;
  if (!write) return { results, wallMs };
  const written = await writeOutputs(results, wallMs);
  return { results, wallMs, ...written };
}

async function environmentInfo() {
  let chromium = "unknown";
  try {
    chromium = (await import("@playwright/test")).chromium.name();
  } catch { /* best-effort */ }
  return {
    node: process.version,
    chromium,
    turn: "in-process Node relay (runner/turn-relay.mjs)",
    signaling: "Postgres via POST /api/call/signal, polled every 250 ms (journey-proof path)",
    platform: `${process.platform} ${process.arch}`,
  };
}

export async function writeOutputs(results, wallMs, { outDir = OUT_DIR } = {}) {
  fs.mkdirSync(path.join(outDir, "screenshots"), { recursive: true });
  const resultsPath = path.join(outDir, "results.json");
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

  const byScenario = new Map();
  for (const r of results) {
    const entry = byScenario.get(r.scenario) ?? { pass: 0, total: 0, failures: [] };
    entry.total++;
    if (r.pass) entry.pass++;
    else entry.failures.push(`seed ${r.seed}: ${r.failure?.message ?? "failed"}`);
    byScenario.set(r.scenario, entry);
  }

  const ttf = results
    .filter((r) => r.measurements?.timeToFirstRemoteFrameMs != null)
    .map((r) => r.measurements.timeToFirstRemoteFrameMs);
  const recovery10 = results
    .filter((r) => r.scenario === "H-07" && r.measurements?.recovery10sMs != null)
    .map((r) => r.measurements.recovery10sMs);

  const env = await environmentInfo();
  const lines = [
    "# LinkedUp call eval summary",
    "",
    `Whole-run wall time: ${(wallMs / 1000).toFixed(1)} s`,
    "",
    "| Scenario | Pass | Total |",
    "|---|---|---|",
  ];
  for (const [scenario, entry] of byScenario) {
    lines.push(`| ${scenario} | ${entry.pass} | ${entry.total} |`);
  }
  lines.push(
    "",
    `p95 time-to-first-remote-frame: ${percentile(ttf, 95) ?? "n/a"} ms (n=${ttf.length})`,
    `p95 H-07 10 s-drop recovery: ${percentile(recovery10, 95) ?? "n/a"} ms (n=${recovery10.length})`,
    "",
    "## Environment",
    "",
    ...Object.entries(env).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "Failures:" + (results.some((r) => !r.pass) ? "" : " none"),
    ...(results.some((r) => !r.pass)
      ? results.filter((r) => !r.pass).map((r) => `- ${r.scenario} seed ${r.seed} (${r.transport}): ${r.failure?.message}`)
      : []),
  );
  const summaryPath = path.join(outDir, "summary.md");
  fs.writeFileSync(summaryPath, lines.join("\n") + "\n");
  return { resultsPath, summaryPath };
}
