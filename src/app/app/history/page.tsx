// src/app/app/history/page.tsx — the signed-in person's call history.
//
// Read from call_summaries at request time, so it loads in any later session:
// the rows were persisted when the room ended, not in the browser.
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import CallHistoryScreen from "@/components/app/call-history-screen";
import { listCallSummaries } from "@/lib/call/summary";

export const dynamic = "force-dynamic";

export default async function CallHistoryPage() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <main
        data-history-refusal=""
        data-refusal-reason="signed_out"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-100"
      >
        <h1 className="text-2xl font-semibold">Sign in to see your calls</h1>
        <p className="max-w-md text-sm text-zinc-400">
          Call history belongs to the account that made the calls.
        </p>
        <Link
          href="/sign-in"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Sign in
        </Link>
      </main>
    );
  }

  const me = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  });
  const summaries = me ? await listCallSummaries(me.id) : [];
  return <CallHistoryScreen summaries={summaries} queueHref="/app" />;
}
