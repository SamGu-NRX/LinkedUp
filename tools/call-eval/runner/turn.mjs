/**
 * TURN for the H-07 / H-15 fault path. The relay is the in-process Node
 * server in turn-relay.mjs, so a run needs no coturn binary. Each
 * participant's UDP shaper forwards a distinct port to it, and relay-forced
 * peers receive `turn:127.0.0.1:<their shaper port>`.
 */
import { startTurnRelay } from "./turn-relay.mjs";

/** The relay ships with the harness, so it is always available. */
export function turnAvailable() {
  return Promise.resolve(true);
}

/** @param {{ port?: number, user?: string, pass?: string, sharedSecret?: string | null }} [options] */
export async function createTurn({ port = 0, user = "eval-user", pass = "eval-pass", sharedSecret = null } = {}) {
  const relay = await startTurnRelay({ port, realm: "linkedup-eval", password: pass, sharedSecret });
  return { port: relay.port, user, pass, stats: relay.stats, stop: () => relay.stop() };
}

/**
 * Relay-only RTCConfiguration pointing at one participant's shaper port.
 * @param {{ user: string, pass: string }} turn
 * @param {number} shaperPort
 */
export function relayConfig(turn, shaperPort) {
  return {
    iceServers: [
      {
        urls: `turn:127.0.0.1:${shaperPort}?transport=udp`,
        username: turn.user,
        credential: turn.pass,
      },
    ],
    iceTransportPolicy: "relay",
  };
}
