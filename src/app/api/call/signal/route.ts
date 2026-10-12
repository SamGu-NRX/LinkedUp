// src/app/api/call/signal/route.ts — the call signaling endpoint.
//
// One POST per operation (join, poll, send, state, leave), all behind Clerk:
// the signed-in user is mapped to their users row and src/lib/call/mesh.ts
// checks them against the room on every call. Requests must be same-origin
// JSON under MAX_BODY_BYTES, which also stops a cross-site form post from
// riding the session cookie (a form cannot send application/json, and a
// cross-origin fetch carries a foreign Origin).
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { MeshError, joinCall, leaveCall, pollCall, sendSignals, setMediaState } from "@/lib/call/mesh";
import { SEND_BATCH, sessionIdSchema, signalSchema } from "@/lib/call/signal-protocol";

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
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
    return refuse("VALIDATION", `Requests are limited to ${MAX_BODY_BYTES} bytes.`, 413);
  }

  const { userId: clerkId } = await auth();
  if (!clerkId) return refuse("UNAUTHORIZED", "Sign in to join this call.", 401);
  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return refuse("FORBIDDEN", "You're not in this call. Only the two people matched into a room can join it.", 403);

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(JSON.parse(raw));
  } catch (error) {
    const detail = error instanceof z.ZodError ? error.issues[0]?.message : "malformed JSON";
    return refuse("VALIDATION", `Bad request: ${detail}`, 400);
  }

  try {
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
    if (error instanceof z.ZodError) return refuse("VALIDATION", error.issues[0]?.message ?? "Bad request", 400);
    throw error;
  }
}
