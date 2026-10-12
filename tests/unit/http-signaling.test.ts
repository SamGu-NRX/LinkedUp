// @vitest-environment node
// The HTTP signaling adapter against a scripted endpoint: what the mesh is
// told for each answer the server can give.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POLL_MS,
  POLL_STALL_MS,
  UNKNOWN_SENDER_HOLD_MS,
  httpSignaling,
} from "@/lib/call/transports/p2p/http-signaling";
import type { SignalingHandlers } from "@/lib/call/transports/p2p/signaling";
import { SEND_BATCH, type PresenceEntry } from "@/lib/call/signal-protocol";

const ROOM = "11111111-1111-4111-8111-111111111111";
const SELF = "self-session-0001";

type Body = { op: string; [k: string]: unknown };
type Reply = { status: number; json?: unknown } | Error;

/** A scripted endpoint: every request is recorded; answers come from `answer`. */
function fakeEndpoint() {
  const requests: Array<{ body: Body; keepalive: boolean }> = [];
  let pollReply: () => Reply = () => ({ status: 200, json: { alive: true, presence: [], signals: [] } });
  let joinReply: Reply = { status: 200, json: { sessionId: SELF, participantId: "1" } };
  let sendGate: Promise<void> | null = null;
  const fetchFn = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Body;
    requests.push({ body, keepalive: Boolean(init.keepalive) });
    let reply: Reply = { status: 200, json: { ok: true } };
    if (body.op === "join") reply = joinReply;
    if (body.op === "poll") reply = pollReply();
    if (body.op === "send") {
      if (sendGate) await sendGate;
      reply = { status: 200, json: { delivered: (body.signals as unknown[]).map(() => true) } };
    }
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.json ?? {}), { status: reply.status });
  }) as unknown as typeof fetch;
  return {
    fetchFn,
    requests,
    ops: (op: string) => requests.filter((r) => r.body.op === op),
    setPoll: (fn: () => Reply) => (pollReply = fn),
    setJoin: (r: Reply) => (joinReply = r),
    gateSends: () => {
      let open!: () => void;
      sendGate = new Promise((r) => (open = r));
      return () => {
        sendGate = null;
        open();
      };
    },
  };
}

function recorder() {
  const events: string[] = [];
  const signals: Array<{ from: string; signal: unknown }> = [];
  const closed: Array<{ kind: string; message: string }> = [];
  const handlers: SignalingHandlers = {
    onWelcome: (peers) => events.push(`welcome ${peers.join(",")}`),
    onPeerJoined: (id) => events.push(`joined ${id}`),
    onPeerLeft: (id, reason) => events.push(`left ${id} ${reason}`),
    onSignal: (from, signal) => signals.push({ from, signal }),
    onRemoteState: (s) => events.push(`state ${s.participantId} mic=${s.micOn} cam=${s.cameraOn}`),
    onClosed: (reason) => closed.push(reason),
  };
  return { events, signals, closed, handlers };
}

const peer = (participantId: string, sessionId: string, micOn = true, cameraOn = true): PresenceEntry => ({
  participantId,
  sessionId,
  micOn,
  cameraOn,
});
const alive = (presence: PresenceEntry[], signals: unknown[] = []): Reply => ({
  status: 200,
  json: { alive: true, presence, signals },
});
const offer = (id: number, from: string, fromSession: string) => ({
  id,
  fromSessionId: fromSession,
  fromParticipantId: from,
  signal: { kind: "description", type: "offer", sdp: `sdp-${id}` },
});

function open(endpoint: ReturnType<typeof fakeEndpoint>, rec: ReturnType<typeof recorder>) {
  return httpSignaling({ endpoint: "/api/call/signal", fetch: endpoint.fetchFn, newSessionId: () => SELF }).open(
    { meetingId: ROOM, identityToken: async () => "" },
    rec.handlers,
  );
}

/** Let pending promises and one poll interval run. */
async function tick(ms = POLL_MS) {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("joining", () => {
  it("joins, then the first poll welcomes the people already present with their state", async () => {
    const ep = fakeEndpoint();
    ep.setPoll(() => alive([peer("2", "peer-session-0002", false, true)]));
    const rec = recorder();
    open(ep, rec);
    await tick(0);
    expect(ep.requests[0].body).toEqual({ op: "join", roomId: ROOM, sessionId: SELF });
    expect(rec.events).toEqual(["welcome 2", "state 2 mic=false cam=true"]);
  });

  it("a refused join is rejected with the server's words", async () => {
    const ep = fakeEndpoint();
    ep.setJoin({ status: 403, json: { code: "FORBIDDEN", message: "You're not in this call." } });
    const rec = recorder();
    open(ep, rec);
    await tick(0);
    expect(rec.closed).toEqual([{ kind: "rejected", message: "You're not in this call." }]);
    expect(ep.ops("poll")).toHaveLength(0);
  });

  it("a join the network never delivered is lost, so the mesh retries", async () => {
    const ep = fakeEndpoint();
    ep.setJoin(new TypeError("Failed to fetch"));
    const rec = recorder();
    open(ep, rec);
    await tick(0);
    expect(rec.closed).toEqual([{ kind: "lost", message: "Failed to fetch" }]);
  });

  it("a rate-limited join is lost, not rejected: waiting helps", async () => {
    const ep = fakeEndpoint();
    ep.setJoin({ status: 429, json: { code: "RATE_LIMITED", message: "Too many joins" } });
    const rec = recorder();
    open(ep, rec);
    await tick(0);
    expect(rec.closed[0].kind).toBe("lost");
  });
});

describe("presence", () => {
  it("reports joins, a reloaded peer as leaving and joining again, and departures", async () => {
    const ep = fakeEndpoint();
    let presence: PresenceEntry[] = [];
    ep.setPoll(() => alive(presence));
    const rec = recorder();
    open(ep, rec);
    await tick(0);
    presence = [peer("2", "peer-session-0002")];
    await tick();
    presence = [peer("2", "peer-session-0003")];
    await tick();
    presence = [];
    await tick();
    expect(rec.events).toEqual([
      "welcome ",
      "joined 2",
      "state 2 mic=true cam=true",
      "left 2 rejoined",
      "joined 2",
      "state 2 mic=true cam=true",
      "left 2 left",
    ]);
  });

  it("never lists this session itself", async () => {
    const ep = fakeEndpoint();
    ep.setPoll(() => alive([peer("1", SELF)]));
    const rec = recorder();
    open(ep, rec);
    await tick(0);
    expect(rec.events).toEqual(["welcome "]);
  });
});

describe("signals", () => {
  it("delivers a known peer's signals in order and acknowledges them on the next poll", async () => {
    const ep = fakeEndpoint();
    let n = 0;
    ep.setPoll(() => {
      n += 1;
      const p = [peer("2", "peer-session-0002")];
      return n === 1 ? alive(p, [offer(5, "2", "peer-session-0002"), offer(6, "2", "peer-session-0002")]) : alive(p);
    });
    const rec = recorder();
    open(ep, rec);
    await tick(0);
    await tick();
    expect(rec.signals.map((s) => (s.signal as { description: { sdp: string } }).description.sdp)).toEqual([
      "sdp-5",
      "sdp-6",
    ]);
    expect(ep.ops("poll")[1].body.ack).toEqual([5, 6]);
  });

  it("acknowledges but ignores a signal from a session the peer has replaced", async () => {
    const ep = fakeEndpoint();
    let n = 0;
    ep.setPoll(() => {
      n += 1;
      const p = [peer("2", "peer-session-new1")];
      return n === 1 ? alive(p, [offer(7, "2", "peer-session-old1")]) : alive(p);
    });
    const rec = recorder();
    open(ep, rec);
    await tick(0);
    await tick();
    expect(rec.signals).toEqual([]);
    expect(ep.ops("poll")[1].body.ack).toEqual([7]);
  });

  it("holds an offer that beats its sender's presence, then delivers it", async () => {
    const ep = fakeEndpoint();
    let n = 0;
    ep.setPoll(() => {
      n += 1;
      if (n === 1) return alive([], [offer(9, "2", "peer-session-0002")]);
      return alive([peer("2", "peer-session-0002")], []);
    });
    const rec = recorder();
    open(ep, rec);
    await tick(0);
    expect(rec.signals).toEqual([]);
    expect(ep.ops("poll")[1]?.body.ack ?? []).toEqual([]);
    await tick();
    expect(rec.signals).toHaveLength(1);
    await tick();
    expect(ep.ops("poll")[2].body.ack).toEqual([9]);
  });

  it("drops a held signal whose sender never appears, after the hold", async () => {
    const ep = fakeEndpoint();
    ep.setPoll(() => alive([], [offer(11, "9", "ghost-session-01")]));
    const rec = recorder();
    open(ep, rec);
    await tick(0);
    await tick(UNKNOWN_SENDER_HOLD_MS + POLL_MS * 2);
    const acks = ep.ops("poll").flatMap((r) => r.body.ack as number[]);
    expect(acks).toContain(11);
    expect(rec.signals).toEqual([]);
  });

  it("sends one request at a time; signals made meanwhile go together, in order, at most SEND_BATCH each", async () => {
    const ep = fakeEndpoint();
    ep.setPoll(() => alive([peer("2", "peer-session-0002")]));
    const rec = recorder();
    const conn = open(ep, rec);
    await tick(0);
    const release = ep.gateSends();
    const total = SEND_BATCH + 5;
    for (let i = 0; i < total; i++) conn.send("2", { candidate: { candidate: `c${i}`, sdpMid: "0", sdpMLineIndex: 0 } });
    await tick(0);
    expect(ep.ops("send")).toHaveLength(1);
    release();
    await tick(0);
    const sends = ep.ops("send");
    // The first signal leaves at once; the rest queue behind it.
    expect(sends.map((s) => (s.body.signals as unknown[]).length)).toEqual([1, SEND_BATCH, total - 1 - SEND_BATCH]);
    const order = sends.flatMap((s) =>
      (s.body.signals as Array<{ toSessionId: string; signal: { candidate: string } }>).map((x) => {
        expect(x.toSessionId).toBe("peer-session-0002");
        return x.signal.candidate;
      }),
    );
    expect(order).toEqual(Array.from({ length: total }, (_, i) => `c${i}`));
  });
});

describe("how a connection ends", () => {
  it.each([
    ["replaced", "replaced"],
    ["ended", "rejected"],
    ["expired", "lost"],
  ])("a poll saying the session was %s closes it as %s", async (reason, kind) => {
    const ep = fakeEndpoint();
    let n = 0;
    ep.setPoll(() => (++n === 1 ? alive([]) : { status: 200, json: { alive: false, reason } }));
    const rec = recorder();
    open(ep, rec);
    await tick(0);
    await tick();
    expect(rec.closed.map((c) => c.kind)).toEqual([kind]);
    const polls = ep.ops("poll").length;
    await tick(POLL_MS * 4);
    expect(ep.ops("poll")).toHaveLength(polls);
  });

  it("rides out failed polls shorter than the stall, and is lost after it", async () => {
    const ep = fakeEndpoint();
    let failing = false;
    ep.setPoll(() => (failing ? new TypeError("Failed to fetch") : alive([])));
    const rec = recorder();
    open(ep, rec);
    await tick(0);
    failing = true;
    await tick(POLL_STALL_MS - 1000);
    expect(rec.closed).toEqual([]);
    failing = false;
    await tick(POLL_MS * 2);
    failing = true;
    await tick(POLL_STALL_MS + POLL_MS * 2);
    expect(rec.closed).toEqual([{ kind: "lost", message: "the call service stopped answering" }]);
  });

  it("a poll the server refuses (removed from the room) is rejected at once", async () => {
    const ep = fakeEndpoint();
    let n = 0;
    ep.setPoll(() => (++n === 1 ? alive([]) : { status: 403, json: { code: "FORBIDDEN", message: "not yours" } }));
    const rec = recorder();
    open(ep, rec);
    await tick(0);
    await tick();
    expect(rec.closed).toEqual([{ kind: "rejected", message: "not yours" }]);
  });

  it("close() leaves with keepalive, stops polling and reports nothing", async () => {
    const ep = fakeEndpoint();
    const rec = recorder();
    const conn = open(ep, rec);
    await tick(0);
    conn.close();
    await tick(0);
    const polls = ep.ops("poll").length;
    await tick(POLL_MS * 4);
    expect(ep.ops("poll")).toHaveLength(polls);
    expect(ep.ops("leave")).toEqual([{ body: { op: "leave", roomId: ROOM, sessionId: SELF }, keepalive: true }]);
    expect(rec.closed).toEqual([]);
  });
});
