/**
 * A small TURN relay (RFC 5766 over UDP, IPv4, loopback only) so the H-07 and
 * H-15 fault path has no system dependency. It replaces a coturn binary: the
 * harness forces every peer connection onto `iceTransportPolicy: "relay"`,
 * each participant's shaper forwards to this relay, and the relay moves media
 * between allocations.
 *
 * Scope is what Chromium's TURN client uses: Binding, Allocate, Refresh,
 * CreatePermission, ChannelBind, Send/Data indications and ChannelData, with
 * the long-term credential handshake (RFC 5389 section 10.2). Chromium drops
 * any TURN success response that lacks a valid MESSAGE-INTEGRITY, so a relay
 * that skipped the handshake allocated but never produced a relay candidate.
 * A request without MESSAGE-INTEGRITY gets 401 with REALM and NONCE; every
 * success response is signed with key = MD5(username:realm:password). The
 * Fixed-password mode accepts every
 * permission: it binds to 127.0.0.1 and lives for one eval run.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import dgram from "node:dgram";

const MAGIC = 0x2112a442;
const METHOD = { binding: 0x001, allocate: 0x003, refresh: 0x004, send: 0x006, data: 0x007, createPermission: 0x008, channelBind: 0x009 };
const ATTR = {
  channelNumber: 0x000c,
  lifetime: 0x000d,
  xorPeerAddress: 0x0012,
  data: 0x0013,
  xorRelayedAddress: 0x0016,
  errorCode: 0x0009,
  xorMappedAddress: 0x0020,
  username: 0x0006,
  messageIntegrity: 0x0008,
  realm: 0x0014,
  nonce: 0x0015,
};
const CLASS = { request: 0b00, indication: 0b01, success: 0b10, error: 0b11 };
const DEFAULT_LIFETIME_S = 600;

/** @param {number} type */
function splitType(type) {
  const method = (type & 0x000f) | ((type & 0x00e0) >> 1) | ((type & 0x3e00) >> 2);
  const cls = ((type & 0x0010) >> 4) | ((type & 0x0100) >> 7);
  return { method, cls };
}

/** @param {number} method @param {number} cls */
function joinType(method, cls) {
  return (method & 0x000f) | ((method & 0x0070) << 1) | ((method & 0x0f80) << 2) | ((cls & 1) << 4) | ((cls & 2) << 7);
}

/**
 * Parse a STUN message. Returns null for anything that is not one.
 * @param {Buffer} msg
 */
export function parseStun(msg) {
  if (msg.length < 20 || (msg[0] & 0xc0) !== 0 || msg.readUInt32BE(4) !== MAGIC) return null;
  const length = msg.readUInt16BE(2);
  if (20 + length > msg.length) return null;
  const { method, cls } = splitType(msg.readUInt16BE(0));
  const txid = msg.subarray(8, 20);
  /** @type {Map<number, Buffer>} */
  const attrs = new Map();
  let off = 20;
  while (off + 4 <= 20 + length) {
    const t = msg.readUInt16BE(off);
    const l = msg.readUInt16BE(off + 2);
    if (!attrs.has(t)) attrs.set(t, msg.subarray(off + 4, off + 4 + l));
    off += 4 + l + ((4 - (l % 4)) % 4);
  }
  return { method, cls, txid, attrs };
}

/** @param {Buffer} value */
export function decodeXorAddress(value) {
  const port = value.readUInt16BE(2) ^ (MAGIC >>> 16);
  const raw = value.readUInt32BE(4) ^ MAGIC;
  const address = [raw >>> 24, (raw >>> 16) & 255, (raw >>> 8) & 255, raw & 255].join(".");
  return { address, port };
}

/** @param {{ address: string, port: number }} addr */
export function encodeXorAddress({ address, port }) {
  const out = Buffer.alloc(8);
  out[1] = 0x01;
  out.writeUInt16BE(port ^ (MAGIC >>> 16), 2);
  const raw = address.split(".").reduce((n, octet) => ((n << 8) | Number(octet)) >>> 0, 0);
  out.writeUInt32BE((raw ^ MAGIC) >>> 0, 4);
  return out;
}

/**
 * @param {number} method @param {number} cls @param {Buffer} txid
 * @param {Array<[number, Buffer]>} attrs
 * @param {Buffer | null} [integrityKey] when set, appends MESSAGE-INTEGRITY
 */
export function buildStun(method, cls, txid, attrs, integrityKey = null) {
  const parts = [];
  for (const [type, value] of attrs) {
    const head = Buffer.alloc(4);
    head.writeUInt16BE(type, 0);
    head.writeUInt16BE(value.length, 2);
    parts.push(head, value, Buffer.alloc((4 - (value.length % 4)) % 4));
  }
  const body = Buffer.concat(parts);
  const header = Buffer.alloc(20);
  header.writeUInt16BE(joinType(method, cls), 0);
  header.writeUInt16BE(body.length + (integrityKey ? 24 : 0), 2);
  header.writeUInt32BE(MAGIC, 4);
  txid.copy(header, 8);
  if (!integrityKey) return Buffer.concat([header, body]);
  // The HMAC covers the header (whose length already counts this attribute)
  // and every attribute before it.
  const mac = createHmac("sha1", integrityKey).update(Buffer.concat([header, body])).digest();
  const head = Buffer.alloc(4);
  head.writeUInt16BE(ATTR.messageIntegrity, 0);
  head.writeUInt16BE(20, 2);
  return Buffer.concat([header, body, head, mac]);
}

/** @param {string} username @param {string} realm @param {string} password */
export function longTermKey(username, realm, password) {
  return createHash("md5").update(`${username}:${realm}:${password}`).digest();
}

/** @param {number} seconds */
function u32(seconds) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(seconds, 0);
  return b;
}

/** @param {number} code @param {string} reason */
function errorCode(code, reason) {
  const b = Buffer.alloc(4);
  b[2] = Math.floor(code / 100);
  b[3] = code % 100;
  return Buffer.concat([b, Buffer.from(reason)]);
}

/**
 * Start the relay. Resolves once the listening socket is bound.
 * Shared-secret mode verifies RFC TURN REST expiry and request integrity.
 * @param {{ port?: number, host?: string, realm?: string, password?: string, sharedSecret?: string | null }} [opts] port 0 picks a free port
 */
export async function startTurnRelay({ port = 0, host = "127.0.0.1", realm = "connvo-eval", password = "eval-pass", sharedSecret = null } = {}) {
  const nonce = Buffer.from(`connvo-${Date.now().toString(36)}`);
  const server = dgram.createSocket("udp4");
  /**
   * One allocation per client 5-tuple.
   * @type {Map<string, { client: { address: string, port: number }, relay: import('node:dgram').Socket, relayed: { address: string, port: number }, expires: number, channels: Map<number, string>, byPeer: Map<string, number> }>}
   */
  const allocations = new Map();
  const counters = { allocations: 0, relayedToPeer: 0, relayedToClient: 0 };

  /** @param {{ address: string, port: number }} a */
  const key = (a) => `${a.address}:${a.port}`;

  /** @param {string} k */
  function release(k) {
    const alloc = allocations.get(k);
    if (!alloc) return;
    allocations.delete(k);
    try {
      alloc.relay.close();
    } catch {
      /* already closed */
    }
  }

  /** @param {Buffer} msg @param {{ address: string, port: number }} client */
  const reply = (msg, client) => server.send(msg, client.port, client.address);

  /**
   * @param {{ address: string, port: number }} client
   * @returns {Promise<{ address: string, port: number }>}
   */
  function allocate(client) {
    const k = key(client);
    const existing = allocations.get(k);
    if (existing) return Promise.resolve(existing.relayed);
    return new Promise((resolve, reject) => {
      const relay = dgram.createSocket("udp4");
      relay.once("error", reject);
      relay.bind(0, host, () => {
        relay.on("error", () => {});
        const relayed = { address: host, port: relay.address().port };
        const alloc = { client, relay, relayed, expires: Date.now() + DEFAULT_LIFETIME_S * 1000, channels: new Map(), byPeer: new Map() };
        allocations.set(k, alloc);
        counters.allocations++;
        // Peer -> client: ChannelData when the peer has a channel, else a
        // Data indication carrying the peer's address.
        relay.on("message", (data, rinfo) => {
          const channel = alloc.byPeer.get(key(rinfo));
          counters.relayedToClient++;
          if (channel !== undefined) {
            const head = Buffer.alloc(4);
            head.writeUInt16BE(channel, 0);
            head.writeUInt16BE(data.length, 2);
            reply(Buffer.concat([head, data]), alloc.client);
          } else {
            const txid = Buffer.alloc(12);
            for (let i = 0; i < 12; i++) txid[i] = Math.floor(Math.random() * 256);
            reply(
              buildStun(METHOD.data, CLASS.indication, txid, [
                [ATTR.xorPeerAddress, encodeXorAddress(rinfo)],
                [ATTR.data, data],
              ]),
              alloc.client,
            );
          }
        });
        resolve(relayed);
      });
    });
  }

  server.on("message", async (msg, rinfo) => {
    const client = { address: rinfo.address, port: rinfo.port };
    // ChannelData: first two bits 01.
    if (msg.length >= 4 && (msg[0] & 0xc0) === 0x40) {
      const alloc = allocations.get(key(client));
      const peer = alloc?.channels.get(msg.readUInt16BE(0));
      if (!alloc || !peer) return;
      const len = msg.readUInt16BE(2);
      const [address, p] = peer.split(":");
      alloc.relay.send(msg.subarray(4, 4 + len), Number(p), address);
      counters.relayedToPeer++;
      return;
    }
    const stun = parseStun(msg);
    if (!stun) return;
    const { method, cls, txid, attrs } = stun;
    const k = key(client);
    if (cls === CLASS.indication && method === METHOD.send) {
      const alloc = allocations.get(k);
      const peerAttr = attrs.get(ATTR.xorPeerAddress);
      const data = attrs.get(ATTR.data);
      if (!alloc || !peerAttr || !data) return;
      const peer = decodeXorAddress(peerAttr);
      alloc.relay.send(data, peer.port, peer.address);
      counters.relayedToPeer++;
      return;
    }
    if (cls !== CLASS.request) return;
    // Long-term credentials: challenge, then sign every success with the
    // key derived from the username the client sent.
    const username = attrs.get(ATTR.username)?.toString("utf8");
    if (method !== METHOD.binding && (!attrs.has(ATTR.messageIntegrity) || !username)) {
      reply(
        buildStun(method, CLASS.error, txid, [
          [ATTR.errorCode, errorCode(401, "Unauthorized")],
          [ATTR.realm, Buffer.from(realm)],
          [ATTR.nonce, nonce],
        ]),
        client,
      );
      return;
    }
    const restPassword = sharedSecret && username ? createHmac("sha1", sharedSecret).update(username).digest("base64") : password;
    const integrityKey = username ? longTermKey(username, realm, restPassword) : null;
    if (method !== METHOD.binding && sharedSecret) {
      const expires = Number(username?.split(":")[0]);
      let offset = 20;
      while (offset + 4 <= msg.length && msg.readUInt16BE(offset) !== ATTR.messageIntegrity) {
        const length = msg.readUInt16BE(offset + 2);
        offset += 4 + length + ((4 - length % 4) % 4);
      }
      const received = attrs.get(ATTR.messageIntegrity);
      const signed = Buffer.from(msg.subarray(0, offset));
      if (signed.length >= 20) signed.writeUInt16BE(offset + 24 - 20, 2);
      const expected = integrityKey ? createHmac("sha1", integrityKey).update(signed).digest() : null;
      if (!Number.isFinite(expires) || expires <= Date.now() / 1000 || !received || !expected || received.length !== expected.length || !timingSafeEqual(received, expected)) {
        reply(buildStun(method, CLASS.error, txid, [[ATTR.errorCode, errorCode(401, "Unauthorized")], [ATTR.realm, Buffer.from(realm)], [ATTR.nonce, nonce]]), client);
        return;
      }
    }
    /** @param {Array<[number, Buffer]>} out */
    const ok = (out) => reply(buildStun(method, CLASS.success, txid, out, integrityKey), client);
    try {
      switch (method) {
        case METHOD.binding:
          ok([[ATTR.xorMappedAddress, encodeXorAddress(client)]]);
          return;
        case METHOD.allocate: {
          const relayed = await allocate(client);
          ok([
            [ATTR.xorRelayedAddress, encodeXorAddress(relayed)],
            [ATTR.xorMappedAddress, encodeXorAddress(client)],
            [ATTR.lifetime, u32(DEFAULT_LIFETIME_S)],
          ]);
          return;
        }
        case METHOD.refresh: {
          const alloc = allocations.get(k);
          if (!alloc) {
            reply(buildStun(method, CLASS.error, txid, [[ATTR.errorCode, errorCode(437, "Allocation Mismatch")]]), client);
            return;
          }
          const lifetime = attrs.get(ATTR.lifetime)?.readUInt32BE(0) ?? DEFAULT_LIFETIME_S;
          if (lifetime === 0) release(k);
          else alloc.expires = Date.now() + Math.min(lifetime, 3600) * 1000;
          ok([[ATTR.lifetime, u32(lifetime === 0 ? 0 : Math.min(lifetime, 3600))]]);
          return;
        }
        case METHOD.createPermission:
          ok([]);
          return;
        case METHOD.channelBind: {
          const alloc = allocations.get(k);
          const ch = attrs.get(ATTR.channelNumber);
          const peerAttr = attrs.get(ATTR.xorPeerAddress);
          if (!alloc || !ch || !peerAttr) {
            reply(buildStun(method, CLASS.error, txid, [[ATTR.errorCode, errorCode(400, "Bad Request")]]), client);
            return;
          }
          const channel = ch.readUInt16BE(0);
          const peer = key(decodeXorAddress(peerAttr));
          alloc.channels.set(channel, peer);
          alloc.byPeer.set(peer, channel);
          ok([]);
          return;
        }
        default:
          reply(buildStun(method, CLASS.error, txid, [[ATTR.errorCode, errorCode(400, "Bad Request")]]), client);
      }
    } catch {
      reply(buildStun(method, CLASS.error, txid, [[ATTR.errorCode, errorCode(508, "Insufficient Capacity")]]), client);
    }
  });

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, alloc] of allocations) if (alloc.expires < now) release(k);
  }, 5000);
  sweep.unref();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.bind(port, host, () => {
      server.on("error", () => {});
      resolve(undefined);
    });
  });

  return {
    port: server.address().port,
    host,
    stats: () => ({ ...counters, live: allocations.size }),
    stop() {
      clearInterval(sweep);
      for (const k of [...allocations.keys()]) release(k);
      try {
        server.close();
      } catch {
        /* already closed */
      }
    },
  };
}
