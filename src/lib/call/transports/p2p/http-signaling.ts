/**
 * HTTP signaling adapter for the P2P mesh, over LinkedUp's signaling
 * endpoint (src/app/api/call/signal/route.ts, src/lib/call/mesh.ts). It
 * follows Connvo's Convex adapter, with polling where Convex pushed:
 *
 * One open() is one session: join, then poll. Each poll is the session's
 * heartbeat, acknowledges the signals handled since the last poll, and
 * returns presence and unread signals. Presence changes become
 * peer-joined/peer-left (a participant whose session changed, a reloaded
 * tab, is reported as leaving and joining again, so the mesh rebuilds that
 * connection).
 *
 * How a connection ends:
 * - "rejected": the server refused the join or a poll (not a member, the
 *   room ended, the call is full, not signed in). Asking again gets the
 *   same answer.
 * - "replaced": a poll reports the session closed by a newer tab.
 * - "lost": the network failed, polls stopped answering for
 *   POLL_STALL_MS, or the session expired. The mesh reconnects with a new
 *   session.
 *
 * Outgoing signals queue and leave in order, up to SEND_BATCH per request,
 * one request at a time: the server stores them in the order the mesh made
 * them, and a burst of candidates costs a request or two, not twenty.
 */
import {
  SEND_BATCH,
  type InboundSignal,
  type PollResult,
  type PresenceEntry,
  type WireSignal,
} from "../../signal-protocol";
import type { P2PSignal, SignalingAdapter, SignalingClose, SignalingConnection } from "./signaling";

/** Time between polls. Signals wait at most this long on the server. */
export const POLL_MS = 250;
/** Polls that have not succeeded for this long count as a lost connection. */
export const POLL_STALL_MS = 6000;
/**
 * How long a signal from a sender presence has not shown is kept before it
 * is acknowledged unread. A sender's first offer can beat its presence entry
 * by a poll; a sender that never appears has closed, and its signals would
 * otherwise hold places in this session's capped queue.
 */
export const UNKNOWN_SENDER_HOLD_MS = 5000;

/**
 * Times a send batch is tried before it is dropped, and the wait before the
 * first retry (doubling after). A batch that failed on the network or that
 * the server aborted (503) changed nothing, so sending it again is safe;
 * dropping it would lose an offer or candidates the mesh is waiting on.
 */
export const SEND_ATTEMPTS = 4;
export const SEND_RETRY_MS = 150;

/** Codes that mean "asking again gets the same answer". */
const REFUSALS = new Set(["UNAUTHORIZED", "FORBIDDEN", "VALIDATION", "ROOM_ENDED", "CALL_FULL"]);

class HttpRefusal extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface HttpSignalingOptions {
  /** The endpoint URL (the journey-proof path passes its own). */
  endpoint: string;
  /** Fetch to use (tests pass a fake). */
  fetch?: typeof fetch;
  newSessionId?: () => string;
}

function toWire(signal: P2PSignal): WireSignal {
  if ("description" in signal) {
    const { type, sdp } = signal.description;
    return { kind: "description", type: (type ?? "offer") as "offer", sdp: sdp ?? "" };
  }
  // RTCIceCandidateInit uses null for absent fields; the endpoint takes only absent ones.
  const c = signal.candidate;
  return {
    kind: "candidate",
    candidate: c.candidate ?? "",
    ...(c.sdpMLineIndex != null ? { sdpMLineIndex: c.sdpMLineIndex } : {}),
    ...(c.sdpMid != null ? { sdpMid: c.sdpMid } : {}),
    ...(c.usernameFragment != null ? { usernameFragment: c.usernameFragment } : {}),
  };
}

function fromWire(signal: WireSignal): P2PSignal {
  if (signal.kind === "description") return { description: { type: signal.type, sdp: signal.sdp } };
  return {
    candidate: {
      candidate: signal.candidate,
      sdpMLineIndex: signal.sdpMLineIndex ?? null,
      sdpMid: signal.sdpMid ?? null,
      usernameFragment: signal.usernameFragment ?? null,
    },
  };
}

export function httpSignaling(options: HttpSignalingOptions): SignalingAdapter {
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const newSessionId = options.newSessionId ?? (() => crypto.randomUUID());

  /** One request; a refusal body becomes HttpRefusal, anything else a plain Error. */
  async function call<T>(body: Record<string, unknown>, keepalive = false): Promise<T> {
    const res = await doFetch(options.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      keepalive,
    });
    if (res.ok) return (await res.json()) as T;
    let detail: { code?: string; message?: string } = {};
    try {
      detail = (await res.json()) as typeof detail;
    } catch {
      /* not JSON: an outage page, a proxy */
    }
    throw new HttpRefusal(detail.code ?? `HTTP_${res.status}`, detail.message ?? `The call service answered ${res.status}.`);
  }

  return {
    open(session, handlers): SignalingConnection {
      const roomId = session.meetingId;
      const sessionId = newSessionId();
      let closed = false;
      let joined = false;
      let welcomed = false;
      /** participantId -> their current session */
      const peers = new Map<string, PresenceEntry>();
      const seen = new Set<number>();
      /** Signals from sessions presence has not shown yet, by signal id. */
      const held = new Map<number, { row: InboundSignal; since: number }>();
      let pendingAck: number[] = [];
      let pollTimer: ReturnType<typeof setTimeout> | null = null;
      let lastPollOk = Date.now();
      const outbox: Array<{ to: string; signal: P2PSignal }> = [];
      let flushing = false;

      const shutdown = () => {
        closed = true;
        if (pollTimer) clearTimeout(pollTimer);
        pollTimer = null;
        outbox.length = 0;
      };
      const report = (reason: SignalingClose) => {
        if (closed) return;
        shutdown();
        handlers.onClosed(reason);
      };
      const refusedOrLost = (err: unknown, fallback: string) => {
        if (err instanceof HttpRefusal && REFUSALS.has(err.code)) report({ kind: "rejected", message: err.message });
        else report({ kind: "lost", message: err instanceof Error ? err.message : fallback });
      };

      const applyPresence = (entries: PresenceEntry[]) => {
        const now = new Map<string, PresenceEntry>();
        for (const e of entries) {
          if (e.sessionId === sessionId) continue;
          now.set(e.participantId, e);
        }
        if (!welcomed) {
          welcomed = true;
          for (const [id, e] of now) peers.set(id, e);
          handlers.onWelcome([...now.keys()]);
          for (const [id, e] of now) handlers.onRemoteState({ participantId: id, micOn: e.micOn, cameraOn: e.cameraOn });
          return;
        }
        for (const [id, before] of [...peers]) {
          const after = now.get(id);
          if (!after || after.sessionId !== before.sessionId) {
            peers.delete(id);
            handlers.onPeerLeft(id, after ? "rejoined" : "left");
          }
        }
        for (const [id, e] of now) {
          const before = peers.get(id);
          if (!before) {
            peers.set(id, e);
            handlers.onPeerJoined(id);
            handlers.onRemoteState({ participantId: id, micOn: e.micOn, cameraOn: e.cameraOn });
          } else if (before.micOn !== e.micOn || before.cameraOn !== e.cameraOn) {
            peers.set(id, e);
            handlers.onRemoteState({ participantId: id, micOn: e.micOn, cameraOn: e.cameraOn });
          }
        }
      };

      const applySignals = (rows: InboundSignal[]) => {
        for (const row of rows) {
          if (closed) return;
          if (seen.has(row.id)) continue;
          const known = peers.get(row.fromParticipantId);
          // A peer's first offer can arrive before presence shows the peer:
          // hold it until presence does.
          if (!known) {
            if (!held.has(row.id)) held.set(row.id, { row, since: Date.now() });
            continue;
          }
          held.delete(row.id);
          seen.add(row.id);
          pendingAck.push(row.id);
          // A signal from a session the peer has since replaced is stale.
          if (known.sessionId !== row.fromSessionId) continue;
          handlers.onSignal(row.fromParticipantId, fromWire(row.signal));
        }
      };

      const dropUnclaimed = () => {
        const now = Date.now();
        for (const [id, h] of held) {
          if (now - h.since <= UNKNOWN_SENDER_HOLD_MS) continue;
          held.delete(id);
          seen.add(id);
          pendingAck.push(id);
        }
      };

      const poll = async () => {
        pollTimer = null;
        if (closed) return;
        dropUnclaimed();
        const ack = pendingAck.slice(0, 100);
        try {
          const result = await call<PollResult>({ op: "poll", roomId, sessionId, ack });
          if (closed) return;
          lastPollOk = Date.now();
          pendingAck = pendingAck.slice(ack.length);
          if (!result.alive) {
            if (result.reason === "replaced") report({ kind: "replaced", message: "This call is open in another window or tab." });
            else if (result.reason === "ended") report({ kind: "rejected", message: "This call has ended." });
            else report({ kind: "lost", message: "the call session expired" });
            return;
          }
          applyPresence(result.presence);
          applySignals([...held.values()].map((h) => h.row));
          applySignals(result.signals);
        } catch (err) {
          if (closed) return;
          if (err instanceof HttpRefusal && REFUSALS.has(err.code)) {
            refusedOrLost(err, "");
            return;
          }
          // A failed poll is retried; only a long run of them is a lost connection.
          if (Date.now() - lastPollOk > POLL_STALL_MS) {
            report({ kind: "lost", message: "the call service stopped answering" });
            return;
          }
        }
        if (!closed) pollTimer = setTimeout(() => void poll(), POLL_MS);
      };

      const flush = async () => {
        if (flushing || closed || !joined) return;
        flushing = true;
        try {
          while (outbox.length && !closed) {
            const batch = outbox.splice(0, SEND_BATCH);
            const signals = batch.flatMap(({ to, signal }) => {
              const peer = peers.get(to);
              return peer ? [{ toSessionId: peer.sessionId, signal: toWire(signal) }] : [];
            });
            if (!signals.length) continue;
            for (let attempt = 1; attempt <= SEND_ATTEMPTS && !closed; attempt++) {
              try {
                await call({ op: "send", roomId, sessionId, signals });
                break;
              } catch (err) {
                // A refusal (ended room, full queue, rate limit) gets the same
                // answer again; the mesh renegotiates if a connection does
                // not come up. Network failures and aborted sends retry,
                // ahead of anything queued after them, so order holds.
                const transient = !(err instanceof HttpRefusal) || err.code === "RETRY" || err.code.startsWith("HTTP_5");
                if (!transient || attempt === SEND_ATTEMPTS) break;
                await new Promise((r) => setTimeout(r, SEND_RETRY_MS * 2 ** (attempt - 1)));
              }
            }
          }
        } finally {
          flushing = false;
        }
      };

      void (async () => {
        try {
          await call({ op: "join", roomId, sessionId });
        } catch (err) {
          refusedOrLost(err, "This call could not be joined.");
          return;
        }
        if (closed) {
          void call({ op: "leave", roomId, sessionId }, true).catch(() => {});
          return;
        }
        joined = true;
        lastPollOk = Date.now();
        await poll();
      })();

      return {
        send(to, signal) {
          if (closed || !peers.has(to)) return;
          outbox.push({ to, signal });
          void flush();
        },
        publishState(state) {
          if (!joined || closed) return;
          void call({ op: "state", roomId, sessionId, micOn: state.micOn, cameraOn: state.cameraOn }).catch(() => {});
        },
        close() {
          const wasJoined = joined;
          shutdown();
          // keepalive: the leave still goes out when the page is unloading.
          if (wasJoined) void call({ op: "leave", roomId, sessionId }, true).catch(() => {});
        },
      };
    },
  };
}
