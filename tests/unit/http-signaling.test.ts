// @vitest-environment node
// The HTTP signaling adapter against a scripted endpoint: what the mesh is
// told for each answer the server can give.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POLL_MS,
  POLL_STALL_MS,
  SEND_ATTEMPTS,
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
  /** Answers for the next sends, in order; afterwards sends succeed. */
  const sendReplies: Reply[] = [];
  const fetchFn = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Body;
    requests.push({ body, keepalive: Boolean(init.keepalive) });
    let reply: Reply = { status: 200, json: { ok: true } };
    if (body.op === "join") reply = joinReply;
    if (body.op === "poll") reply = pollReply();
    if (body.op === "send") {
      if (sendGate) await sendGate;
      reply = sendReplies.shift() ?? { status: 200, json: { delivered: (body.signals as unknown[]).map(() => true) } };
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
    failSends: (...replies: Reply[]) => sendReplies.push(...replies),
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

// performance is faked too: the adapter times stalls on the monotonic clock,
// and vi.setSystemTime moves only the wall clock.
beforeEach(() =>
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"] }),
);
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

describe("a send the server did not store", () => {
  const candidates = (conn: { send: (to: string, s: never) => void }, from: number, n: number) => {
    for (let i = from; i < from + n; i++) conn.send("2", { candidate: { candidate: `c${i}`, sdpMid: "0", sdpMLineIndex: 0 } } as never);
  };
  const sentCandidates = (ep: ReturnType<typeof fakeEndpoint>) =>
    ep.ops("send").flatMap((r) => (r.body.signals as Array<{ signal: { candidate: string } }>).map((x) => x.signal.candidate));

  it("retries a send the server aborted (503) and keeps the order of later sends", async () => {
    const ep = fakeEndpoint();
    ep.setPoll(() => alive([peer("2", "peer-session-0002")]));
    const rec = recorder();
    const conn = open(ep, rec);
    await tick(0);
    ep.failSends({ status: 503, json: { code: "RETRY", message: "busy" } });
    candidates(conn, 0, 1);
    candidates(conn, 1, 2);
    await tick(2000);
    // c0 was tried twice (aborted, then stored); c1 and c2 went after it.
    expect(sentCandidates(ep)).toEqual(["c0", "c0", "c1", "c2"]);
  });

  it("retries a send the network lost, up to SEND_ATTEMPTS, then moves on", async () => {
    const ep = fakeEndpoint();
    ep.setPoll(() => alive([peer("2", "peer-session-0002")]));
    const rec = recorder();
    const conn = open(ep, rec);
    await tick(0);
    ep.failSends(...Array.from({ length: SEND_ATTEMPTS }, () => new TypeError("Failed to fetch") as Reply));
    candidates(conn, 0, 1);
    await tick(5000);
    candidates(conn, 1, 1);
    await tick(1000);
    expect(sentCandidates(ep)).toEqual([...Array.from({ length: SEND_ATTEMPTS }, () => "c0"), "c1"]);
  });

  it("does not retry a refusal", async () => {
    const ep = fakeEndpoint();
    ep.setPoll(() => alive([peer("2", "peer-session-0002")]));
    const rec = recorder();
    const conn = open(ep, rec);
    await tick(0);
    ep.failSends({ status: 429, json: { code: "SIGNAL_QUEUE_FULL", message: "full" } });
    candidates(conn, 0, 1);
    await tick(2000);
    expect(sentCandidates(ep)).toEqual(["c0"]);
  });
});

describe("every non-2xx answer the route can give to a poll", () => {
  // From src/app/api/call/signal/route.ts and MeshError's statuses in mesh.ts.
  const refusals: Array<[number, string]> = [
    [400, "VALIDATION"],
    [401, "UNAUTHORIZED"],
    [403, "FORBIDDEN"],
    [409, "CALL_FULL"],
    [410, "ROOM_ENDED"],
    [413, "VALIDATION"],
    [415, "VALIDATION"],
  ];
  const transient: Array<[number, string | null]> = [
    [429, "RATE_LIMITED"],
    [429, "SIGNAL_QUEUE_FULL"],
    [503, "RETRY"],
    [500, null],
    [502, null],
  ];
  const answering = (status: number, code: string | null) => {
    const ep = fakeEndpoint();
    let n = 0;
    ep.setPoll(() => (++n === 1 ? alive([]) : { status, json: code ? { code, message: `${code} answer` } : undefined }));
    return ep;
  };

  it.each(refusals)("%i %s is a refusal: rejected at once", async (status, code) => {
    const rec = recorder();
    open(answering(status, code), rec);
    await tick(0);
    await tick();
    expect(rec.closed).toEqual([{ kind: "rejected", message: `${code} answer` }]);
  });

  it.each(transient)("%i %s is retried, and only a full stall of them is lost", async (status, code) => {
    const ep = answering(status, code);
    const rec = recorder();
    open(ep, rec);
    await tick(0);
    await tick(POLL_STALL_MS - 500);
    expect(rec.closed, "nothing before the stall").toEqual([]);
    expect(ep.ops("poll").length, "polling went on").toBeGreaterThan(10);
    await tick(1000);
    expect(rec.closed).toEqual([{ kind: "lost", message: "the call service stopped answering" }]);
  });

  it("a wall-clock jump during failing polls is not a stall", async () => {
    const ep = answering(503, "RETRY");
    const rec = recorder();
    open(ep, rec);
    await tick(0);
    await tick(POLL_MS);
    // The machine's clock steps forward a minute; no time passes for the page.
    vi.setSystemTime(Date.now() + 60_000);
    await tick(POLL_MS * 2);
    expect(rec.closed).toEqual([]);
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
