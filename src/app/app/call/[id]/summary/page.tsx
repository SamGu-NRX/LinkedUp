// src/app/app/call/[id]/summary/page.tsx — the after-call recap route.
//
// One participant's persisted summary for one room, with the call room's
// gate: an outsider is refused without learning whether the room exists, and
// a room that never produced a summary says so instead of inventing one.
import { auth } from "@clerk/nextjs/server";
import CallSummaryScreen, { CallSummaryRefusal } from "@/components/app/call-summary-screen";
import { getCallSummaryForUser } from "@/lib/call/summary";

export const dynamic = "force-dynamic";

export default async function CallSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  const access = userId
    ? await getCallSummaryForUser(userId, id)
    : ({ allowed: false, reason: "signed_out" } as const);

  if (!access.allowed) {
    return <CallSummaryRefusal reason={access.reason} backHref="/app" />;
  }

  return <CallSummaryScreen summary={access.summary} historyHref="/app/history" backHref="/app" />;
}
