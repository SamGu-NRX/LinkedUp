// scripts/acceptance/validate.mjs — fail-closed validation of the acceptance
// run's machine-readable evidence (tests/e2e/acceptance.spec.ts writes it).
//
// The acceptance command is only allowed to pass when the evidence proves the
// things that must never be vacuous: remote media really flowed (counter
// detail present and growing on both sides) and the app really released every
// row (cleanup step). A run that fails must name the step that failed. An
// injected failure (LINKEDUP_ACCEPTANCE_FAIL_AT) must fail the run at exactly
// the named step — evidence that hides or swallows it is invalid.
//
// Pure module: no imports, no I/O. tests/unit/acceptance-evidence.test.ts
// pins this contract.

/** Steps whose absence can never yield a valid "passed" run. */
export const REQUIRED_PASSED_STEPS = ["remote-media", "cleanup-released"];

/**
 * @param {unknown} summary  Parsed contents of summary.json (or null/unparsed).
 * @param {{ expectFailAt?: string | null }} [options]
 *   expectFailAt: expect-fail mode — the run is valid when it FAILED at
 *   exactly this named step (used to prove failure injection fails the run).
 * @returns {{ valid: boolean; failures: string[] }}
 */
export function validateRunEvidence(summary, options = {}) {
  const expectFailAt = options.expectFailAt ?? null;
  const failures = [];
  const fail = (message) => failures.push(message);

  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return {
      valid: false,
      failures: ["evidence summary is missing or not an object — the run produced no machine-readable evidence"],
    };
  }

  const steps = Array.isArray(summary.steps) ? summary.steps : null;
  if (!steps || steps.length === 0) fail("evidence carries no steps");
  if (summary.route !== "normal" && summary.route !== "proof") {
    fail(`route must be recorded as "normal" or "proof", got ${JSON.stringify(summary.route)}`);
  }

  const stepByName = new Map();
  if (steps) {
    for (const step of steps) {
      if (step && typeof step.name === "string" && step.name) stepByName.set(step.name, step);
      else fail("a step entry lacks a name");
    }
  }

  if (expectFailAt !== null) {
    // Expect-fail mode: the ONLY valid shape is a failed run that names the
    // expected step and shows it as the failed step in the evidence.
    if (summary.status !== "failed") {
      fail(`expect-fail mode: status must be "failed", got ${JSON.stringify(summary.status)}`);
    }
    const failure = summary.failure;
    if (!failure || typeof failure !== "object") {
      fail("expect-fail mode: failure object missing — the run did not record a named failure");
    } else if (failure.step !== expectFailAt) {
      fail(
        `expect-fail mode: failure.step is ${JSON.stringify(failure.step)}, expected ${JSON.stringify(expectFailAt)}`,
      );
    }
    const failedStep = stepByName.get(expectFailAt);
    if (!failedStep) {
      fail(`expect-fail mode: no evidence line for step ${JSON.stringify(expectFailAt)}`);
    } else if (failedStep.status !== "failed") {
      fail(
        `expect-fail mode: step ${JSON.stringify(expectFailAt)} is recorded as ${JSON.stringify(failedStep.status)}, expected "failed"`,
      );
    }
    return { valid: failures.length === 0, failures };
  }

  if (summary.status === "failed") {
    const failure = summary.failure;
    if (!failure || typeof failure !== "object" || typeof failure.step !== "string" || !failure.step) {
      fail('a failed run must name the step that failed: failure.step is missing');
    } else {
      const failedStep = stepByName.get(failure.step);
      if (!failedStep) {
        fail(`failure names step ${JSON.stringify(failure.step)} but no evidence line records it`);
      } else if (failedStep.status !== "failed") {
        fail(
          `failure names step ${JSON.stringify(failure.step)} but that step is recorded as ${JSON.stringify(failedStep.status)}`,
        );
      }
    }
  } else if (summary.status === "passed") {
    for (const required of REQUIRED_PASSED_STEPS) {
      const step = stepByName.get(required);
      if (!step) {
        fail(`status is "passed" but required step ${JSON.stringify(required)} has no evidence line`);
      } else if (step.status !== "passed") {
        fail(`status is "passed" but required step ${JSON.stringify(required)} is ${JSON.stringify(step.status)}`);
      }
    }
    // Fail closed on absent remote media: the pass claim must carry the
    // counters themselves, not just a green step name.
    const media = stepByName.get("remote-media");
    const detail = media && media.detail && typeof media.detail === "object" ? media.detail : null;
    if (!detail) {
      fail("remote-media step carries no counter detail — absent remote-media evidence fails the run");
    } else {
      for (const side of ["a", "b"]) {
        const sideDetail = detail[side] && typeof detail[side] === "object" ? detail[side] : null;
        if (!sideDetail) {
          fail(`remote-media detail lacks side ${JSON.stringify(side)}`);
          continue;
        }
        if (sideDetail.peerConnections !== true) {
          fail(`remote-media ${side}: no RTCPeerConnections observed (media could not have flowed)`);
        }
        if (sideDetail.audioBytesGrew !== true) {
          fail(`remote-media ${side}: inbound audio RTP bytes did not grow — remote audio absent`);
        }
        if (sideDetail.videoFramesAdvanced !== true) {
          fail(`remote-media ${side}: remote video frames did not advance — remote video absent`);
        }
      }
    }
    // Fail closed on absent cleanup: the release claim must carry the rows.
    const cleanup = stepByName.get("cleanup-released");
    const cleanupDetail = cleanup && cleanup.detail && typeof cleanup.detail === "object" ? cleanup.detail : null;
    if (!cleanupDetail) {
      fail("cleanup-released step carries no row detail — absent cleanup evidence fails the run");
    } else {
      if (cleanupDetail.roomEnded !== true) fail("cleanup detail: roomEnded is not true");
      if (cleanupDetail.roomEndedAt !== true) fail("cleanup detail: roomEndedAt is not true");
      if (cleanupDetail.openSessions !== 0) {
        fail(`cleanup detail: openSessions is ${JSON.stringify(cleanupDetail.openSessions)}, expected 0`);
      }
      if (!Array.isArray(cleanupDetail.exitedEntries) || cleanupDetail.exitedEntries.length !== 2) {
        fail("cleanup detail: exitedEntries must list both participants' released queue entries");
      }
    }
  } else {
    fail(`status must be "passed" or "failed", got ${JSON.stringify(summary.status)}`);
  }

  if (summary.injectedFailure && summary.status !== "failed") {
    fail("injectedFailure is recorded but the run claims success — the injection was swallowed");
  }

  return { valid: failures.length === 0, failures };
}
