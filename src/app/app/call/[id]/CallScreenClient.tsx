// src/app/app/call/[id]/CallScreenClient.tsx
"use client";

import { useRouter } from "next/navigation";
import VoiceCallScreen from "@/components/call/VoiceCallScreen";
import type { CallType, Participant } from "@/types/call";
import type { RoomAccess } from "@/lib/matching";
import { endRoomAction } from "@/app/app/smart-connection/_actions";

export default function CallScreenClient({
  access,
  signalingEndpoint,
  iceEndpoint,
  exitHref,
  summaryHref,
}: {
  access: Extract<RoomAccess, { allowed: true }>;
  /** Where the call signals: /api/call/signal, or the journey-proof path's own. */
  signalingEndpoint: string;
  iceEndpoint: string;
  /** Where the queue lives (unused now Done leads to the summary; kept for the call contract). */
  exitHref: string;
  /** Where Done lands: this room's summary. Defaults to the app route. */
  summaryHref?: string;
}) {
  const router = useRouter();

  const participants: [Participant, Participant] = [
    {
      id: String(access.me.id),
      name: access.me.name,
      avatarUrl: access.me.avatarUrl,
    },
    {
      id: String(access.partner.id),
      name: access.partner.name,
      avatarUrl: access.partner.avatarUrl,
    },
  ];

  const summary = summaryHref ?? `/app/call/${access.roomId}/summary`;

  return (
    <VoiceCallScreen
      callType={access.queueType as CallType}
      participants={participants}
      initialDuration={300}
      call={{
        roomId: access.roomId,
        selfId: String(access.me.id),
        signalingEndpoint,
        iceEndpoint,
      }}
      // Leaving is leaving the call, not ending the room: the screen offers
      // Rejoin, and the other person stays connected.
      onEndCall={() => {}}
      onDone={(rating) => {
        // Done ends the room for both, persists both participants' summary
        // rows (the caller's rating included), and shows this person the
        // real call's recap instead of dropping them back with nothing.
        void endRoomAction(access.roomId, {
          rating: rating ?? undefined,
        }).finally(() => router.push(summary));
      }}
      onExtendCall={() => {
        // Extension needs session semantics a later step owns; the control
        // is part of the DOM contract and stays inert until then.
      }}
      onToggleMute={() => {
        /* local capture state lives in VoiceCallScreen */
      }}
      onRateCall={() => {
        /* the rating is sent with Done, persisted in call_summaries */
      }}
    />
  );
}
