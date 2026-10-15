import { z } from "zod";
export interface IceCredentials {
  iceServers: RTCIceServer[];
  expiresAt: number;
}

/** Each call-page session owns one cache; credentials never enter persistent storage. */
export function sessionIceConfiguration(load: () => Promise<IceCredentials>, now = Date.now) {
  let cached: IceCredentials | null = null;
  let pending: Promise<RTCConfiguration> | null = null;
  return async (): Promise<RTCConfiguration> => {
    if (cached && cached.expiresAt > now() + 30_000) return { iceServers: cached.iceServers };
    if (pending) return pending;
    pending = (async () => {
      const next = await load();
      if (!Number.isFinite(next.expiresAt) || next.expiresAt <= now() + 30_000 || !next.iceServers.length) throw new Error("The call connection credentials expired. Try again.");
      cached = next;
      return { iceServers: next.iceServers };
    })();
    try { return await pending; } finally { pending = null; }
  };
}

/** Only candidate types leave getStats; addresses and credentials stay private. */
export async function connectionPath(pc: RTCPeerConnection): Promise<"relay" | "direct" | "unknown"> {
  const stats = await pc.getStats();
  let pair: (RTCStats & { localCandidateId?: string; remoteCandidateId?: string }) | undefined;
  stats.forEach((row) => {
    if (row.type === "transport" && row.selectedCandidatePairId) pair = stats.get(row.selectedCandidatePairId);
  });
  if (!pair) stats.forEach((row) => { if (row.type === "candidate-pair" && row.state === "succeeded" && row.nominated) pair = row; });
  if (!pair) return "unknown";
  const selected = pair;
  const local = selected.localCandidateId ? stats.get(selected.localCandidateId) : undefined;
  const remote = selected.remoteCandidateId ? stats.get(selected.remoteCandidateId) : undefined;
  if (!local || !remote) return "unknown";
  return local.candidateType === "relay" || remote.candidateType === "relay" ? "relay" : "direct";
}

const iceResponse = z.object({
  iceServers: z.array(z.object({
    urls: z.union([z.string(), z.array(z.string()).min(1)]),
    username: z.string().optional(),
    credential: z.string().optional(),
  })).min(1),
  expiresAt: z.number().int().positive(),
});

export class IceAccessError extends Error {}

export async function fetchRoomIceConfig(roomId: string): Promise<IceCredentials> {
  const response = await fetch(`/api/call/ice?roomId=${encodeURIComponent(roomId)}`, {
    cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 403 || response.status === 401) throw new IceAccessError("You no longer have access to this call.");
  if (!response.ok) throw new Error("The call service could not prepare network access. Try again.");
  return iceResponse.parse(await response.json());
}
