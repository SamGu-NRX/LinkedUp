#!/usr/bin/env node
// scripts/acceptance/run.mjs — THE single acceptance command (`pnpm test:acceptance`).
//
// One command proves the full local journey end to end:
//   1. boots the project-owned local stack (scripts/dev-up.mjs: Postgres 17 on
//      :54329 migrated by Drizzle, keyless `next dev` on :3000) exactly as
//      Playwright's webServer hook would, so the command is self-contained;
//   2. runs tests/e2e/acceptance.spec.ts — three isolated Chromium contexts
//      with generated media through onboarding, queue pairing, a third-user
//      wait, a cancellation, real two-way media, reload recovery, persisted
//      summaries and full cleanup;
//   3. validates the run's machine-readable evidence FAIL-CLOSED
//      (scripts/acceptance/validate.mjs): a pass needs the remote-media
//      counters and the released-row details in hand, a failure must name its
//      step;
//   4. stops the stack it started.
//
// Exit 0 only when the journey passed AND the evidence is valid. In
// LINKEDUP_ACCEPTANCE_EXPECT_FAIL=<step> mode (used to prove the injection
// contract) exit 0 means the run failed at exactly that named step with
// well-formed evidence; anything else exits non-zero.
//
// Env:
//   LINKEDUP_ACCEPTANCE_EVIDENCE_DIR  where summary.json/evidence.jsonl land
//                                     (default test-results/acceptance)
//   LINKEDUP_ACCEPTANCE_FAIL_AT       inject a failure at a named step
//   LINKEDUP_ACCEPTANCE_EXPECT_FAIL   expect-fail mode (see above)
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { validateRunEvidence } from "./validate.mjs";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const EVIDENCE_DIR =
  process.env.LINKEDUP_ACCEPTANCE_EVIDENCE_DIR ?? "test-results/acceptance";
const EXPECT_FAIL_AT = process.env.LINKEDUP_ACCEPTANCE_EXPECT_FAIL ?? null;

const run = (label, command, args, env) => {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.error) {
    console.error(
      `[acceptance] ${label} could not start: ${result.error.message}`,
    );
    process.exit(2);
  }
  if (result.status !== 0) {
    console.error(`[acceptance] ${label} exited ${result.status}`);
  }
  return result.status ?? 1;
};

const startedAt = new Date().toISOString();
console.log(
  `[acceptance] booting the local stack (Postgres :54329, keyless next dev :3000)…`,
);
const upStatus = run("dev:up", process.execPath, ["scripts/dev-up.mjs"], {
  LINKEDUP_JOURNEY_PROOF: "1",
});

let playwrightStatus = 1;
try {
  if (upStatus === 0) {
    console.log(`[acceptance] running the full-journey acceptance spec…`);
    playwrightStatus = run(
      "playwright",
      process.execPath,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        "tests/e2e/acceptance.spec.ts",
        "--project=desktop",
        "--retries=0",
      ],
      {
        LINKEDUP_JOURNEY_PROOF: "1",
        LINKEDUP_ACCEPTANCE_EVIDENCE_DIR: EVIDENCE_DIR,
        // pass-through by explicit copy so the command's contract is visible
        ...(process.env.LINKEDUP_ACCEPTANCE_FAIL_AT
          ? {
              LINKEDUP_ACCEPTANCE_FAIL_AT:
                process.env.LINKEDUP_ACCEPTANCE_FAIL_AT,
            }
          : {}),
      },
    );
  }
} finally {
  run("dev:down", process.execPath, ["scripts/dev-up.mjs", "--down"], {});
}

const summaryPath = path.join(ROOT, EVIDENCE_DIR, "summary.json");
let summary = null;
if (existsSync(summaryPath)) {
  try {
    summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  } catch (error) {
    console.error(
      `[acceptance] summary.json is not valid JSON: ${error.message}`,
    );
  }
} else {
  console.error(`[acceptance] no summary.json at ${summaryPath}`);
}

const verdict = validateRunEvidence(summary, { expectFailAt: EXPECT_FAIL_AT });
// Fail closed on the test runner's own exit: in normal mode the Playwright
// run must succeed; in expect-fail mode the injected failure must actually
// fail it. Evidence validity alone never proves the journey.
const runnerStatusOk = EXPECT_FAIL_AT
  ? playwrightStatus !== 0
  : playwrightStatus === 0;
const report = {
  command: "pnpm test:acceptance",
  startedAt,
  finishedAt: new Date().toISOString(),
  expectFailAt: EXPECT_FAIL_AT,
  playwrightStatus,
  evidence: {
    summary: EVIDENCE_DIR ? path.join(EVIDENCE_DIR, "summary.json") : null,
  },
  validation: verdict,
  passed: upStatus === 0 && runnerStatusOk && verdict.valid,
};
console.log(`[acceptance] ${JSON.stringify(report, null, 2)}`);

if (!report.passed) {
  console.error(
    `[acceptance] FAILED — the acceptance run did not prove the journey:`,
  );
  for (const failure of verdict.failures)
    console.error(`[acceptance]   - ${failure}`);
  process.exit(1);
}
console.log(
  EXPECT_FAIL_AT
    ? `[acceptance] PASS (expect-fail mode): the injected failure failed the run at the named step "${EXPECT_FAIL_AT}".`
    : `[acceptance] PASS: the full local journey is proven. Evidence in ${EVIDENCE_DIR}/.`,
);
