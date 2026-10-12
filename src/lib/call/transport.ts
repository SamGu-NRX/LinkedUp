/**
 * The transport seam every Connvo call transport implements.
 *
 * Source of truth: docs/plan/CALL-PLAN.md decisions D4/D5 and the harness
 * DOM contract. Rules that hold for every implementation:
 *
 * - Local capture is owned by the UI's local-media hook, not the transport.
 *   A transport never stops a track it did not create, and `leave()` closes
 *   every connection it opened (D5).
 * - Local stream changes (initial capture, mute-release, device switch) are
 *   published via `publishLocalStream`; the transport forwards them to
 *   remote peers (replaceTrack or renegotiation, its choice).
 * - Remote mute/camera state shown by the DOM contract (`data-audio-muted`,
 *   `data-video-off`) arrives through `TransportEvents.onRemoteState`
 *   signaling; media analysis is a separate ground-truth check, not the
 *   source of UI state.
 */

export type CallPhase =
  | "idle"
  | "joining"
  | "connected"
  | "reconnecting"
  | "failed"
  | "left";

export interface LocalCallState {
  micOn: boolean;
  cameraOn: boolean;
}

export interface RemoteParticipantState {
  participantId: string;
  micOn: boolean;
  cameraOn: boolean;
}

export interface TransportContext {
  /** Meeting row id; the signaling path must authorize it. */
  meetingId: string;
  /** The local participant's stable id (the JWT `sub`). */
  selfId: string;
  /** Returns a fresh bearer token for the signaling/auth path. */
  identityToken: () => Promise<string>;
  /**
   * The local capture stream, owned by the UI's local-media hook (D5).
   * May be null while capture is being re-acquired.
   */
  getLocalStream: () => MediaStream | null;
  /** Optional RTCConfiguration override (the harness may force relay for H-15). */
  rtcConfig?: RTCConfiguration;
}

export type TransportErrorKind = "auth" | "network" | "media" | "unknown";

export interface TransportError {
  kind: TransportErrorKind;
  message: string;
  retryable: boolean;
}

export interface TransportEvents {
  onPhase: (phase: CallPhase) => void;
  onRemoteJoined: (p: { participantId: string }) => void;
  onRemoteLeft: (p: { participantId: string; reason: string }) => void;
  onRemoteStream: (p: { participantId: string; stream: MediaStream }) => void;
  onRemoteState: (p: RemoteParticipantState) => void;
  onError: (e: TransportError) => void;
}

export interface CallTransport {
  readonly name: string;
  connect(ctx: TransportContext, events: TransportEvents): Promise<void>;
  publishLocalStream(stream: MediaStream | null): void;
  publishLocalState(state: LocalCallState): void;
  /**
   * Leaves the call and closes every connection this transport opened.
   * Must not stop tracks it did not create (D5).
   */
  leave(): Promise<void>;
}
