/**
 * Per-run context for LinkedUp's real call room. Ported from Connvo's
 * runner context (real page, --signaling=convex), with LinkedUp's own
 * people, queue and signaling:
 *
 * - The page is the call room on the journey-proof path
 *   (/onboarding?journey-proof=call&room=<id>), reached the way a person
 *   reaches it: sign in, open the queue, get matched by the server, press
 *   Join the call. Each scenario frees the personas first, so every
 *   scenario's room is a fresh match.
 * - Participants are named by letter (A, B, O); pages show users.id. The
 *   context installs window.__harnessIds in every page so in-page lookups
 *   by letter find the right tile.
 * - "Signaling gone" (H-07) takes the peer's browser offline, which stops
 *   its polls; media is cut separately by the participant's UDP shaper.
 * - Closed call sessions come from the call_sessions table.
 *
 * Scenarios never touch these pieces directly: they launch peers through
 * the context and reach fault hooks through it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTurn, relayConfig } from "./turn.mjs";
import { createShaper } from "./shaper.mjs";
import { SECOND_CAMERA_ID, secondCameraInit } from "./second-camera.mjs";
import { loadContracts } from "./contracts.mjs";
import { closedSessions, ensurePersonas, freePersonas, loadClerkKeys, openStackDb, signIn } from "./linkedup.mjs";

const RUNNER_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(RUNNER_DIR, "..", "fixtures");

const FIXTURES = {
  A: { video: "peer-A.y4m", audio: "peer-A.wav" },
  B: { video: "peer-B.y4m", audio: "peer-B.wav" },
  C: { video: "peer-C.y4m", audio: "peer-C.wav" },
  O: { video: "peer-C.y4m", audio: "peer-C.wav" },
};
const TURN_PORT = Number(process.env.LINKEDUP_EVAL_TURN_PORT) || 0;
const SHAPER_BASE_PORT = Number(process.env.LINKEDUP_EVAL_SHAPER_BASE_PORT) || 3479;

export const PROOF_QUEUE = "/onboarding?journey-proof=queue&type=casual";
export const PROOF_CALL = "/onboarding?journey-proof=call&room=";
const CALL_URL = /journey-proof=call&room=([0-9a-f-]{36})/;

export class RunContext {
  /**
   * @param {{ baseUrl: string, seed?: number, log?: (m: string) => void, warmUp?: boolean, turn?: Awaited<ReturnType<typeof createTurn>> | null }} opts
   */
  constructor({ baseUrl, seed = 1, log = console.log, warmUp = true, turn = null }) {
    if (!baseUrl) throw new Error("the LinkedUp harness needs --base-url (the running stack)");
    this.transport = "p2p-postgres";
    this.page = "real";
    this.url = baseUrl;
    this.seed = seed;
    this.log = log;
    this._warmUp = warmUp;
    this.turn = turn;
    this.shapers = new Map();
    this.sql = null;
    this.personas = null;
    /** The room of the current scenario, once the queue has matched the pair. */
    this.roomId = null;
    this.meetingId = null;
    this._relayConfigCache = new Map();
    this._relayEnabled = false;
    this._peers = new Set();
  }

  async start() {
    await loadClerkKeys(this.url);
    this.sql = await openStackDb();
    this.personas = await ensurePersonas(this.sql);
    this.log(`personas ready: ${Object.entries(this.personas).map(([l, p]) => `${l}=user ${p.userId}`).join(", ")}`);
    if (this._warmUp) await this.warmUp();
    return this;
  }

  /** Letter -> the page's participant id (users.id as a string). */
  get ids() {
    return Object.fromEntries(Object.entries(this.personas).map(([l, p]) => [l, String(p.userId)]));
  }

  /**
   * Compile the pages once, unscored: `next dev` compiles on first load, and
   * the first seed would otherwise measure that as join latency.
   */
  async warmUp() {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await signIn(page, this.url, this.personas.O.email);
      await page.goto(`${this.url}${PROOF_CALL}00000000-0000-4000-8000-000000000000`, { waitUntil: "networkidle", timeout: 180_000 });
      await page.waitForSelector("[data-call-phase]", { timeout: 120_000 });
      await page.goto(`${this.url}${PROOF_QUEUE}`, { waitUntil: "networkidle", timeout: 180_000 });
      await page.waitForSelector("[data-queue-phase]", { timeout: 120_000 });
      await page.click("[data-queue-leave]").catch(() => {});
      await page.waitForTimeout(1000);
    } finally {
      await browser.close();
    }
    await freePersonas(this.sql, this.personas);
  }

  async ensureTurn() {
    if (this.turn) return this.turn;
    this.turn = await createTurn({ port: TURN_PORT });
    return this.turn;
  }

  /** A fresh match per scenario-seed: free the personas; the peers' queue does the rest. */
  async newMeeting(name) {
    await freePersonas(this.sql, this.personas);
    this.roomId = null;
    this.meetingId = `${name} s${this.seed}`;
    this._relayEnabled = false;
    this._relayConfigCache.clear();
    return this.meetingId;
  }

  async rtcConfigFor(participant) {
    if (!this._relayEnabled) return null;
    const cached = this._relayConfigCache.get(participant);
    if (cached) return cached;
    const turn = await this.ensureTurn();
    const shaper = this.shaperFor(participant);
    const config = relayConfig(turn, shaper.port);
    this._relayConfigCache.set(participant, config);
    return config;
  }

  enableRelay() {
    this._relayEnabled = true;
  }

  setSeed(seed) {
    this.seed = seed;
    if (this.shapers.size > 0) {
      for (const shaper of this.shapers.values()) shaper.stop();
      this.shapers.clear();
      this._relayConfigCache.clear();
    }
  }

  shaperFor(participant) {
    let shaper = this.shapers.get(participant);
    if (!shaper) {
      shaper = createShaper({ seed: this.seed });
      const idx = ["A", "B", "C", "O", "D"].indexOf(participant);
      const port = SHAPER_BASE_PORT + (idx >= 0 ? idx : this.shapers.size + 4);
      shaper.ready = this.ensureTurn().then((turn) => shaper.start({ listenPort: port, targetPort: turn.port }));
      shaper.port = port;
      this.shapers.set(participant, shaper);
    }
    return shaper;
  }

  fixturePaths(participant) {
    const f = FIXTURES[participant] ?? FIXTURES.A;
    return { video: path.join(FIXTURES_DIR, f.video), audio: path.join(FIXTURES_DIR, f.audio) };
  }

  fixturesExist(participant) {
    const { video, audio } = this.fixturePaths(participant);
    return [video, audio].every((p) => fs.existsSync(p));
  }

  /**
   * Launch one peer: its own Chromium with the fixture camera and mic, the
   * probe, the letter-to-id map, and a second camera for H-05; signed in as
   * the persona. A and B then queue and accept their match in the
   * background (H-06 launches one, then the other, so this cannot wait for
   * the match); the outsider O opens the current room's call page directly.
   * @param {string} participant
   * @param {Record<string, string>} [params]
   * @param {object | null} [rtcConfig]
   * @param {{ fullChromium?: boolean }} [opts]
   */
  async launchPeer(participant, params = {}, rtcConfig, { fullChromium = false } = {}) {
    const persona = this.personas[participant];
    if (!persona) throw new Error(`no persona ${participant}`);
    const config = rtcConfig ?? (await this.rtcConfigFor(participant));
    const { video, audio } = this.fixturePaths(participant);
    const { launchPeer: launch } = await import("./peers.mjs");
    const peer = await launch({ fixtureVideo: video, fixtureAudio: audio, baseUrl: this.url, rtcConfig: config, participant, fullChromium });
    peer.iceResponses = [];
    peer.page.on("response", async (response) => {
      if (!response.url().includes("/api/call/ice?")) return;
      const body = await response.json().catch(() => null);
      peer.iceResponses.push({ status: response.status(), turn: body?.iceServers?.some((server) => [server.urls].flat().some((url) => /^turns?:/.test(url))) ?? false });
    });
    const { SECOND_CAMERA_COLOR } = loadContracts();
    await peer.context.addInitScript(/** @type {any} */ (secondCameraInit), { deviceId: SECOND_CAMERA_ID, color: [...SECOND_CAMERA_COLOR] });
    await peer.context.addInitScript((ids) => {
      /** @type {any} */ (window).__harnessIds = ids;
    }, this.ids);
    this._peers.add(peer);
    const origClose = peer.close.bind(peer);
    peer.close = () => {
      this._peers.delete(peer);
      return origClose();
    };

    await signIn(peer.page, this.url, persona.email);
    if (participant === "O") {
      if (!this.roomId) throw new Error("the outsider needs a matched room to try");
      await peer.page.goto(`${this.url}${PROOF_CALL}${this.roomId}`, { waitUntil: "domcontentloaded" });
      return peer;
    }
    await peer.page.goto(`${this.url}${PROOF_QUEUE}`, { waitUntil: "domcontentloaded" });
    peer.matched = (async () => {
      await peer.page.locator("[data-call-accept]").waitFor({ timeout: 60_000 });
      // Joining begins here: the call page auto-joins once it loads.
      peer.joinClickAt = Date.now();
      await peer.page.locator("[data-call-accept]").click({ timeout: 10_000 });
      await peer.page.waitForURL(CALL_URL, { timeout: 30_000 });
      const roomId = peer.page.url().match(CALL_URL)?.[1] ?? null;
      if (roomId && this.roomId && roomId !== this.roomId) throw new Error(`${participant} landed in ${roomId}, the other peer in ${this.roomId}`);
      this.roomId = roomId;
      return roomId;
    })();
    peer.matched.catch((err) => this.log(`${participant} did not reach the call: ${err.message}`));
    return peer;
  }

  /** The page auto-joins; there is no lobby. */
  async joinFromLobby() {}

  /** H-05: switch to the second camera from the device menu, as a person would. */
  async switchCamera(peer) {
    await peer.page.click('[data-testid="device-settings"]');
    await peer.page.selectOption("#device-camera", SECOND_CAMERA_ID, { timeout: 5000 });
    await peer.page.keyboard.press("Escape");
  }

  _peerOf(participant) {
    const peer = [...this._peers].filter((p) => p.peerId === participant).pop();
    if (!peer) throw new Error(`no live peer ${participant}`);
    return peer;
  }

  /** H-07: the peer's network is gone for signaling (its polls fail). */
  async killPeerSocket(participant) {
    await this._peerOf(participant).context.setOffline(true);
  }

  async restorePeerSocket(participant) {
    await this._peerOf(participant).context.setOffline(false);
  }

  /** Closed call sessions of the current room, from Postgres. */
  async sessionEvents() {
    return this.roomId ? closedSessions(this.sql, this.roomId, this.personas) : [];
  }

  async closePeers() {
    await Promise.allSettled([...this._peers].map((p) => p.close()));
    this._peers.clear();
  }

  async stop() {
    await this.closePeers();
    for (const shaper of this.shapers.values()) shaper.stop();
    this.shapers.clear();
    this.turn?.stop();
    this.turn = null;
    if (this.sql && this.personas) await freePersonas(this.sql, this.personas).catch(() => {});
    await this.sql?.end({ timeout: 2 });
    this.sql = null;
  }
}
