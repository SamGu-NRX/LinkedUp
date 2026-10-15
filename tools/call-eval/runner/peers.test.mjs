/**
 * peerLaunchArgs tests (reviewed bug: H-06's full-chromium peer still got
 * --use-fake-ui-for-media-stream, which auto-grants every prompt, so the
 * scenario never tested real denial).
 */
import { describe, expect, it } from "vitest";
import { peerLaunchArgs } from "./peers.mjs";

const FIXTURES = { fixtureVideo: "/tmp/v.y4m", fixtureAudio: "/tmp/a.wav" };

describe("peerLaunchArgs permission flags", () => {
  it("keeps fake-UI for the headless shell (H scenarios need auto-granted media)", () => {
    const args = peerLaunchArgs({ ...FIXTURES });
    expect(args).toContain("--use-fake-ui-for-media-stream");
  });

  it("drops fake-UI for the full chromium build so H-06 tests real denial", () => {
    const args = peerLaunchArgs({ ...FIXTURES, fullChromium: true });
    expect(args).not.toContain("--use-fake-ui-for-media-stream");
    // The fake device and file fixtures stay: denial is about PERMISSIONS,
    // not about the device source.
    expect(args).toContain("--use-fake-device-for-media-stream");
    expect(args.some((a) => a.startsWith("--use-file-for-fake-video-capture"))).toBe(true);
  });
});
