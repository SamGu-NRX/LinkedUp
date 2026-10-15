// src/app/api/call/signal/route.ts — the call signaling endpoint.
//
// One POST per operation (join, poll, send, state, leave), all behind Clerk:
// the signed-in user is mapped to their users row and src/lib/call/mesh.ts
// checks them against the room on every call. Requests must be same-origin
// JSON, which stops a cross-site form post from riding the session cookie
// (a form cannot send application/json, and a cross-origin fetch carries a
// foreign Origin). The caller is authenticated and onboarded before the
// body is read, and the body is read only up to MAX_BODY_BYTES.
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { MeshError, joinCall, leaveCall, pollCall, sendSignals, setMediaState } from "@/lib/call/mesh";
import { SEND_BATCH, sessionIdSchema, signalSchema } from "@/lib/call/signal-protocol";
import { expireInactiveRoomForParticipant } from "@/lib/matching";

export const dynamic = "force-dynamic";

/**
 * Largest accepted request body. A send batch is in practice one description
 * plus candidates; 96 KB holds two descriptions at the 32 KB SDP cap.
 */
const MAX_BODY_BYTES = 96 * 1024;

const roomIdSchema = z.string().uuid();

const requestSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("join"), roomId: roomIdSchema, sessionId: sessionIdSchema }),
  z.object({
    op: z.literal("poll"),
    roomId: roomIdSchema,
    sessionId: sessionIdSchema,
    ack: z.array(z.number().int().positive()).max(100).default([]),
  }),
  z.object({
    op: z.literal("send"),
    roomId: roomIdSchema,
    sessionId: sessionIdSchema,
    signals: z
      .array(z.object({ toSessionId: sessionIdSchema, signal: signalSchema }))
      .min(1)
      .max(SEND_BATCH),
  }),
  z.object({
    op: z.literal("state"),
    roomId: roomIdSchema,
    sessionId: sessionIdSchema,
    micOn: z.boolean(),
    cameraOn: z.boolean(),
  }),
  z.object({ op: z.literal("leave"), roomId: roomIdSchema, sessionId: sessionIdSchema }),
]);

/**
 * The body as text, or null once it passes `max` bytes. Counts bytes as
 * they arrive and stops reading there, so an oversized body (declared or
 * streamed without a length) is never buffered whole.
 */
async function readCapped(request: NextRequest, max: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function refuse(code: string, message: string, status: number) {
  return NextResponse.json({ code, message }, { status });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return refuse("FORBIDDEN", "Cross-origin requests are not accepted.", 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return refuse("VALIDATION", "Send JSON.", 415);
  }

  // Who is asking comes before reading anything they sent.
  const { userId: clerkId } = await auth();
  if (!clerkId) return refuse("UNAUTHORIZED", "Sign in to join this call.", 401);
  const [me] = await db
    .select({ id: users.id, onboardingComplete: users.onboardingComplete })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (!me) return refuse("FORBIDDEN", "You're not in this call. Only the two people matched into a room can join it.", 403);
  // The database onboarding gate, as the call pages apply it: the
  // journey-proof alias reaches this route without the middleware's check.
  if (!me.onboardingComplete) return refuse("FORBIDDEN", "Finish onboarding before joining a call.", 403);

  const raw = await readCapped(request, MAX_BODY_BYTES);
  if (raw === null) return refuse("VALIDATION", `Requests are limited to ${MAX_BODY_BYTES} bytes.`, 413);

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(JSON.parse(raw));
  } catch (error) {
    const detail = error instanceof z.ZodError ? error.issues[0]?.message : "malformed JSON";
    return refuse("VALIDATION", `Bad request: ${detail}`, 400);
  }

  try {
    if (body.op === "join" || body.op === "poll") {
      await expireInactiveRoomForParticipant(me.id, body.roomId);
    }
    switch (body.op) {
      case "join":
        return NextResponse.json(await joinCall(me.id, body.roomId, body.sessionId));
      case "poll":
        return NextResponse.json(await pollCall(me.id, body.roomId, body.sessionId, body.ack));
      case "send":
        return NextResponse.json(await sendSignals(me.id, body.roomId, body.sessionId, body.signals));
      case "state":
        await setMediaState(me.id, body.roomId, body.sessionId, { micOn: body.micOn, cameraOn: body.cameraOn });
        return NextResponse.json({ ok: true });
      case "leave":
        await leaveCall(me.id, body.roomId, body.sessionId);
        return NextResponse.json({ ok: true });
    }
  } catch (error) {
    if (error instanceof MeshError) return refuse(error.code, error.message, error.status);
    // A transaction Postgres aborted to break a deadlock or a serialization
    // conflict did nothing: the client may send it again.
    const pgCode = (error as { code?: string } | null)?.code;
    if (pgCode === "40P01" || pgCode === "40001") return refuse("RETRY", "The call service was busy. Try again.", 503);
    if (error instanceof z.ZodError) return refuse("VALIDATION", error.issues[0]?.message ?? "Bad request", 400);
    throw error;
  }
}
