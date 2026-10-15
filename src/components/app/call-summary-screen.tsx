// src/components/app/call-summary-screen.tsx — the after-call recap.
//
// Rendered from one person's persisted call_summaries row: the real call's
// partner, duration, queue, and the rating they gave. Nothing here is
// invented: a room with no persisted summary says so honestly instead of
// showing a made-up recap (the old AfterCallScreen placeholder did).
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { formatCallDuration, type CallSummary } from "@/lib/call/summary";
import { cn } from "@/lib/utils";

const refusalCopy: Record<string, { title: string; detail: string }> = {
  signed_out: {
    title: "Sign in to open this summary",
    detail:
      "A call's recap belongs to the two people who had it. Sign in with the account you called from.",
  },
  not_a_participant: {
    title: "This summary isn't yours",
    detail:
      "Only the two people matched into a room can read its recap. If this was your call, sign in from the account you queued with.",
  },
  summary_missing: {
    title: "No summary was recorded",
    detail:
      "This room ended before either of you pressed Done, so there was no call to recap. The queue will pair you fresh.",
  },
};

/** The refusal state, mirroring the call room's honest-refusal contract. */
export function CallSummaryRefusal({
  reason,
  backHref,
}: {
  reason: string;
  backHref: string;
}) {
  const copy = refusalCopy[reason] ?? refusalCopy.not_a_participant;
  return (
    <main
      data-summary-refusal=""
      data-refusal-reason={reason}
      data-call-phase="failed"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-100"
    >
      <h1 className="text-2xl font-semibold">{copy.title}</h1>
      <p data-testid="summary-error" className="max-w-md text-sm text-zinc-400">
        {copy.detail}
      </p>
      <Link
        href={reason === "signed_out" ? "/sign-in" : backHref}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        {reason === "signed_out" ? "Sign in" : "Back to the app"}
      </Link>
    </main>
  );
}

function Stars({ rating }: { rating: number | null }) {
  return (
    <div
      data-testid="summary-rating"
      aria-label={rating === null ? "Not rated" : `${rating} of 5 stars`}
    >
      <div className="flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <Star
            key={value}
            aria-hidden
            className={cn(
              "size-5",
              rating !== null && value <= rating
                ? "fill-amber-400 text-amber-400"
                : "text-zinc-700",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** One person's recap: real partner, real duration, their own rating. */
export default function CallSummaryScreen({
  summary,
  historyHref,
  backHref,
}: {
  summary: CallSummary;
  /** Where the history lives: /app/history, or the proof path's own. */
  historyHref: string;
  /** Where "Back to the app" goes. */
  backHref: string;
}) {
  const ended = new Date(summary.endedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <main
      data-summary-root=""
      className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-100"
    >
      <Card className="w-full max-w-xl border-white/10 bg-zinc-900 text-zinc-100">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Call summary</CardTitle>
          <p className="text-sm text-zinc-400">{ended}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="space-y-4 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-zinc-400">Person you met</dt>
              <dd data-testid="summary-peer" className="font-medium">
                {summary.peerName}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-zinc-400">Call duration</dt>
              <dd
                data-testid="summary-duration"
                className="font-mono tabular-nums"
              >
                {formatCallDuration(summary.durationSeconds)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-zinc-400">Queue</dt>
              <dd
                data-testid="summary-queue"
                className="font-medium capitalize"
              >
                {summary.queueType}
              </dd>
            </div>
          </dl>
          <div className="flex flex-col items-center gap-2 border-t border-white/10 pt-5">
            <p className="text-sm text-zinc-400">Your rating</p>
            <Stars rating={summary.rating} />
          </div>
          <div className="flex justify-center gap-3 pt-1">
            <Button
              asChild
              variant="default"
              size="lg"
              data-testid="summary-history"
            >
              <Link href={historyHref}>See all calls</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={backHref}>Back to the app</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
