#!/usr/bin/env node
/** Owns a disposable TURN relay and the :3202 app process for the call-network proof. */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createTurn } from "../runner/turn.mjs";
import { runScenarios, writeOutputs } from "../runner/run.mjs";

const root = process.cwd();
const scenarios = (process.argv.find((arg) => arg.startsWith("--scenarios="))?.split("=")[1] ?? "H-17,H-01").split(",");
const seeds = (process.argv.find((arg) => arg.startsWith("--seeds="))?.split("=")[1] ?? "1,2,3").split(",").map(Number);
if (!seeds.every((seed) => Number.isSafeInteger(seed) && seed > 0)) throw new Error("Seeds must be positive integers.");
const outDir = path.resolve(root, process.argv.find((arg) => arg.startsWith("--out="))?.slice(6) ?? "docs/lane2/verification");
const baseUrl = "http://localhost:3202";
const databaseUrl = "postgresql://postgres@127.0.0.1:54329/linkedup_turn";
// Neither a server already on the port nor an inherited tenant may enter this proof.
if (await fetch(baseUrl, { signal: AbortSignal.timeout(1000) }).then(() => true, () => false)) throw new Error("Port 3202 is already in use.");
const secret = randomBytes(32).toString("base64url");
const relay = await createTurn({ sharedSecret: secret });
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(?:NEXT_PUBLIC_)?CLERK_|^TURN_/.test(key)) delete env[key];
Object.assign(env, {
  DATABASE_URL: databaseUrl,
  LINKEDUP_JOURNEY_PROOF: "1", NEXT_PUBLIC_LINKEDUP_CALL_TRACE: "1",
  TURN_SHARED_SECRET: secret, TURN_URLS: `turn:127.0.0.1:${relay.port}?transport=udp`,
});
process.env.LINKEDUP_EVAL_DATABASE_URL = databaseUrl;
fs.mkdirSync(".local", { recursive: true });
const output = fs.openSync(".local/turn-proof-next.log", "a");
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", "3202"], { cwd: root, env, stdio: ["ignore", output, output] });
try {
  const deadline = Date.now() + 120_000;
  while (!await fetch(`${baseUrl}/sign-in`, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok, () => false)) {
    if (server.exitCode !== null) throw new Error("Next exited; inspect .local/turn-proof-next.log locally.");
    if (Date.now() > deadline) throw new Error("Next readiness timed out; inspect .local/turn-proof-next.log locally.");
    await new Promise((r) => setTimeout(r, 500));
  }
  const { results, wallMs } = await runScenarios({ scenarios, seeds, baseUrl, turn: relay, write: false });
  await writeOutputs(results, wallMs, { outDir });
  console.log(`Call proof: ${results.filter((r) => r.pass).length}/${results.length} passed`);
  if (results.some((r) => !r.pass)) process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise((r) => server.once("exit", r)), new Promise((r) => setTimeout(r, 5000))]);
  if (server.exitCode === null) server.kill("SIGKILL");
  fs.closeSync(output);
  relay.stop();
}
