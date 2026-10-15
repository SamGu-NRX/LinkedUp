// src/app/app/call/[id]/CallRoom.tsx
//
// The call room for one room id: the server-side membership check, then
// either the call screen or an honest refusal. Rendered by the call route
// (page.tsx) and by the journey-proof test path (src/app/journey-proof/).
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { getRoomForUser } from "@/lib/matching";
import CallScreenClient from "./CallScreenClient";

const refusalCopy: Record<string, { title: string; detail: string }> = {
  signed_out: {
    title: "Sign in to open this call",
    detail:
      "Calls belong to the two people who matched. Sign in with the account you queued from to join this room.",
  },
  room_not_found: {
    title: "Call not found",
    detail: "This call room doesn't exist. It may have never been created.",
  },
  room_ended: {
    title: "This call has ended",
    detail: "The call room you tried to open is no longer active.",
  },
  not_a_participant: {
    title: "You're not in this call",
    detail:
      "Only the two people matched into this room can join it. If this was your match, rejoin the queue from the app.",
  },
};

export default async function CallRoom({
  id,
  signalingEndpoint = "/api/call/signal",
  iceEndpoint = "/api/call/ice",
  exitHref = "/app",
  summaryHref,
}: {
  id: string;
  signalingEndpoint?: string;
  iceEndpoint?: string;
  exitHref?: string;
  /** Where Done lands after ending the room: the room's summary route. */
  summaryHref?: string;
}) {
  const { userId } = await auth();
  const access = userId
    ? await getRoomForUser(userId, id)
    : ({ allowed: false, reason: "signed_out" } as const);

  if (!access.allowed) {
    const copy = refusalCopy[access.reason] ?? refusalCopy.not_a_participant;
    return (
      <main
        data-call-refusal=""
        data-refusal-reason={access.reason}
        // The call contract: a refused visitor's call has failed, and why
        // is in call-error.
        data-call-phase="failed"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-100"
      >
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p data-testid="call-error" className="max-w-md text-sm text-zinc-400">
          {copy.detail}
        </p>
        <Link
          href={access.reason === "signed_out" ? "/sign-in" : exitHref}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {access.reason === "signed_out" ? "Sign in" : "Back to the app"}
        </Link>
      </main>
    );
  }

  return (
    <CallScreenClient
      access={access}
      signalingEndpoint={signalingEndpoint}
      iceEndpoint={iceEndpoint}
      exitHref={exitHref}
      summaryHref={summaryHref}
    />
  );
}
