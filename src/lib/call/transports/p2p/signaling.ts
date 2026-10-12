/**
 * The signaling adapter the P2P mesh talks through. The mesh owns negotiation
 * and reconnect policy; an adapter only moves messages for one connection
 * attempt. Ported from Connvo; LinkedUp's implementation is
 * http-signaling.ts, polling the Postgres-backed endpoint.
 */
import type { LocalCallState, RemoteParticipantState } from "../../transport";

/** What one peer sends another to negotiate a connection. */
export type P2PSignal =
  | { description: RTCSessionDescriptionInit }
  | { candidate: RTCIceCandidateInit };

/** Why a signaling connection ended. */
export type SignalingClose =
  /** The server refused this identity or meeting; retrying will not help. */
  | { kind: "rejected"; message: string }
  /** The connection dropped or never opened; the mesh may retry. */
  | { kind: "lost"; message: string }
  /**
   * The same identity joined again from somewhere else and took over.
   * Reconnecting would take it back, and the two would fight forever.
   */
  | { kind: "replaced"; message: string };

export interface SignalingHandlers {
  /** The server accepted us; `peers` are the participants already present. */
  onWelcome: (peers: string[]) => void;
  onPeerJoined: (participantId: string) => void;
  onPeerLeft: (participantId: string, reason: string) => void;
  onSignal: (from: string, signal: P2PSignal) => void;
  onRemoteState: (state: RemoteParticipantState) => void;
  /** Called once per connection, unless the mesh closed it itself. */
  onClosed: (reason: SignalingClose) => void;
}

export interface SignalingConnection {
  send: (to: string, signal: P2PSignal) => void;
  publishState: (state: LocalCallState) => void;
  /** Leaves the room on purpose; `onClosed` does not fire. */
  close: () => void;
}

export interface SignalingAdapter {
  /** Opens one connection attempt; the mesh calls it again to reconnect. */
  open: (
    session: { meetingId: string; identityToken: () => Promise<string> },
    handlers: SignalingHandlers,
  ) => SignalingConnection;
}
