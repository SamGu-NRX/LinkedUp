// src/components/app/call-history-screen.tsx — the call history.
//
// Every row is a persisted call_summaries row of the signed-in person, read
// from the database at request time, so history loads in any later session.
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { formatCallDuration, type CallSummary } from "@/lib/call/summary";
import { cn } from "@/lib/utils";

export default function CallHistoryScreen({
  summaries,
  queueHref,
  summaryHref = (roomId: string) => `/app/call/${roomId}/summary`,
}: {
  summaries: CallSummary[];
  /** Where queueing lives: /app, or the proof path's own. */
  queueHref: string;
  /** Where a row's recap lives: the app summary route, or the proof path's own. */
  summaryHref?: (roomId: string) => string;
}) {
  return (
    <main
      data-history-root=""
      className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-100"
    >
      <Card className="w-full max-w-2xl border-white/10 bg-zinc-900 text-zinc-100">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Your calls</CardTitle>
          <p className="text-sm text-zinc-400">
            {summaries.length === 0
              ? "No calls yet."
              : `${summaries.length} call${summaries.length === 1 ? "" : "s"}, most recent first.`}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {summaries.length === 0 ? (
            <p
              data-testid="history-empty"
              className="text-center text-sm text-zinc-500"
            >
              Finish a call and its summary lands here.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {summaries.map((summary) => (
                <li
                  key={summary.roomId}
                  data-testid="history-row"
                  data-history-peer={summary.peerName}
                  data-history-duration={summary.durationSeconds}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {summary.peerName}
                    </p>
                    <p className="text-xs text-zinc-400">
                      <span className="capitalize">{summary.queueType}</span> ·{" "}
                      {new Date(summary.endedAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      data-testid="history-duration"
                      className="font-mono text-sm tabular-nums"
                    >
                      {formatCallDuration(summary.durationSeconds)}
                    </span>
                    <span
                      className="flex items-center gap-0.5"
                      aria-label={
                        summary.rating === null
                          ? "Not rated"
                          : `${summary.rating} of 5 stars`
                      }
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Star
                          key={value}
                          aria-hidden
                          className={cn(
                            "size-3.5",
                            summary.rating !== null && value <= summary.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-zinc-700",
                          )}
                        />
                      ))}
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link href={summaryHref(summary.roomId)}>Recap</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-center pt-2">
            <Button
              asChild
              variant="default"
              size="lg"
              data-testid="history-queue"
            >
              <Link href={queueHref}>Back to the app</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
