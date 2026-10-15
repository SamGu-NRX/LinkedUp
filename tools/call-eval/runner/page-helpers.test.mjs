/**
 * measureFps and color classification tests over known inputs.
 *
 * measureFps samples inside the page (requestVideoFrameCallback plus a 10 ms
 * timer) and returns the samples to Node in one evaluate call; the fake page
 * below stands in for that call with the samples a stream at `fps` produces
 * when read every 10 ms. The reviewed bug sampled through one Node round trip
 * per read, which capped the observable rate under load.
 */
import { describe, expect, it } from "vitest";
import { matchPeerColor, measureFps, toneMatches, toneIsSilent, waitForLiveMedia, waitForSilence } from "./page-helpers.mjs";
import { decodeToneHz } from "../lib/decoders.mjs";

/** 0.5 s of a pure tone at 48 kHz (decodeToneHz caps its window at 12000 samples). */
/** @param {number} hz @param {number} [sampleRate] @param {number} [seconds] @param {number} [amp] */
function toneBuffer(hz, sampleRate = 48000, seconds = 0.5, amp = 0.6) {
  const out = new Float32Array(Math.floor(sampleRate * seconds));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / sampleRate);
  return out;
}

/** Fake peer whose in-page sampler returns a stream at `fps`, read every 10 ms.
 * @param {number} fps */
function fakePeerAt(fps) {
  return {
    peerId: "A",
    page: {
      /** @param {unknown} _fn @param {{ ms: number }} arg */
      evaluate: async (_fn, arg) => {
        const out = [];
        for (let t = 0; t < arg.ms; t += 10) out.push({ t, counter: Math.floor((t * fps) / 1000) % 4096 });
        return { samples: out, timeOrigin: Date.now() };
      },
    },
  };
}

describe("measureFps", () => {
  it("measures a healthy 30 fps stream at about 30 fps", async () => {
    const result = await measureFps(fakePeerAt(30), "B", 2000);
    expect(result.fps).toBeGreaterThan(29);
    expect(result.fps).toBeLessThan(31);
    expect(result.implausible).toBe(false);
  });

  it("measures a 10 fps stream below the H-01 bar", async () => {
    const result = await measureFps(fakePeerAt(10), "B", 2000);
    expect(result.fps).toBeLessThan(15);
  });

  it("reports a frozen stream as 0 fps", async () => {
    const result = await measureFps(fakePeerAt(0), "B", 1500);
    expect(result.fps).toBe(0);
  });

  it("reports no tile as 0 fps", async () => {
    const peer = { peerId: "A", page: { evaluate: async () => ({ samples: [], timeOrigin: 0 }) } };
    expect((await measureFps(peer, "B", 1000)).fps).toBe(0);
  });
});

describe("matchPeerColor", () => {
  // Known inputs: each pinned fixture color, shifted by the y4m round trip.
  it.each([
    ["A", { r: 205, g: 35, b: 35 }],
    ["B", { r: 35, g: 150, b: 85 }],
    ["C", { r: 45, g: 85, b: 175 }],
    ["second-camera", { r: 170, g: 40, b: 170 }],
    ["B", { r: 46, g: 140, b: 92 }],
  ])("classifies %s", (label, rgb) => {
    const match = matchPeerColor(rgb);
    expect(match.label).toBe(label);
    expect(match.ok).toBe(true);
  });

  it("rejects a color far from every peer", () => {
    expect(matchPeerColor({ r: 128, g: 128, b: 128 }).ok).toBe(false);
  });
});

describe("tone predicates over real decoders", () => {
  it("matches the sender's tone peak from the decoded object", () => {
    // Known inputs: decodeToneHz on a 440 Hz sine. The reviewed H-02 bug did
    // Math.abs(decode - expected) on the OBJECT — NaN arithmetic — so a
    // healthy tone never matched.
    const decoded = decodeToneHz(toneBuffer(440), 48000);
    expect(decoded.peakHz).toBeGreaterThan(439.5);
    expect(decoded.peakHz).toBeLessThan(440.5);
    expect(decoded.rms).toBeGreaterThan(0.3);
    expect(toneMatches(decoded, 440)).toBe(true);
    expect(toneMatches(decoded, 660)).toBe(false);
    expect(toneMatches(decoded, 660, 5)).toBe(false);
  });

  it("counts digital silence and nothing-heard as muted", () => {
    // Known inputs: an all-zero buffer decodes to { peakHz: 0, rms: 0 }.
    const silence = decodeToneHz(new Float32Array(24000), 48000);
    expect(silence.peakHz).toBe(0);
    expect(toneIsSilent(silence)).toBe(true);
    // The reviewed H-03 bug compared the decode OBJECT to 0 — always truthy —
    // and threw "muted remote still produced a peak" on every healthy call.
    expect(toneMatches(silence, 440)).toBe(false);
    expect(toneIsSilent(null)).toBe(true); // no stream/track: sampleRemoteTone returns null
    expect(toneIsSilent({ peakHz: 87, rms: 0.0005 })).toBe(true); // sub-floor noise bin
    expect(toneIsSilent({ peakHz: 660, rms: 0.4 })).toBe(false); // an actual tone is NOT silent
  });
});

describe("waitForSilence (H-03)", () => {
  // Known input: the received-rms timeline measured on the reference bench
  // after A muted (attribute flip at ~30 ms; tone until ~190 ms; silent from
  // ~345 ms). The old H-03 took one 700 ms sample at the flip; this one
  // contains the tone tail, so a healthy call read as "still audible".
  const timeline = [
    { untilMs: 250, rms: 0.19, peakHz: 440 },
    { untilMs: Infinity, rms: 0, peakHz: 0 },
  ];
  /** @param {{ value: number }} clock */
  const samplerOn = (clock) => async () => {
    clock.value += 150;
    const step = timeline.find((s) => clock.value - 150 < s.untilMs);
    return step ? { rms: step.rms, peakHz: step.peakHz } : null;
  };

  it("passes a healthy mute whose audio drains within the bar", async () => {
    const clock = { value: 0 };
    const result = await waitForSilence(samplerOn(clock), { deadlineMs: 1000, now: () => clock.value });
    expect(result.silent).toBe(true);
    expect(result.afterMs).toBeLessThanOrEqual(450);
  });

  it("a single sample taken at the flip would have read the tail as audible", async () => {
    const clock = { value: 0 };
    const first = await samplerOn(clock)();
    expect(toneIsSilent(first)).toBe(false);
  });

  it("fails a sender whose audio never stops", async () => {
    let t = 0;
    const result = await waitForSilence(async () => ((t += 150), { rms: 0.4, peakHz: 440 }), { deadlineMs: 1000, now: () => t });
    expect(result.silent).toBe(false);
    expect(result.afterMs).toBeGreaterThanOrEqual(1000);
  });
});

describe("waitForLiveMedia (H-07, H-08, H-09 recovery)", () => {
  const rightColor = async () => ({ ok: true, label: "A" });
  const soon = () => Date.now() + 300;

  it("rejects a frozen last frame even though its colour is right", async () => {
    // Known input: the tile keeps A's colour but the counter never advances,
    // which the old colour-only recovery check accepted.
    await expect(
      waitForLiveMedia(fakePeerAt(0), "A", { deadlineAt: soon(), label: "A", readColor: rightColor }),
    ).rejects.toThrow(/not live/);
  });

  it("accepts the right colour with frames advancing at 30 fps, timed from the first advance", async () => {
    const before = Date.now();
    const live = await waitForLiveMedia(fakePeerAt(30), "A", { deadlineAt: soon(), label: "A", readColor: rightColor });
    expect(live.fps).toBeGreaterThan(29);
    expect(live.liveAt).toBeGreaterThanOrEqual(before);
  });

  it("rejects advancing frames of the wrong person", async () => {
    await expect(
      waitForLiveMedia(fakePeerAt(30), "A", { deadlineAt: soon(), label: "A", readColor: async () => ({ ok: true, label: "B" }) }),
    ).rejects.toThrow(/not live/);
  });

  it("rejects a stream that advances below the bar", async () => {
    await expect(
      waitForLiveMedia(fakePeerAt(10), "A", { deadlineAt: soon(), label: "A", readColor: rightColor }),
    ).rejects.toThrow(/not live/);
  });

  it("rejects a window that opens before the deadline when the first advance comes after it", async () => {
    // Known input: the 1 s window starts 200 ms before the deadline, but the
    // first frame that moves arrives 300 ms after it.
    const deadlineAt = Date.now() + 200;
    await expect(
      waitForLiveMedia(fakePeerAt(30), "A", {
        deadlineAt,
        label: "A",
        readColor: rightColor,
        readFps: async () => ({ fps: 30, firstAdvanceAt: deadlineAt + 300 }),
      }),
    ).rejects.toThrow(/after the deadline/);
  });
});
