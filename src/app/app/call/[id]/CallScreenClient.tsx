// src/app/app/call/[id]/CallScreenClient.tsx
"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState, type ReactNode } from "react";
import VoiceCallScreen, { LeftScreen } from "@/components/call/VoiceCallScreen";
import type { CallType, Participant } from "@/types/call";
import type { RoomAccess } from "@/lib/matching";
import { endRoomAction } from "@/app/app/smart-connection/_actions";
import { saveCallRatingAction } from "./_actions";

function useCallFinish(roomId: string, exitHref: string, roomState: "active" | "ended") {
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
          roomId,
          rating: rating.current,
        });
        if (!saved.success) {
          setStatus({ state: "error", message: saved.error });
          return;
        }
      }
      if (roomState === "active") {
        setStatus({ state: "saving", message: "Finishing your call…" });
        const ended = await endRoomAction(roomId);
        if (!ended.success) {
          setStatus({
            state: "error",
            message: `Could not finish your call: ${ended.error}. Choose Done to retry.`,
          });
          return;
        }
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

  return {
    status,
    finishCall,
    rate: (value: number) => {
      rating.current = value;
      setStatus({ state: "idle" });
    },
  };
}

export default function CallScreenClient({
  access,
  signalingEndpoint,
  iceEndpoint,
  exitHref,
}: {
  access: Extract<RoomAccess, { allowed: true }>;
  /** Where the call signals: /api/call/signal, or the journey-proof path's own. */
  signalingEndpoint: string;
  iceEndpoint: string;
  /** Where Done goes after ending the room. */
  exitHref: string;
}) {
  const { status, finishCall, rate } = useCallFinish(access.roomId, exitHref, "active");
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
    <CallFinishLayout status={status}>
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
        onRateCall={rate}
      />
    </CallFinishLayout>
  );
}

/** Ended-room membership was checked by CallRoom; no capture or transport mounts. */
export function CompletedCallRating({
  roomId,
  exitHref,
}: {
  roomId: string;
  exitHref: string;
}) {
  const { status, finishCall, rate } = useCallFinish(roomId, exitHref, "ended");
  const [rating, setRating] = useState<number | null>(null);
  return (
    <CallFinishLayout status={status}>
      <LeftScreen
        title="This call has ended"
        rating={rating}
        onRate={(value) => {
          setRating(value);
          rate(value);
        }}
        onDone={() => {
          void finishCall();
        }}
      />
    </CallFinishLayout>
  );
}

function CallFinishLayout({
  status,
  children,
}: {
  status: ReturnType<typeof useCallFinish>["status"];
  children: ReactNode;
}) {
  // Keyless Clerk initialization remounts its descendants when keys arrive.
  // Accept input only after that reset and hydration have both finished.
  const { isLoaded } = useAuth();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100">
      <fieldset
        disabled={!ready || !isLoaded || status.state === "saving"}
        className="m-0 flex min-h-0 min-w-0 flex-1 flex-col border-0 p-0 [&_[data-call-root]]:h-full"
        aria-label="Call controls"
      >
        {children}
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
