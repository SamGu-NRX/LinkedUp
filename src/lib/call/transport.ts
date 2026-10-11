/**
 * The seam every call transport implements (docs/plan/CALL-PLAN.md, D5).
 *
 * Round 1 tries competing transports (P2P over Convex signaling, a self-hosted SFU) behind one UI and one harness,
 * so the UI and the two-peer harness depend only on this file. Local capture belongs to the caller: a transport
 * sends the tracks it is given and never stops them, and leave() closes every connection it opened.
 */

export type ParticipantId = string;

export type CallPhase = "idle" | "joining" | "connected" | "reconnecting" | "failed" | "left";

export type CallErrorCode =
  | "unauthorized" // the backend refused this user for this meeting
  | "meeting-not-active"
  | "signaling-unavailable"
  | "connection-failed" // could not establish or recover media after retries
  | "aborted";

export interface CallError {
  code: CallErrorCode;
  /** Human-readable detail for logs; the UI maps `code` to its own copy. */
  detail: string;
}

export type RemoteConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface RemoteParticipant {
  id: ParticipantId;
  displayName: string;
  /** Null until a track arrives, and again after the participant stops sending it. */
  audio: MediaStreamTrack | null;
  video: MediaStreamTrack | null;
  /** The sender's declared state, signalled explicitly rather than inferred from silence or black frames. */
  audioMuted: boolean;
  videoOff: boolean;
  connection: RemoteConnectionState;
}

export interface CallSnapshot {
  phase: CallPhase;
  /** Set when phase is "failed"; may also accompany "reconnecting". */
  error: CallError | null;
  /** Ordered by join time; never contains the local user, never contains duplicates. */
  participants: readonly RemoteParticipant[];
}

export interface JoinOptions {
  meetingId: string;
  /** Tracks to publish; either may be null (joined muted or with the camera off). */
  audio: MediaStreamTrack | null;
  video: MediaStreamTrack | null;
  /** Aborting it while joining rejects join() with code "aborted" and releases everything opened so far. */
  signal?: AbortSignal;
}

export interface CallTransport {
  /** Resolves once connected to the meeting (not once every peer is connected); rejects with a CallError. */
  join(options: JoinOptions): Promise<void>;
  /** Swap or remove the published track for one kind without leaving, e.g. a device switch or camera off. */
  replaceTrack(kind: "audio" | "video", track: MediaStreamTrack | null): Promise<void>;
  /** Tell the other side the declared mute or camera state. */
  setPublishedState(state: { audioMuted: boolean; videoOff: boolean }): Promise<void>;
  /** Idempotent. Closes all connections and server sessions this transport opened; does not stop local tracks. */
  leave(): Promise<void>;
  getSnapshot(): CallSnapshot;
  /** Called after every snapshot change. Returns an unsubscribe function. */
  subscribe(listener: (snapshot: CallSnapshot) => void): () => void;
}
