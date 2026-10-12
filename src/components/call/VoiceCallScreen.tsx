// src/components/call/VoiceCallScreen.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Clock, Star, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VoiceCallProps } from "@/types/call";

/**
 * VoiceCallScreen — the LS0 voice-call surface.
 *
 * Renders the call DOM contract documented for the journey suite:
 * a root region with a phase attribute, a call timer, participant rows,
 * and control buttons carrying stable data-testids so the J-suite can
 * drive and observe the call without depending on visual styling.
 *
 * LS0 behavior: the call phase is about the CALL, not this device. With
 * no media transport yet (LS1 adds it), the phase stays "joining"; it
 * becomes "failed" when the browser refuses camera and microphone, and
 * "left" when the person ends the call. Local capture readiness is tracked
 * separately (data-call-local-media). Mic and camera toggles really stop
 * and re-acquire tracks. There is no simulated remote media — the partner
 * tile reports exactly what exists ("audio not connected").
 *
 * Every capture request carries a generation number. Leaving, unmounting
 * and a newer request each advance it, and a request that resolves for an
 * old generation stops its tracks at once — the initial request, a retry,
 * or a toggle re-acquire alike — so no track outlives the room.
 */
type CallPhase = "joining" | "connected" | "reconnecting" | "failed" | "left";

type CaptureError = {
  kind: "permission" | "no-device" | "unknown";
  message: string;
};

const phaseLabel: Record<CallPhase, string> = {
  joining: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  failed: "Connection failed",
  left: "Call ended",
};

// Exported for the honesty unit tests.
export function formatElapsed(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/** Stops every live track — the only reliable way to release devices. */
function stopAllTracks(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
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
  const [phase, setPhase] = useState<CallPhase>("joining");
  // This device's capture: live tracks owned by the screen. Not the call.
  const [localReady, setLocalReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [captureError, setCaptureError] = useState<CaptureError | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Toggle intents mirror into refs so startCapture reads the current
  // intent without a new identity (which would re-run the mount capture).
  const micEnabledRef = useRef(true);
  const cameraOnRef = useRef(true);
  /** Bumped by leave, unmount and each new full capture request. */
  const captureGenRef = useRef(0);
  const leftRef = useRef(false);

  const toggleMic = useCallback(() => {
    const next = !micEnabledRef.current;
    micEnabledRef.current = next;
    setMicEnabled(next);
    onToggleMute();
  }, [onToggleMute]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOnRef.current;
    cameraOnRef.current = next;
    setCameraOn(next);
  }, []);

  const localParticipant = participants[0];
  const remoteParticipants = participants.slice(1);

  const setStreamAndRef = useCallback((next: MediaStream | null) => {
    streamRef.current = next;
    setStream(next);
  }, []);

  /** Release this device: invalidate pending requests, stop every live track. */
  const releaseCapture = useCallback(() => {
    captureGenRef.current += 1;
    stopAllTracks(streamRef.current);
    streamRef.current = null;
  }, []);

  const startCapture = useCallback(async () => {
    const gen = ++captureGenRef.current;
    const current = () => gen === captureGenRef.current && !leftRef.current;
    setCaptureError(null);
    setPhase((p) => (p === "failed" ? "joining" : p));
    try {
      // Ask only for the kinds the user's toggles currently allow — a retry
      // after muting the mic must not silently re-open the microphone.
      const media = await navigator.mediaDevices.getUserMedia({
        audio: micEnabledRef.current,
        video: cameraOnRef.current,
      });
      if (!current()) {
        // Left, unmounted or superseded while the browser prompt was open:
        // release everything the browser just granted.
        stopAllTracks(media);
        return;
      }
      // A toggle flipped while the request was in flight: exclude the kinds
      // the user disabled (stopping their tracks) so the stream matches the
      // visible controls — the same filtering the mute toggles apply.
      const wantedTracks = media.getTracks().filter((track) => {
        const wanted = track.kind === "audio" ? micEnabledRef.current : cameraOnRef.current;
        if (!wanted) track.stop();
        return wanted;
      });
      stopAllTracks(streamRef.current);
      setStreamAndRef(new MediaStream(wantedTracks));
      setLocalReady(true);
    } catch (error) {
      if (!current()) return;
      // Browsers throw DOMException, but read the name off any error —
      // wrappers and polyfills exist in the wild.
      const name =
        error instanceof DOMException
          ? error.name
          : ((error as { name?: string } | null)?.name ?? "");
      if (name === "NotAllowedError") {
        setCaptureError({
          kind: "permission",
          message:
            "Camera and microphone access was blocked. Allow access in your browser settings, then retry.",
        });
        // Without permission there is no call to have: say so.
        setPhase("failed");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setCaptureError({
          kind: "no-device",
          message:
            "No camera or microphone was found. Connect one (or check that another app isn't holding it), then retry.",
        });
      } else {
        setCaptureError({
          kind: "unknown",
          message: "Could not start local capture. Retry when ready.",
        });
      }
    }
  }, [setStreamAndRef]);

  // Acquire local media on mount (startCapture is stable). Unmounting
  // (Back, route change) releases the devices and invalidates any request
  // still waiting on the browser prompt.
  useEffect(() => {
    void startCapture();
    return releaseCapture;
  }, [startCapture, releaseCapture]);

  /** Re-acquire one kind after a toggle, unless a leave or newer capture intervened. */
  const reacquire = useCallback(
    async (kind: "audio" | "video", isCancelled: () => boolean) => {
      const gen = captureGenRef.current;
      const stale = () => isCancelled() || gen !== captureGenRef.current || leftRef.current;
      try {
        const fresh = await navigator.mediaDevices.getUserMedia(
          kind === "audio" ? { audio: true } : { video: true },
        );
        if (stale()) {
          stopAllTracks(fresh);
          return;
        }
        const current = streamRef.current;
        setStreamAndRef(new MediaStream([...(current?.getTracks() ?? []), ...fresh.getTracks()]));
      } catch (error) {
        if (stale()) return;
        const name = error instanceof DOMException ? error.name : "";
        const what = kind === "audio" ? "Microphone" : "Camera";
        setCaptureError({
          kind: name === "NotAllowedError" ? "permission" : "no-device",
          message:
            name === "NotAllowedError"
              ? `${what} access was blocked. Allow access in your browser settings, then retry.`
              : `No ${what.toLowerCase()} was found. Connect one, then retry.`,
        });
      }
    },
    [setStreamAndRef],
  );

  // Camera off: really stop the video track. Camera on: re-acquire it.
  useEffect(() => {
    if (!localReady) return;
    if (!cameraOn) {
      const current = streamRef.current;
      current?.getVideoTracks().forEach((track) => track.stop());
      if (current) {
        setStreamAndRef(new MediaStream(current.getTracks().filter((t) => t.kind !== "video")));
      }
      return;
    }
    if (streamRef.current?.getVideoTracks().some((t) => t.readyState === "live")) return;
    let cancelled = false;
    void reacquire("video", () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [cameraOn, localReady, reacquire, setStreamAndRef]);

  // Mic off: really stop the audio track. Mic on: re-acquire it.
  useEffect(() => {
    if (!localReady) return;
    if (!micEnabled) {
      const current = streamRef.current;
      current?.getAudioTracks().forEach((track) => track.stop());
      if (current) {
        setStreamAndRef(new MediaStream(current.getTracks().filter((t) => t.kind !== "audio")));
      }
      return;
    }
    if (streamRef.current?.getAudioTracks().some((t) => t.readyState === "live")) return;
    let cancelled = false;
    void reacquire("audio", () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [micEnabled, localReady, reacquire, setStreamAndRef]);

  // Local preview element follows the stream while the camera is live.
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Elapsed timer runs only while the call is actually connected.
  useEffect(() => {
    if (phase !== "connected") return;
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const localAudioLive = stream?.getAudioTracks().some((t) => t.readyState === "live") ?? false;
  const localVideoLive = stream?.getVideoTracks().some((t) => t.readyState === "live") ?? false;
  const micState = localReady && micEnabled && localAudioLive ? "live" : "muted";

  const handleLeave = () => {
    leftRef.current = true;
    releaseCapture();
    setStreamAndRef(null);
    setLocalReady(false);
    setPhase("left");
    onEndCall();
  };

  const remaining = Math.max(initialDuration - elapsed, 0);

  return (
    <main
      data-call-root=""
      data-call-phase={phase}
      data-call-local-media={localReady ? "ready" : "pending"}
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

      {/* Local preview: the only video shown is this device's capture. */}
      {localVideoLive && phase !== "left" && (
        <video
          data-call-local-preview=""
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-44 w-64 scale-x-[-1] rounded-xl border border-zinc-800 bg-black object-cover"
        />
      )}

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
            <span className="text-sm font-medium">{localParticipant.name} (you)</span>
            <span
              data-call-mic-state={micState}
              className={cn("ml-auto text-xs", micState === "muted" ? "text-red-400" : "text-green-400")}
            >
              {micState === "muted" ? "muted" : "mic live"}
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
            <span className="text-sm font-medium">{participant.name}</span>
            {/* Remote media wrapper: no remote stream exists in LS0, so the
                wrapper reports muted video/audio honestly instead of
                pretending to play. Real streams attach in LS1. */}
            <div
              data-testid="remote-media"
              data-participant-id={participant.id}
              data-audio-muted="true"
              data-video-off="true"
              className="ml-auto flex flex-col items-end"
            >
              <span data-call-transport-note="" className="text-xs text-zinc-500">
                audio not connected — waiting for media transport
              </span>
            </div>
          </li>
        ))}
      </ul>

      {captureError && phase !== "left" && (
        <div
          data-call-capture-error={captureError.kind}
          role="alert"
          className="flex max-w-sm flex-col items-center gap-3 text-center"
        >
          <p className="text-sm text-red-400">{captureError.message}</p>
          <Button
            data-testid="retry-media"
            data-call-retry=""
            onClick={() => {
              void startCapture();
            }}
            variant="secondary"
          >
            Retry capture
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
            aria-pressed={micEnabled}
            aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
            onClick={toggleMic}
            variant="secondary"
            size="icon"
            className="h-14 w-14 rounded-full"
          >
            {micEnabled ? (
              <Mic className="h-6 w-6" aria-hidden />
            ) : (
              <MicOff className="h-6 w-6" aria-hidden />
            )}
          </Button>
          <Button
            data-call-camera=""
            aria-pressed={cameraOn}
            aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
            onClick={toggleCamera}
            variant="secondary"
            size="icon"
            className="h-14 w-14 rounded-full"
          >
            {cameraOn ? (
              <Video className="h-6 w-6" aria-hidden />
            ) : (
              <VideoOff className="h-6 w-6" aria-hidden />
            )}
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
          <Button
            data-testid="leave-call"
            data-call-end=""
            aria-label="End call"
            onClick={handleLeave}
            variant="destructive"
            size="icon"
            className="h-16 w-16 rounded-full"
          >
            <PhoneOff className="h-7 w-7" aria-hidden />
          </Button>
        </footer>
      )}
    </main>
  );
}
