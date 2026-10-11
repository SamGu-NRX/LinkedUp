// src/app/app/call/[id]/CallScreenClient.tsx
"use client";

import { useRouter } from "next/navigation";
import VoiceCallScreen from "@/components/call/VoiceCallScreen";
import type { CallType, Participant } from "@/types/call";
import type { RoomAccess } from "@/lib/matching";
import { endRoomAction } from "@/app/app/smart-connection/_actions";

export default function CallScreenClient({
  access,
}: {
  access: Extract<RoomAccess, { allowed: true }>;
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

  const handleEndCall = async () => {
    // Leaving really ends the room: the row flips to `ended`, so the
    // partner's next check sees an ended call instead of a ghost room.
    await endRoomAction(access.roomId);
    router.push("/app");
  };

  return (
    <VoiceCallScreen
      callType={access.queueType as CallType}
      participants={participants}
      initialDuration={300}
      onEndCall={() => {
        void handleEndCall();
      }}
      onExtendCall={() => {
        // Call extension needs session semantics that arrive with the
        // transport milestone (LS1); the control is part of the DOM
        // contract and stays inert until then.
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
