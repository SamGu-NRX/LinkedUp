// src/lib/call/signal-protocol.ts — what the signaling endpoint and its
// browser client agree on. No server imports: the client bundles this.
import { z } from "zod";

/** Signals one send request may carry; the client batches what is queued, up to this. */
export const SEND_BATCH = 20;

export type CloseReason = "left" | "replaced" | "expired" | "ended";

export const sessionIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,64}$/, "sessionId must be 8-64 letters, digits, '-' or '_'");

export const signalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("description"),
    type: z.enum(["offer", "answer", "pranswer", "rollback"]),
    sdp: z.string(),
  }),
  z.object({
    kind: z.literal("candidate"),
    candidate: z.string(),
    sdpMLineIndex: z.number().int().min(0).max(1024).optional(),
    sdpMid: z.string().optional(),
    usernameFragment: z.string().optional(),
  }),
]);
export type WireSignal = z.infer<typeof signalSchema>;

export interface PresenceEntry {
  sessionId: string;
  participantId: string;
  micOn: boolean;
  cameraOn: boolean;
}

export interface InboundSignal {
  id: number;
  fromSessionId: string;
  fromParticipantId: string;
  signal: WireSignal;
}

export type PollResult =
  | { alive: false; reason: CloseReason }
  | { alive: true; presence: PresenceEntry[]; signals: InboundSignal[] };
