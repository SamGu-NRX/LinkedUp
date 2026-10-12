/// <reference lib="dom" />
// In-page code below runs in the browser through page.evaluate.
/**
 * In-page media helpers: everything a scenario asserts about media receipts is
 * decoded here from the DOM (remote <video> pixels, audio track samples) plus
 * the probe — never from app internals. Decoder functions come from the
 * pinned import-free module lib/decoders.mjs, serialized as a whole bundle
 * (stringifying one function would drop module-level helpers like
 * validateImageData); each page caches the initialized bundle once.
 *
 * Participants are named by harness letter (A, B, O). On LinkedUp the page
 * shows each person by their users.id, so every in-page lookup maps the
 * letter through window.__harnessIds, which the context installs per page.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadContracts } from "./contracts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
let bundle = null;

/**
 * The pinned decoder module as one bundle string, with its ESM `export`
 * keywords stripped so both new Function() (Node) and in-page evaluation can
 * parse it. The module is import-free by contract, so there is nothing else
 * to rewrite.
 */
export function decoderBundle() {
  if (!bundle) {
    bundle = fs
      .readFileSync(path.join(ROOT, "tools/call-eval/lib/decoders.mjs"), "utf8")
      .replace(/^export\s+(?=(const|function|class)\b)/gm, "");
  }
  return bundle;
}

function initDecodersInNode(bundleSrc) {
  const fn = new Function(bundleSrc + "\nreturn { decodeBarcodeColor, decodeFrameCounter, computeFps, decodeToneHz };");
  return fn();
}

/** Node-side tolerant color classification (y4m round-trip shifts ~±13/ch). */
export function matchPeerColor(rgb) {
  const { PEER_COLORS, SECOND_CAMERA_COLOR, COLOR_TOLERANCE } = loadContracts();
  return classifyRemoteColor(rgb, peerPalette(PEER_COLORS, SECOND_CAMERA_COLOR), COLOR_TOLERANCE);
}

/**
 * The labelled palette both color classifiers use. classifyRemoteColor
 * destructures [label, rgb] pairs; passing bare triples made every color
 * classify as garbage (NaN distance), so H-01 failed healthy calls.
 * @param {Record<"A" | "B" | "C" | "D", ArrayLike<number>>} peerColors
 * @param {ArrayLike<number>} secondCamera
 * @returns {Array<[string, [number, number, number]]>}
 */
export function peerPalette(peerColors, secondCamera) {
  /** @param {ArrayLike<number>} c @returns {[number, number, number]} */
  const rgb = (c) => [c[0], c[1], c[2]];
  return [
    ["A", rgb(peerColors.A)],
    ["B", rgb(peerColors.B)],
    ["C", rgb(peerColors.C)],
    ["D", rgb(peerColors.D)],
    ["second-camera", rgb(secondCamera)],
  ];
}

/**
 * Tolerant palette classification, pure so the page-side color hook can
 * embed it verbatim (colorHookExpression stringifies it): nearest palette
 * entry by max per-channel distance; ok only within tolerance.
 * @param {{ r: number, g: number, b: number }} rgb
 * @param {Array<[string, [number, number, number]]>} palette label -> rgb triple
 * @param {number} tolerance
 */
export function classifyRemoteColor(rgb, palette, tolerance) {
  let best = null;
  for (const [label, ref] of palette) {
    const d = Math.max(Math.abs(rgb.r - ref[0]), Math.abs(rgb.g - ref[1]), Math.abs(rgb.b - ref[2]));
    if (!best || d < best.distance) best = { label, distance: d };
  }
  return { ...best, ok: best.distance <= tolerance };
}

/**
 * True when a sampleRemoteTone result carries the expected tone: decodeToneHz
 * returns { peakHz, rms } — the reviewed H-02/H-03 bug did arithmetic on the
 * OBJECT (NaN peak), so the predicate reads peakHz explicitly.
 * @param {{ peakHz?: number, rms?: number } | null | undefined} decoded
 * @param {number} expectedHz
 * @param {number} [tolerance]
 * @returns {boolean}
 */
export function toneMatches(decoded, expectedHz, tolerance = 10) {
  const peak = decoded?.peakHz;
  if (typeof peak !== "number" || !Number.isFinite(peak)) return false;
  return Math.abs(peak - expectedHz) <= tolerance;
}

/**
 * True when nothing audible was received: no sample at all (null — no track
 * or no stream), digital silence (decodeToneHz yields peakHz 0 at rms < 1e-6),
 * or sub-floor energy. The floor counts near-silent noise as muted: the
 * reviewed H-03 bug compared the decode OBJECT to 0 and threw on every
 * healthy muted call. Pure digital silence must always count as muted.
 * @param {{ peakHz?: number, rms?: number } | null | undefined} decoded
 * @param {{ rmsFloor?: number }} [opts]
 * @returns {boolean}
 */
export function toneIsSilent(decoded, { rmsFloor = 0.01 } = {}) {
  if (!decoded || typeof decoded !== "object") return true;
  if (decoded.peakHz === 0) return true;
  return Number(decoded.rms) < rmsFloor;
}

/** Sample the pinned counter band; classification stays Node-side. */
export async function decodeRemoteFrame(peer, participantId) {
  const bundleSrc = await decoderBundle();
  return peer.page.evaluate(
    async ({ participantId, bundleSrc }) => {
      if (!window.__connvoDecoders) {
        window.__connvoDecoders = new Function(
          bundleSrc + "\nreturn { decodeBarcodeColor, decodeFrameCounter, computeFps, decodeToneHz };",
        )();
      }
      const { decodeBarcodeColor, decodeFrameCounter } = window.__connvoDecoders;
      const tile = document.querySelector(
        `[data-testid="remote-media"][data-participant-id="${(window.__harnessIds || {})[participantId] ?? participantId}"]`,
      );
      const video = tile?.querySelector("video");
      if (!video || !video.videoWidth) return { present: false };
      const w = video.videoWidth;
      const h = video.videoHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, w, h);
      // Color region: everything above the barcode band (band pinned at
      // y=200..239 of the 320x240 fixture).
      const colorRegion = ctx.getImageData(0, 0, w, Math.min(200, h));
      const band = ctx.getImageData(0, 200, w, Math.min(40, h - 200));
      return {
        present: true,
        color: decodeBarcodeColor(colorRegion),
        counter: decodeFrameCounter(band),
        videoWidth: w,
        videoHeight: h,
      };
    },
    { participantId, bundleSrc },
  );
}

/** Remote audio tone via the remote MediaStream audio track (an AnalyserNode tap). */
export async function sampleRemoteTone(peer, participantId, durationMs = 700) {
  const bundleSrc = await decoderBundle();
  return peer.page.evaluate(
    async ({ participantId, durationMs, bundleSrc }) => {
      if (!window.__connvoDecoders) {
        window.__connvoDecoders = new Function(
          bundleSrc + "\nreturn { decodeBarcodeColor, decodeFrameCounter, computeFps, decodeToneHz };",
        )();
      }
      const { decodeToneHz } = window.__connvoDecoders;

      const tile = document.querySelector(
        `[data-testid="remote-media"][data-participant-id="${(window.__harnessIds || {})[participantId] ?? participantId}"]`,
      );
      const stream = tile?.querySelector("video")?.srcObject;
      if (!stream) return null;
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack || audioTrack.readyState !== "live") return null;

      window.__harnessAnalysers = window.__harnessAnalysers || new Map();
      let hook = window.__harnessAnalysers.get(participantId);
      if (!hook || hook.trackId !== audioTrack.id) {
        if (hook) {
          try {
            hook.actx.close();
          } catch {
            /* already closed */
          }
        }
        const ACtx = window.AudioContext || window.webkitAudioContext;
        const actx = new ACtx();
        await actx.resume();
        const analyser = actx.createAnalyser();
        analyser.fftSize = 4096;
        actx.createMediaStreamSource(new MediaStream([audioTrack])).connect(analyser);
        hook = { actx, analyser, buf: new Float32Array(analyser.fftSize), trackId: audioTrack.id };
        window.__harnessAnalysers.set(participantId, hook);
      }
      const { actx, analyser, buf } = hook;
      const chunks = [];
      const deadline = actx.currentTime + durationMs / 1000;
      while (actx.currentTime < deadline) {
        analyser.getFloatTimeDomainData(buf);
        chunks.push(Float32Array.from(buf));
        await new Promise((r) => setTimeout(r, 20));
      }
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const merged = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        merged.set(c, off);
        off += c.length;
      }
      return decodeToneHz(merged, actx.sampleRate);
    },
    { participantId, durationMs, bundleSrc },
  );
}

/**
 * Remote video fps from counter reads taken inside the page. computeFps counts
 * OBSERVED counter advances (a duplicate frame advances nothing; a 4095->0
 * wrap is just another change), so a lost or late decode lowers the rate.
 *
 * Sampling runs in the page, not through one page.evaluate per read: a Node
 * round trip per sample (plus canvas setup) took longer than a 33 ms frame on
 * a loaded host, which capped the measurable rate below the stream's real one.
 * The page reads the counter on every requestVideoFrameCallback and also on a
 * 10 ms timer (the fallback when the browser skips frame callbacks); duplicate
 * reads of the same frame add no advances. Frames are scaled into the pinned
 * 320x240 layout first, so an encoder downscale cannot move the barcode band.
 */
/**
 * @param {{ page: { evaluate: Function } }} peer
 * @param {string} participantId
 * @param {number} [ms]
 */
export async function measureFps(peer, participantId, ms = 5000) {
  const bundleSrc = await decoderBundle();
  const sampled = await peer.page.evaluate(
    /** @param {{ participantId: string, ms: number, bundleSrc: string }} arg */
    async ({ participantId, ms, bundleSrc }) => {
      const w = /** @type {any} */ (window);
      if (!w.__connvoDecoders) {
        w.__connvoDecoders = new Function(
          bundleSrc + "\nreturn { decodeBarcodeColor, decodeFrameCounter, computeFps, decodeToneHz };",
        )();
      }
      const { decodeFrameCounter } = w.__connvoDecoders;
      const video = document
        .querySelector(`[data-testid="remote-media"][data-participant-id="${(window.__harnessIds || {})[participantId] ?? participantId}"]`)
        ?.querySelector("video");
      if (!video) return { samples: [], timeOrigin: performance.timeOrigin };
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const c2d = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d", { willReadFrequently: true }));
      /** @type {Array<{ t: number, counter: number }>} */
      const out = [];
      /** @param {number} t */
      const read = (t) => {
        if (!video.videoWidth) return;
        c2d.drawImage(video, 0, 0, 320, 240);
        const decoded = decodeFrameCounter(c2d.getImageData(0, 200, 320, 40));
        if (decoded.ok) out.push({ t, counter: decoded.counter });
      };
      const end = performance.now() + ms;
      await new Promise((resolve) => {
        const timer = setInterval(() => {
          const now = performance.now();
          if (now >= end) {
            clearInterval(timer);
            resolve(undefined);
            return;
          }
          read(now);
        }, 10);
        if (typeof video.requestVideoFrameCallback === "function") {
          /** @param {number} now */
          const onFrame = (now) => {
            if (now >= end) return;
            read(now);
            video.requestVideoFrameCallback(onFrame);
          };
          video.requestVideoFrameCallback(onFrame);
        }
      });
      // timeOrigin turns page timestamps into wall-clock time for the caller.
      return { samples: out.sort((x, y) => x.t - y.t), timeOrigin: performance.timeOrigin };
    },
    { participantId, ms, bundleSrc },
  );
  const samples = sampled.samples;
  // Wall-clock time of the first frame whose counter moved, or null.
  let firstAdvanceAt = null;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].counter !== samples[i - 1].counter) {
      firstAdvanceAt = Math.round(sampled.timeOrigin + samples[i].t);
      break;
    }
  }
  if (samples.length < 3) return { fps: 0, samples: samples.length, implausible: true, firstAdvanceAt };
  const { computeFps } = initDecodersInNode(bundleSrc);
  const plausible = (v) => Number.isFinite(v) && v > 0 && v <= 60;
  let computed = computeFps(samples);
  let implausible = !plausible(computed);
  if (implausible) {
    computed = robustFps(samples);
    implausible = !plausible(computed);
  }
  return { fps: Number(computed.toFixed(1)), samples: samples.length, implausible, firstAdvanceAt };
}

/** Median of plausible per-step rates (mod-4096 wrap aware). */
export function robustFps(samples) {
  const rates = [];
  for (let i = 1; i < samples.length; i++) {
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    let dc = samples[i].counter - samples[i - 1].counter;
    if (dc < -2048) dc += 4096; // wrap
    if (dc < 0 || (dt > 0.05 && dc / dt > 60)) continue; // implausible step
    if (dt > 0.05) rates.push(dc / dt);
  }
  if (!rates.length) return 0;
  rates.sort((a, b) => a - b);
  const mid = Math.floor(rates.length / 2);
  return rates.length % 2 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2;
}

/**
 * Full stats sweep for one participant: calls getStats on each matching
 * receiver through the wrapped pc and aggregates inbound-rtp + the best
 * candidate-pair RTT. Returns null-shaped zeros when nothing flows yet.
 */
export async function readRtpStats(peer, kind = "video", participantId = null) {
  return peer.page.evaluate(
    async ({ kindName, participantId }) => {
      const pcs = window.__wrappedPcs || [];
      const tile = participantId
        ? document.querySelector(`[data-testid="remote-media"][data-participant-id="${(window.__harnessIds || {})[participantId] ?? participantId}"]`)
        : null;
      const tileStream = tile?.querySelector("video")?.srcObject ?? null;
      const tileTrackIds = tileStream ? new Set([...tileStream.getTracks()].map((t) => t.id)) : null;

      const out = { packetsReceived: 0, packetsLost: 0, bytesReceived: 0, rttMs: null, reports: 0 };
      for (const pc of pcs) {
        let receivers;
        try {
          receivers = pc.getReceivers();
        } catch {
          continue;
        }
        for (const receiver of receivers) {
          const track = receiver.track;
          if (!track || track.kind !== kindName) continue;
          if (tileTrackIds && !tileTrackIds.has(track.id)) continue;
          const stats = await pc.getStats(); // wrapped: increments getStatsCalls
          stats.forEach((s) => {
            if (s.type === "inbound-rtp" && s.kind === kindName) {
              out.packetsReceived += s.packetsReceived ?? 0;
              out.packetsLost += s.packetsLost ?? 0;
              out.bytesReceived += s.bytesReceived ?? 0;
              out.reports++;
            }
            if (s.type === "candidate-pair" && s.state === "succeeded" && s.currentRoundTripTime != null) {
              const rtt = Math.round(s.currentRoundTripTime * 1000);
              if (out.rttMs === null || rtt < out.rttMs) out.rttMs = rtt;
            }
          });
        }
      }
      return out;
    },
    { kindName: kind, participantId },
  );
}

/**
 * Samples readRtpStats across a window (single reads can return null RTT
 * between consent checks); returns start/end packet counts and the mean of
 * non-null RTT readings. Used by H-15's getStats proof and H-07 recovery.
 */
export async function collectRtpStatsWindow(peer, kind, ms, { stepMs = 500, participantId = null } = {}) {
  const start = await readRtpStats(peer, kind, participantId);
  const t0 = Date.now();
  const rtts = [];
  let end = start;
  while (Date.now() - t0 < ms) {
    await new Promise((r) => setTimeout(r, stepMs));
    end = await readRtpStats(peer, kind, participantId);
    if (end.rttMs != null) rtts.push(end.rttMs);
  }
  return {
    packetsLostStart: start.packetsLost,
    packetsLostEnd: end.packetsLost,
    deltaLost: end.packetsLost - start.packetsLost,
    packetsReceived: end.packetsReceived - start.packetsReceived,
    bytesReceived: end.bytesReceived - start.bytesReceived,
    rttMs: rtts.length ? Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length) : end.rttMs,
    rttSamples: rtts,
    reports: end.reports,
  };
}

/** Probe snapshot (connection/track lifecycle + getStatsCalls). */
export async function probeState(peer) {
  return peer.page.evaluate(() => JSON.parse(JSON.stringify(window.__callProbe)));
}

/**
 * The local and remote candidate types of each live pc's selected pair, read
 * from getStats. H-07 and H-15 use it to prove media really rides the
 * harness TURN relay (both ends "relay") rather than a direct host path the
 * shaper never sees.
 */
/** @param {{ page: import('@playwright/test').Page }} peer */
export async function selectedCandidateTypes(peer) {
  return peer.page.evaluate(async () => {
    const out = [];
    for (const pc of /** @type {RTCPeerConnection[]} */ (/** @type {any} */ (window).__wrappedPcs || [])) {
      if (pc.connectionState === "closed") continue;
      const stats = await pc.getStats();
      /** @type {Map<string, any>} */
      const byId = new Map();
      stats.forEach((/** @type {any} */ s) => byId.set(s.id, s));
      /** @type {any} */
      let pair = null;
      stats.forEach((/** @type {any} */ s) => {
        if (s.type === "transport" && s.selectedCandidatePairId) pair = byId.get(s.selectedCandidatePairId);
      });
      out.push(pair ? { local: byId.get(pair.localCandidateId)?.candidateType ?? null, remote: byId.get(pair.remoteCandidateId)?.candidateType ?? null } : null);
    }
    return out;
  });
}

/**
 * Poll short tone samples until the received audio is silent, and report how
 * long that took. Mute state reaches the other page over signaling in tens of
 * milliseconds, but audio already encoded, in flight and in the receiver's
 * jitter buffer keeps playing for a few hundred (measured on the reference
 * bench: tone until ~190 ms after the flip, silence from ~345 ms). One long
 * sample taken at the flip therefore averages that tail in and reads as
 * "still audible" on a healthy call.
 * @param {() => Promise<{ peakHz?: number, rms?: number } | null>} sample one short window
 * @param {{ deadlineMs: number, now?: () => number }} opts
 * @returns {Promise<{ silent: boolean, afterMs: number, last: { peakHz?: number, rms?: number } | null }>}
 */
export async function waitForSilence(sample, { deadlineMs, now = Date.now }) {
  const t0 = now();
  let last = null;
  for (;;) {
    last = await sample();
    const afterMs = now() - t0;
    if (toneIsSilent(last)) return { silent: true, afterMs, last };
    if (afterMs >= deadlineMs) return { silent: false, afterMs, last };
  }
}

/**
 * Wait until `participantId`'s tile shows live media: the right colour AND
 * frames advancing at `minFps` or more over a 1 s window (observed counter
 * advances). A frozen last frame keeps the right colour, so colour alone
 * passed recovery checks on stuck media.
 *
 * Recovery is timed from the first advancing frame itself, and that frame
 * must land by `deadlineAt`: a window that opened just before the deadline
 * cannot count frames that arrived after it.
 * @param {{ page: { evaluate: Function } }} peer
 * @param {string} participantId
 * @param {{ deadlineAt: number, minFps?: number, label?: string | null,
 *   readColor?: () => Promise<{ ok?: boolean, label?: string } | null>,
 *   readFps?: () => Promise<{ fps: number, firstAdvanceAt: number | null }> }} opts
 */
export async function waitForLiveMedia(peer, participantId, { deadlineAt, minFps = 15, label = null, readColor, readFps }) {
  const color =
    readColor ??
    (() =>
      peer.page.evaluate(
        `(async () => { const c = await window.__decodeRemoteColor(${JSON.stringify(participantId)}); return c ? { ok: c.ok, label: c.label } : null; })()`,
      ));
  const fpsOf = readFps ?? (() => measureFps(peer, participantId, 1000));
  /** @type {{ color: unknown, fps: number | null, firstAdvanceAt: number | null }} */
  let last = { color: null, fps: null, firstAdvanceAt: null };
  for (;;) {
    const c = await color();
    if (c?.ok && (!label || c.label === label)) {
      const { fps, firstAdvanceAt } = await fpsOf();
      last = { color: c, fps, firstAdvanceAt };
      if (fps >= minFps && firstAdvanceAt != null) {
        if (firstAdvanceAt > deadlineAt) {
          throw new Error(`${participantId}'s first advancing frame came ${firstAdvanceAt - deadlineAt} ms after the deadline`);
        }
        return { liveAt: firstAdvanceAt, fps, label: c.label };
      }
    } else {
      last = { color: c, fps: null, firstAdvanceAt: null };
    }
    if (Date.now() > deadlineAt) {
      throw new Error(`${participantId}'s media not live by the deadline: need the right colour and >= ${minFps} fps over 1 s (last ${JSON.stringify(last)})`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}
