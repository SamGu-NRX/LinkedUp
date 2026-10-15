/// <reference lib="dom" />
// In-page code below runs in the browser through page.evaluate.
/**
 * Shared scenario helpers. Two hard-won behaviors live here:
 * 1. page.evaluate("() => …") in Playwright 1.64 evaluates the string as an
 *    EXPRESSION — it returns the function object instead of calling it. Every
 *    helper normalizes string sources by invoking them at eval time.
 * 2. joinPair waits for each peer's HONEST phase (the mock reports
 *    `connected` only after real ICE completes), so under shared-sandbox CPU
 *    load the join wait is 30 s — the scenarios' own timing assertions start
 *    after the join, and none of them re-define join latency.
 */
import { loadContracts } from "./contracts.mjs";
import { launchPeer } from "./peers.mjs";
import { decodeRemoteFrame } from "./page-helpers.mjs";

export class ScenarioError extends Error {
  /** @param {string} message @param {unknown} [details] */
  constructor(message, details = null) {
    super(message);
    this.name = "ScenarioError";
    this.details = details;
  }
}

/** Normalize a polling source: a string "(…) => x" is invoked at eval time. */
function normalizedEval(page, source, arg) {
  if (typeof source === "string") return page.evaluate(`(${source})()`, arg);
  return page.evaluate(source, arg);
}

export async function waitFor(peer, source, { timeoutMs = 10000, describe = "condition" } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  for (;;) {
    last = await normalizedEval(peer.page, source);
    if (last) return last;
    if (Date.now() > deadline) {
      throw new ScenarioError(`${peer.peerId}: ${describe} not reached within ${timeoutMs} ms`, { last });
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

export async function waitForValue(peer, source, predicate, { timeoutMs = 10000, describe = "value" } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  for (;;) {
    last = await normalizedEval(peer.page, source);
    if (predicate(last)) return last;
    if (Date.now() > deadline) {
      throw new ScenarioError(`${peer.peerId}: ${describe} not satisfied within ${timeoutMs} ms (last=${JSON.stringify(last)})`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** `[data-call-phase]` on the call root. */
export const phaseIs = (phase) =>
  `() => document.querySelector('[data-call-phase]')?.getAttribute('data-call-phase') === '${phase}'`;

export async function waitAttr(peer, participantId, attr, value, timeoutMs) {
  // The predicate compares the exact expected value: waitFor resolves on
  // truthiness, and getAttribute returns the string "false" — which IS
  // truthy — so a truthiness wait would satisfy a muted check instantly.
  await waitFor(
    peer,
    `() => document.querySelector('[data-testid="remote-media"][data-participant-id="' + ((window.__harnessIds || {})['${participantId}'] ?? '${participantId}') + '"]')?.getAttribute('${attr}') === '${value}'`,
    { timeoutMs, describe: `${attr}=${value} on ${participantId}` },
  );
  return value;
}

export async function click(peer, testId) {
  await peer.page.click(`[data-testid="${testId}"]`);
}

/**
 * Leave the call. The bench leaves on one click; the real call page asks
 * first, so when `leave-call-confirm` appears this confirms it.
 * @param {{ page: import('@playwright/test').Page }} peer
 */
export async function leaveCall(peer) {
  await peer.page.click('[data-testid="leave-call"]');
  const outcome = await peer.page
    .waitForFunction(
      () =>
        document.querySelector('[data-call-phase]')?.getAttribute('data-call-phase') === 'left'
          ? 'left'
          : document.querySelector('[data-testid="leave-call-confirm"]')
            ? 'confirm'
            : null,
      null,
      { timeout: 3000 },
    )
    .then((h) => h.jsonValue())
    .catch(() => null);
  if (outcome === 'confirm') await peer.page.click('[data-testid="leave-call-confirm"]');
}

/**
 * Join A and B against ctx.url with optional query params. The rtcConfig
 * parameter stays undefined unless a caller pins one: when the context has
 * relay enabled (H-07/H-15), ctx.launchPeer then resolves each peer's own
 * relay-only RTCConfiguration through that peer's shaper, so media flows the
 * harness-controlled path. Passing null explicitly also resolves from the
 * context (launchPeer treats null as "no explicit config").
 */
/**
 * @param {import('./context.mjs').RunContext} ctx
 * @param {{ a?: string, b?: string, paramsA?: object, paramsB?: object, rtcConfig?: object | null, timeoutMs?: number }} [opts]
 */
export async function joinPair(ctx, { a = "A", b = "B", paramsA = {}, paramsB = {}, rtcConfig, timeoutMs = 30000 } = {}) {
  const t0 = Date.now();
  const [peerA, peerB] = await Promise.all([
    ctx.launchPeer(a, paramsA, rtcConfig),
    ctx.launchPeer(b, paramsB, rtcConfig),
  ]);
  try {
    // Settle on connected OR failed: a failed page will not recover by
    // itself, so waiting out the full timeout would only slow the run.
    const settled = `() => { const p = document.querySelector('[data-call-phase]')?.getAttribute('data-call-phase'); return p === 'connected' || p === 'failed' ? p : null; }`;
    const phases = await Promise.all([
      waitFor(peerA, settled, { timeoutMs, describe: "phase 'connected'" }),
      waitFor(peerB, settled, { timeoutMs, describe: "phase 'connected'" }),
    ]);
    if (phases.includes("failed")) throw new ScenarioError(`join failed (phases ${phases.join("/")})`);
  } catch (err) {
    const states = await Promise.all([peerA, peerB].map((p) => pageDiagnostics(p).catch((e) => ({ error: String(e) }))));
    throw new ScenarioError(`${err instanceof Error ? err.message : err} | ${JSON.stringify(states)}`);
  }
  return { peerA, peerB, tJoinMs: Date.now() - t0 };
}

/**
 * What a stuck page looks like: phase, error text, tiles and each wrapped pc's states.
 * @param {{ page: import('@playwright/test').Page }} peer
 */
export async function pageDiagnostics(peer) {
  return peer.page.evaluate(async () => {
    const w = /** @type {any} */ (window);
    const pcs = /** @type {RTCPeerConnection[]} */ (w.__wrappedPcs || []);
    /** Candidate types and address kinds per live pc, from getStats. */
    const candidates = [];
    for (const pc of pcs) {
      if (pc.connectionState === "closed") continue;
      const local = [];
      const remote = [];
      const stats = await pc.getStats();
      stats.forEach((/** @type {any} */ r) => {
        if (r.type !== "local-candidate" && r.type !== "remote-candidate") return;
        const addr = String(r.address ?? "");
        const kind = addr.endsWith(".local") ? "mdns" : addr.includes(":") ? "v6" : addr.startsWith("127.") ? "loopback" : addr ? "v4" : "none";
        (r.type === "local-candidate" ? local : remote).push(`${r.candidateType}/${r.protocol}/${kind}`);
      });
      candidates.push({ local: [...new Set(local)], remote: [...new Set(remote)] });
    }
    return {
      url: location.pathname + location.search.replace(/room=[^&]*/, "room=…"),
      phase: document.querySelector("[data-call-phase]")?.getAttribute("data-call-phase") ?? null,
      error: document.querySelector('[data-testid="call-error"]')?.textContent?.slice(0, 160) || null,
      tiles: [...document.querySelectorAll('[data-testid="remote-media"]')].map((t) => t.getAttribute("data-participant-id")),
      pcs: pcs.map((pc) => `${pc.signalingState}/${pc.iceConnectionState}/${pc.connectionState}`),
      candidates,
      // What each live connection was built with: ICE servers (URLs only)
      // and transport policy, to tell "nothing to gather from" apart.
      configs: pcs
        .filter((pc) => pc.connectionState !== "closed")
        .map((pc) => {
          const c = pc.getConfiguration();
          return { policy: c.iceTransportPolicy, servers: (c.iceServers || []).map((s) => s.urls) };
        }),
      probeConfig: w.__probeRtcConfig ? JSON.stringify(w.__probeRtcConfig).slice(0, 200) : null,
      // Can this page gather at all? A fresh connection, 2 s of gathering.
      freshGather: await (async () => {
        try {
          const test = new RTCPeerConnection();
          const found = [];
          test.onicecandidate = (e) => found.push(e.candidate ? e.candidate.type : "end");
          test.createDataChannel("probe");
          await test.setLocalDescription();
          await new Promise((r) => setTimeout(r, 2000));
          const out = { found, state: test.iceGatheringState };
          test.close();
          return out;
        } catch (err) {
          return { error: String(err) };
        }
      })(),
      visibility: document.visibilityState,
      // The p2p transport's event trace (NEXT_PUBLIC_LINKEDUP_CALL_TRACE=1).
      log: (w.__callTraceLog || []).slice(-30),
    };
  });
}

/**
 * H-01's time-to-first-remote-frame: ms from `since` until the first decoded
 * remote frame whose counter parses.
 */
export async function timeToFirstRemoteFrame(peer, participantId, since, deadlineMs = 20000) {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    const frame = await decodeRemoteFrame(peer, participantId);
    if (frame.present && frame.counter?.ok) {
      return { ms: Date.now() - since, at: Date.now() };
    }
    if (Date.now() > deadline) {
      throw new ScenarioError(`${peer.peerId}: no decodable remote frame on ${participantId} within 20 s`, { frame });
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

export async function assertProbePresent(peer) {
  const has = await peer.page.evaluate(() => !!window.__callProbe);
  if (!has) throw new ScenarioError(`${peer.peerId}: __callProbe missing — the init script did not run`, {});
}

export { launchPeer, loadContracts };
