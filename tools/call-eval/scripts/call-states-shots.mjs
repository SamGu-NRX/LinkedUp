#!/usr/bin/env node
/**
 * Screenshots of LinkedUp's call room in each state, at 1440x900 and
 * 390x844, and a frame strip of a real two-person call.
 *
 * Every state is reached for real, through the journey-proof path with two
 * personas matched by the queue: joining (signaling slowed by Chromium's
 * network emulation, so the first join takes seconds), waiting for the
 * partner, connected, the partner muted with the camera off, the camera
 * menu, reconnecting and then failed (one peer's network taken offline),
 * left, permission denied (full Chromium, a real denied prompt) and an
 * outsider refused.
 *
 * Clerk's keyless-mode prompt and Next's dev indicator (development-only
 * overlays) are hidden in the captures; they are not part of the app.
 *
 *   node tools/call-eval/scripts/call-states-shots.mjs --base-url=http://localhost:3000 [--out=<dir>]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RunContext, PROOF_CALL, PROOF_QUEUE } from "../runner/context.mjs";
import { launchPeer } from "../runner/peers.mjs";
import { signIn } from "../runner/linkedup.mjs";

const EVAL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(EVAL_DIR, "..", "..");
const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a !== "--").map((a) => a.replace(/^--/, "").split("=")));
const baseUrl = flags["base-url"] ?? "http://localhost:3000";
const outDir = path.resolve(REPO, flags.out ?? "tools/call-eval/out/screenshots");
fs.mkdirSync(outDir, { recursive: true });

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
const CALL_URL = /journey-proof=call&room=([0-9a-f-]{36})/;

const ctx = new RunContext({ baseUrl, warmUp: true });
await ctx.start();

/** @type {Array<any>} */
const peers = [];
async function peer(id, { deny = false } = {}) {
  const { video, audio } = ctx.fixturePaths(id);
  const p = await launchPeer({ fixtureVideo: video, fixtureAudio: audio, baseUrl, participant: id, fullChromium: deny, viewport: VIEWPORTS[0] });
  peers.push(p);
  await signIn(p.page, baseUrl, ctx.personas[id].email);
  return p;
}
const phaseOf = (p) => p.page.evaluate(() => document.querySelector("[data-call-phase]")?.getAttribute("data-call-phase"));
async function waitPhase(p, phase, timeout = 30000) {
  await p.page.waitForFunction((want) => document.querySelector("[data-call-phase]")?.getAttribute("data-call-phase") === want, phase, { timeout });
}
async function hideDevOverlays(p) {
  await p.page.evaluate(() => {
    for (const el of document.querySelectorAll("button")) {
      if (/keyless prompt/i.test(el.getAttribute("aria-label") ?? el.textContent ?? "")) {
        let box = el;
        while (box.parentElement && getComputedStyle(box).position !== "fixed") box = box.parentElement;
        box.style.display = "none";
      }
    }
    for (const el of document.querySelectorAll("nextjs-portal")) el.remove();
  });
}
async function shoot(p, name) {
  for (const viewport of VIEWPORTS) {
    await p.page.setViewportSize(viewport);
    await p.page.waitForTimeout(500);
    await hideDevOverlays(p);
    await p.page.screenshot({ path: path.join(outDir, `${name}-${viewport.width}x${viewport.height}.png`) });
  }
  await p.page.setViewportSize(VIEWPORTS[0]);
  console.log(`shot ${name}: phase ${await phaseOf(p)}`);
}
async function queue(p) {
  await p.page.goto(`${baseUrl}${PROOF_QUEUE}`, { waitUntil: "domcontentloaded" });
}
async function accept(p) {
  await p.page.locator("[data-call-accept]").click({ timeout: 60000 });
  await p.page.waitForURL(CALL_URL, { timeout: 120000, waitUntil: "commit" });
  return p.page.url().match(CALL_URL)[1];
}

try {
  // Room 1: A and B, matched by the queue.
  await ctx.newMeeting("shots");
  const a = await peer("A");
  const b = await peer("B");
  await Promise.all([queue(a), queue(b)]);
  await Promise.all([a, b].map((p) => p.page.locator("[data-call-accept]").waitFor({ timeout: 60000 })));

  // Joining: A's requests take 1.5 s each, so the first join is visibly slow.
  const cdp = await a.context.newCDPSession(a.page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 1500, downloadThroughput: -1, uploadThroughput: -1 });
  const room = await accept(a);
  await a.page.waitForSelector('[data-call-local-media="ready"]', { timeout: 120000 });
  if ((await phaseOf(a)) === "joining") await shoot(a, "joining");
  else console.log(`joining: missed (phase ${await phaseOf(a)})`);
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  // Connected, alone: the partner has not joined yet.
  await waitPhase(a, "connected");
  await a.page.waitForTimeout(800);
  await shoot(a, "waiting-for-partner");

  // Both in the call.
  await accept(b);
  await waitPhase(b, "connected");
  await a.page.waitForFunction(() => {
    const v = /** @type {HTMLVideoElement | null} */ (document.querySelector('[data-testid="remote-media"] video'));
    return v && v.videoWidth > 0;
  }, null, { timeout: 20000 });
  await a.page.waitForTimeout(1500);
  await shoot(a, "connected");
  await shoot(b, "connected-other-side");
  const strip = [];
  for (let i = 0; i < 6; i++) {
    for (const p of [a, b]) {
      const file = path.join(outDir, `strip-${p.peerId}-${i}.png`);
      await hideDevOverlays(p);
      await p.page.screenshot({ path: file });
      strip.push({ who: p.peerId, file });
    }
    await a.page.waitForTimeout(500);
  }

  // B mutes and turns the camera off: A's tile says so.
  await b.page.click('[data-testid="toggle-mic"]');
  await b.page.click('[data-testid="toggle-camera"]');
  await a.page.waitForSelector('[data-testid="remote-media"][data-video-off="true"][data-audio-muted="true"]', { timeout: 5000 });
  await shoot(a, "partner-muted-camera-off");
  await b.page.click('[data-testid="toggle-camera"]');
  await b.page.click('[data-testid="toggle-mic"]');

  // The camera menu.
  await a.page.click('[data-testid="device-settings"]');
  await a.page.waitForTimeout(300);
  await shoot(a, "camera-menu");
  await a.page.keyboard.press("Escape");

  // Reconnecting, then failed: B's network goes away and stays away.
  await b.context.setOffline(true);
  await waitPhase(b, "reconnecting", 20000);
  await shoot(b, "reconnecting");
  await waitPhase(b, "failed", 70000);
  await shoot(b, "failed");

  // Leaving.
  await a.page.click('[data-testid="leave-call"]');
  await waitPhase(a, "left", 5000);
  await shoot(a, "left");

  // Frame strip: A's and B's views, six frames 0.5 s apart.
  const sheet = peers[0];
  const rows = ["A", "B"]
    .map((who) => `<div style="display:flex;gap:6px">${strip
      .filter((s) => s.who === who)
      .map((s) => `<img src="data:image/png;base64,${fs.readFileSync(s.file).toString("base64")}" style="width:360px">`)
      .join("")}</div>`)
    .join("");
  await sheet.page.setViewportSize({ width: 6 * 366 + 6, height: 2 * 231 + 18 });
  await sheet.page.setContent(`<body style="margin:6px;background:#09090b;display:grid;gap:6px">${rows}</body>`);
  await sheet.page.screenshot({ path: path.join(outDir, "frame-strip-two-person-call.png"), fullPage: true });
  for (const s of strip) fs.rmSync(s.file);

  // Room 2: A's browser refuses camera and microphone.
  for (const p of peers.splice(0)) await p.browser.close();
  await ctx.newMeeting("shots-denied");
  const denied = await peer("A", { deny: true });
  const b2 = await peer("B");
  await Promise.all([queue(denied), queue(b2)]);
  const room2 = await accept(denied);
  await accept(b2);
  await denied.page.waitForSelector('[data-testid="retry-media"]', { timeout: 30000 });
  await shoot(denied, "permission-denied");

  // An outsider opening the room's link.
  const o = await peer("O");
  await o.page.goto(`${baseUrl}${PROOF_CALL}${room2}`, { waitUntil: "domcontentloaded" });
  await o.page.waitForSelector('[data-testid="call-error"]', { timeout: 30000 });
  await shoot(o, "outsider-refused");
  console.log(`rooms ${room.slice(0, 8)}…, ${room2.slice(0, 8)}…; screenshots in ${path.relative(REPO, outDir)}`);
} finally {
  await Promise.allSettled(peers.map((p) => p.browser.close()));
  await ctx.stop();
}
