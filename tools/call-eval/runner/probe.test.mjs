/**
 * Probe record tests (reviewed bug: H-11 tested `pc.closed`, which the probe
 * never recorded).
 *
 * probeInit is raw init-script source executed inside the browser. These
 * tests run it in a plain Node function scope with fake RTCPeerConnection /
 * getUserMedia stand-ins — no browser — and drive state transitions through
 * the probe's own event listeners. The closed-state test fails against the
 * old code: the record had no `closed` field, so every pc read as
 * not-closed and H-11's all-closed assertion could never see the truth.
 */
import { describe, expect, it } from "vitest";
import { probeInit } from "./probe.mjs";

/** @typedef {{ [event: string]: ((evt: object) => void)[] }} HandlerMap */

class FakePC {
  /** @param {{ iceServers?: object[] }} [cfg] */
  constructor(cfg) {
    this.__cfg = cfg;
    this.connectionState = "new";
    this.iceConnectionState = "new";
    this.signalingState = "stable";
    /** @type {HandlerMap} */
    this.__handlers = {};
  }
  /** @param {string} type @param {(evt: object) => void} fn */
  addEventListener(type, fn) {
    (this.__handlers[type] ??= []).push(fn);
  }
  /** @param {string} type */
  fire(type) {
    for (const fn of this.__handlers[type] ?? []) fn({ type });
  }
  close() {
    this.connectionState = "closed";
    this.fire("connectionstatechange");
  }
  getStats() {
    return Promise.resolve(new Map());
  }
  getReceivers() {
    return [];
  }
  restartIce() {
    this.__restarted = (this.__restarted ?? 0) + 1;
  }
}

function fakeTrack() {
  /** @type {HandlerMap} */
  const handlers = {};
  return {
    id: "track-1",
    kind: "video",
    readyState: "live",
    /** @param {string} type @param {(evt: object) => void} fn */
    addEventListener(type, fn) {
      (handlers[type] ??= []).push(fn);
    },
    stop() {
      this.readyState = "ended";
      for (const fn of handlers.ended ?? []) fn({});
    },
  };
}

/**
 * Executes probeInit against a fake browser scope and returns the scope.
 * @param {{ rtcConfig?: object }} [opts]
 */
function boot({ rtcConfig } = {}) {
  /** @type {{ RTCPeerConnection: typeof FakePC, __probeRtcConfig?: object, __wrappedPcs?: FakePC[] }} */
  const windowObj = { RTCPeerConnection: FakePC };
  if (rtcConfig) windowObj.__probeRtcConfig = rtcConfig;
  const track = fakeTrack();
  /** @param {object} _constraints */
  async function fakeGetUserMedia(_constraints) {
    return { getTracks: () => [track] };
  }
  const navigatorObj = {
    mediaDevices: { getUserMedia: fakeGetUserMedia },
  };
  const probe = new Function("window", "navigator", `${probeInit}\n;return window.__callProbe;`)(
    windowObj,
    navigatorObj,
  );
  return { windowObj, navigatorObj, track, probe };
}

describe("probe connection records", () => {
  it("records closed state as connections close (H-11's assertion target)", () => {
    const { windowObj, probe } = boot();
    const pc = new windowObj.RTCPeerConnection();
    const rec = probe.pcs[0];
    expect(rec.closed).toBe(false);
    expect(probe.pcs.length).toBe(1);

    pc.connectionState = "connected";
    pc.fire("connectionstatechange"); // recount runs on state changes
    expect(rec.everConnected).toBe(true);
    expect(rec.closed).toBe(false);
    expect(probe.connections.live).toBe(1);

    pc.close();
    expect(rec.closed).toBe(true); // old code: undefined — H-11 could never observe closure
    expect(probe.connections.live).toBe(0);
  });

  it("keeps the wrapped constructor's getStats accounting and config override", async () => {
    const forced = { iceServers: [], iceTransportPolicy: "relay" };
    const { windowObj, probe } = boot({ rtcConfig: forced });
    const pc = new windowObj.RTCPeerConnection({ iceServers: [] });
    expect(pc.__cfg).toBe(forced); // super(window.__probeRtcConfig || cfg)
    await pc.getStats();
    expect(probe.getStatsCalls).toBe(1);
    expect(windowObj.__wrappedPcs).toContain(pc);
  });

  it("exposes __probeRestartIce over every wrapped pc (H-08's mechanism)", () => {
    const { windowObj } = boot();
    expect(typeof windowObj.__probeRestartIce).toBe("function"); // old probe: undefined
    windowObj.__wrappedPcs = []; // reset: boot() itself may have created none
    const pc1 = new windowObj.RTCPeerConnection();
    const pc2 = new windowObj.RTCPeerConnection();
    const result = windowObj.__probeRestartIce();
    expect(result).toEqual([true, true]);
    expect(pc1.__restarted).toBe(1);
    expect(pc2.__restarted).toBe(1);
  });

  it("counts live tracks through the wrapped getUserMedia", async () => {
    const { navigatorObj, track, probe } = boot();
    await navigatorObj.mediaDevices.getUserMedia({ video: true });
    expect(probe.tracks.created).toBe(1);
    expect(probe.tracks.live).toBe(1);
    track.stop();
    expect(probe.tracks.live).toBe(0);
  });
});
