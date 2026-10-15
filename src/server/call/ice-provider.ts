/** Server-only provider logic. Never import this module from a client component. */
export interface IceCredentials {
  iceServers: { urls: string[]; username?: string; credential?: string }[];
  expiresAt: number;
}
export interface IceProvider {
  issue(participant: string): Promise<IceCredentials>;
}
export const ICE_TTL_SECONDS = 3600;
export interface TurnEnvironment {
  TURN_CLOUDFLARE_KEY_ID?: string;
  TURN_CLOUDFLARE_API_TOKEN?: string;
  TURN_SHARED_SECRET?: string;
  TURN_URLS?: string;
}

export async function turnRestCredential(secret: string, username: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(username));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

function parseServers(value: unknown): IceCredentials["iceServers"] {
  if (!Array.isArray(value) || !value.length) throw new Error("TURN provider returned no ICE servers.");
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new Error("TURN provider returned invalid ICE servers.");
    const row = entry as Record<string, unknown>;
    const urls = typeof row.urls === "string" ? [row.urls] : row.urls;
    if (!Array.isArray(urls) || !urls.length || !urls.every((url) => typeof url === "string" && /^(stun|stuns|turn|turns):[^\s]+$/.test(url))) throw new Error("TURN provider returned invalid ICE servers.");
    const relay = urls.some((url: string) => /^turns?:/.test(url));
    if (relay && (typeof row.username !== "string" || typeof row.credential !== "string")) throw new Error("TURN provider returned incomplete credentials.");
    return { urls: urls as string[], ...(relay ? { username: row.username as string, credential: row.credential as string } : {}) };
  });
}

export function iceProvider(env: TurnEnvironment, now = Date.now, request: typeof fetch = fetch): IceProvider {
  const cloudflare = Boolean(env.TURN_CLOUDFLARE_KEY_ID || env.TURN_CLOUDFLARE_API_TOKEN);
  if (cloudflare && (!env.TURN_CLOUDFLARE_KEY_ID || !env.TURN_CLOUDFLARE_API_TOKEN)) throw new Error("TURN_CLOUDFLARE_KEY_ID and TURN_CLOUDFLARE_API_TOKEN must both be set.");
  const staticTurn = Boolean(env.TURN_SHARED_SECRET || env.TURN_URLS);
  if (!cloudflare && staticTurn && (!env.TURN_SHARED_SECRET || !env.TURN_URLS)) throw new Error("TURN_SHARED_SECRET and TURN_URLS must both be set.");
  return {
    async issue(participant) {
      // One hour bounds leaked credential use; clients renew before restarting ICE.
      const expiresAt = (Math.floor(now() / 1000) + ICE_TTL_SECONDS) * 1000;
      if (cloudflare) {
        let response: Response;
        try {
          response = await request(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_CLOUDFLARE_KEY_ID!)}/credentials/generate-ice-servers`, {
            method: "POST", headers: { Authorization: `Bearer ${env.TURN_CLOUDFLARE_API_TOKEN!}`, "Content-Type": "application/json" },
            body: JSON.stringify({ ttl: ICE_TTL_SECONDS }), signal: AbortSignal.timeout(10_000),
          });
        } catch { throw new Error("The call connection service is unavailable. Try again."); }
        // Provider response bodies can contain credentials; never include them in errors.
        if (!response.ok) throw new Error("The call connection service refused credentials. Try again.");
        const body: unknown = await response.json().catch(() => null);
        return { iceServers: parseServers(body && typeof body === "object" ? (body as Record<string, unknown>).iceServers : null), expiresAt };
      }
      if (staticTurn) {
        const urls = env.TURN_URLS!.split(",").map((url) => url.trim());
        if (!urls.length || !urls.every((url) => /^turns?:[^\s]+$/.test(url))) throw new Error("TURN_URLS must contain comma-separated TURN URLs.");
        const username = `${expiresAt / 1000}:${participant}`;
        return { iceServers: [{ urls, username, credential: await turnRestCredential(env.TURN_SHARED_SECRET!, username) }], expiresAt };
      }
      return { iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }], expiresAt };
    },
  };
}
