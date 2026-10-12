/**
 * RTCPeerConnection / getUserMedia probe, injected per browser context
 * (CONTRACT.md "Runner contract"). All receipt evidence comes from the DOM
 * contract plus this probe — never app internals.
 *
 * probeInit is the raw init-script source (addInitScript accepts a string).
 * An optional RTCConfiguration override is delivered by a second init script
 * (probeConfigInit) that scenarios H-07 / H-15 enable: the wrapped constructor
 * then forces every peer connection onto the harness-controlled relay path
 * (local TURN behind the UDP shaper, iceTransportPolicy "relay").
 */

export const probeInit = String.raw`
(() => {
  if (window.__callProbe) return;
  const NativePC = window.RTCPeerConnection;
  const NativeGUM = navigator.mediaDevices
    ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    : null;

  const probe = {
    connections: { live: 0, opened: 0 },
    tracks: { live: 0, created: 0 },
    getStatsCalls: 0,
    pcs: [],
  };
  window.__callProbe = probe;
  let seq = 0;

  function recount() {
    let live = 0;
    let opened = 0;
    for (const r of probe.pcs) {
      if (r.connectionState !== 'closed') live++;
      if (r.everConnected) opened++;
    }
    probe.connections.live = live;
    probe.connections.opened = opened;
  }

  function record(pc) {
    const rec = {
      id: ++seq,
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      signalingState: pc.signalingState,
      // H-11 asserts on closed directly; the reviewed bug never recorded it,
      // so every record read as not-closed regardless of the real state.
      closed: pc.connectionState === 'closed',
      everConnected: false,
    };
    probe.pcs.push(rec);
    const sync = () => {
      rec.connectionState = pc.connectionState;
      rec.iceConnectionState = pc.iceConnectionState;
      rec.signalingState = pc.signalingState;
      rec.closed = pc.connectionState === 'closed';
      if (pc.connectionState === 'connected') rec.everConnected = true;
      recount();
    };
    pc.addEventListener('connectionstatechange', sync);
    pc.addEventListener('iceconnectionstatechange', sync);
    pc.addEventListener('signalingstatechange', sync);
    rec.sync = sync;
    return rec;
  }

  class WrappedPC extends NativePC {
    constructor(cfg) {
      super(window.__probeRtcConfig || cfg);
      this.__probe = record(this);
      // Registry of the real pc instances (probe.pcs holds records only):
      // the runner reads receivers/getStats through these, which also keeps
      // getStatsCalls honest (H-11 counts deltas, not absolutes).
      (window.__wrappedPcs = window.__wrappedPcs || []).push(this);
    }
    getStats(...args) {
      probe.getStatsCalls++;
      return super.getStats(...args);
    }
    // close() fires no connectionstatechange event, so the record must
    // sync here or a cleanly closed pc would count as live forever.
    close() {
      super.close();
      this.__probe.sync();
    }
  }
  window.RTCPeerConnection = WrappedPC;

  // H-08's contract mechanism is a forced ICE restart on the live PCs, not
  // socket killing (that was the mock relay's approximation and it broke
  // real transports). Returns one boolean per wrapped pc so the scenario
  // can assert the restart was actually attempted on every connection.
  window.__probeRestartIce = () => (window.__wrappedPcs || []).map((pc) => {
    try {
      if (typeof pc.restartIce !== 'function') return false;
      pc.restartIce();
      return true;
    } catch {
      return false;
    }
  });

  // A capture track ends either by its source ending (the 'ended' event) or
  // by stop(), which fires no event. Both paths decrement once.
  const captured = new WeakSet();
  const markEnded = (track) => {
    if (!captured.has(track)) return;
    captured.delete(track);
    probe.tracks.live--;
  };
  if (typeof MediaStreamTrack !== 'undefined') {
    const nativeStop = MediaStreamTrack.prototype.stop;
    MediaStreamTrack.prototype.stop = function stop() {
      nativeStop.call(this);
      markEnded(this);
    };
  }
  if (NativeGUM) {
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await NativeGUM(constraints);
      for (const track of stream.getTracks()) {
        probe.tracks.created++;
        probe.tracks.live++;
        captured.add(track);
        track.addEventListener('ended', () => markEnded(track));
      }
      return stream;
    };
  }
})();
`;

/** Second init script: installs the relay-only RTCConfiguration override. */
export const probeConfigInit = (config) => {
  window.__probeRtcConfig = config;
};

export function hasProbe() {
  return typeof window !== 'undefined' && !!window.__callProbe;
}
