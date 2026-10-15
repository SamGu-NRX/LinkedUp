// src/components/queue/SmartConnectionEngine.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import MatchIntro from "@/components/matching/MatchIntro";
import {
  queueJoinAction,
  queueLeaveAction,
  queueStateAction,
} from "@/app/app/smart-connection/_actions";
import type { QueueStateForUser } from "@/lib/matching";

interface SmartConnectionEngineProps {
  queueType: "professional" | "casual";
  /** The room id is appended. The journey-proof test path passes its own. */
  callPathPrefix?: string;
  /** Where leaving the queue goes. */
  leaveHref?: string;
}

const queueButton =
  "min-h-11 transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-emerald-400";

const queueLabel: Record<"professional" | "casual", string> = {
  professional: "Professional",
  casual: "Casual",
};

/**
 * Real-state queue screen. Joining, polling, leaving, and matching all
 * run through DB-backed server actions — no simulated timers, no mock
 * match data. Elapsed time is computed from the server-persisted
 * `joinedAt`, so a reload keeps the true wait time.
 */
export default function SmartConnectionEngine({
  queueType,
  callPathPrefix = "/app/call/",
  leaveHref = "/app",
}: SmartConnectionEngineProps) {
  const router = useRouter();
  const [state, setState] = useState<QueueStateForUser>({ status: "idle" });
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [leaving, setLeaving] = useState(false);
  // Set when an offered match is withdrawn because the other person left;
  // the server has already put this person back in the queue.
  const [partnerLeft, setPartnerLeft] = useState<string | null>(null);
  const joinedAtRef = useRef<number | null>(null);
  const queueJoinedRef = useRef(false);
  const offeredRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await queueStateAction();
      if (!res.success) {
        setPhase("error");
        setError(res.error);
        return;
      }
      setState(res.state);
      if (res.state.status === "waiting" && offeredRef.current)
        setPartnerLeft(offeredRef.current);
      offeredRef.current =
        res.state.status === "matched" ? res.state.partner.name : null;
      if (res.state.status === "matched") setPartnerLeft(null);
      if (res.state.status === "waiting") {
        joinedAtRef.current = new Date(res.state.joinedAt).getTime();
        setElapsed(Math.floor((Date.now() - joinedAtRef.current) / 1000));
      }
      if (res.state.status === "matched") {
        joinedAtRef.current = null;
      }
      setPhase("ready");
      setError(null);
    } catch {
      setPhase("error");
      setError("Could not check the queue. Try again.");
    }
  }, []);

  // Join on mount; poll state every 2 s while waiting.
  useEffect(() => {
    let cancelled = false;
    queueJoinedRef.current = false;
    (async () => {
      try {
        const join = await queueJoinAction({ queueType });
        if (cancelled) return;
        if (!join.success) {
          setPhase("error");
          setError(join.error);
          return;
        }
        queueJoinedRef.current = true;
        await refresh();
      } catch {
        if (!cancelled) {
          setPhase("error");
          setError("Could not join the queue. Try again.");
        }
      }
    })();
    const poll = setInterval(() => {
      if (queueJoinedRef.current) void refresh();
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [queueType, refresh]);

  // Local elapsed tick while waiting.
  useEffect(() => {
    if (state.status !== "waiting") return;
    const timer = setInterval(() => {
      if (joinedAtRef.current) {
        setElapsed(Math.floor((Date.now() - joinedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [state.status]);

  const handleLeave = async () => {
    setLeaving(true);
    setLeaveError(null);
    try {
      const result = await queueLeaveAction();
      if (!result.success) {
        setLeaveError(result.error);
        return;
      }
      router.push(leaveHref);
    } catch {
      setLeaveError("Could not leave the queue. Try again.");
    } finally {
      setLeaving(false);
    }
  };

  const handleAccept = async () => {
    if (state.status !== "matched") return;
    router.push(`${callPathPrefix}${state.roomId}`);
  };

  const renderScreen = () => {
    if (phase === "loading") {
      return (
        <main
          data-queue-phase="loading"
          className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-100"
        >
          <Loader2
            className="h-8 w-8 text-emerald-400 motion-safe:animate-spin"
            aria-hidden
          />
          <p className="text-sm text-zinc-400">Checking the queue…</p>
        </main>
      );
    }

    if (phase === "error") {
      return (
        <main
          data-queue-phase="error"
          className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-100"
        >
          <h1 className="text-2xl font-semibold">Queue unavailable</h1>
          <p role="alert" className="max-w-md text-sm text-zinc-400">
            {error ?? "Something went wrong."}
          </p>
          <Button
            className={queueButton}
            onClick={() => {
              setPhase("loading");
              setError(null);
              void (async () => {
                try {
                  const join = await queueJoinAction({ queueType });
                  if (!join.success) {
                    setError(join.error);
                    setPhase("error");
                    return;
                  }
                  queueJoinedRef.current = true;
                  await refresh();
                } catch {
                  setError("Could not join the queue. Try again.");
                  setPhase("error");
                }
              })();
            }}
          >
            Try again
          </Button>
          <Button
            className={queueButton}
            variant="ghost"
            onClick={() => router.push(leaveHref)}
          >
            Back to the app
          </Button>
        </main>
      );
    }

    if (state.status === "matched") {
      return (
        <main
          data-queue-phase="matched"
          className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-6 py-10 text-center text-zinc-100"
        >
          <p className="text-sm tracking-wide text-emerald-400 uppercase">
            {queueLabel[state.queueType]} match found
          </p>
          <div
            data-call-partner-name={state.partner.name}
            className="flex w-full max-w-xl min-w-0 flex-col items-center gap-2"
          >
            <h1 className="max-w-full text-3xl font-semibold [overflow-wrap:anywhere] break-words">
              {state.partner.name}
            </h1>
            <span className="text-sm text-zinc-400">is your match</span>
          </div>
          <MatchIntro intro={state.intro} />
          {leaveError && (
            <p role="alert" className="max-w-xl text-sm text-red-300">
              {leaveError}
            </p>
          )}
          <Button
            data-call-accept=""
            size="lg"
            className={`${queueButton} rounded-full bg-emerald-600 px-8 text-base text-white hover:bg-emerald-700`}
            onClick={handleAccept}
          >
            Join the call
          </Button>
          <Button
            data-call-decline=""
            variant="ghost"
            onClick={handleLeave}
            disabled={leaving}
            className={`${queueButton} text-zinc-400`}
          >
            <LogOut className="h-4 w-4" aria-hidden /> Leave queue instead
          </Button>
        </main>
      );
    }

    if (state.status === "idle") {
      return (
        <main
          data-queue-phase="idle"
          className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-100"
        >
          <div>
            <h1 className="text-2xl font-semibold">You are not in the queue</h1>
          </div>
          <p className="max-w-md text-sm text-zinc-400">
            Return to the app to start a new search.
          </p>
          <Button
            className={queueButton}
            onClick={() => router.push(leaveHref)}
          >
            Back to the app
          </Button>
        </main>
      );
    }

    return (
      <main
        data-queue-phase="waiting"
        data-queue-type={queueType}
        className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-6 py-10 text-center text-zinc-100"
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-emerald-500/40">
          <Users className="h-10 w-10 text-emerald-400" aria-hidden />
        </div>
        <div data-queue-status="waiting" className="max-w-xl">
          <h1 className="text-2xl font-semibold">
            Looking for someone to talk to…
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {elapsed < 20
              ? `${queueLabel[queueType]} mode. Looking for shared interests first. After 20 seconds, we widen the search.`
              : `${queueLabel[queueType]} mode. The search has widened beyond shared interests. We are still looking for someone available.`}
          </p>
        </div>
        <p
          data-queue-notice={partnerLeft ? "partner-left" : undefined}
          aria-live="polite"
          className="min-h-5 text-sm text-zinc-300"
        >
          {partnerLeft
            ? `${partnerLeft} left before the call started. You're back in the queue.`
            : null}
        </p>
        {leaveError && (
          <p role="alert" className="max-w-xl text-sm text-red-300">
            {leaveError}
          </p>
        )}
        <p
          data-queue-elapsed-seconds={elapsed}
          className="text-3xl font-light tabular-nums"
        >
          {formatWait(elapsed)}
        </p>
        <Button
          data-queue-leave=""
          variant="outline"
          onClick={handleLeave}
          disabled={leaving}
          className={`${queueButton} rounded-full border-zinc-700 bg-transparent px-6 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100`}
        >
          <LogOut className="h-4 w-4" aria-hidden /> Leave the queue
        </Button>
      </main>
    );
  };

  const announcement =
    phase === "loading"
      ? "Checking the queue."
      : phase === "error"
        ? "Queue unavailable."
        : state.status === "matched"
          ? `${state.partner.name} is your match. Join the call when you are ready.`
          : state.status === "waiting"
            ? "Looking for someone to talk to."
            : "You are not in the queue.";
  return (
    <>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </p>
      {renderScreen()}
    </>
  );
}

function formatWait(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
