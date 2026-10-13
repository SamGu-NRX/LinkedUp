// @vitest-environment node
// How the signaling endpoint answers when Postgres aborts the transaction
// it ran: the client must be told it may send again. Clerk, the database
// lookup and the mesh are stand-ins; only the route's mapping is under test.
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: "user_x" }) }));
vi.mock("@/db", () => {
  const chain = { from: () => chain, where: () => chain, limit: async () => [{ id: 7, onboardingComplete: true }] };
  return { db: { select: () => chain } };
});
const mesh = vi.hoisted(() => ({ sendSignals: vi.fn() }));
vi.mock("@/lib/call/mesh", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/call/mesh")>()),
  sendSignals: mesh.sendSignals,
}));

const { POST } = await import("@/app/api/call/signal/route");

const send = () =>
  new NextRequest("http://localhost:3000/api/call/signal", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({
      op: "send",
      roomId: "11111111-1111-4111-8111-111111111111",
      sessionId: "session-0001",
      signals: [{ toSessionId: "session-0002", signal: { kind: "candidate", candidate: "c" } }],
    }),
  });

describe("an aborted transaction", () => {
  it.each(["40P01", "40001"])("Postgres %s answers 503 RETRY", async (code) => {
    mesh.sendSignals.mockRejectedValueOnce(Object.assign(new Error("aborted"), { code }));
    const res = await POST(send());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "RETRY" });
  });
});
