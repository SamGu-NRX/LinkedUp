/**
 * Peer browser launches (D4: one Chromium per peer). All peers run the fake
 * capture devices with the pinned fixture files; the probe init script is
 * installed per context, and an optional relay-only RTCConfiguration is
 * delivered through a second init script (probeConfigInit) so wrapped
 * constructors force media onto the harness-controlled relay path.
 */
import { chromium } from "@playwright/test";
import { probeInit, probeConfigInit } from "./probe.mjs";

const HEADLESS_SHELL_ARGS = (videoFixture, audioFixture) => [
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  // Shared-box hygiene: /dev/shm is small and there is no GPU on the eval
  // host — without these, tabs crash under memory pressure and GL init.
  "--disable-dev-shm-usage",
  "--disable-gpu",
  `--use-file-for-fake-video-capture=${videoFixture}`,
  `--use-file-for-fake-audio-capture=${audioFixture}`,
  "--autoplay-policy=no-user-gesture-required",
  "--disable-renderer-backgrounding",
  "--mute-audio", // analysis taps the track, not the speaker
];

export { HEADLESS_SHELL_ARGS as chromiumLaunchArgs };

/**
 * Launch args for a peer. The full chromium build drops the fake-UI flag:
 * it auto-grants every permission prompt, which would stop H-06 from ever
 * testing real denial (headless chromium denies by default; the scenario
 * grants explicitly for its retry step).
 * @param {{ fullChromium?: boolean, fixtureVideo: string, fixtureAudio: string }} opts
 * @returns {string[]}
 */
export function peerLaunchArgs({ fullChromium = false, fixtureVideo, fixtureAudio }) {
  const args = HEADLESS_SHELL_ARGS(fixtureVideo, fixtureAudio);
  return fullChromium ? args.filter((a) => a !== "--use-fake-ui-for-media-stream") : args;
}

/**
 * @param {object} opts
 * @param {string} opts.fixtureVideo y4m for the fake camera
 * @param {string} opts.fixtureAudio wav for the fake mic
 * @param {string} opts.baseUrl mock or bench origin (context base URL)
 * @param {object|null} opts.rtcConfig relay-only override for H-07/H-15
 * @param {boolean} opts.fullChromium use the full build (H-06 needs real
 *   permission flow; the headless shell cannot run it)
 * @param {string} opts.participant A|B|C|O
 */
export async function launchPeer({
  fixtureVideo,
  fixtureAudio,
  baseUrl,
  rtcConfig = null,
  fullChromium = false,
  participant = "A",
  viewport = { width: 1280, height: 720 },
} = {}) {
  const launchOpts = {
    headless: true,
    args: peerLaunchArgs({ fullChromium, fixtureVideo, fixtureAudio }),
  };
  if (fullChromium) launchOpts.channel = "chromium"; // full build, not the shell
  const browser = await chromium.launch(launchOpts);

  const context = await browser.newContext({
    viewport,
    baseURL: baseUrl,
    // P-04: default, per-test reduced-motion contexts set their own
    reducedMotion: "no-preference",
  });
  await context.addInitScript(probeInit);
  if (rtcConfig) await context.addInitScript(probeConfigInit, rtcConfig);

  const page = await context.newPage();
  page.on("pageerror", (err) => {
    console.error(`[pageerror ${participant}]`, err?.message?.slice(0, 300));
  });

  return {
    peerId: participant,
    browser,
    context,
    page,
    async close() {
      try {
        await browser.close();
      } catch {
        /* already dead */
      }
    },
  };
}

/**
 * H-10: hard-kill a peer's tab through CDP (Playwright 1.64's Browser has no
 * process() accessor; Target.closeTarget is the reliable path).
 */
export async function killPeerTab(peer) {
  const cdp = await peer.context.newCDPSession(peer.page);
  const info = await cdp.send("Target.getTargetInfo");
  const targetId = info.targetInfo.targetId;
  const pageClosed = new Promise((resolve) => peer.page.on("close", () => resolve(true)));
  try {
    const cdpBrowser = await peer.browser.newBrowserCDPSession();
    await cdpBrowser.send("Target.closeTarget", { targetId });
  } catch {
    return false;
  }
  return Promise.race([pageClosed, new Promise((r) => setTimeout(() => r(false), 3000))]);
}
