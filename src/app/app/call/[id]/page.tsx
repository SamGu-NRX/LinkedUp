// src/app/app/call/[id]/page.tsx
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { getRoomForUser } from "@/lib/matching";
import CallScreenClient from "./CallScreenClient";

export const dynamic = "force-dynamic";

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

export default async function CallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-100"
      >
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="max-w-md text-sm text-zinc-400">{copy.detail}</p>
        <Link
          href={access.reason === "signed_out" ? "/sign-in" : "/app"}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {access.reason === "signed_out" ? "Sign in" : "Back to the app"}
        </Link>
      </main>
    );
  }

  return <CallScreenClient access={access} />;
}
