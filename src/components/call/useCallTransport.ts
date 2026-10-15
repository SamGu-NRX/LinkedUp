"use client";

/**
 * Runs the P2P transport for one call room while the screen wants it.
 *
 * The screen owns capture (VoiceCallScreen); this hook forwards the current
 * stream and mic/camera state to the transport and reports back the call's
 * phase, the remote participants and any transport error. It joins when
 * `active` turns true (capture is ready and the person has not left) and
 * leaves when it turns false, on unmount, and when the page is hidden for
 * good (pagehide), so a reload or a closed tab ends the session at once
 * instead of waiting out the heartbeat.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchRoomIceConfig, sessionIceConfiguration } from "@/lib/call/ice-config";
import type { CallPhase, CallTransport, TransportError, TransportEvents } from "@/lib/call/transport";
import { createP2PTransport } from "@/lib/call/transports/p2p/p2p-transport";
import { httpSignaling } from "@/lib/call/transports/p2p/http-signaling";

export interface CallConnection {
  roomId: string;
  /** This person's participant id: their users.id, as the signaling server reports it. */
  selfId: string;
  /** The signaling endpoint (the journey-proof path passes its own). */
  signalingEndpoint: string;
  iceEndpoint?: string;
}

export interface RemoteState {
  stream: MediaStream | null;
  /** Bumped when the remote stream's tracks change, so the tile re-attaches. */
  version: number;
  micOn: boolean;
  cameraOn: boolean;
}

export function useCallTransport({
  connection,
  active,
  stream,
  micOn,
  cameraOn,
}: {
  connection: CallConnection | null;
  active: boolean;
  stream: MediaStream | null;
  micOn: boolean;
  cameraOn: boolean;
}) {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [error, setError] = useState<TransportError | null>(null);
  const [remotes, setRemotes] = useState<Map<string, RemoteState>>(new Map());
  /** Bumped by retry() to rebuild the transport. */
  const [attempt, setAttempt] = useState(0);
  const transportRef = useRef<CallTransport | null>(null);
  const streamRef = useRef(stream);
  streamRef.current = stream;
  const stateRef = useRef({ micOn, cameraOn });
  stateRef.current = { micOn, cameraOn };

  const updateRemote = useCallback((id: string, patch: (r: RemoteState) => RemoteState) => {
    setRemotes((prev) => {
      const next = new Map(prev);
      next.set(id, patch(prev.get(id) ?? { stream: null, version: 0, micOn: true, cameraOn: true }));
      return next;
    });
  }, []);

  const roomId = connection?.roomId;
  const selfId = connection?.selfId;
  const endpoint = connection?.signalingEndpoint;
  const iceEndpoint = connection?.iceEndpoint ?? "/api/call/ice";
  const getRtcConfig = useMemo(() => sessionIceConfiguration(() => {
    if (!roomId || !selfId) throw new Error("No call participant selected.");
    return fetchRoomIceConfig(roomId, iceEndpoint);
  }), [roomId, selfId, iceEndpoint]);

  useEffect(() => {
    if (!active || !roomId || !selfId || !endpoint) return;
    let current = true;
    const transport = createP2PTransport({
      signaling: httpSignaling({ endpoint }),
      getRtcConfig,
      onConnectionPath: (path) => {
        // Candidate types only. Never publish addresses, usernames or credentials.
        if (current) document.querySelector("[data-call-root]")?.setAttribute("data-call-connection-path", path);
      },
    });
    transportRef.current = transport;
    setError(null);
    setRemotes(new Map());
    document.querySelector("[data-call-root]")?.setAttribute("data-call-connection-path", "unknown");
    const events: TransportEvents = {
      onPhase: (p) => current && setPhase(p),
      onRemoteJoined: ({ participantId }) => current && updateRemote(participantId, (r) => r),
      onRemoteLeft: ({ participantId }) =>
        current &&
        setRemotes((prev) => {
          if (!prev.has(participantId)) return prev;
          const next = new Map(prev);
          next.delete(participantId);
          return next;
        }),
      onRemoteStream: ({ participantId, stream: remote }) =>
        current && updateRemote(participantId, (r) => ({ ...r, stream: remote, version: r.version + 1 })),
      onRemoteState: ({ participantId, micOn: m, cameraOn: c }) =>
        current && updateRemote(participantId, (r) => ({ ...r, micOn: m, cameraOn: c })),
      onError: (e) => current && setError(e),
    };
    void transport.connect(
      {
        meetingId: roomId,
        selfId,
        // The endpoint authenticates with the Clerk session cookie.
        identityToken: async () => "",
        getLocalStream: () => streamRef.current,
      },
      events,
    );
    transport.publishLocalStream(streamRef.current);
    transport.publishLocalState(stateRef.current);
    const onPageHide = (e: PageTransitionEvent) => {
      if (!e.persisted) void transport.leave();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      current = false;
      window.removeEventListener("pagehide", onPageHide);
      void transport.leave();
      if (transportRef.current === transport) transportRef.current = null;
      setRemotes(new Map());
      setPhase("idle");
    };
  }, [active, roomId, selfId, endpoint, attempt, updateRemote, getRtcConfig]);

  // Forward capture changes (camera on/off, device switch) and mute state.
  useEffect(() => {
    transportRef.current?.publishLocalStream(stream);
  }, [stream]);
  useEffect(() => {
    transportRef.current?.publishLocalState({ micOn, cameraOn });
  }, [micOn, cameraOn]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { phase, error, remotes, retry };
}
