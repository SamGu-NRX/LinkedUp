/// <reference lib="dom" />
// In-page code below runs in the browser through page.evaluate.
/**
 * H-01..H-16. Every function is named scenario_<id> (the orchestrator binds
 * by name) and returns the plan-schema measurement object for its result
 * entry. Pass conditions live verbatim in lib/scenario-contracts.ts and are
 * echoed by the summary; the assertions below implement them.
 */
import {
  ScenarioError,
  waitFor,
  waitForValue,
  phaseIs,
  waitAttr,
  click,
  leaveCall,
  joinPair,
  timeToFirstRemoteFrame,
  assertProbePresent,
  pageDiagnostics,
} from "./scenario-kit.mjs";
import { killPeerTab } from "./peers.mjs";
import fs from "node:fs";
import { captureCallStates, keyboardCallPass, scenarioIceExhaustion } from "./ice-states.mjs";
import { loadContracts } from "./contracts.mjs";
import {
  classifyRemoteColor,
  decodeRemoteFrame,
  matchPeerColor,
  peerPalette,
  sampleRemoteTone,
  measureFps,
  collectRtpStatsWindow,
  probeState,
  decoderBundle,
  toneMatches,
  toneIsSilent,
  selectedCandidateTypes,
  waitForSilence,
  waitForLiveMedia,
} from "./page-helpers.mjs";

const H = (ms) => new Promise((r) => setTimeout(r, ms));

const tileCount = (participantId) =>
  `() => document.querySelectorAll('[data-testid="remote-media"][data-participant-id="' + ((window.__harnessIds || {})['${participantId}'] ?? '${participantId}') + '"]').length`;

const tileCountAll = `() => document.querySelectorAll('[data-testid="remote-media"]').length`;

// page.evaluate() given a string evaluates it as an expression: a function
// source comes back as the function itself (serialized as undefined), never
// called. Every direct evaluate of these sources wraps them as "(src)()".

/** Milliseconds left until `deadline`, never below 1 (a wait needs a positive timeout). */
const left = (/** @type {number} */ deadline) => Math.max(1, deadline - Date.now());

// Node-side color assertions go through one page-side hook wrapping the pinned
// decoder bundle; tolerant classification per the S0b cross-thread note.
async function installColorHook(peer) {
  const bundleSrc = await decoderBundle();
  const { PEER_COLORS, SECOND_CAMERA_COLOR, COLOR_TOLERANCE } = loadContracts();
  // The hook classifies against the peer palette with the contract tolerance
  // and returns { ok, label, distance } (plus the raw color for evidence):
  // the reviewed bug returned the raw decoder RGB, so H-05's `c.ok &&
  // c.label === "second-camera"` could never see the expected shape.
  const palette = peerPalette(PEER_COLORS, SECOND_CAMERA_COLOR);
  await peer.page.evaluate(`((bundleSrc, palette, tolerance, classifySrc) => {
    if (window.__decodeRemoteColor) return;
    const classify = new Function('return ' + classifySrc)();
    window.__decodeRemoteColor = async (participantId) => {
      const decoders = new Function(bundleSrc + "\\nreturn { decodeBarcodeColor };")();
      const pid = (window.__harnessIds || {})[participantId] ?? participantId;
      const tile = document.querySelector('[data-testid="remote-media"][data-participant-id="' + pid + '"]');
      const video = tile?.querySelector("video");
      if (!video || !video.videoWidth) return { ok: false, label: "none", distance: 999 };
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, Math.min(200, canvas.height));
      const color = decoders.decodeBarcodeColor(data);
      return { ...classify(color, palette, tolerance), color };
    };
  })(${JSON.stringify(bundleSrc)}, ${JSON.stringify(palette)}, ${COLOR_TOLERANCE}, ${JSON.stringify(classifyRemoteColor.toString())})`);
}

/** H-01 — each decodes the other's barcode color within 5 s; remote frames advance at >= 15 fps over 5 s */
export async function scenario_H_01(ctx, { log }) {
  // The contract's 5 s bar runs from the moment joining begins (the join
  // click; auto-join fires at page mount) — the reviewed bug started the
  // clock after both peers were already connected and never enforced the
  // deadline at all.
  const tLaunch = Date.now();
  const { peerA, peerB, tJoinMs } = await joinPair(ctx);
  // On LinkedUp the join click is "Join the call" on the match screen
  // (sign-in and the queue come before it); the page joins as it loads.
  const t0 = Math.min(peerA.joinClickAt ?? tLaunch, peerB.joinClickAt ?? tLaunch);
  await assertProbePresent(peerA);
  await assertProbePresent(peerB);
  await installColorHook(peerA);
  await installColorHook(peerB);

  const aSeesB = await timeToFirstRemoteFrame(peerA, "B", t0, 5000);
  const bSeesA = await timeToFirstRemoteFrame(peerB, "A", t0, 5000);
  if (aSeesB.ms > 5000 || bSeesA.ms > 5000) {
    throw new ScenarioError(`H-01: time to first remote frame exceeded the 5 s bar (A ${aSeesB.ms} ms, B ${bSeesA.ms} ms)`, { aSeesB, bSeesA });
  }

  // Each side must decode the other's colour within the same 5 s from the
  // join. The first frames come from an encoder still ramping up and can
  // sit just outside the tolerance, so keep decoding until the bar, rather
  // than judging one early frame.
  /** @param {any} peer @param {string} from @param {string} want */
  async function colourWithin(peer, from, want) {
    let last = null;
    for (;;) {
      const frame = await decodeRemoteFrame(peer, from);
      last = frame.present ? matchPeerColor(frame.color) : null;
      if (last?.ok && last.label === want) return { ms: Date.now() - t0, distance: last.distance };
      if (Date.now() - t0 > 5000) {
        throw new ScenarioError(`H-01: ${peer.peerId}'s view of ${from} classified as ${last?.label ?? "nothing"} (distance ${last?.distance ?? "n/a"}) at the 5 s bar`, { frame });
      }
      await H(100);
    }
  }
  const colourB = await colourWithin(peerA, "B", "B"); // A's view of B must be B's green
  const colourA = await colourWithin(peerB, "A", "A");

  const fpsA = await measureFps(peerA, "B", 5000); // A receiving B
  const fpsB = await measureFps(peerB, "A", 5000);
  if (fpsA.fps < 15 || fpsB.fps < 15) {
    throw new ScenarioError(`H-01: fps below 15 (A sees ${fpsA.fps}, B sees ${fpsB.fps})`, { fpsA, fpsB });
  }
  log(`H-01 join ${tJoinMs} ms, first frame ${aSeesB.ms}/${bSeesA.ms} ms, fps ${fpsA.fps}/${fpsB.fps}`);
  return {
    joinMs: tJoinMs,
    timeToFirstRemoteFrameMs: aSeesB.ms,
    timeToFirstRemoteFrameMsReverse: bSeesA.ms,
    fpsAtoB: fpsA.fps,
    fpsBtoA: fpsB.fps,
    colourMsAseesB: colourB.ms,
    colourMsBseesA: colourA.ms,
  };
}

/** H-02 — each receiver's analyser peak is the sender's tone +-10 Hz within 3 s */
export async function scenario_H_02(ctx) {
  const { peerA, peerB } = await joinPair(ctx);

  async function toneWithin(peer, from, expected, timeoutMs = 3000) {
    const deadline = Date.now() + timeoutMs;
    let last = null;
    for (;;) {
      last = await sampleRemoteTone(peer, from, 400); // jitter-buffer settle: stale pre-join samples read as silence
      // decodeToneHz returns { peakHz, rms } — the reviewed bug did
      // arithmetic on the object (NaN), so no healthy call ever matched.
      if (toneMatches(last, expected)) return last.peakHz;
      if (Date.now() > deadline) {
        const heard = last ? `${last.peakHz} Hz (rms ${last.rms})` : "silence";
        throw new ScenarioError(`H-02: ${peer.peerId} heard ${heard}, expected ${expected}±10 Hz from ${from}`);
      }
      await H(200);
    }
  }

  const aHears = await toneWithin(peerA, "B", 660);
  const bHears = await toneWithin(peerB, "A", 440);
  return { aHearsB: aHears, bHearsA: bHears };
}

/** H-03 — remote data-audio-muted flips within 1 s; received tone energy falls below threshold; unmute restores both */
export async function scenario_H_03(ctx) {
  const { peerA, peerB } = await joinPair(ctx);

  const t0 = Date.now();
  await click(peerA, "toggle-mic");
  await waitAttr(peerB, "A", "data-audio-muted", "true", 1000);
  const muteFlipMs = Date.now() - t0;

  // No tone energy while muted, within the same 1 s bar as the attribute.
  // Polling matters: the attribute arrives over signaling before the last
  // unmuted audio has drained from the receiver (see waitForSilence).
  const silence = await waitForSilence(() => sampleRemoteTone(peerB, "A", 150), { deadlineMs: 1000 });
  if (!silence.silent) {
    throw new ScenarioError(
      `H-03: muted remote still produced energy ${silence.afterMs} ms after mute (peak ${silence.last?.peakHz} Hz, rms ${silence.last?.rms})`,
      { silence },
    );
  }
  const silentAfterMs = Date.now() - t0;

  const t1 = Date.now();
  await click(peerA, "toggle-mic");
  await waitAttr(peerB, "A", "data-audio-muted", "false", 1000);
  const unmuteFlipMs = Date.now() - t1;

  const deadline = Date.now() + 3000;
  let restored = null;
  for (;;) {
    restored = await sampleRemoteTone(peerB, "A", 500);
    if (toneMatches(restored, 440)) break; // reads restored.peakHz (the reviewed NaN bug compared the object)
    if (Date.now() > deadline) {
      const heard = restored ? `${restored.peakHz} Hz (rms ${restored.rms})` : "silence";
      throw new ScenarioError(`H-03: unmute did not restore the 440 Hz tone (last ${heard})`);
    }
    await H(200);
  }
  return { muteFlipMs, silentAfterMs, unmuteFlipMs, restoredToneHz: restored.peakHz };
}

/** H-04 — remote data-video-off flips within 1 s; the sender's capture track is ended (camera released); on resumes frames */
export async function scenario_H_04(ctx) {
  const { peerA, peerB } = await joinPair(ctx);

  // Capture A's OWN capture tracks before toggling: window.__h11tracks is
  // only ever set by H-11's pre-leave capture, so H-04's read was always []
  // and the ended-track assertion compared against nothing (reviewed bug).
  await peerA.page.evaluate(`(() => {
    window.__h04tracks = [...(document.querySelector('[data-testid="local-video"]')?.srcObject?.getTracks() ?? [])];
  })()`);

  const t0 = Date.now();
  await click(peerA, "toggle-camera");
  await waitAttr(peerB, "A", "data-video-off", "true", 1000);
  const offFlipMs = Date.now() - t0;

  const trackStates = await peerA.page.evaluate(`(() => (window.__h04tracks ?? []).map(t => t.readyState))()`);
  if (trackStates.length === 0 || !trackStates.includes("ended")) {
    throw new ScenarioError(`H-04: sender's capture track is not ended (${JSON.stringify(trackStates)})`);
  }

  await click(peerA, "toggle-camera");
  await waitAttr(peerB, "A", "data-video-off", "false", 5000);
  const fps = await measureFps(peerB, "A", 4000);
  if (fps.fps < 10) throw new ScenarioError(`H-04: frames did not resume (${fps.fps} fps)`, { fps });
  return { offFlipMs, resumedFps: fps.fps };
}

/** H-05 — switching to the second fake camera keeps frames flowing without a failed phase */
export async function scenario_H_05(ctx) {
  const { peerA, peerB } = await joinPair(ctx);
  await installColorHook(peerB);

  const before = await measureFps(peerB, "A", 1500);
  await ctx.switchCamera(peerA);
  const during = await measureFps(peerB, "A", 2500);
  const phase = await waitFor(peerA, phaseIs("connected"), { timeoutMs: 5000, describe: "phase staying connected after switch" });

  const color = await waitForValue(
    peerB,
    `async () => await window.__decodeRemoteColor("A")`,
    (c) => c?.ok && c.label === "second-camera",
    { timeoutMs: 15000, describe: "second-camera color on B's tile" },
  );
  const after = await measureFps(peerB, "A", 2000);
  if (during.fps === 0 && after.fps === 0) {
    throw new ScenarioError("H-05: frames stopped flowing after the switch", { before, during, after });
  }
  return { fpsBefore: before.fps, fpsDuring: during.fps, fpsAfter: after.fps, phase, colorDistance: color.distance };
}

/** H-06 — context without media permission shows an actionable error; granting and retry-media joins */
export async function scenario_H_06(ctx) {
  // A runs the full Chromium build without the fake-UI flag, so its
  // getUserMedia prompt is really denied (headless denies by default). It
  // launches through ctx.launchPeer like every other peer, so it carries the
  // bench signaling URL; B is a normal peer A must reach after the retry.
  const peerA = await ctx.launchPeer("A", {}, undefined, { fullChromium: true });
  const peerB = await ctx.launchPeer("B");
  await waitFor(peerA, `() => !!document.querySelector('[data-testid="call-error"]')?.textContent`, {
    timeoutMs: 10000,
    describe: "actionable error to appear",
  });
  const text = await peerA.page.evaluate(`(() => document.querySelector('[data-testid="call-error"]').textContent)()`);
  const retryVisible = await peerA.page.evaluate(`(() => { const b = document.querySelector('[data-testid="retry-media"]'); return !!b && !b.hidden; })()`);
  if (!retryVisible) throw new ScenarioError("H-06: retry-media button not offered", { text });
  const phaseDenied = await peerA.page.evaluate(`(() => document.querySelector('[data-call-phase]')?.getAttribute('data-call-phase'))()`);
  if (phaseDenied === "connected") throw new ScenarioError("H-06: denied peer reports connected", { text });

  await peerA.context.grantPermissions(["camera", "microphone"], { origin: ctx.url });
  await click(peerA, "retry-media");
  try {
    await waitFor(peerA, phaseIs("connected"), { timeoutMs: 20000, describe: "A connected after granting + retry" });
    await waitFor(peerB, phaseIs("connected"), { timeoutMs: 20000, describe: "B connected to A after A's retry" });
  } catch (err) {
    const states = await Promise.all([peerA, peerB].map((p) => pageDiagnostics(p).catch((e) => ({ error: String(e) }))));
    throw new ScenarioError(`${err instanceof Error ? err.message : err} | ${JSON.stringify(states)}`);
  }
  const fps = await measureFps(peerB, "A", 1500);
  if (fps.fps <= 0) throw new ScenarioError("H-06: B receives no frames from A after the retry", { fps });
  return { errorText: text.slice(0, 120), phaseDenied, joinedAfterRetry: true, fpsBseesA: fps.fps };
}

/** H-07 — one peer offline 3 s, 10 s, 30 s: honest reconnecting, media resumes within 10 s of restore, no duplicate tiles */
export async function scenario_H_07(ctx, { seed }) {
  ctx.enableRelay();
  await ctx.shaperFor("B").ready; // B's own shaper; A stays on host candidates
  const { peerA, peerB } = await joinPair(ctx);
  await installColorHook(peerB); // the media-resume check decodes through the hook
  const pathB = await selectedCandidateTypes(peerB);
  if (!pathB.length || !pathB.every((/** @type {{ local: string | null } | null} */ p) => p?.local === "relay")) {
    throw new ScenarioError(`H-07: B's media is not on the TURN relay, so the shaper cannot drop it (${JSON.stringify(pathB)})`);
  }

  const recoveries = [];
  for (const durationS of [3, 10, 30]) {
    ctx.shaperFor("B").applyProfile({ lossPct: 100, delayMs: 0 });
    await ctx.killPeerSocket("B"); // signaling gone too

    await waitFor(peerB, phaseIs("reconnecting"), {
      timeoutMs: 15000,
      describe: `honest reconnecting during ${durationS}s drop`,
    });
    await H(durationS * 1000);

    ctx.shaperFor("B").applyProfile({ lossPct: 0, delayMs: 0 });
    await ctx.restorePeerSocket("B");
    const restoreAt = Date.now();
    // One deadline from the restore covers reconnecting AND media resuming:
    // the reviewed version gave each wait its own 10 s.
    const deadline = restoreAt + 10000;
    await waitFor(peerB, phaseIs("connected"), {
      timeoutMs: left(deadline),
      describe: `reconnected within 10 s of restore (${durationS}s drop)`,
    });
    // Media resumes: B sees A's colour with frames advancing, not a frozen
    // last frame.
    const live = await waitForLiveMedia(peerB, "A", { deadlineAt: deadline, label: "A" });
    const recoveryMs = live.liveAt - restoreAt;
    if (recoveryMs > 10000) {
      throw new ScenarioError(`H-07: recovery took ${recoveryMs} ms after the ${durationS}s drop; the bar is 10 s`);
    }

    const tilesA = await peerA.page.evaluate(`(${tileCountAll})()`);
    const tilesB = await peerB.page.evaluate(`(${tileCountAll})()`);
    if (tilesA !== 1 || tilesB !== 1) {
      throw new ScenarioError(`H-07: duplicate tiles after ${durationS}s drop (A:${tilesA}, B:${tilesB})`);
    }
    recoveries.push({ durationS, recoveryMs, tilesA, tilesB });
  }
  // Over Convex these show each drop ending B's session and B rejoining
  // with a new one, i.e. that signaling really went down with the media.
  const sessionEvents = await ctx.sessionEvents();
  return { seed, relayPathB: pathB, shaperB: ctx.shaperFor("B").stats(), drops: recoveries, recovery10sMs: recoveries.find((r) => r.durationS === 10)?.recoveryMs, sessionEvents: sessionEvents.slice(-8) };
}

/** H-08 — recovers within 10 s (signaling outage mid-call: both sockets die at once) */
export async function scenario_H_08(ctx) {
  const { peerA, peerB } = await joinPair(ctx);
  await installColorHook(peerA);
  await installColorHook(peerB);

  // The contract's mechanism is a FORCED ICE RESTART on the live PCs, not
  // killing signaling sockets (that was the mock relay's approximation and
  // it never exercised the recovery path the contract names). The probe
  // helper returns one boolean per wrapped pc, so the scenario asserts the
  // restart was actually attempted on every connection.
  const ufragsSource = `() => (window.__wrappedPcs || []).filter((pc) => pc.connectionState !== "closed").map((pc) => (pc.localDescription?.sdp.match(/a=ice-ufrag:(\\S+)/) || [])[1] || null)`;
  const ufragsA = await peerA.page.evaluate(`(${ufragsSource})()`);
  const ufragsB = await peerB.page.evaluate(`(${ufragsSource})()`);
  const restartedA = await peerA.page.evaluate(`(() => window.__probeRestartIce())()`);
  const restartedB = await peerB.page.evaluate(`(() => window.__probeRestartIce())()`);
  if (!Array.isArray(restartedA) || restartedA.length === 0 || !restartedA.every(Boolean)) {
    throw new ScenarioError(`H-08: ICE restart not attempted on A's connections (${JSON.stringify(restartedA)})`);
  }
  if (!Array.isArray(restartedB) || restartedB.length === 0 || !restartedB.every(Boolean)) {
    throw new ScenarioError(`H-08: ICE restart not attempted on B's connections (${JSON.stringify(restartedB)})`);
  }

  // restartIce() only marks the pc as needing negotiation; the restart is
  // real once each live pc carries a new local ICE ufrag. Without this check a
  // transport that ignored the restart would pass, since media never stopped.
  const t0 = Date.now();
  // One 10 s deadline from the forced restart for every step below; the
  // reviewed version gave each wait its own 10 s, so 50 s could pass.
  const deadline = t0 + 10000;
  for (const [peer, before] of [[peerA, ufragsA], [peerB, ufragsB]]) {
    await waitForValue(peer, ufragsSource, (/** @type {Array<string | null>} */ now) => Array.isArray(now) && now.length > 0 && now.every((u, i) => u && u !== before[i]), {
      timeoutMs: left(deadline),
      describe: `new ICE ufrag on every live pc after the forced restart (before ${JSON.stringify(before)})`,
    });
  }
  // Frames must keep advancing both ways, not just show the right colour.
  const liveB = await waitForLiveMedia(peerA, "B", { deadlineAt: deadline, label: "B" });
  const liveA = await waitForLiveMedia(peerB, "A", { deadlineAt: deadline, label: "A" });
  await waitFor(peerA, phaseIs("connected"), { timeoutMs: left(deadline), describe: "A phase connected within 10 s" });
  await waitFor(peerB, phaseIs("connected"), { timeoutMs: left(deadline), describe: "B phase connected within 10 s" });
  const recoveryMs = Math.max(liveA.liveAt, liveB.liveAt) - t0;
  if (recoveryMs > 10000) throw new ScenarioError(`H-08: recovery took ${recoveryMs} ms; the bar is 10 s`);
  return { recoveryMs, restartedPcs: restartedA.length + restartedB.length, ufragsBefore: { A: ufragsA, B: ufragsB } };
}

/** H-09 — reloaded peer rejoins; no ghost participant after 10 s */
export async function scenario_H_09(ctx) {
  const { peerA, peerB } = await joinPair(ctx);
  await installColorHook(peerB); // the no-ghost media check decodes through the hook

  await peerA.page.reload({ waitUntil: "domcontentloaded" }); // same URL: the bench rejoins by itself
  await ctx.joinFromLobby(peerA); // the real page reloads into its lobby
  await waitFor(peerA, phaseIs("connected"), { timeoutMs: 10000, describe: "reloaded A reconnected" });
  await waitForValue(peerB, tileCount("A"), (n) => n === 1, {
    timeoutMs: 10000,
    describe: "B sees exactly one A tile",
  });
  await H(10000); // the contract's ghost observation window
  const ghostTiles = await peerB.page.evaluate(`(${tileCount("A")})()`);
  if (ghostTiles !== 1) {
    throw new ScenarioError(`H-09: ghost participant after reload (${ghostTiles} A tiles)`);
  }
  // The one A tile is live after the ghost window: advancing frames, not a
  // stale last frame.
  await waitForLiveMedia(peerB, "A", { deadlineAt: Date.now() + 3000, label: "A" });
  return { ghostTiles };
}

/** H-10 — survivor shows the peer gone within 15 s */
export async function scenario_H_10(ctx) {
  const { peerA, peerB } = await joinPair(ctx);

  const closed = await killPeerTab(peerA); // CDP Target.closeTarget: no WS close frame
  if (!closed) throw new ScenarioError("H-10: failed to hard-kill peer A's tab");

  await waitForValue(peerB, tileCount("A"), (n) => n === 0, {
    timeoutMs: 15000,
    describe: "A's tile gone within 15 s (heartbeat sweep)",
  });
  const events = await ctx.sessionEvents(); // promise under the reference signaling handle, array on the mock relay
  return { closed, tileGone: true, sessionEvents: events.slice(-4) };
}

/** H-11 — all local tracks ended, all wrapped connections closed, no getStats traffic afterwards, server session closed */
export async function scenario_H_11(ctx) {
  const { peerA, peerB } = await joinPair(ctx);

  // Capture the local tracks BEFORE leaving: the bench nulls the video
  // element's srcObject on leave, so afterwards there is nothing to read —
  // but pre-captured track objects still report their (ended) readyState.
  await peerA.page.evaluate(`(() => {
    window.__h11tracks = [...(document.querySelector('[data-testid="local-video"]')?.srcObject?.getTracks() ?? [])];
  })()`);

  await leaveCall(peerA);
  await waitFor(peerA, phaseIs("left"), { timeoutMs: 5000, describe: "A's phase left" });

  // Read the PRE-CAPTURED track objects (window.__h11tracks, captured above):
  // the bench page unmounts the local-video element on leave, so a DOM read
  // would throw; the captured MediaStreamTrack objects still report their
  // post-leave readyState.
  const trackStates = await peerA.page.evaluate(`(() => (window.__h11tracks ?? []).map(t => t.readyState))()`);
  if (trackStates.length === 0 || !trackStates.every((s) => s === "ended")) {
    throw new ScenarioError(`H-11: local tracks not ended (${JSON.stringify(trackStates)})`);
  }

  const probe = await probeState(peerA);
  if (probe.connections.live !== 0 || probe.pcs.some((pc) => !pc.closed)) {
    throw new ScenarioError(`H-11: wrapped connections not closed (${JSON.stringify(probe.connections)}, ${probe.pcs.length} pcs)`);
  }

  await H(1000);
  const calls1 = (await probeState(peerA)).getStatsCalls;
  await H(1000);
  const calls2 = (await probeState(peerA)).getStatsCalls;
  if (calls1 !== calls2) {
    throw new ScenarioError(`H-11: getStats still called after leave (${calls1} -> ${calls2})`);
  }

  const events = await ctx.sessionEvents();
  // relay.mjs records reason "left" for a clean departure ("disconnected"
  // for a bare socket drop) — the reviewed bug asserted the never-recorded
  // "leave".
  const leftEvent = events.find((e) => e.participant === "A" && e.reason === "left");
  if (!leftEvent) throw new ScenarioError("H-11: no leave session event on the relay", { events });

  // B observes the departure (tile gone).
  await waitForValue(peerB, tileCount("A"), (n) => n === 0, { timeoutMs: 15000, describe: "B's tile for A removed" });
  return { trackStates, getStatsCallsStable: true, getStatsCalls: calls2, sessionEvents: events.slice(-4) };
}

/** H-12 — simultaneous join in both orders, 20 seeds: always connects */
export async function scenario_H_12(ctx, { seed }) {
  // Both join orders across the seed matrix; within one seed both pages
  // launch simultaneously (Promise.all) — offers collide from both sides.
  const flip = seed % 2 === 0;
  const a = flip ? "B" : "A";
  const b = flip ? "A" : "B";
  const { peerA, peerB } = await joinPair(ctx, { a, b });
  await assertProbePresent(peerA);
  await assertProbePresent(peerB);
  await installColorHook(peerA);
  await installColorHook(peerB);
  await waitFor(peerA, phaseIs("connected"), { timeoutMs: 30000, describe: `${a} connected` });
  await waitFor(peerB, phaseIs("connected"), { timeoutMs: 30000, describe: `${b} connected` });
  // The transport's connected phase now requires ICE plus decoded frames,
  // but the scenario still proves it directly: sampled fps must be positive
  // on both tiles (the reviewed defect passed H-12 on phase alone).
  // peerA is identity `a` and shows `b`'s tile (and vice versa). The reviewed
  // bug sampled "B" on the first page even when the seed swapped the order,
  // so every even seed read the page's own id, found no tile and failed.
  const fpsA = await measureFps(peerA, b, 2000);
  const fpsB = await measureFps(peerB, a, 2000);
  if (fpsA.fps <= 0 || fpsB.fps <= 0) {
    throw new ScenarioError(`H-12: remote frames did not advance (${a}: ${fpsA.fps} fps, ${b}: ${fpsB.fps} fps)`);
  }
  await peerA.close();
  await peerB.close();
  return { order: `${a}-first`, bothConnected: true, fps: { [`${a}sees${b}`]: fpsA.fps, [`${b}sees${a}`]: fpsB.fps } };
}

/** H-13 — five leave/rejoin cycles: live connection and track counts return to baseline */
export async function scenario_H_13(ctx) {
  const { peerA, peerB } = await joinPair(ctx);
  const baseline = await probeState(peerA);

  // ONE page for all five cycles: relaunching per cycle hid leaks the way
  // the reviewed bug did — a fresh page forgets the old page's connections
  // and tracks, so accumulated live state never showed in the probe.
  for (let cycle = 1; cycle <= 5; cycle++) {
    await leaveCall(peerA);
    await waitFor(peerA, phaseIs("left"), { timeoutMs: 5000, describe: `cycle ${cycle}: left` });
    await click(peerA, "join-call"); // same page re-joins; B never leaves
    await ctx.joinFromLobby(peerA); // the real page's Rejoin goes back to its lobby first
    await waitFor(peerA, phaseIs("connected"), { timeoutMs: 30000, describe: `cycle ${cycle}: A rejoined` });
  }

  const probe = await probeState(peerA);
  const result = {
    baseline: { live: baseline.connections.live, tracks: baseline.tracks.live },
    final: { live: probe.connections.live, tracks: probe.tracks.live },
  };
  if (probe.connections.live !== baseline.connections.live || probe.tracks.live !== baseline.tracks.live) {
    throw new ScenarioError("H-13: connection/track counts did not return to baseline", result);
  }
  await peerA.close();
  await peerB.close();
  return result;
}

/** H-14 — a signed-in non-participant gets a named rejection and no media */
export async function scenario_H_14(ctx) {
  const { peerA, peerB } = await joinPair(ctx);
  const peerO = await ctx.launchPeer("O");
  try {
    // The real page renders call-error only once there is an error.
    await waitFor(peerO, `() => !!document.querySelector('[data-testid="call-error"]')?.textContent`, {
      timeoutMs: 10000,
      describe: "named rejection to appear",
    });
    const text = await peerO.page.evaluate(`(() => document.querySelector('[data-testid="call-error"]').textContent)()`);
    const tiles = await peerO.page.evaluate(`(${tileCountAll})()`);
    if (tiles !== 0) throw new ScenarioError(`H-14: rejected peer has ${tiles} media tiles`, { text });
    const phase = await peerO.page.evaluate(`(() => document.querySelector('[data-call-phase]')?.getAttribute('data-call-phase'))()`);
    // The page refuses O before any media; the signaling server must refuse
    // O too, so a hand-made request cannot join the call either.
    const signaling = await peerO.page.evaluate(async (roomId) => {
      const res = await fetch("/onboarding?journey-proof=signal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "join", roomId, sessionId: "outsider-session-1" }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    }, ctx.roomId);
    if (signaling.status !== 403 || signaling.body?.code !== "FORBIDDEN") {
      throw new ScenarioError(`H-14: the signaling server did not refuse the outsider (${JSON.stringify(signaling)})`);
    }
    await waitForValue(peerB, tileCountAll, (n) => n === 1, { timeoutMs: 5000, describe: "no O tile on B" });
    return { rejection: text.slice(0, 140), phase, tiles, signalingRefusal: signaling.body.message };
  } finally {
    await peerO.close();
    await peerA.close();
    await peerB.close();
  }
}

/** H-15 — 5% and 15% loss with 300 ms delay, by a method getStats proves affects RTP: call stays connected, A/V recovers */
export async function scenario_H_15(ctx) {
  ctx.enableRelay();
  await ctx.shaperFor("B").ready;
  const { peerA, peerB } = await joinPair(ctx); // configs resolve per participant: A host, B relay via B's shaper

  await installColorHook(peerB);

  async function proofBlock(label, lossPct, delayMs, windowMs = 6000) {
    if (lossPct > 0 || delayMs > 0) {
      ctx.shaperFor("B").applyProfile({ lossPct, delayMs });
    }
    const stats = await collectRtpStatsWindow(peerB, "video", windowMs, { participantId: "A" });
    const fps = await measureFps(peerB, "A", 3000);
    const phase = await peerB.page.evaluate(`(() => document.querySelector('[data-call-phase]')?.getAttribute('data-call-phase'))()`);
    ctx.shaperFor("B").applyProfile({ lossPct: 0, delayMs: 0 });
    return { label, lossPct, delayMs, deltaLost: stats.deltaLost, rttMs: stats.rttMs, fps: fps.fps, phase, clearedAt: Date.now() };
  }

  /**
   * "A/V recovers": audio too. Right after a loss block clears, B must hear
   * A's 440 Hz tone again within 3 s of that moment.
   * @param {string} name @param {number} clearedAt
   */
  async function toneBack(name, clearedAt) {
    const deadline = clearedAt + 3000;
    let tone = null;
    for (;;) {
      tone = await sampleRemoteTone(peerB, "A", 400);
      if (toneMatches(tone, 440)) return { hz: tone.peakHz, afterMs: Date.now() - clearedAt };
      if (Date.now() > deadline) {
        const heard = tone ? `${tone.peakHz} Hz (rms ${tone.rms})` : "silence";
        throw new ScenarioError(`H-15: audio did not recover within 3 s after ${name} loss (heard ${heard}, expected 440 Hz)`, { tone });
      }
      await H(200);
    }
  }

  const baseline = await proofBlock("baseline", 0, 0, 4000);
  if (baseline.deltaLost !== 0 || baseline.rttMs >= 100) {
    throw new ScenarioError("H-15: baseline is not clean — proof would be meaningless", baseline);
  }

  const loss5 = await proofBlock("5%", 5, 300);
  if (loss5.deltaLost <= 0 || loss5.rttMs < 250) {
    throw new ScenarioError(
      `H-15: shaping did not demonstrably reach RTP at 5% (lost +${loss5.deltaLost}, rtt ${loss5.rttMs} ms)`,
      loss5,
    );
  }
  const tone5 = await toneBack("5%", loss5.clearedAt);
  const recovery5 = await proofBlock("recovery-5%", 0, 0, 4000);

  const loss15 = await proofBlock("15%", 15, 300);
  if (loss15.deltaLost <= 0 || loss15.rttMs < 250) {
    throw new ScenarioError(
      `H-15: shaping did not demonstrably reach RTP at 15% (lost +${loss15.deltaLost}, rtt ${loss15.rttMs} ms)`,
      loss15,
    );
  }
  const tone15 = await toneBack("15%", loss15.clearedAt);
  const recovery15 = await proofBlock("recovery-15%", 0, 0, 4000);

  for (const [name, block] of [["5%", loss5], ["15%", loss15]]) {
    if (block.phase !== "connected") {
      throw new ScenarioError(`H-15: call phase was "${block.phase}" under ${name} loss`, block);
    }
  }
  for (const [name, block] of [["5%", recovery5], ["15%", recovery15]]) {
    if (block.fps < 10) {
      throw new ScenarioError(`H-15: video did not recover after ${name} loss (${block.fps} fps)`, block);
    }
  }
  return {
    baseline,
    loss5,
    recovery5,
    loss15,
    recovery15,
    toneAfter5: tone5,
    toneAfter15: tone15,
    shaperB: ctx.shaperFor("B").stats(),
    proof: "packetsLost delta > 0 and RTT >= 250 ms under 300 ms shaping; video fps and the 440 Hz tone recover with the profile cleared",
  };
}

/** H-16 — informational: all pairs receive media */
export async function scenario_H_16(ctx) {
  const [peerA, peerB, peerC] = await Promise.all([
    ctx.launchPeer("A"),
    ctx.launchPeer("B"),
    ctx.launchPeer("C"),
  ]);
  try {
    await Promise.all([
      waitFor(peerA, phaseIs("connected"), { timeoutMs: 30000, describe: "A connected" }),
      waitFor(peerB, phaseIs("connected"), { timeoutMs: 30000, describe: "B connected" }),
      waitFor(peerC, phaseIs("connected"), { timeoutMs: 30000, describe: "C connected" }),
    ]);
    for (const peer of [peerA, peerB, peerC]) await installColorHook(peer);

    const pairs = [];
    for (const [viewer, from, expected] of [
      ["A", "B", "B"],
      ["A", "C", "C"],
      ["B", "A", "A"],
      ["B", "C", "C"],
      ["C", "A", "A"],
      ["C", "B", "B"],
    ]) {
      const peer = { A: peerA, B: peerB, C: peerC }[viewer];
      const c = await waitForValue(
        peer,
        `async () => await window.__decodeRemoteColor("${from}")`,
        (c) => c?.ok && c.label === expected,
        { timeoutMs: 20000, describe: `${viewer} decodes ${from}` },
      );
      pairs.push({ viewer, from, label: c.label, distance: c.distance });
    }
    return { informational: true, pairs, allPairsReceiveMedia: pairs.length === 6 };
  } finally {
    await Promise.all([peerA.close(), peerB.close(), peerC.close()]);
  }
}

/** Endpoint-issued TURN REST credentials carry real media under relay-only policy. */
export async function scenario_H_17(ctx, { seed }) {
  if (!ctx.turn) throw new ScenarioError("H-17 requires scripts/prove-turn.mjs to configure the endpoint and relay together.");
  // The policy is the only override. Server URLs and credentials must come from /api/call/ice.
  const peerA = await ctx.launchPeer("A", {}, { iceTransportPolicy: "relay" });
  const peerB = await ctx.launchPeer("B", {}, { iceTransportPolicy: "relay" });
  try {
    await Promise.all([peerA, peerB].map((peer) => waitFor(peer, phaseIs("connected"), { timeoutMs: 30000 })));
  } catch (error) {
    fs.mkdirSync("docs/lane2/screenshots", { recursive: true });
    for (const peer of [peerA, peerB]) {
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await peer.page.setViewportSize(viewport);
        await peer.page.screenshot({ path: `docs/lane2/screenshots/blocked-${peer.peerId}-${viewport.width}x${viewport.height}.png` });
      }
    }
    const states = await Promise.all([peerA, peerB].map((peer) => pageDiagnostics(peer)));
    throw new ScenarioError(`${error.message} | ${JSON.stringify(states)}`);
  }
  await installColorHook(peerA);
  await installColorHook(peerB);
  await waitForLiveMedia(peerA, "B", { deadlineAt: Date.now() + 15000, label: "B" });
  await waitForLiveMedia(peerB, "A", { deadlineAt: Date.now() + 15000, label: "A" });
  const frameA = await decodeRemoteFrame(peerA, "B");
  const frameB = await decodeRemoteFrame(peerB, "A");
  if (matchPeerColor(frameA.color)?.label !== "B" || matchPeerColor(frameB.color)?.label !== "A") throw new ScenarioError("H-17 remote video does not match the other participant.");
  // Match H-02's three-second tone check; a newly attached analyser can
  // start with silence before the jitter buffer delivers its first sample.
  async function remoteTone(peer, from, expected) {
    const deadline = Date.now() + 3000;
    let tone;
    do {
      tone = await sampleRemoteTone(peer, from, 400);
      if (toneMatches(tone, expected)) return tone;
    } while (Date.now() < deadline);
    throw new ScenarioError(`H-17 ${peer.peerId} expected ${expected} Hz, received ${JSON.stringify(tone)}`);
  }
  const [toneA, toneB] = await Promise.all([remoteTone(peerA, "B", 660), remoteTone(peerB, "A", 440)]);
  const paths = [await selectedCandidateTypes(peerA), await selectedCandidateTypes(peerB)];
  if (!paths.every((path) => path.length && path.every((pair) => pair?.local === "relay" && pair?.remote === "relay"))) throw new ScenarioError("H-17 selected media path is not relayed", { paths });
  if (![peerA, peerB].every((peer) => peer.iceResponses.some((response) => response.status === 200 && response.turn))) throw new ScenarioError("H-17 did not observe the authorized ICE endpoint.");
  const relayStats = ctx.turn.stats();
  if (relayStats.allocations < 2 || !relayStats.relayedToPeer || !relayStats.relayedToClient) throw new ScenarioError("H-17 TURN did not carry media.");
  const captures = seed === 1 ? await captureCallStates(peerA, "relay-connected") : [];
  const keyboard = [];
  if (seed === 1) {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await peerA.page.setViewportSize(viewport);
      keyboard.push({ ...viewport, ...await keyboardCallPass(peerA) });
    }
  }
  return { seed, endpointCredentialsUsed: true, relayStats, paths, audioHz: [toneA.peakHz, toneB.peakHz], colours: ["B", "A"], captures, keyboard };
}

export async function scenario_H_18(ctx, options) {
  return scenarioIceExhaustion(ctx, { ...options, installColorHook });
}
