#!/usr/bin/env node
/**
 * LinkedUp call eval: scores the H scenarios on the real call room.
 *
 * Usage (the stack must be up with the journey-proof path and the call
 * trace: `LINKEDUP_JOURNEY_PROOF=1 NEXT_PUBLIC_LINKEDUP_CALL_TRACE=1 pnpm dev:up`):
 *   node tools/call-eval/scripts/run-eval.mjs --base-url=http://localhost:3000 \
 *     [--scenarios=H-01..H-14 | H-01,H-07] [--seeds=1..3 | 1,2] [--out=<dir>]
 *
 * Writes results.json and summary.md under tools/call-eval/out/ (or --out).
 * Exit code 0 only when every run passed.
 */
import path from "node:path";
import { H_IDS, WIRED_H, runScenarios, writeOutputs } from "../runner/run.mjs";

function parseList(raw, universe) {
  if (!raw || raw === "all") return [...WIRED_H];
  if (raw.includes("..")) {
    const [from, to] = raw.split("..");
    const a = universe.indexOf(from.trim());
    const b = universe.indexOf(to.trim());
    if (a === -1 || b === -1) throw new Error(`unknown range bounds in "${raw}"`);
    return universe.slice(Math.min(a, b), Math.max(a, b) + 1);
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseSeeds(raw) {
  if (!raw) return [1];
  if (raw.includes("..")) {
    const [from, to] = raw.split("..").map((s) => Number(s.trim()));
    const out = [];
    for (let i = Math.min(from, to); i <= Math.max(from, to); i++) out.push(i);
    return out;
  }
  return raw.split(",").map((s) => Number(s.trim())).filter(Number.isInteger);
}

const flags = {};
for (const arg of process.argv.slice(2).filter((a) => a !== "--")) {
  const m = arg.match(/^--([a-z-]+)(?:=(.*))?$/i);
  if (!m) throw new Error(`unrecognized argument "${arg}"`);
  flags[m[1]] = m[2] ?? "true";
}
const baseUrl = flags["base-url"];
if (!baseUrl) throw new Error("--base-url is required (the running LinkedUp stack)");
const scenarios = parseList(flags.scenarios, H_IDS);
const seeds = parseSeeds(flags.seeds);

console.log(`call-eval: ${scenarios.length} scenarios x ${seeds.length} seeds on ${baseUrl}`);
const { results, wallMs } = await runScenarios({ scenarios, seeds, baseUrl, log: console.log, write: false });
const outDir = flags.out ? path.resolve(flags.out) : undefined;
const { resultsPath, summaryPath } = await writeOutputs(results, wallMs, outDir ? { outDir } : undefined);
console.log(`results: ${resultsPath}`);
console.log(`summary: ${summaryPath}`);
const failed = results.filter((r) => !r.pass);
console.log(`done in ${(wallMs / 1000).toFixed(1)}s: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
