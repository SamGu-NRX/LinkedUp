// src/components/queue/SmartConnectionEngine.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  queueJoinAction,
  queueLeaveAction,
  queueStateAction,
} from "@/app/app/smart-connection/_actions";
import type { QueueStateForUser } from "@/lib/matching";

interface SmartConnectionEngineProps {
  queueType: "professional" | "casual";
}

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
export default function SmartConnectionEngine({ queueType }: SmartConnectionEngineProps) {
  const router = useRouter();
  const [state, setState] = useState<QueueStateForUser>({ status: "idle" });
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [leaving, setLeaving] = useState(false);
  // Set when an offered match is withdrawn because the other person left;
  // the server has already put this person back in the queue.
  const [partnerLeft, setPartnerLeft] = useState<string | null>(null);
  const joinedAtRef = useRef<number | null>(null);
  const offeredRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await queueStateAction();
    if (!res.success) {
      setPhase("error");
      setError(res.error);
      return;
    }
    setState(res.state);
    if (res.state.status === "waiting" && offeredRef.current) setPartnerLeft(offeredRef.current);
    offeredRef.current = res.state.status === "matched" ? res.state.partner.name : null;
    if (res.state.status === "matched") setPartnerLeft(null);
    if (res.state.status === "waiting") {
      joinedAtRef.current = new Date(res.state.joinedAt).getTime();
      setElapsed(Math.floor((Date.now() - joinedAtRef.current) / 1000));
    }
    if (res.state.status === "matched") {
      joinedAtRef.current = null;
    }
    setPhase("ready");
  }, []);

  // Join on mount; poll state every 2 s while waiting.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const join = await queueJoinAction({ queueType });
      if (cancelled) return;
      if (!join.success) {
        setPhase("error");
        setError(join.error);
        return;
      }
      await refresh();
    })();
    const poll = setInterval(() => {
      void refresh();
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
    await queueLeaveAction();
    router.push("/app");
  };

  const handleAccept = async () => {
    if (state.status !== "matched") return;
    router.push(`/app/call/${state.roomId}`);
  };

  if (phase === "loading") {
    return (
      <main
        data-queue-phase="loading"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-100"
      >
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" aria-hidden />
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
        <p className="max-w-md text-sm text-zinc-400">{error ?? "Something went wrong."}</p>
        <Button
          onClick={() => {
            setPhase("loading");
            void refresh();
          }}
        >
          Try again
        </Button>
        <Button variant="ghost" onClick={() => router.push("/app")}>
          Back to the app
        </Button>
      </main>
    );
  }

  if (state.status === "matched") {
    return (
      <main
        data-queue-phase="matched"
        className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-6 text-center text-zinc-100"
      >
        <p className="text-sm uppercase tracking-wide text-emerald-400">
          {queueLabel[state.queueType]} match found
        </p>
        <div
          data-call-partner-name={state.partner.name}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-3xl font-semibold">{state.partner.name}</span>
          <span className="text-sm text-zinc-400">is ready to talk now</span>
        </div>
        <Button
          data-call-accept=""
          size="lg"
          className="rounded-full bg-emerald-600 px-8 text-base hover:bg-emerald-700"
          onClick={handleAccept}
        >
          Join the call
        </Button>
        <Button
          data-call-decline=""
          variant="ghost"
          onClick={handleLeave}
          disabled={leaving}
          className="text-zinc-400"
        >
          <LogOut className="h-4 w-4" aria-hidden /> Leave queue instead
        </Button>
      </main>
    );
  }

  return (
    <main
      data-queue-phase="waiting"
      data-queue-type={queueType}
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-6 text-center text-zinc-100"
    >
      <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-emerald-500/40">
        <Users className="h-10 w-10 animate-pulse text-emerald-400" aria-hidden />
      </div>
      <div data-queue-status="waiting">
        <h1 className="text-2xl font-semibold">Looking for someone to talk to…</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {queueLabel[queueType]} mode — you&apos;ll be matched as soon as another person joins.
        </p>
      </div>
      <p data-queue-notice={partnerLeft ? "partner-left" : undefined} aria-live="polite" className="min-h-5 text-sm text-zinc-300">
        {partnerLeft ? `${partnerLeft} left before the call started. You're back in the queue.` : null}
      </p>
      <p data-queue-elapsed-seconds={elapsed} className="text-3xl font-light tabular-nums">
        {formatWait(elapsed)}
      </p>
      <Button
        data-queue-leave=""
        variant="outline"
        onClick={handleLeave}
        disabled={leaving}
        className="rounded-full border-zinc-700 px-6 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100"
      >
        <LogOut className="h-4 w-4" aria-hidden /> Leave the queue
      </Button>
    </main>
  );
}

function formatWait(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
