// tests/unit/acceptance-evidence.test.ts — the fail-closed contract of the
// acceptance command's evidence validator (scripts/acceptance/validate.mjs).
//
// These tests pin what "passed" is allowed to mean: absent remote-media
// evidence, absent cleanup evidence, a failure without a named step, or a
// swallowed failure injection can never validate.
import { describe, expect, it } from "vitest";
import { REQUIRED_PASSED_STEPS, validateRunEvidence } from "../../scripts/acceptance/validate.mjs";

const remoteMediaDetail = () => ({
  a: { peerConnections: true, audioBytesBefore: 100, audioBytesAfter: 900, audioBytesGrew: true, videoFramesAdvanced: true },
  b: { peerConnections: true, audioBytesBefore: 120, audioBytesAfter: 980, audioBytesGrew: true, videoFramesAdvanced: true },
});

const cleanupDetail = () => ({
  roomEnded: true,
  roomEndedAt: true,
  openSessions: 0,
  exitedEntries: [{ user_id: 1, status: "exited" }, { user_id: 2, status: "exited" }],
});

/** A well-formed PASSED summary; individual tests mutate the weak spot. */
function healthySummary(overrides: Record<string, unknown> = {}) {
  return {
    command: "pnpm test:acceptance",
    status: "passed",
    failure: null,
    injectedFailure: null,
    route: "proof",
    journey: {},
    steps: [
      { name: "onboarding-signup", status: "passed", startedAt: "t", durationMs: 1 },
      { name: "onboarding-rows", status: "passed", startedAt: "t", durationMs: 1 },
      { name: "queue-pair", status: "passed", startedAt: "t", durationMs: 1 },
      { name: "third-user-waits", status: "passed", startedAt: "t", durationMs: 1 },
      { name: "cancellation", status: "passed", startedAt: "t", durationMs: 1 },
      { name: "remote-media", status: "passed", startedAt: "t", durationMs: 1, detail: remoteMediaDetail() },
      { name: "cleanup-released", status: "passed", startedAt: "t", durationMs: 1, detail: cleanupDetail() },
    ],
    ...overrides,
  };
}

describe("acceptance evidence validation (fail-closed)", () => {
  it("accepts a well-formed passing run", () => {
    const verdict = validateRunEvidence(healthySummary());
    expect(verdict.valid).toBe(true);
    expect(verdict.failures).toEqual([]);
  });

  it("requires evidence at all", () => {
    for (const empty of [null, undefined, {}, [], "junk"]) {
      expect(validateRunEvidence(empty).valid).toBe(false);
    }
  });

  it("fails a pass whose remote-media step carries no counter detail", () => {
    const summary = healthySummary();
    delete (summary.steps.find((s) => s.name === "remote-media") as Record<string, unknown>).detail;
    const verdict = validateRunEvidence(summary);
    expect(verdict.valid).toBe(false);
    expect(verdict.failures.some((f) => f.includes("no counter detail"))).toBe(true);
  });

  it("fails a pass where remote audio did not grow on either side", () => {
    for (const side of ["a", "b"]) {
      const summary = healthySummary();
      const detail = remoteMediaDetail() as Record<string, Record<string, unknown>>;
      detail[side].audioBytesGrew = false;
      (summary.steps.find((s) => s.name === "remote-media") as Record<string, unknown>).detail = detail;
      const verdict = validateRunEvidence(summary);
      expect(verdict.valid).toBe(false);
      expect(verdict.failures.some((f) => f.includes(`${side}: inbound audio RTP bytes did not grow`))).toBe(true);
    }
  });

  it("fails a pass where no peer connections were observed", () => {
    const summary = healthySummary();
    const detail = remoteMediaDetail() as Record<string, Record<string, unknown>>;
    detail.a.peerConnections = false;
    (summary.steps.find((s) => s.name === "remote-media") as Record<string, unknown>).detail = detail;
    expect(validateRunEvidence(summary).valid).toBe(false);
  });

  it("fails a pass whose cleanup step carries no row detail", () => {
    const summary = healthySummary();
    delete (summary.steps.find((s) => s.name === "cleanup-released") as Record<string, unknown>).detail;
    expect(validateRunEvidence(summary).valid).toBe(false);
  });

  it("fails a pass with an open call session or an unreleased entry", () => {
    const open = healthySummary();
    (open.steps.find((s) => s.name === "cleanup-released") as Record<string, unknown>).detail = {
      ...cleanupDetail(),
      openSessions: 1,
    };
    expect(validateRunEvidence(open).valid).toBe(false);

    const dangling = healthySummary();
    (dangling.steps.find((s) => s.name === "cleanup-released") as Record<string, unknown>).detail = {
      ...cleanupDetail(),
      exitedEntries: [{ user_id: 1, status: "exited" }],
    };
    expect(validateRunEvidence(dangling).valid).toBe(false);
  });

  it("requires every declared required step", () => {
    for (const required of REQUIRED_PASSED_STEPS) {
      const summary = healthySummary();
      summary.steps = summary.steps.filter((s) => s.name !== required);
      const verdict = validateRunEvidence(summary);
      expect(verdict.valid).toBe(false);
      expect(verdict.failures.some((f) => f.includes(required))).toBe(true);
    }
  });

  it("demands a named step from a failing run", () => {
    const unnamed = healthySummary({ status: "failed", failure: null });
    expect(validateRunEvidence(unnamed).valid).toBe(false);

    const ghost = healthySummary({ status: "failed", failure: { step: "remote-media", message: "x" } });
    ghost.steps = ghost.steps.filter((s) => s.name !== "remote-media");
    expect(validateRunEvidence(ghost).valid).toBe(false);
  });

  it("rejects an injected failure that was swallowed into a pass", () => {
    const swallowed = healthySummary({ injectedFailure: "cleanup-released" });
    expect(validateRunEvidence(swallowed).valid).toBe(false);
  });

  it("in expect-fail mode accepts only a run that failed at exactly the named step", () => {
    const good = healthySummary({
      status: "failed",
      failure: { step: "remote-media", message: 'injected failure at step "remote-media"' },
      injectedFailure: "remote-media",
    });
    const step = good.steps.find((s) => s.name === "remote-media") as Record<string, unknown>;
    step.status = "failed";
    step.error = 'injected failure at step "remote-media" (LINKEDUP_ACCEPTANCE_FAIL_AT)';
    expect(validateRunEvidence(good, { expectFailAt: "remote-media" }).valid).toBe(true);

    // Wrong step named, run passed anyway, or evidence line missing: invalid.
    expect(validateRunEvidence(good, { expectFailAt: "cleanup-released" }).valid).toBe(false);
    expect(validateRunEvidence(healthySummary(), { expectFailAt: "remote-media" }).valid).toBe(false);
    const missing = healthySummary({ status: "failed", failure: { step: "remote-media", message: "x" } });
    missing.steps = missing.steps.filter((s) => s.name !== "remote-media");
    expect(validateRunEvidence(missing, { expectFailAt: "remote-media" }).valid).toBe(false);
  });

  it("records the route either way", () => {
    expect(validateRunEvidence(healthySummary({ route: undefined })).valid).toBe(false);
    expect(validateRunEvidence(healthySummary({ route: "normal" })).valid).toBe(true);
  });
});
