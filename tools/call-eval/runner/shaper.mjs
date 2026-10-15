/**
 * Harness-controlled UDP shaper (H-07 / H-15 fault mechanism).
 *
 * Chromium's network emulation and Playwright route interception shape the
 * browser's HTTP stack only; ICE/STUN/TURN and RTP ride Chromium's own UDP
 * sockets that CDP never touches. This shaper is a user-space dgram proxy in
 * front of the harness TURN relay, with seeded loss decisions and a fixed
 * delay queue. Scenarios force peer connections onto
 * `iceTransportPolicy: "relay"`, so all of a shaped participant's RTP passes
 * through here in both directions.
 *
 * Loss and delay apply to both directions: 100% loss makes the participant
 * fully offline (H-07), not just mute. H-15 shapes one participant only, so
 * a 5% profile is 5% per direction on that participant's link, not doubled.
 */
import dgram from "node:dgram";

/** Deterministic 32-bit PRNG so a seed reproduces a run's exact loss pattern. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createShaper({ seed = 1 } = {}) {
  const rng = mulberry32(seed);
  /** @type {import('node:dgram').Socket | null} */
  let socket = null; // client-facing listener
  /** @type {{ address: string, port: number } | null} */
  let target = null; // the TURN endpoint media is proxied to
  // One uplink socket per browser source port, like a NAT mapping. Chromium
  // can open several UDP sockets to the same TURN server (one per network
  // interface or connection); a single shared uplink sent every reply to the
  // last source seen, so the other sockets' allocations never completed.
  /** @type {Map<string, import('node:dgram').Socket>} */
  const uplinks = new Map();
  let profile = { lossPct: 0, delayMs: 0 };
  const timers = new Set();
  const stats = { forwarded: 0, dropped: 0, droppedUp: 0, droppedDown: 0 };

  const lose = () => profile.lossPct > 0 && rng() * 100 < profile.lossPct;

  /** @param {Buffer} msg @param {{ address: string, port: number }} rinfo */
  function onClient(msg, rinfo) {
    if (!target || !socket) return;
    const k = `${rinfo.address}:${rinfo.port}`;
    let uplink = uplinks.get(k);
    if (!uplink) {
      const client = { address: rinfo.address, port: rinfo.port };
      const fresh = dgram.createSocket("udp4");
      fresh.on("error", () => {});
      fresh.on("message", (reply) => {
        if (lose()) {
          stats.dropped++;
          stats.droppedDown++;
          return;
        }
        shapedSend(reply, client, socket);
      });
      fresh.bind(0, "127.0.0.1");
      uplinks.set(k, fresh);
      uplink = fresh;
    }
    if (lose()) {
      stats.dropped++;
      stats.droppedUp++;
      return;
    }
    shapedSend(msg, target, uplink);
  }

  /** @param {Buffer} msg @param {{ address: string, port: number }} dest @param {import('node:dgram').Socket | null | undefined} via */
  function shapedSend(msg, dest, via) {
    const send = () => {
      if (!via) return;
      try {
        via.send(msg, dest.port, dest.address);
        stats.forwarded++;
      } catch {
        /* socket closed mid-flight */
      }
    };
    if (profile.delayMs > 0) {
      const t = setTimeout(() => {
        timers.delete(t);
        send();
      }, profile.delayMs);
      timers.add(t);
    } else {
      send();
    }
  }

  return {
    /** Bind the proxy port; UDP to it is forwarded to the TURN port. */
    start({ listenPort, targetPort, targetHost = "127.0.0.1" }) {
      target = { address: targetHost, port: targetPort };
      return new Promise((resolve, reject) => {
        const listener = dgram.createSocket("udp4");
        socket = listener;
        listener.on("message", onClient);
        listener.once("error", reject);
        listener.bind(listenPort, "127.0.0.1", () => {
          listener.on("error", () => {});
          resolve(listener.address().port);
        });
      });
    },
    /** Apply a shaping profile; lossPct 0 + delayMs 0 = passthrough. */
    applyProfile(next) {
      profile = { lossPct: next.lossPct ?? 0, delayMs: next.delayMs ?? 0 };
    },
    clear() {
      this.applyProfile({ lossPct: 0, delayMs: 0 });
    },
    stats() {
      return { ...stats, uplinks: uplinks.size };
    },
    stop() {
      for (const t of timers) clearTimeout(t);
      timers.clear();
      for (const u of uplinks.values()) {
        try {
          u.close();
        } catch {
          /* already closed */
        }
      }
      uplinks.clear();
      try {
        socket?.close();
      } catch {
        /* already closed */
      }
      socket = null;
    },
  };
}
