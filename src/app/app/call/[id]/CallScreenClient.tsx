// src/app/app/call/[id]/CallScreenClient.tsx
"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import VoiceCallScreen from "@/components/call/VoiceCallScreen";
import type { CallType, Participant } from "@/types/call";
import type { RoomAccess } from "@/lib/matching";
import { endRoomAction } from "@/app/app/smart-connection/_actions";
import { saveCallRatingAction } from "./_actions";

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
  const rating = useRef<number | null>(null);
  const finishing = useRef(false);
  const [status, setStatus] = useState<
    | { state: "idle" }
    | { state: "saving"; message: string }
    | { state: "error"; message: string }
  >({ state: "idle" });

  async function finishCall() {
    if (finishing.current) return;
    finishing.current = true;
    setStatus({
      state: "saving",
      message:
        rating.current === null
          ? "Finishing your call…"
          : "Saving your rating…",
    });
    try {
      if (rating.current !== null) {
        const saved = await saveCallRatingAction({
          roomId: access.roomId,
          rating: rating.current,
        });
        if (!saved.success) {
          setStatus({ state: "error", message: saved.error });
          return;
        }
      }
      setStatus({ state: "saving", message: "Finishing your call…" });
      const ended = await endRoomAction(access.roomId);
      if (!ended.success) {
        setStatus({
          state: "error",
          message: `Could not finish your call: ${ended.error}. Choose Done to retry.`,
        });
        return;
      }
      router.push(exitHref);
    } catch {
      setStatus({
        state: "error",
        message:
          "Could not finish your call. Check your connection. Choose Done to retry.",
      });
    } finally {
      finishing.current = false;
    }
  }

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

  return (
    <div className="flex h-dvh flex-col bg-zinc-950">
      <fieldset
        disabled={status.state === "saving"}
        className="m-0 min-h-0 min-w-0 flex-1 border-0 p-0 [&_[data-call-root]]:h-full"
        aria-label="Call controls"
      >
        <VoiceCallScreen
          callType={access.queueType as CallType}
          participants={participants}
          initialDuration={300}
          call={{
            roomId: access.roomId,
            selfId: String(access.me.id),
            signalingEndpoint,
          }}
          // Leaving is leaving the call, not ending the room: the screen offers
          // Rejoin, and the other person stays connected.
          onEndCall={() => {}}
          onDone={() => {
            void finishCall();
          }}
          onExtendCall={() => {
            // Extension needs session semantics a later step owns; the control
            // is part of the DOM contract and stays inert until then.
          }}
          onToggleMute={() => {
            /* local capture state lives in VoiceCallScreen */
          }}
          onRateCall={(value) => {
            rating.current = value;
            setStatus({ state: "idle" });
          }}
        />
      </fieldset>
      {status.state !== "idle" && (
        <p
          role={status.state === "error" ? "alert" : "status"}
          data-call-finish-status={status.state}
          className={`mx-auto mt-2 mb-[max(1rem,env(safe-area-inset-bottom))] w-[calc(100%-2rem)] max-w-md shrink-0 rounded-xl px-4 py-3 text-center text-sm ${status.state === "error" ? "bg-rose-950 text-rose-100" : "bg-zinc-900 text-zinc-200"}`}
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
