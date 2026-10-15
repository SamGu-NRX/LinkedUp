import fs from "node:fs";
import { ScenarioError, waitFor, phaseIs, pageDiagnostics } from "./scenario-kit.mjs";
import { selectedCandidateTypes, waitForLiveMedia } from "./page-helpers.mjs";

const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
const shotDir = "docs/lane2/screenshots";

async function tabTo(page, selector) {
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    if (await page.locator(selector).evaluate((el) => el === document.activeElement)) {
      const focus = await page.locator(selector).evaluate((el) => {
        const style = getComputedStyle(el);
        return { visible: el.matches(":focus-visible"), outline: style.outlineStyle, width: parseFloat(style.outlineWidth) };
      });
      if (!focus.visible || focus.outline === "none" || focus.width < 2) throw new ScenarioError(`No visible keyboard focus on ${selector}`);
      return;
    }
  }
  throw new ScenarioError(`Tab did not reach ${selector}`);
}

/** Exercise the call's native controls through Tab, Enter, Space and Escape. */
export async function keyboardCallPass(peer) {
  const page = peer.page;
  await tabTo(page, '[data-testid="toggle-mic"]');
  await page.keyboard.press("Space");
  if (await page.locator('[data-testid="toggle-mic"]').getAttribute("aria-pressed") !== "true") throw new ScenarioError("Keyboard mute did not change state");
  await page.keyboard.press("Space");
  await tabTo(page, '[data-testid="toggle-camera"]');
  await page.keyboard.press("Enter");
  if (await page.locator('[data-testid="toggle-camera"]').getAttribute("aria-pressed") !== "true") throw new ScenarioError("Keyboard camera toggle did not change state");
  await page.keyboard.press("Enter");
  await tabTo(page, '[data-testid="device-settings"]');
  await page.keyboard.press("Enter");
  await page.locator("#device-camera").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("#device-camera") === document.activeElement, null, { timeout: 1000 });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector('[data-testid="device-settings"]') === document.activeElement, null, { timeout: 1000 });
  if (await page.locator('[data-call-extend]').isVisible()) await tabTo(page, '[data-call-extend]');
  await tabTo(page, '[data-testid="leave-call"]');
  await page.keyboard.press("Enter");
  await waitFor(peer, phaseIs("left"));
  await tabTo(page, '[data-testid="join-call"]');
  await page.keyboard.press("Enter");
  await waitFor(peer, () => window.__wrappedPcs.some((pc) => pc.connectionState === "connected"), { timeoutMs: 15_000 });
  return { mic: true, camera: true, cameraMenu: true, focusRestored: true, leaveAndRejoin: true };
}

export async function captureCallStates(peer, state) {
  fs.mkdirSync(shotDir, { recursive: true });
  // Match call-states-shots.mjs: hide only development overlays so they
  // cannot cover app controls during captures or keyboard inspection.
  await peer.page.evaluate(() => {
    for (const button of document.querySelectorAll("button")) {
      if (!/keyless prompt/i.test(button.getAttribute("aria-label") ?? "")) continue;
      let box = button;
      while (box.parentElement && getComputedStyle(box).position !== "fixed") box = box.parentElement;
      box.style.display = "none";
    }
    for (const indicator of document.querySelectorAll("nextjs-portal")) indicator.remove();
  });
  const evidence = [];
  for (const viewport of viewports) {
    await peer.page.setViewportSize(viewport);
    for (const reducedMotion of ["no-preference", "reduce"]) {
      await peer.page.emulateMedia({ reducedMotion });
      const layout = await peer.page.locator("[data-call-root]").evaluate((root) => {
        const rect = root.getBoundingClientRect();
        const animations = root.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running");
        return { width: rect.width, viewport: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, runningAnimations: animations.length, reduced: matchMedia("(prefers-reduced-motion: reduce)").matches };
      });
      if (layout.overflow || layout.width > layout.viewport) throw new ScenarioError("Call overflows the viewport", layout);
      if (reducedMotion === "reduce" && (!layout.reduced || layout.runningAnimations)) throw new ScenarioError("Reduced-motion call still animates", layout);
      const suffix = reducedMotion === "reduce" ? "-reduced" : "";
      await peer.page.screenshot({ path: `${shotDir}/${state}-${viewport.width}x${viewport.height}${suffix}.png` });
      evidence.push({ ...viewport, reducedMotion, ...layout });
    }
  }
  return evidence;
}

/** Drop real relay requests until the call exhausts its ICE restart budget. */
export async function scenarioIceExhaustion(ctx, { seed, installColorHook }) {
  const droppedBefore = ctx.turn.stats().droppedRequests;
  ctx.turn.setAvailable(false);
  try {
    const peerA = await ctx.launchPeer("A", {}, { iceTransportPolicy: "relay" });
    const peerB = await ctx.launchPeer("B", {}, { iceTransportPolicy: "relay" });
    await Promise.all([peerA.matched, peerB.matched]);
    for (const peer of [peerA, peerB]) {
      await waitFor(peer, () => window.__wrappedPcs?.length > 0);
      await peer.page.evaluate(() => {
        window.__iceRestarts = 0;
        for (const pc of window.__wrappedPcs) {
          const restart = pc.restartIce.bind(pc);
          pc.restartIce = () => { window.__iceRestarts++; restart(); };
        }
      });
    }
    // The first failure leaves signaling; its partner may then wait for a
    // peer instead of failing. Inspect whichever caller exhausts ICE first.
    const failedPeer = await Promise.any([peerA, peerB].map(async (peer) => {
      await waitFor(peer, phaseIs("failed"), { timeoutMs: 40_000 });
      return peer;
    }));
    const errors = await Promise.all([peerA, peerB].map((peer) => peer.page.evaluate(() => document.querySelector('[data-testid="call-error"]')?.textContent ?? null)));
    const message = await failedPeer.page.locator('[data-testid="call-error"]').textContent();
    if (!message?.startsWith("Can't reach the other person.")) throw new ScenarioError("ICE exhaustion did not explain the failure", errors);
    const restarts = await Promise.all([peerA, peerB].map((peer) => peer.page.evaluate(() => window.__iceRestarts)));
    if (!restarts.some((count) => count > 0)) throw new ScenarioError("ICE never restarted before giving up", restarts);
    const probe = await failedPeer.page.evaluate(() => window.__callProbe.pcs.map((pc) => ({ everConnected: pc.everConnected, closed: pc.closed })));
    if (!probe.length || !probe.every((pc) => !pc.everConnected && pc.closed)) throw new ScenarioError("Unreachable peer was not closed", probe);
    const captures = await captureCallStates(failedPeer, "ice-exhausted");
    const relayStats = ctx.turn.stats();
    if (relayStats.droppedRequests <= droppedBefore) throw new ScenarioError("The outage dropped no real TURN requests");
    // One caller can fail while its partner processes peer-left. Wait for
    // both old attempts to close before deciding which callers need Retry.
    await Promise.all([peerA, peerB].map((peer) => waitFor(peer, () => {
      const phase = document.querySelector("[data-call-root]")?.getAttribute("data-call-phase");
      return window.__callProbe.connections.live === 0 && (phase === "failed" || phase === "connected");
    }, { describe: "original ICE attempt closed" })));
    const retryPeers = [];
    for (const peer of [peerA, peerB]) {
      if (await peer.page.locator("[data-call-root]").getAttribute("data-call-phase") !== "failed") continue;
      await tabTo(peer.page, '[data-testid="retry-call"]');
      retryPeers.push(peer);
    }
    ctx.turn.setAvailable(true);
    await Promise.all(retryPeers.map((peer) => peer.page.keyboard.press("Enter")));
    try {
      await Promise.all([peerA, peerB].map((peer) => waitFor(peer, phaseIs("connected"), { timeoutMs: 15_000 })));
    } catch (error) {
      const states = await Promise.all([peerA, peerB].map((peer) => pageDiagnostics(peer)));
      throw new ScenarioError(`${error.message}; retried ${retryPeers.map((peer) => peer.peerId).join(",")}; ${JSON.stringify(states)}`);
    }
    await installColorHook(peerA);
    await installColorHook(peerB);
    await waitForLiveMedia(peerA, "B", { deadlineAt: Date.now() + 15_000, label: "B" });
    await waitForLiveMedia(peerB, "A", { deadlineAt: Date.now() + 15_000, label: "A" });
    const recoveredPaths = await Promise.all([selectedCandidateTypes(peerA), selectedCandidateTypes(peerB)]);
    if (!recoveredPaths.every((paths) => paths.length && paths.every((pair) => pair?.local === "relay" && pair?.remote === "relay"))) throw new ScenarioError("Retry did not recover relayed media", recoveredPaths);
    return { seed, errors, probe, restarts, relayStats, droppedRequests: relayStats.droppedRequests - droppedBefore, captures, keyboardRetryRecovered: true, recoveredPaths };
  } finally {
    ctx.turn.setAvailable(true);
  }
}
