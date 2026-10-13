// @vitest-environment node
// The signaling endpoint's front door: what it refuses before the mesh runs,
// and how mesh refusals reach the client. Clerk is stubbed (the signed-in
// user is set per test); the database is the stack's.
import "./support/use-stack-db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { like } from "drizzle-orm";
import { NextRequest } from "next/server";

const clerk = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: clerk.userId }) }));

const { db } = await import("@/db");
const { rooms, users } = await import("@/db/schema");
const { POST } = await import("@/app/api/call/signal/route");

const PREFIX = "witness_route_";
const ORIGIN = "http://localhost:3000";
let memberClerkId = "";
let outsiderClerkId = "";
let roomId = "";

function request(body: unknown, { origin = ORIGIN, type = "application/json", raw }: { origin?: string | null; type?: string; raw?: string } = {}) {
  const headers: Record<string, string> = { "content-type": type };
  if (origin) headers.origin = origin;
  return new NextRequest(`${ORIGIN}/api/call/signal`, { method: "POST", headers, body: raw ?? JSON.stringify(body) });
}
async function answer(req: NextRequest) {
  const res = await POST(req);
  return { status: res.status, body: (await res.json()) as { code?: string } };
}

beforeAll(async () => {
  await db.delete(users).where(like(users.clerkId, `${PREFIX}%`));
  const make = async (tag: string) => {
    const clerkId = `${PREFIX}${tag}_${Date.now()}`;
    const [row] = await db.insert(users).values({ clerkId, email: `${clerkId}@witness.local`, onboardingComplete: true }).returning({ id: users.id });
    return { clerkId, id: row.id };
  };
  const a = await make("a");
  const b = await make("b");
  const o = await make("o");
  memberClerkId = a.clerkId;
  outsiderClerkId = o.clerkId;
  const [room] = await db.insert(rooms).values({ queueType: "casual", status: "active", user1Id: a.id, user2Id: b.id }).returning({ id: rooms.id });
  roomId = room.id;
});
afterAll(async () => {
  await db.delete(users).where(like(users.clerkId, `${PREFIX}%`));
});

const join = () => ({ op: "join", roomId, sessionId: `route-${Math.random().toString(36).slice(2, 10)}` });

describe("before the mesh runs", () => {
  it("refuses a cross-origin request", async () => {
    clerk.userId = memberClerkId;
    expect(await answer(request(join(), { origin: "https://evil.example" }))).toMatchObject({ status: 403, body: { code: "FORBIDDEN" } });
  });

  it("refuses anything but JSON", async () => {
    clerk.userId = memberClerkId;
    expect((await answer(request(join(), { type: "text/plain" }))).status).toBe(415);
  });

  it("refuses an oversized body", async () => {
    clerk.userId = memberClerkId;
    expect((await answer(request(null, { raw: JSON.stringify({ pad: "x".repeat(100 * 1024) }) }))).status).toBe(413);
  });

  it("refuses a signed-out caller", async () => {
    clerk.userId = null;
    expect(await answer(request(join()))).toMatchObject({ status: 401, body: { code: "UNAUTHORIZED" } });
  });

  it("refuses a signed-in caller with no profile", async () => {
    clerk.userId = `${PREFIX}nobody`;
    expect(await answer(request(join()))).toMatchObject({ status: 403, body: { code: "FORBIDDEN" } });
  });

  it("refuses a malformed operation", async () => {
    clerk.userId = memberClerkId;
    expect((await answer(request({ op: "join", roomId: "not-a-uuid", sessionId: "abcdefgh" }))).status).toBe(400);
    expect((await answer(request({ op: "teleport", roomId }))).status).toBe(400);
    expect((await answer(request(null, { raw: "{" }))).status).toBe(400);
  });
});

describe("mesh answers", () => {
  it("lets a member join and answers an outsider with a named refusal", async () => {
    clerk.userId = memberClerkId;
    const ok = await answer(request(join()));
    expect(ok.status).toBe(200);
    clerk.userId = outsiderClerkId;
    const refused = await answer(request(join()));
    expect(refused).toMatchObject({ status: 403, body: { code: "FORBIDDEN" } });
    expect((refused.body as { message?: string }).message).toMatch(/not in this call/);
  });
});

describe("the order of the front door", () => {
  it("answers a signed-out caller 401 before looking at an oversized body", async () => {
    clerk.userId = null;
    const res = await POST(request(null, { raw: JSON.stringify({ pad: "x".repeat(200 * 1024) }) }));
    expect(res.status).toBe(401);
  });

  it("stops reading a streamed body at the cap", async () => {
    clerk.userId = memberClerkId;
    const CHUNK = 16 * 1024;
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 640) controller.close();
        else controller.enqueue(new Uint8Array(CHUNK).fill(32));
      },
    });
    const req = new NextRequest(`${ORIGIN}/api/call/signal`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body,
      duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1] & { duplex: "half" });
    const res = await POST(req);
    expect(res.status).toBe(413);
    // 96 KB is six chunks; the stream may run a few ahead, never to its 10 MB end.
    expect(pulled).toBeLessThan(20);
  });

});
