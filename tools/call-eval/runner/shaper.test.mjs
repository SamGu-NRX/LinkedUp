/**
 * Shaper routing tests (reviewed bug: TURN replies forwarded back to TURN).
 *
 * The shaper sits between one participant's browser and coturn. The old
 * implementation used a single socket and forwarded EVERY inbound datagram
 * to coturn — including coturn's own replies, which therefore looped back to
 * coturn and never reached the browser. These tests drive a fake echo "TURN"
 * server through a live shaper with real UDP sockets: a roundtrip must
 * return to the client, the delay queue must hold packets, and a 100% loss
 * profile must blackhole client egress.
 */
import net from "node:net";
import dgram from "node:dgram";
import { describe, expect, it } from "vitest";
import { createShaper } from "./shaper.mjs";

/** @param {import('node:dgram').Socket} sock @param {number} [port] @returns {Promise<number>} */
function bind(sock, port = 0) {
  return new Promise((resolve, reject) => {
    sock.once("error", reject);
    sock.bind(port, "127.0.0.1", () => resolve(sock.address().port));
  });
}

/** Resolves with the next datagram, or rejects after timeoutMs. */
/** @param {import('node:dgram').Socket} sock @param {number} [timeoutMs] @returns {Promise<{ msg: string, rinfo: { address: string, port: number } }>} */
function recv(sock, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no datagram within ${timeoutMs} ms`)), timeoutMs);
    sock.once("message", (/** @type {Buffer} */ msg, /** @type {{ address: string, port: number }} */ rinfo) => {
      clearTimeout(timer);
      resolve({ msg: msg.toString(), rinfo });
    });
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const port = /** @type {import('node:net').AddressInfo} */ (probe.address()).port;
      probe.close(() => resolve(port));
    });
    probe.on("error", reject);
  });
}

/** Fake coturn: echoes every datagram back to its sender. */
async function startEchoTurn() {
  const sock = dgram.createSocket("udp4");
  const port = await bind(sock);
  sock.on("message", (msg, rinfo) => sock.send(msg, rinfo.port, rinfo.address));
  return { sock, port };
}

async function startShapedClient() {
  const turn = await startEchoTurn();
  const shaper = createShaper({ seed: 7 });
  const listenPort = await freePort();
  await shaper.start({ listenPort, targetPort: turn.port });
  const client = dgram.createSocket("udp4");
  const clientPort = await bind(client);
  const closeAll = () => {
    shaper.stop();
    turn.sock.close();
    client.close();
  };
  return { shaper, listenPort, client, clientPort, closeAll };
}

/** @param {import('node:dgram').Socket} client @param {number} port @param {string} text @returns {Promise<void>} */
function sendTo(client, port, text) {
  return new Promise((resolve, reject) =>
    client.send(Buffer.from(text), port, "127.0.0.1", (err) => (err ? reject(err) : resolve())),
  );
}

describe("shaper route-by-sender", () => {
  it("returns TURN's reply to the client instead of looping it back to TURN", { timeout: 10000 }, async () => {
    const { shaper, listenPort, client, closeAll } = await startShapedClient();
    try {
      await sendTo(client, listenPort, "ping");
      const reply = await recv(client);
      expect(reply.msg).toBe("ping");
      expect(reply.rinfo.port).toBe(listenPort); // came back through the shaper
      // And the roundtrip must be repeatable (allocation + channel traffic).
      await sendTo(client, listenPort, "ping2");
      expect((await recv(client)).msg).toBe("ping2");
      expect(shaper.stats().forwarded).toBeGreaterThanOrEqual(4); // 2 out + 2 back
    } finally {
      closeAll();
    }
  });

  it("holds packets for the configured delay without reordering", { timeout: 10000 }, async () => {
    const { shaper, listenPort, client, closeAll } = await startShapedClient();
    try {
      shaper.applyProfile({ lossPct: 0, delayMs: 150 });
      const t0 = Date.now();
      await sendTo(client, listenPort, "delayed");
      await recv(client);
      expect(Date.now() - t0).toBeGreaterThanOrEqual(145);
    } finally {
      closeAll();
    }
  });

  it("drops 100% of client egress under the loss profile", { timeout: 10000 }, async () => {
    const { shaper, listenPort, client, closeAll } = await startShapedClient();
    try {
      shaper.applyProfile({ lossPct: 100, delayMs: 0 });
      for (let i = 0; i < 3; i++) await sendTo(client, listenPort, `lost-${i}`);
      await expect(recv(client, 400)).rejects.toThrow(/no datagram/);
      expect(shaper.stats().dropped).toBe(3);
      expect(shaper.stats().forwarded).toBe(0);
    } finally {
      closeAll();
    }
  });
});

describe("shaper both directions", () => {
  /** Fake TURN that remembers the last uplink it heard from, so it can push. */
  async function startPushTurn() {
    const sock = dgram.createSocket("udp4");
    const port = await bind(sock);
    /** @type {{ address: string, port: number } | null} */
    let last = null;
    sock.on("message", (msg, rinfo) => {
      last = rinfo;
      sock.send(msg, rinfo.port, rinfo.address);
    });
    /** @param {string} text */
    const push = (text) => last && sock.send(Buffer.from(text), last.port, last.address);
    return { sock, port, push };
  }

  it("drops traffic toward the client under 100% loss, so an offline peer receives nothing", { timeout: 10000 }, async () => {
    const turn = await startPushTurn();
    const shaper = createShaper({ seed: 3 });
    const listenPort = await freePort();
    await shaper.start({ listenPort, targetPort: turn.port });
    const client = dgram.createSocket("udp4");
    await bind(client);
    try {
      await sendTo(client, listenPort, "hello");
      expect((await recv(client)).msg).toBe("hello");
      shaper.applyProfile({ lossPct: 100, delayMs: 0 });
      turn.push("inbound media");
      await expect(recv(client, 400)).rejects.toThrow(/no datagram/);
      expect(shaper.stats().droppedDown).toBe(1);
      shaper.clear();
      turn.push("after restore");
      expect((await recv(client)).msg).toBe("after restore");
    } finally {
      shaper.stop();
      turn.sock.close();
      client.close();
    }
  });

  it("keeps a separate mapping per client source port", { timeout: 10000 }, async () => {
    const turn = await startEchoTurn();
    const shaper = createShaper({ seed: 4 });
    const listenPort = await freePort();
    await shaper.start({ listenPort, targetPort: turn.port });
    const one = dgram.createSocket("udp4");
    const two = dgram.createSocket("udp4");
    await bind(one);
    await bind(two);
    try {
      await sendTo(one, listenPort, "from-one");
      await sendTo(two, listenPort, "from-two");
      expect((await recv(one)).msg).toBe("from-one");
      expect((await recv(two)).msg).toBe("from-two");
      expect(shaper.stats().uplinks).toBe(2);
    } finally {
      shaper.stop();
      turn.sock.close();
      one.close();
      two.close();
    }
  });
});
