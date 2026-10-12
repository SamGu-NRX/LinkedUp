/**
 * The harness TURN relay against real UDP sockets: two clients allocate,
 * then data crosses between the allocations by Send/Data indication and by
 * ChannelData, the two paths Chromium's TURN client uses.
 */
import dgram from "node:dgram";
import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { buildStun, decodeXorAddress, encodeXorAddress, longTermKey, parseStun, startTurnRelay } from "./turn-relay.mjs";

const ALLOCATE = 0x003;
const CREATE_PERMISSION = 0x008;
const CHANNEL_BIND = 0x009;
const SEND = 0x006;
const DATA = 0x007;

/** @type {Array<() => void>} */
const cleanups = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** @returns {Promise<import('node:dgram').Socket>} */
async function client() {
  const sock = dgram.createSocket("udp4");
  await new Promise((r) => sock.bind(0, "127.0.0.1", () => r(undefined)));
  cleanups.push(() => sock.close());
  return sock;
}

/** @param {import('node:dgram').Socket} sock @returns {Promise<Buffer>} */
function next(sock, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    sock.once("message", (m) => {
      clearTimeout(t);
      resolve(m);
    });
  });
}

const txid = () => Buffer.from(Array.from({ length: 12 }, (_, i) => i + 1));

const KEY = longTermKey("u", "connvo-eval", "eval-pass");
const signed = () => /** @type {Array<[number, Buffer]>} */ ([[0x0006, Buffer.from("u")]]);

/** @param {import('node:dgram').Socket} sock @param {number} port @param {Buffer} msg */
async function request(sock, port, msg) {
  const reply = next(sock);
  sock.send(msg, port, "127.0.0.1");
  const raw = await reply;
  return Object.assign(parseStun(raw) ?? {}, { raw });
}

/** Chromium drops TURN success responses whose MESSAGE-INTEGRITY does not verify. */
function integrityValid(/** @type {Buffer} */ raw) {
  let off = 20;
  while (off + 4 <= raw.length) {
    const type = raw.readUInt16BE(off);
    const len = raw.readUInt16BE(off + 2);
    if (type === 0x0008) {
      const head = Buffer.from(raw.subarray(0, off));
      head.writeUInt16BE(off + 24 - 20, 2);
      const mac = createHmac("sha1", KEY).update(head).digest();
      return mac.equals(raw.subarray(off + 4, off + 24));
    }
    off += 4 + len + ((4 - (len % 4)) % 4);
  }
  return false;
}

/** Allocate with a placeholder integrity attribute, the way a client does after the 401. */
const allocate = () => buildStun(ALLOCATE, 0, txid(), [[0x0019, Buffer.from([17, 0, 0, 0])], ...signed()], KEY);

describe("turn relay", () => {
  it("allocates, relays by indication and by channel between two clients", async () => {
    const relay = await startTurnRelay();
    cleanups.push(() => relay.stop());
    const a = await client();
    const b = await client();

    // First Allocate without credentials: 401 with a realm and nonce.
    const challenge = await request(a, relay.port, buildStun(ALLOCATE, 0, txid(), [[0x0019, Buffer.from([17, 0, 0, 0])]]));
    expect(challenge.cls).toBe(0b11);
    expect(challenge.attrs?.get(0x0014)?.toString()).toBe("connvo-eval");
    expect(challenge.attrs?.has(0x0015)).toBe(true);

    const allocA = await request(a, relay.port, allocate());
    const allocB = await request(b, relay.port, allocate());
    expect(allocA?.cls).toBe(0b10);
    expect(integrityValid(allocA.raw)).toBe(true);
    const relayedA = decodeXorAddress(/** @type {Buffer} */ (allocA?.attrs.get(0x0016)));
    const relayedB = decodeXorAddress(/** @type {Buffer} */ (allocB?.attrs.get(0x0016)));
    expect(relayedA.address).toBe("127.0.0.1");
    expect(relayedA.port).not.toBe(relayedB.port);

    const perm = await request(a, relay.port, buildStun(CREATE_PERMISSION, 0, txid(), [[0x0012, encodeXorAddress(relayedB)], ...signed()], KEY));
    expect(perm?.cls).toBe(0b10);
    expect(integrityValid(perm.raw)).toBe(true);

    // A -> B by Send indication; B gets a Data indication naming A's relayed address.
    const atB = next(b);
    a.send(buildStun(SEND, 0b01, txid(), [[0x0012, encodeXorAddress(relayedB)], [0x0013, Buffer.from("rtp-1")]]), relay.port, "127.0.0.1");
    const data = parseStun(await atB);
    expect(data?.method).toBe(DATA);
    expect(data?.attrs.get(0x0013)?.toString()).toBe("rtp-1");
    expect(decodeXorAddress(/** @type {Buffer} */ (data?.attrs.get(0x0012)))).toEqual(relayedA);

    // B binds channel 0x4001 to A; A's next send reaches B as ChannelData.
    const bind = await request(b, relay.port, buildStun(CHANNEL_BIND, 0, txid(), [[0x000c, Buffer.from([0x40, 0x01, 0, 0])], [0x0012, encodeXorAddress(relayedA)], ...signed()], KEY));
    expect(bind?.cls).toBe(0b10);
    const atB2 = next(b);
    a.send(buildStun(SEND, 0b01, txid(), [[0x0012, encodeXorAddress(relayedB)], [0x0013, Buffer.from("rtp-2")]]), relay.port, "127.0.0.1");
    const channelData = await atB2;
    expect(channelData.readUInt16BE(0)).toBe(0x4001);
    expect(channelData.subarray(4, 4 + channelData.readUInt16BE(2)).toString()).toBe("rtp-2");

    // B -> A over the bound channel.
    const atA = next(a);
    const frame = Buffer.concat([Buffer.from([0x40, 0x01, 0, 5]), Buffer.from("rtp-3")]);
    b.send(frame, relay.port, "127.0.0.1");
    const back = parseStun(await atA);
    expect(back?.attrs.get(0x0013)?.toString()).toBe("rtp-3");
    expect(relay.stats().allocations).toBe(2);
  });

  it("answers a Binding request with the client's mapped address", async () => {
    const relay = await startTurnRelay();
    cleanups.push(() => relay.stop());
    const a = await client();
    const res = await request(a, relay.port, buildStun(0x001, 0, txid(), []));
    expect(decodeXorAddress(/** @type {Buffer} */ (res?.attrs.get(0x0020)))).toEqual({ address: "127.0.0.1", port: a.address().port });
  });
});
