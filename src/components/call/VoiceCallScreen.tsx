"use client";

import { useEffect, useState } from "react";
import { Mic, MicOff, PhoneOff, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VoiceCallProps } from "@/types/call";

/**
 * VoiceCallScreen — the LS0 voice-call surface.
 *
 * Renders the call DOM contract documented in docs/plan/CALL-PLAN.md:
 * a root region with a phase attribute, a call timer, participant rows,
 * and control buttons carrying stable data-testids so the J-suite can
 * drive and observe the call without depending on visual styling.
 *
 * Milestone 1 renders honest state only: the screen mounts in "joining"
 * and every transition into connected/reconnecting/failed/left is driven
 * by real transport snapshots wired in a later milestone. No simulated
 * remote audio, no fabricated connection states.
 */

type CallPhase = "joining" | "connected" | "reconnecting" | "failed" | "left";

const phaseLabel: Record<CallPhase, string> = {
  joining: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  failed: "Connection failed",
  left: "Call ended",
};

function formatElapsed(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function VoiceCallScreen({
  callType,
  participants,
  initialDuration,
  onEndCall,
  onExtendCall,
  onToggleMute,
  onRateCall,
}: VoiceCallProps) {
  // Milestone 1: transport wiring is not in place yet, so the phase stays
  // "joining". Real snapshots replace this in the transport milestone.
  const [phase] = useState<CallPhase>("joining");
  const [isMuted, setIsMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rating, setRating] = useState<number | null>(null);

  // Elapsed timer runs only while the call is actually connected.
  useEffect(() => {
    if (phase !== "connected") return;
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const localParticipant = participants[0];
  const remoteParticipants = participants.slice(1);

  const handleToggleMute = () => {
    setIsMuted((prev) => !prev);
    onToggleMute();
  };

  const remaining = Math.max(initialDuration - elapsed, 0);

  return (
    <main
      data-call-root=""
      data-call-phase={phase}
      role="region"
      aria-label="Voice call"
      className={cn(
        "flex h-screen w-full flex-col items-center justify-center gap-8 bg-zinc-950 text-zinc-100",
        "transition-colors motion-safe:duration-300",
      )}
    >
      <header className="flex flex-col items-center gap-2">
        <p className="text-sm uppercase tracking-wide text-zinc-400">
          {callType === "professional" ? "Professional call" : "Casual call"}
        </p>
        <h2 data-call-title="" className="text-2xl font-semibold">
          {phaseLabel[phase]}
        </h2>
        <div
          data-call-timer=""
          aria-label={`Call time ${formatElapsed(elapsed)}`}
          className="font-mono text-4xl tabular-nums"
        >
          {formatElapsed(elapsed)}
        </div>
        {phase === "connected" && (
          <p className="text-xs text-zinc-500" data-call-remaining="">
            {formatElapsed(remaining)} left in this session
          </p>
        )}
      </header>

      <ul
        data-call-participants=""
        className="flex w-full max-w-sm flex-col gap-3"
        aria-label="Call participants"
      >
        {localParticipant && (
          <li
            key={localParticipant.id}
            data-call-participant=""
            data-participant-id={localParticipant.id}
            className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={localParticipant.avatarUrl}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
            <span className="text-sm font-medium">{localParticipant.name} (you)</span>
            <span
              data-call-mic-state={isMuted ? "muted" : "live"}
              className={cn(
                "ml-auto text-xs",
                isMuted ? "text-red-400" : "text-green-400",
              )}
            >
              {isMuted ? "muted" : "mic live"}
            </span>
          </li>
        )}
        {remoteParticipants.map((participant) => (
          <li
            key={participant.id}
            data-call-participant=""
            data-participant-id={participant.id}
            className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={participant.avatarUrl}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
            <span className="text-sm font-medium">{participant.name}</span>
            {/* Remote media wrapper: audio is attached only when a real
                remote stream exists. Until then the wrapper reports muted
                video/audio honestly instead of pretending to play. */}
            <div
              data-testid="remote-media"
              data-participant-id={participant.id}
              data-audio-muted="true"
              data-video-off="true"
              className="ml-auto flex flex-col items-end"
            >
              <span className="text-xs text-zinc-500">audio not connected</span>
              <audio data-remote-audio="" autoPlay playsInline hidden />
            </div>
          </li>
        ))}
      </ul>

      {phase === "failed" && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-red-400">
            We couldn&apos;t reach the call. Check your microphone connection.
          </p>
          <Button
            data-testid="retry-media"
            onClick={() => {
              /* transport retry wired with the transport milestone */
            }}
            variant="secondary"
          >
            Retry connection
          </Button>
        </div>
      )}

      {phase === "left" ? (
        <section
          aria-label="Rate your call"
          className="flex flex-col items-center gap-3"
          data-call-rating=""
        >
          <p className="text-sm text-zinc-300">How was your call?</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Call rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value > 1 ? "s" : ""}`}
                onClick={() => {
                  setRating(value);
                  onRateCall(value);
                }}
                className="rounded p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                <Star
                  className={cn(
                    "h-6 w-6",
                    rating !== null && value <= rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-zinc-600",
                  )}
                />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <footer className="flex items-center gap-4">
          <Button
            data-testid="toggle-mic"
            data-call-mic=""
            aria-pressed={isMuted}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
            onClick={handleToggleMute}
            variant="secondary"
            size="icon"
            className="h-14 w-14 rounded-full"
          >
            {isMuted ? (
              <MicOff className="h-6 w-6" aria-hidden />
            ) : (
              <Mic className="h-6 w-6" aria-hidden />
            )}
          </Button>
          <Button
            data-testid="leave-call"
            data-call-end=""
            aria-label="End call"
            onClick={onEndCall}
            variant="destructive"
            size="icon"
            className="h-16 w-16 rounded-full"
          >
            <PhoneOff className="h-7 w-7" aria-hidden />
          </Button>
          <Button
            data-call-extend=""
            aria-label="Extend call by five minutes"
            onClick={onExtendCall}
            variant="secondary"
            size="icon"
            className="h-14 w-14 rounded-full"
          >
            <Clock className="h-6 w-6" aria-hidden />
          </Button>
        </footer>
      )}
    </main>
  );
}
