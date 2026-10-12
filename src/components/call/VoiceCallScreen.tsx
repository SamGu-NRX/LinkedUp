// src/components/call/VoiceCallScreen.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clock,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Settings2,
  Star,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CallPhase } from "@/lib/call/transport";
import type { VoiceCallProps } from "@/types/call";
import { useCallTransport, type CallConnection, type RemoteState } from "./useCallTransport";

/**
 * VoiceCallScreen — the call room for a matched pair.
 *
 * DOM contract (the call harness, tools/call-eval): `[data-call-phase]` on
 * the root, one of joining|connected|reconnecting|failed|left; each remote
 * person in a `[data-testid="remote-media"]` tile with data-participant-id,
 * data-audio-muted and data-video-off around their <video>; the local
 * preview in `[data-testid="local-video"]`; buttons toggle-mic,
 * toggle-camera, device-settings, leave-call, retry-media, and join-call to
 * rejoin after leaving; errors in `[data-testid="call-error"]`.
 *
 * The phase is the call's, not this device's: "connected" only once the
 * transport connects to the other person; "failed" when the browser refuses
 * camera and microphone or the transport gives up; "left" after Leave.
 * Without a `call` (no signaling configured) the phase stays "joining".
 *
 * Capture belongs to this screen. Every capture request carries a
 * generation number; leaving, unmounting and a newer request each advance
 * it, and a request that resolves for an old generation stops its tracks at
 * once, so no track outlives the room. Mic and camera toggles really stop
 * and re-acquire tracks; the transport only forwards what it is given.
 */

type ScreenPhase = "joining" | "failed" | "left";

type CaptureError = {
  kind: "permission" | "no-device" | "unknown";
  message: string;
};

const phaseLabel: Record<CallPhase, string> = {
  idle: "Connecting…",
  joining: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  failed: "Connection failed",
  left: "You left the call",
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

/**
 * Controls give feedback by colour, not motion: a press can come from the
 * keyboard, and keyboard actions do not animate (review-animations).
 * Focus is a real outline, so forced-colors mode keeps it.
 */
// Tailwind v4's outline-none would also zero the outline style this ring
// relies on, so there is no outline-none here.
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-emerald-400";
const control = cn(
  focusRing,
  "grid size-12 shrink-0 place-items-center rounded-full disabled:opacity-50",
);

export default function VoiceCallScreen({
  callType,
  participants,
  initialDuration,
  onEndCall,
  onExtendCall,
  onToggleMute,
  onRateCall,
  call = null,
  onDone,
}: VoiceCallProps & { call?: CallConnection | null; onDone?: () => void }) {
  const [screenPhase, setScreenPhase] = useState<ScreenPhase>("joining");
  // This device's capture: live tracks owned by the screen. Not the call.
  const [localReady, setLocalReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [captureError, setCaptureError] = useState<CaptureError | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Toggle intents mirror into refs so startCapture reads the current
  // intent without a new identity (which would re-run the mount capture).
  const micEnabledRef = useRef(true);
  const cameraOnRef = useRef(true);
  const cameraIdRef = useRef("");
  /** Bumped by leave, unmount and each new full capture request. */
  const captureGenRef = useRef(0);
  const leftRef = useRef(false);

  const left = screenPhase === "left";
  const transport = useCallTransport({
    connection: call,
    active: Boolean(call) && localReady && !left,
    stream,
    micOn: micEnabled,
    cameraOn,
  });

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
  const partner = participants[1];

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

  const videoConstraint = (): MediaTrackConstraints | boolean =>
    cameraIdRef.current ? { deviceId: { exact: cameraIdRef.current } } : true;

  const startCapture = useCallback(async () => {
    const gen = ++captureGenRef.current;
    const current = () => gen === captureGenRef.current && !leftRef.current;
    setCaptureError(null);
    setScreenPhase((p) => (p === "failed" ? "joining" : p));
    try {
      // Ask only for the kinds the user's toggles currently allow — a retry
      // after muting the mic must not silently re-open the microphone.
      const media = await navigator.mediaDevices.getUserMedia({
        audio: micEnabledRef.current,
        video: cameraOnRef.current ? videoConstraint() : false,
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
        error instanceof DOMException ? error.name : ((error as { name?: string } | null)?.name ?? "");
      if (name === "NotAllowedError") {
        setCaptureError({
          kind: "permission",
          message:
            "Camera and microphone access was blocked. Allow access in your browser settings, then try again.",
        });
        // Without permission there is no call to have: say so.
        setScreenPhase("failed");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setCaptureError({
          kind: "no-device",
          message: "No camera or microphone was found. Connect one, or close another app that is using it, then try again.",
        });
      } else {
        setCaptureError({ kind: "unknown", message: "Could not start your camera and microphone. Try again." });
      }
    }
    // videoConstraint reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          kind === "audio" ? { audio: true } : { video: videoConstraint() },
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
              ? `${what} access was blocked. Allow access in your browser settings, then try again.`
              : `No ${what.toLowerCase()} was found. Connect one, then try again.`,
        });
      }
    },
    // videoConstraint reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Cameras to switch between, once the browser has granted access (labels
  // and ids are hidden before that).
  useEffect(() => {
    if (!localReady || !navigator.mediaDevices?.enumerateDevices) return;
    let cancelled = false;
    const read = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (cancelled) return;
      setCameras(devices.filter((d) => d.kind === "videoinput" && d.deviceId));
      const live = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId;
      if (live && !cameraIdRef.current) setCameraId(live);
    };
    void read();
    navigator.mediaDevices.addEventListener?.("devicechange", read);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener?.("devicechange", read);
    };
  }, [localReady]);

  /** Switch cameras without leaving: the new track replaces the old one. */
  const switchCamera = useCallback(
    async (deviceId: string) => {
      cameraIdRef.current = deviceId;
      setCameraId(deviceId);
      if (!cameraOnRef.current || !streamRef.current) return;
      const gen = captureGenRef.current;
      try {
        const fresh = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
        if (gen !== captureGenRef.current || leftRef.current || !cameraOnRef.current) {
          stopAllTracks(fresh);
          return;
        }
        const current = streamRef.current;
        current?.getVideoTracks().forEach((t) => t.stop());
        setStreamAndRef(
          new MediaStream([...(current?.getAudioTracks() ?? []), ...fresh.getVideoTracks()]),
        );
      } catch {
        setCaptureError({ kind: "no-device", message: "That camera could not start. Pick another one." });
      }
    },
    [setStreamAndRef],
  );

  // Local preview element follows the stream while the camera is live.
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const phase: CallPhase =
    screenPhase === "left"
      ? "left"
      : screenPhase === "failed"
        ? "failed"
        : call
          ? transport.phase === "idle" || transport.phase === "left"
            ? "joining"
            : transport.phase
          : "joining";

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
    setScreenPhase("left");
    onEndCall();
  };

  const handleRejoin = () => {
    leftRef.current = false;
    setScreenPhase("joining");
    setElapsed(0);
    void startCapture();
  };

  const remaining = Math.max(initialDuration - elapsed, 0);
  const remotes = [...transport.remotes.entries()];
  const transportFailed = phase === "failed" && screenPhase !== "failed" && transport.error;
  const nameFor = (id: string) => (partner && String(partner.id) === id ? partner.name : "Your match");

  return (
    <main
      data-call-root=""
      data-call-phase={phase}
      data-call-local-media={localReady ? "ready" : "pending"}
      role="region"
      aria-label="Call"
      className="flex h-dvh w-full flex-col bg-zinc-950 text-zinc-100"
    >
      <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
            {callType === "professional" ? "Professional call" : "Casual call"}
          </p>
          <h1 data-call-title="" className="truncate text-lg font-semibold sm:text-xl">
            {left ? phaseLabel.left : partner ? `${partner.name}` : "Your call"}
          </h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div
            data-call-timer=""
            aria-label={`Call time ${formatElapsed(elapsed)}`}
            className="font-mono text-lg tabular-nums sm:text-xl"
          >
            {formatElapsed(elapsed)}
          </div>
          {phase === "connected" && (
            <p className="text-xs text-zinc-500" data-call-remaining="">
              {formatElapsed(remaining)} left
            </p>
          )}
        </div>
      </header>

      {left ? (
        <LeftScreen
          rating={rating}
          onRate={(value) => {
            setRating(value);
            onRateCall(value);
          }}
          onRejoin={handleRejoin}
          onDone={onDone}
        />
      ) : (
        <>
          <div aria-live="polite" role="status" className="flex min-h-9 justify-center px-4 pt-2">
            <StatusPill phase={phase} alone={remotes.length === 0} partnerName={partner?.name} />
          </div>

          <section className="relative mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col p-3 sm:p-6">
            {localReady && captureError && (
              <div
                role="alert"
                data-call-capture-error={captureError.kind}
                className="mb-3 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-rose-500/10 px-4 py-2 text-sm text-rose-200"
              >
                <span data-testid="call-error">{captureError.message}</span>
                <button
                  type="button"
                  data-testid="retry-media"
                  data-call-retry=""
                  onClick={() => setCaptureError(null)}
                  className={cn(focusRing, "h-11 rounded-full bg-white/10 px-4 text-xs font-medium hover:bg-white/15")}
                >
                  Dismiss
                </button>
              </div>
            )}
            {(captureError && !localReady) || transportFailed ? (
              <ProblemPanel
                captureKind={!localReady ? captureError?.kind : undefined}
                message={
                  (!localReady && captureError?.message) ||
                  (transport.error ? transport.error.message : "The connection to the call was lost.")
                }
                onRetryMedia={captureError && !localReady ? () => void startCapture() : undefined}
                onRetryCall={localReady && transport.error?.retryable ? transport.retry : undefined}
                onDone={onDone}
              />
            ) : remotes.length === 0 ? (
              <WaitingTile name={partner?.name} phase={phase} />
            ) : (
              <div className="grid min-h-0 flex-1 gap-3">
                {remotes.map(([id, r]) => (
                  <RemoteTile key={id} id={id} name={nameFor(id)} remote={r} dim={phase === "reconnecting"} />
                ))}
              </div>
            )}

            {localVideoLive && (
              <video
                data-testid="local-video"
                data-call-local-preview=""
                ref={videoRef}
                autoPlay
                muted
                playsInline
                aria-label="Your camera"
                className="absolute right-5 bottom-5 z-10 aspect-video w-28 scale-x-[-1] rounded-xl bg-black object-cover shadow-lg ring-1 ring-white/10 sm:right-9 sm:bottom-9 sm:w-52"
              />
            )}
          </section>

          <ul className="sr-only" data-call-participants="" aria-label="Call participants">
            {localParticipant && (
              <li data-call-participant="" data-participant-id={localParticipant.id}>
                {localParticipant.name} (you)
                <span data-call-mic-state={micState}>{micState === "muted" ? "muted" : "mic live"}</span>
              </li>
            )}
          </ul>

          <footer
            role="group"
            aria-label="Call controls"
            className="flex items-center justify-center gap-2 border-t border-white/5 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-3"
          >
            <button
              type="button"
              data-testid="toggle-mic"
              data-call-mic=""
              aria-pressed={!micEnabled}
              aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
              title={micEnabled ? "Mute microphone" : "Unmute microphone"}
              onClick={toggleMic}
              className={cn(control, micEnabled ? "bg-white/10 hover:bg-white/15" : "bg-rose-500 text-white hover:bg-rose-400")}
            >
              {micEnabled ? <Mic className="size-5" aria-hidden /> : <MicOff className="size-5" aria-hidden />}
            </button>
            <button
              type="button"
              data-testid="toggle-camera"
              data-call-camera=""
              aria-pressed={!cameraOn}
              aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
              title={cameraOn ? "Turn camera off" : "Turn camera on"}
              onClick={toggleCamera}
              className={cn(control, cameraOn ? "bg-white/10 hover:bg-white/15" : "bg-rose-500 text-white hover:bg-rose-400")}
            >
              {cameraOn ? <Video className="size-5" aria-hidden /> : <VideoOff className="size-5" aria-hidden />}
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  data-testid="device-settings"
                  aria-label="Camera settings"
                  title="Camera settings"
                  className={cn(control, "bg-white/10 hover:bg-white/15")}
                >
                  <Settings2 className="size-5" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                aria-label="Camera settings"
                // No open/close animation: the menu is opened from the
                // keyboard as often as by pointer.
                // Important: Radix sets the content's inline animation itself.
                className="w-72 border-white/10 bg-zinc-900 text-zinc-100 animate-none!"
              >
                <label htmlFor="device-camera" className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Camera
                </label>
                <select
                  id="device-camera"
                  value={cameraId}
                  disabled={cameras.length === 0}
                  onChange={(e) => void switchCamera(e.target.value)}
                  className={cn(focusRing, "h-11 w-full rounded-md border border-white/10 bg-zinc-950 px-2 text-base sm:text-sm")}
                >
                  {cameras.length === 0 && <option value="">No camera found</option>}
                  {cameras.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </PopoverContent>
            </Popover>
            <button
              type="button"
              data-call-extend=""
              aria-label="Extend call by five minutes"
              title="Extend call by five minutes"
              onClick={onExtendCall}
              className={cn(control, "hidden bg-white/10 hover:bg-white/15 sm:grid")}
            >
              <Clock className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              data-testid="leave-call"
              data-call-end=""
              aria-label="Leave call"
              onClick={handleLeave}
              className={cn(
                focusRing,
                "ml-1 flex h-12 shrink-0 items-center gap-2 rounded-full bg-rose-600 px-5 text-sm font-semibold text-white hover:bg-rose-500",
              )}
            >
              <PhoneOff className="size-5" aria-hidden />
              <span>Leave</span>
            </button>
          </footer>
        </>
      )}
    </main>
  );
}

function StatusPill({ phase, alone, partnerName }: { phase: CallPhase; alone: boolean; partnerName?: string }) {
  const text =
    phase === "reconnecting"
      ? "Reconnecting. The call continues when the connection comes back."
      : phase === "joining" || phase === "idle"
        ? "Connecting to the call…"
        : phase === "connected" && alone
          ? `Waiting for ${partnerName ?? "your match"} to join`
          : null;
  if (!text) return null;
  return (
    <p
      key={text}
      className={cn(
        "rounded-full bg-white/5 px-3 py-1.5 text-sm",
        phase === "reconnecting" ? "text-amber-300" : "text-zinc-300",
      )}
    >
      {text}
    </p>
  );
}

function WaitingTile({ name, phase }: { name?: string; phase: CallPhase }) {
  return (
    <div
      data-call-partner-waiting=""
      className="grid min-h-0 flex-1 place-items-center rounded-2xl bg-zinc-900 ring-1 ring-white/5"
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <Initials name={name} />
        <p className="text-sm text-zinc-400">
          {phase === "connected" ? `${name ?? "Your match"} hasn't joined yet.` : `Connecting you with ${name ?? "your match"}…`}
        </p>
      </div>
    </div>
  );
}

function Initials({ name }: { name?: string }) {
  const letters = (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className="grid size-20 place-items-center rounded-full bg-emerald-500/15 text-2xl font-semibold text-emerald-300 sm:size-24">
      {letters || "?"}
    </div>
  );
}

/**
 * One remote person. The <video> carries their audio too, so it stays
 * mounted (and playing) while their camera is off; a placeholder covers it.
 * If the browser blocks audio until a tap, the tile asks for one.
 */
function RemoteTile({ id, name, remote, dim }: { id: string; name: string; remote: RemoteState; dim: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== remote.stream) el.srcObject = remote.stream;
    if (!remote.stream) return;
    el.play().then(
      () => setNeedsTap(false),
      (err: unknown) => {
        if ((err as { name?: string })?.name === "NotAllowedError") setNeedsTap(true);
      },
    );
  }, [remote.stream, remote.version]);

  return (
    <div
      data-testid="remote-media"
      data-participant-id={id}
      data-audio-muted={String(!remote.micOn)}
      data-video-off={String(!remote.cameraOn)}
      className={cn(
        "relative min-h-0 overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/5 transition-opacity duration-200 motion-reduce:transition-none",
        dim && "opacity-60",
      )}
    >
      <video ref={ref} autoPlay playsInline aria-label={`${name}'s video`} className="size-full object-cover" />
      {!remote.cameraOn && (
        <div className="absolute inset-0 grid place-items-center bg-zinc-900">
          <div className="flex flex-col items-center gap-2">
            <Initials name={name} />
            <p className="text-sm text-zinc-400">Camera off</p>
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-sm backdrop-blur-sm">
        <span className="max-w-[12rem] truncate">{name}</span>
        {!remote.micOn && <MicOff className="size-4 text-rose-300" aria-label="Muted" />}
      </div>
      {needsTap && (
        <button
          type="button"
          onClick={() => {
            void ref.current?.play().then(() => setNeedsTap(false), () => {});
          }}
          className={cn(
            focusRing,
            "absolute top-3 left-1/2 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-400 px-4 text-sm font-semibold text-emerald-950",
          )}
        >
          <Volume2 className="size-4" aria-hidden /> Tap to hear {name}
        </button>
      )}
    </div>
  );
}

function ProblemPanel({
  captureKind,
  message,
  onRetryMedia,
  onRetryCall,
  onDone,
}: {
  captureKind?: CaptureError["kind"];
  message: string;
  onRetryMedia?: () => void;
  onRetryCall?: () => void;
  onDone?: () => void;
}) {
  return (
    <div
      role="alert"
      data-call-capture-error={captureKind}
      className="grid min-h-0 flex-1 place-items-center rounded-2xl bg-zinc-900 px-6 ring-1 ring-white/5"
    >
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <p data-testid="call-error" className="text-base text-zinc-100">
          {message}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {onRetryMedia && (
            <button
              type="button"
              data-testid="retry-media"
              data-call-retry=""
              onClick={onRetryMedia}
              className={cn(focusRing, "flex h-11 items-center gap-2 rounded-full bg-emerald-400 px-5 text-sm font-semibold text-emerald-950")}
            >
              <RotateCcw className="size-4" aria-hidden /> Try again
            </button>
          )}
          {onRetryCall && (
            <button
              type="button"
              data-testid="retry-call"
              onClick={onRetryCall}
              className={cn(focusRing, "flex h-11 items-center gap-2 rounded-full bg-emerald-400 px-5 text-sm font-semibold text-emerald-950")}
            >
              <RotateCcw className="size-4" aria-hidden /> Reconnect
            </button>
          )}
          {onDone && (
            <button
              type="button"
              onClick={onDone}
              className={cn(focusRing, "h-11 rounded-full bg-white/10 px-5 text-sm font-medium hover:bg-white/15")}
            >
              Back to the queue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LeftScreen({
  rating,
  onRate,
  onRejoin,
  onDone,
}: {
  rating: number | null;
  onRate: (value: number) => void;
  onRejoin: () => void;
  onDone?: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  // Focus moves to the heading once, when the screen appears; rating a call
  // must not pull it back.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col gap-2">
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">
          You left the call
        </h2>
        <p className="text-sm text-zinc-400">Your camera and microphone are off.</p>
      </div>
      {/* Native radios: one Tab stop, arrow keys move between stars. */}
      <fieldset className="flex flex-col items-center gap-3" data-call-rating="">
        <legend className="mb-3 text-sm text-zinc-300">How was your call?</legend>
        <div className="flex">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="relative grid size-12 cursor-pointer place-items-center">
              <input
                type="radio"
                name="call-rating"
                value={value}
                checked={rating === value}
                onChange={() => onRate(value)}
                aria-label={`${value} star${value > 1 ? "s" : ""}`}
                className="peer sr-only"
              />
              <Star
                aria-hidden
                className={cn(
                  "size-7 rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-solid peer-focus-visible:outline-emerald-400",
                  rating !== null && value <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-600",
                )}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          data-testid="join-call"
          onClick={onRejoin}
          className={cn(focusRing, "h-11 rounded-full bg-white/10 px-5 text-sm font-medium hover:bg-white/15")}
        >
          Rejoin
        </button>
        {onDone && (
          <button
            type="button"
            data-testid="call-done"
            onClick={onDone}
            className={cn(focusRing, "h-11 rounded-full bg-emerald-400 px-5 text-sm font-semibold text-emerald-950 hover:bg-emerald-300")}
          >
            Done
          </button>
        )}
      </div>
    </section>
  );
}
