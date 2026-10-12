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
  exitHref,
}: {
  access: Extract<RoomAccess, { allowed: true }>;
  /** Where the call signals: /api/call/signal, or the journey-proof path's own. */
  signalingEndpoint: string;
  /** Where Done goes after ending the room. */
  exitHref: string;
}) {
  const router = useRouter();

  const participants: [Participant, Participant] = [
    { id: String(access.me.id), name: access.me.name, avatarUrl: access.me.avatarUrl },
    { id: String(access.partner.id), name: access.partner.name, avatarUrl: access.partner.avatarUrl },
  ];

  return (
    <VoiceCallScreen
      callType={access.queueType as CallType}
      participants={participants}
      initialDuration={300}
      call={{ roomId: access.roomId, selfId: String(access.me.id), signalingEndpoint }}
      // Leaving is leaving the call, not ending the room: the screen offers
      // Rejoin, and the other person stays connected.
      onEndCall={() => {}}
      onDone={() => {
        // Done ends the room for both, so each can queue again.
        void endRoomAction(access.roomId).finally(() => router.push(exitHref));
      }}
      onExtendCall={() => {
        // Extension needs session semantics a later step owns; the control
        // is part of the DOM contract and stays inert until then.
      }}
      onToggleMute={() => {
        /* local capture state lives in VoiceCallScreen */
      }}
      onRateCall={() => {
        /* ratings persist in a later milestone */
      }}
    />
  );
}
