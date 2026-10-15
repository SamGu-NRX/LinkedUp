// tests/e2e/helpers/acceptance.ts — step evidence for the single acceptance
// command (tests/e2e/acceptance.spec.ts).
//
// The run records one machine-readable JSONL line per step plus a final
// summary.json: step name, status, duration, and the concrete counters or
// row values that PROVE the step (remote-media carries RTP byte and video
// frame evidence; cleanup carries the released rows). A run that fails names
// the failing step. LINKEDUP_ACCEPTANCE_FAIL_AT=<step> injects a failure at
// that named step, and the evidence must name it back — that is how the
// fail-closed behaviour is proved, not asserted in prose.
//
// Evidence destination: LINKEDUP_ACCEPTANCE_EVIDENCE_DIR, default
// test-results/acceptance. scripts/acceptance/validate.mjs (unit-tested)
// decides whether a summary may pass.
import { mkdir, appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

export interface AcceptanceStep {
  name: string;
  status: "passed" | "failed";
  startedAt: string;
  durationMs: number;
  detail?: unknown;
  error?: string;
}

export interface AcceptanceFailure {
  step: string;
  message: string;
}

const cleanError = (message: string | undefined) =>
  (message ?? "unknown error").replace(/\u001b\[[0-9;]*m/g, "").slice(0, 800);

/**
 * The RTCPeerConnection/getUserMedia probe, injected per context (the
 * tools/call-eval contract — the same template normal-route.spec.ts uses).
 */
export const PROBE_INIT = (() => {
  const source = readFileSync(path.resolve(__dirname, "../../../tools/call-eval/runner/probe.mjs"), "utf8");
  const start = source.indexOf("export const probeInit = String.raw`");
  if (start === -1) throw new Error("probe.mjs: no probeInit template found");
  const bodyStart = start + "export const probeInit = String.raw`".length;
  const end = source.indexOf("\n`;", bodyStart);
  if (end === -1) throw new Error("probe.mjs: unterminated probeInit template");
  return source.slice(bodyStart, end);
})();

export class AcceptanceRun {
  private readonly steps: AcceptanceStep[] = [];
  private readonly evidenceFile: string;
  private readonly summaryFile: string;
  private readonly notes: Record<string, unknown> = {};
  private current = "";
  failure: AcceptanceFailure | null = null;

  constructor(dir = process.env.LINKEDUP_ACCEPTANCE_EVIDENCE_DIR ?? "test-results/acceptance") {
    this.evidenceFile = path.join(dir, "evidence.jsonl");
    this.summaryFile = path.join(dir, "summary.json");
  }

  /** Arbitrary journey facts (route, room id, personas) carried in the summary. */
  note(key: string, value: unknown): void {
    this.notes[key] = value;
  }

  /**
   * Records a step: duration, JSONL line appended immediately (a crashed run
   * keeps the steps it completed), and the step's proving detail. A step that
   * throws is recorded failed with its message and rethrows.
   */
  async step<T>(name: string, body: () => Promise<T>): Promise<T> {
    if (this.current) throw new Error(`step ${JSON.stringify(name)} started inside ${JSON.stringify(this.current)}`);
    this.current = name;
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const entry: AcceptanceStep = { name, status: "failed", startedAt, durationMs: 0 };
    this.steps.push(entry);
    try {
      const result = await body();
      entry.status = "passed";
      entry.durationMs = Date.now() - started;
      if (result !== undefined) entry.detail = result;
      await this.append(entry);
      this.current = "";
      return result;
    } catch (error) {
      entry.status = "failed";
      entry.durationMs = Date.now() - started;
      entry.error = cleanError(error instanceof Error ? error.message : String(error));
      await this.append(entry);
      this.current = "";
      if (!this.failure) this.failure = { step: name, message: entry.error };
      throw error;
    }
  }

  private async append(entry: AcceptanceStep): Promise<void> {
    await mkdir(path.dirname(this.evidenceFile), { recursive: true });
    await appendFile(this.evidenceFile, `${JSON.stringify(entry)}\n`);
  }

  /**
   * Writes summary.json from the final Playwright test state. Injected
   * failures (LINKEDUP_ACCEPTANCE_FAIL_AT) are recorded on the summary so the
   * validator can demand the run failed at exactly that step.
   */
  async finalize(input: {
    testStatus: string | undefined;
    testError?: string | undefined;
    startedAt: string;
    injectedFailAt: string | null;
  }): Promise<void> {
    const failed = input.testStatus !== "passed";
    const failure = failed
      ? this.failure ?? { step: "unknown", message: cleanError(input.testError) }
      : null;
    const summary = {
      command: "pnpm test:acceptance",
      spec: "tests/e2e/acceptance.spec.ts",
      startedAt: input.startedAt,
      finishedAt: new Date().toISOString(),
      status: failed ? "failed" : "passed",
      failure,
      injectedFailure: input.injectedFailAt,
      route: this.notes.route,
      journey: this.notes,
      steps: this.steps,
    };
    await mkdir(path.dirname(this.summaryFile), { recursive: true });
    await writeFile(this.summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
  }
}

/**
 * Runs one acceptance step under the injection contract: when
 * LINKEDUP_ACCEPTANCE_FAIL_AT names this step, the step fails with a clear
 * injected marker before the real body runs, so the evidence names the step.
 */
export async function acceptanceStep<T>(
  run: AcceptanceRun,
  name: string,
  injectedFailAt: string | null,
  body: () => Promise<T>,
): Promise<T> {
  if (injectedFailAt === name) {
    return run.step(name, async () => {
      throw new Error(`injected failure at step "${name}" (LINKEDUP_ACCEPTANCE_FAIL_AT)`);
    });
  }
  return run.step(name, body);
}

/** Inbound audio RTP bytes summed over every wrapped peer connection. */
async function inboundAudioBytes(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const pcs = (window as unknown as { __wrappedPcs?: RTCPeerConnection[] }).__wrappedPcs ?? [];
    let total = 0;
    for (const pc of pcs) {
      for (const receiver of pc.getReceivers()) {
        if (receiver.track?.kind !== "audio") continue;
        const stats = await receiver.getStats();
        stats.forEach((s) => {
          if (s.type === "inbound-rtp" && typeof (s as RTCInboundRtpStreamStats).bytesReceived === "number") {
            total += (s as RTCInboundRtpStreamStats).bytesReceived!;
          }
        });
      }
    }
    return total;
  });
}

/** True when the remote <video> keeps advancing (frames still arriving). */
async function remoteVideoAdvances(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const v = document.querySelector('[data-testid="remote-media"] video') as HTMLVideoElement | null;
        if (!v) {
          resolve(false);
          return;
        }
        const t0 = v.currentTime;
        setTimeout(() => resolve(v.currentTime > t0), 700);
      }),
  );
}

/**
 * The remote-media evidence for one side: peer connections observed, inbound
 * audio bytes growing, remote video frames advancing. All three must hold —
 * the validator fails the run on any missing counter, so absent remote media
 * can never present as a pass.
 */
export async function remoteMediaSideDetail(page: Page): Promise<{
  peerConnections: boolean;
  audioBytesBefore: number;
  audioBytesAfter: number;
  audioBytesGrew: boolean;
  videoFramesAdvanced: boolean;
}> {
  const peerCount = await page.evaluate(() => (window as unknown as { __wrappedPcs?: RTCPeerConnection[] }).__wrappedPcs?.length ?? 0);
  const before = await inboundAudioBytes(page);
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  const after = await inboundAudioBytes(page);
  const videoFramesAdvanced = await remoteVideoAdvances(page);
  return {
    peerConnections: peerCount > 0,
    audioBytesBefore: before,
    audioBytesAfter: after,
    audioBytesGrew: after > before,
    videoFramesAdvanced,
  };
}


