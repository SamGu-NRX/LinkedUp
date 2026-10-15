/**
 * Runtime bridge to lib/scenario-contracts.ts. The runner is plain Node
 * (v20.20.2 — no TS import path here), so the verbatim strings are extracted
 * from the source text with completeness checks; any missing ID fails loudly
 * instead of paraphrasing.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function extractObject(source, name) {
  const start = source.indexOf(`export const ${name}`);
  if (start < 0) throw new Error(`scenario-contracts.ts: ${name} not found`);
  const open = source.indexOf("{", start);
  const close = source.indexOf("} as const;", open);
  if (open < 0 || close < 0) throw new Error(`scenario-contracts.ts: ${name} body not delimited`);
  const body = source.slice(open + 1, close);
  const out = {};
  // "H-01": "..." (or across lines) — plain-object string entries only.
  const entryRe = /"([^"]+)":\s*\n?\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = entryRe.exec(body)) !== null) {
    out[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\n/g, "\n");
  }
  if (Object.keys(out).length === 0) {
    throw new Error(`scenario-contracts.ts: no entries parsed from ${name}`);
  }
  return out;
}

function extractNumberArray(source, name) {
  const re = new RegExp(`export const ${name} = \\[([^\\]]+)\\]`);
  const m = source.match(re);
  if (!m) throw new Error(`scenario-contracts.ts: ${name} not found`);
  return m[1].split(",").map((n) => Number(n.trim()));
}

let cached = null;

export function loadContracts() {
  if (cached) return cached;
  const src = fs.readFileSync(path.join(ROOT, "tools/call-eval/lib/scenario-contracts.ts"), "utf8");
  const H_PASS_CONDITIONS = extractObject(src, "H_PASS_CONDITIONS");
  const P_PASS_CONDITIONS = extractObject(src, "P_PASS_CONDITIONS");
  const H_IDS = Object.keys(H_PASS_CONDITIONS);
  const P_IDS = Object.keys(P_PASS_CONDITIONS);

  const expectedH = Array.from({ length: 16 }, (_, i) => `H-${String(i + 1).padStart(2, "0")}`);
  const expectedP = ["P-01", "P-02", "P-03", "P-04", "P-05"];
  for (const id of expectedH) {
    if (!H_PASS_CONDITIONS[id]) throw new Error(`scenario-contracts.ts: missing verbatim pass condition for ${id}`);
  }
  for (const id of expectedP) {
    if (!P_PASS_CONDITIONS[id]) throw new Error(`scenario-contracts.ts: missing verbatim pass condition for ${id}`);
  }

  cached = {
    H_PASS_CONDITIONS,
    P_PASS_CONDITIONS,
    H_IDS,
    P_IDS,
    TONES: { A: 440, B: 660, C: 880, D: 1100 },
    PEER_COLORS: { A: [205, 35, 35], B: [35, 150, 85], C: [45, 85, 175], D: [210, 150, 30] },
    SECOND_CAMERA_COLOR: extractNumberArray(src, "SECOND_CAMERA_COLOR"),
    COLOR_TOLERANCE: Number(src.match(/export const COLOR_TOLERANCE = (\d+)/)?.[1] ?? 16),
  };
  return cached;
}
