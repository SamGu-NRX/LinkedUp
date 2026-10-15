/**
 * P2P mesh transport: one RTCPeerConnection per remote participant, for calls
 * of two to four people. It implements src/lib/call/transport.ts and follows
 * D5: the caller owns capture, this transport never stops a track, and
 * leave() closes every connection it opened.
 *
 * Negotiation is the W3C "perfect negotiation" pattern: either side may offer
 * at any time; on a collision the polite side (the lower participant id)
 * rolls back and answers, the impolite side ignores the colliding offer.
 * That covers simultaneous joins, renegotiation after a device change and
 * ICE restarts started by both ends at once.
 *
 * Recovery:
 * - The impolite side restarts ICE (the polite side follows through the
 *   offer): at once on "failed", and after DISCONNECTED_GRACE_MS of
 *   "disconnected", since that often heals by itself first.
 * - A connection that is not up within NOT_CONNECTED_RESTART_MS restarts
 *   ICE, and again each period after. A connection built while the network
 *   was down can have no TURN allocation and no candidates at all, and
 *   Chrome takes far longer than that to declare it failed by itself.
 * - A lost signaling connection reconnects with backoff. Peers tear down
 *   their connection to us when the server reports us gone, so on the next
 *   welcome every peer connection is rebuilt from scratch.
 * - Joining or reconnecting that does not reach "connected" within
 *   GIVE_UP_MS ends in "failed" with a retryable error, so the UI never
 *   shows a spinner forever.
 */
import { connectionPath, IceAccessError } from "../../ice-config";
import type {
  CallPhase,
  CallTransport,
  LocalCallState,
  TransportContext,
  TransportErrorKind,
  TransportEvents,
} from "../../transport";
import type {
  P2PSignal,
  SignalingAdapter,
  SignalingConnection,
} from "./signaling";

const DISCONNECTED_GRACE_MS = 3000;
const NOT_CONNECTED_RESTART_MS = 6000;
/** How long the polite side waits for the other side's offer before offering itself. */
const POLITE_OFFER_DELAY_MS = 1500;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 5000;
const GIVE_UP_MS = { joining: 30_000, reconnecting: 45_000 } as const;

/**
 * Event trace for diagnosing failed joins: the harness reads the tail of
 * window.__callTraceLog when a join never connects. Off unless the build
 * sets NEXT_PUBLIC_LINKEDUP_CALL_TRACE=1 (the eval stack does).
 */
const TRACE = process.env.NEXT_PUBLIC_LINKEDUP_CALL_TRACE === "1";
function trace(message: string): void {
  if (!TRACE || typeof window === "undefined") return;
  const w = window as unknown as { __callTraceLog?: string[] };
  const log = (w.__callTraceLog ??= []);
  log.push(`${Math.round(performance.now())} ${message}`);
  if (log.length > 300) log.shift();
}

type Kind = "audio" | "video";
const KINDS: Kind[] = ["audio", "video"];

interface Peer {
  id: string;
  pc: RTCPeerConnection;
  /** The lower id yields on an offer collision. */
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingRemoteAnswer: boolean;
  /** Candidates that arrived before any remote description. */
  pendingCandidates: RTCIceCandidateInit[];
  senders: Partial<Record<Kind, RTCRtpSender>>;
  remoteStream: MediaStream;
  streamAnnounced: boolean;
  everConnected: boolean;
  mediaReceived: boolean;
  mediaCleanup: Array<() => void>;
  /** Incoming signals for this peer are applied one at a time, in order. */
  chain: Promise<void>;
  disconnectedTimer: ReturnType<typeof setTimeout> | null;
  watchdog: ReturnType<typeof setInterval> | null;
  politeOfferTimer: ReturnType<typeof setTimeout> | null;
  /** When the last offer from the other side arrived (ms since epoch). */
  lastRemoteOfferAt: number;
  initialIceDeadline: ReturnType<typeof setTimeout> | null;
}

export interface P2PTransportOptions {
  signaling: SignalingAdapter;
  getRtcConfig?: () => Promise<RTCConfiguration>;
  onConnectionPath?: (path: "relay" | "direct" | "unknown") => void;
}

export function createP2PTransport({
  signaling,
  getRtcConfig,
  onConnectionPath,
}: P2PTransportOptions): CallTransport {
  let ctx: TransportContext | null = null;
  let events: TransportEvents | null = null;
  let conn: SignalingConnection | null = null;
  /** Bumped per connection attempt so late callbacks from an old one are ignored. */
  let generation = 0;
  let signalingUp = false;
  let phase: CallPhase = "idle";
  let leaving = false;
  let localStream: MediaStream | null = null;
  let localState: LocalCallState = { micOn: true, cameraOn: true };
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let giveUpTimer: ReturnType<typeof setTimeout> | null = null;
  const peers = new Map<string, Peer>();

  function setPhase(next: CallPhase): void {
    if (phase === next) return;
    phase = next;
    events?.onPhase(next);
    if (giveUpTimer) clearTimeout(giveUpTimer);
    giveUpTimer = null;
    if (next === "joining" || next === "reconnecting") {
      giveUpTimer = setTimeout(() => {
        if (phase === next) {
          fail(
            "network",
            "Can't reach the other person. A network may be blocking calls. Try again or switch networks.",
            true,
          );
        }
      }, GIVE_UP_MS[next]);
    }
  }

  function fail(
    kind: TransportErrorKind,
    message: string,
    retryable: boolean,
  ): void {
    if (phase === "left" || phase === "failed") return;
    events?.onError({ kind, message, retryable });
    teardownAll(false);
    closeSignaling();
    setPhase("failed");
  }

  /** SDP can create a muted track before any RTP arrives. Wait for media. */
  function refreshPhase(): void {
    if (leaving || phase === "left" || phase === "failed" || phase === "idle")
      return;
    const all = [...peers.values()];
    const ready = signalingUp && all.length > 0 && all.every(
      (peer) => peer.pc.connectionState === "connected" && peer.mediaReceived,
    );
    if (ready) setPhase("connected");
    else setPhase(phase === "joining" ? "joining" : "reconnecting");
  }

  function terminal(): boolean {
    return phase === "failed" || phase === "left";
  }

  function failIceCredentials(error: unknown): void {
    if (error instanceof IceAccessError) fail("auth", error.message, false);
    else fail("network", "The call service could not prepare network access. Try again.", true);
  }

  function currentStream(): MediaStream | null {
    return localStream ?? ctx?.getLocalStream() ?? null;
  }

  function send(to: string, signal: P2PSignal): void {
    conn?.send(to, signal);
  }

  function enqueue(peer: Peer, step: () => Promise<void>): void {
    peer.chain = peer.chain.then(step).catch((err: unknown) => {
      // A stale description or candidate; the next negotiation recovers.
      trace(
        `${peer.id} signal step failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  function createPeer(id: string): Peer {
    if (!ctx) throw new Error("p2p transport: createPeer before connect");
    const pc = new RTCPeerConnection(ctx.rtcConfig);
    const peer: Peer = {
      id,
      pc,
      polite: ctx.selfId < id,
      makingOffer: false,
      ignoreOffer: false,
      settingRemoteAnswer: false,
      pendingCandidates: [],
      senders: {},
      remoteStream: new MediaStream(),
      streamAnnounced: false,
      everConnected: false,
      mediaReceived: false,
      mediaCleanup: [],
      chain: Promise.resolve(),
      disconnectedTimer: null,
      watchdog: null,
      politeOfferTimer: null,
      lastRemoteOfferAt: 0,
      initialIceDeadline: null,
    };
    peers.set(id, peer);
    // Signaling alone cannot prove a newly arrived peer is reachable.
    peer.initialIceDeadline = setTimeout(() => {
      if (peers.get(id) === peer && !peer.everConnected) fail("network", "Can't reach the other person. A network may be blocking calls. Try again or switch networks.", true);
    }, GIVE_UP_MS.joining);

    // addTrack, not addTransceiver: a remote offer can reuse an addTrack
    // transceiver, so a glare rollback does not leave orphaned m-lines.
    const stream = currentStream();
    for (const kind of KINDS) {
      const track = stream?.getTracks().find((t) => t.kind === kind);
      if (track && stream) peer.senders[kind] = pc.addTrack(track, stream);
    }

    pc.onicecandidate = ({ candidate }) => {
      trace(
        `${id} local candidate ${candidate ? candidate.type : "end"}${conn ? "" : " (no signaling)"}`,
      );
      if (candidate) send(id, { candidate: candidate.toJSON() });
    };
    pc.onicegatheringstatechange = () =>
      trace(`${id} gathering ${pc.iceGatheringState}`);
    pc.ontrack = ({ track }) => {
      for (const old of peer.remoteStream.getTracks()) {
        if (old.kind === track.kind && old.id !== track.id)
          peer.remoteStream.removeTrack(old);
      }
      if (!peer.remoteStream.getTrackById(track.id))
        peer.remoteStream.addTrack(track);
      const received = () => {
        if (peers.get(id) !== peer || peer.remoteStream.getTrackById(track.id) !== track || track.muted || track.readyState !== "live") return;
        // Mute controls stop tracks, so retain the first received-media proof
        // for this connection even when both participants turn their media off.
        peer.mediaReceived = true;
        refreshPhase();
      };
      track.addEventListener("unmute", received);
      peer.mediaCleanup.push(() => track.removeEventListener("unmute", received));
      received();
      if (!peer.streamAnnounced) {
        peer.streamAnnounced = true;
        events?.onRemoteStream({
          participantId: id,
          stream: peer.remoteStream,
        });
      }
    };
    const makeOffer = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        trace(`${id} sent ${pc.localDescription?.type}`);
        if (pc.localDescription)
          send(id, { description: pc.localDescription.toJSON() });
      } catch (err) {
        // The pc closed or a newer negotiation replaced this one.
        trace(
          `${id} offer failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        peer.makingOffer = false;
      }
    };
    // Glare avoidance. When both sides offered at once, the polite side
    // rolled back its offer, and after that rollback Chromium's ICE agent on
    // that connection never produced a candidate, so the call never
    // connected (traced on the real call page; a fresh connection on the
    // same page still gathered). Perfect negotiation still handles any
    // collision, but the polite side no longer starts one:
    // - when it needs to negotiate (first offer, ICE restart, a new track)
    //   it waits POLITE_OFFER_DELAY_MS, and offers only if the other side
    //   sent no offer meanwhile. If negotiation is still needed after
    //   answering that offer, Chromium fires negotiationneeded again.
    // - only the impolite side starts ICE restarts on its own timers.
    pc.onnegotiationneeded = () => {
      trace(`${id} negotiationneeded (${pc.signalingState})`);
      if (!peer.polite) {
        void makeOffer();
        return;
      }
      if (peer.politeOfferTimer) return;
      const askedAt = Date.now();
      peer.politeOfferTimer = setTimeout(() => {
        peer.politeOfferTimer = null;
        if (peer.lastRemoteOfferAt >= askedAt) return;
        if (pc.signalingState === "stable" && pc.connectionState !== "closed") {
          trace(`${id} no offer arrived; offering`);
          void makeOffer();
        }
      }, POLITE_OFFER_DELAY_MS);
    };
    let restarting = false;
    const restart = () => {
      if (peer.polite || restarting || leaving || terminal()) return;
      restarting = true;
      void (async () => {
        try {
          const config = await getRtcConfig?.();
          if (peers.get(id) !== peer || leaving || phase === "failed") return;
          if (config) {
            pc.setConfiguration({ ...pc.getConfiguration(), ...config });
            if (ctx) ctx.rtcConfig = config;
          }
          pc.restartIce();
        } catch (error) {
          if (peers.get(id) === peer && !leaving) {
            failIceCredentials(error);
          }
        } finally { restarting = false; }
      })();
    };
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "failed") {
        restart();
      } else if (state === "disconnected" && !peer.disconnectedTimer) {
        peer.disconnectedTimer = setTimeout(() => {
          peer.disconnectedTimer = null;
          if (pc.iceConnectionState === "disconnected") restart();
        }, DISCONNECTED_GRACE_MS);
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        peer.everConnected = true;
        if (peer.initialIceDeadline) clearTimeout(peer.initialIceDeadline);
        peer.initialIceDeadline = null;
        void connectionPath(pc).then((path) => {
          if (peers.get(id) === peer && !leaving) onConnectionPath?.(path);
        }).catch(() => {});
      }
      refreshPhase();
    };
    peer.watchdog = setInterval(() => {
      if (pc.connectionState !== "connected" && pc.connectionState !== "closed")
        restart();
    }, NOT_CONNECTED_RESTART_MS);
    return peer;
  }

  async function applySignal(peer: Peer, signal: P2PSignal): Promise<void> {
    const { pc } = peer;
    if ("description" in signal) {
      const description = signal.description;
      if (description.type === "offer" && getRtcConfig) {
        let config: RTCConfiguration;
        try {
          config = await getRtcConfig();
        } catch (error) {
          if (peers.get(peer.id) === peer && !leaving) {
            failIceCredentials(error);
          }
          return;
        }
        if (peers.get(peer.id) !== peer || leaving || phase === "failed") return;
        pc.setConfiguration({ ...pc.getConfiguration(), ...config });
        if (ctx) ctx.rtcConfig = config;
      }
      if (description.type === "offer") peer.lastRemoteOfferAt = Date.now();
      const readyForOffer =
        !peer.makingOffer &&
        (pc.signalingState === "stable" || peer.settingRemoteAnswer);
      const collision = description.type === "offer" && !readyForOffer;
      peer.ignoreOffer = !peer.polite && collision;
      trace(
        `${peer.id} got ${description.type} in ${pc.signalingState}${collision ? " (collision)" : ""}${peer.ignoreOffer ? " ignored" : ""}`,
      );
      if (peer.ignoreOffer) return;
      peer.settingRemoteAnswer = description.type === "answer";
      await pc.setRemoteDescription(description);
      peer.settingRemoteAnswer = false;
      for (const candidate of peer.pendingCandidates.splice(0)) {
        await pc.addIceCandidate(candidate).catch(() => {});
      }
      trace(`${peer.id} applied ${description.type}; now ${pc.signalingState}`);
      if (description.type === "offer") {
        await pc.setLocalDescription();
        if (pc.localDescription)
          send(peer.id, { description: pc.localDescription.toJSON() });
      }
      return;
    }
    if (!pc.remoteDescription) {
      trace(`${peer.id} remote candidate queued`);
      peer.pendingCandidates.push(signal.candidate);
      return;
    }
    try {
      await pc.addIceCandidate(signal.candidate);
      trace(`${peer.id} remote candidate added`);
    } catch (err) {
      // Candidates for an offer we ignored are expected to fail.
      if (!peer.ignoreOffer) throw err;
    }
  }

  /** Closes one peer connection. Never stops local tracks (D5). */
  function closePeer(peer: Peer): void {
    if (peer.initialIceDeadline) clearTimeout(peer.initialIceDeadline);
    if (peer.disconnectedTimer) clearTimeout(peer.disconnectedTimer);
    if (peer.watchdog) clearInterval(peer.watchdog);
    if (peer.politeOfferTimer) clearTimeout(peer.politeOfferTimer);
    const { pc } = peer;
    for (const cleanup of peer.mediaCleanup) cleanup();
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onnegotiationneeded = null;
    pc.oniceconnectionstatechange = null;
    pc.onconnectionstatechange = null;
    pc.close();
    peers.delete(peer.id);
  }

  function teardownAll(announce: boolean): void {
    for (const peer of [...peers.values()]) {
      closePeer(peer);
      if (announce)
        events?.onRemoteLeft({ participantId: peer.id, reason: "left" });
    }
  }

  /** A fresh connection to `id`; the tile stays if one already existed. */
  function rebuildPeer(id: string): void {
    const existing = peers.get(id);
    trace(
      `${id} ${existing ? "rebuild" : "build"} peer (local tracks: ${currentStream()?.getTracks().length ?? 0})`,
    );
    if (existing) closePeer(existing);
    else events?.onRemoteJoined({ participantId: id });
    createPeer(id);
  }

  function closeSignaling(): void {
    generation++;
    conn?.close();
    conn = null;
    signalingUp = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function openSignaling(): void {
    if (!ctx) return;
    const mine = ++generation;
    const live = () => mine === generation && !leaving;
    conn = signaling.open(
      { meetingId: ctx.meetingId, identityToken: ctx.identityToken },
      {
        onWelcome: (present) => {
          trace(`welcome [${present.join(",")}]${live() ? "" : " (stale)"}`);
          if (!live()) return;
          signalingUp = true;
          reconnectAttempt = 0;
          for (const id of [...peers.keys()]) {
            if (!present.includes(id)) {
              const gone = peers.get(id);
              if (gone) closePeer(gone);
              events?.onRemoteLeft({ participantId: id, reason: "left" });
            }
          }
          for (const id of present) rebuildPeer(id);
          conn?.publishState(localState);
          refreshPhase();
        },
        onPeerJoined: (id) => {
          trace(`peer-joined ${id}${live() ? "" : " (stale)"}`);
          if (!live()) return;
          rebuildPeer(id);
          // The newcomer has never seen our mute/camera state.
          conn?.publishState(localState);
          refreshPhase();
        },
        onPeerLeft: (id) => {
          trace(`peer-left ${id}${live() ? "" : " (stale)"}`);
          if (!live()) return;
          const peer = peers.get(id);
          if (peer) closePeer(peer);
          events?.onRemoteLeft({ participantId: id, reason: "left" });
          refreshPhase();
        },
        onSignal: (from, signal) => {
          if (!live()) return;
          let peer = peers.get(from);
          if (!peer) {
            events?.onRemoteJoined({ participantId: from });
            peer = createPeer(from);
          }
          if ("description" in signal && signal.description.type === "offer")
            peer.lastRemoteOfferAt = Date.now();
          const target = peer;
          enqueue(target, () => applySignal(target, signal));
        },
        onRemoteState: (state) => {
          if (live()) events?.onRemoteState(state);
        },
        onClosed: (reason) => {
          trace(
            `signaling closed: ${reason.kind} ${reason.message}${live() ? "" : " (stale)"}`,
          );
          if (!live()) return;
          conn = null;
          signalingUp = false;
          if (reason.kind === "rejected") {
            fail("auth", reason.message, false);
            return;
          }
          if (reason.kind === "replaced") {
            // Retrying is the user's call: it would take the call back from
            // the other window.
            fail("network", reason.message, true);
            return;
          }
          refreshPhase();
          const delay = Math.min(
            RECONNECT_MAX_MS,
            RECONNECT_BASE_MS * 2 ** reconnectAttempt,
          );
          reconnectAttempt++;
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (!leaving && phase !== "failed" && phase !== "left")
              openSignaling();
          }, delay);
        },
      },
    );
  }

  return {
    name: "p2p",

    async connect(context, transportEvents): Promise<void> {
      trace(`connect as ${context.selfId}`);
      teardownAll(false);
      closeSignaling();
      const mine = generation;
      events = transportEvents;
      leaving = false;
      phase = "idle";
      setPhase("joining");
      let rtcConfig: RTCConfiguration | undefined;
      try {
        rtcConfig = getRtcConfig ? await getRtcConfig() : context.rtcConfig;
      } catch (error) {
        if (mine === generation && !leaving) {
          failIceCredentials(error);
        }
        return;
      }
      if (mine !== generation || leaving) return;
      ctx = { ...context, rtcConfig };
      reconnectAttempt = 0;
      openSignaling();
    },

    publishLocalStream(stream: MediaStream | null): void {
      localStream = stream;
      for (const peer of peers.values()) {
        for (const kind of KINDS) {
          const track =
            stream?.getTracks().find((t) => t.kind === kind) ?? null;
          const sender = peer.senders[kind];
          if (sender) {
            if (sender.track !== track)
              void sender.replaceTrack(track).catch(() => {});
          } else if (track && stream) {
            peer.senders[kind] = peer.pc.addTrack(track, stream);
          }
        }
      }
    },

    publishLocalState(state: LocalCallState): void {
      localState = state;
      conn?.publishState(state);
    },

    async leave(): Promise<void> {
      leaving = true;
      if (giveUpTimer) clearTimeout(giveUpTimer);
      giveUpTimer = null;
      closeSignaling();
      teardownAll(false);
      localStream = null;
      setPhase("left");
    },
  };
}
