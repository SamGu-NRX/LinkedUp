import { describe, expect, it } from "vitest";

import * as dataAvatarUtils from "@/data/avatar-utils";
import * as dataProfiles from "@/data/profiles";
import * as dataMockUsers from "@/data/mock-users";
import { generateAvatarColor, generateAvatarDataUrl, getInitials, formatTime, getStatusColor } from "@/data/avatar-utils";
import { profiles, initialMessages } from "@/data/profiles";
import { mockUsers } from "@/data/mock-users";
// The lib copy is a near-duplicate of the data copy. Tests may import it to
// pin parity; source must stay untouched (out of scope).
import * as libAvatarUtils from "@/lib/avatar-utils";

const isHex = (s: string) => /^[0-9a-fA-F]{6}$/.test(s);

/** Decode an avatar data URL into its SVG source. */
const decodeSvg = (dataUrl: string): string =>
  decodeURIComponent(dataUrl.slice(dataUrl.indexOf(",") + 1));

describe("src/data module surface", () => {
  it("exports exactly the public API the app imports", () => {
    // Guards against accidental removal/renaming of the contract the
    // dashboard and user-card demo depend on.
    expect(Object.keys(dataAvatarUtils).sort()).toEqual([
      "generateAvatarColor",
      "generateAvatarDataUrl",
      "getInitials",
      "getStatusColor",
      "formatTime",
    ]);
    expect(Object.keys(dataProfiles).sort()).toEqual([
      "initialMessages",
      "profiles",
    ]);
    expect(Object.keys(dataMockUsers)).toEqual(["mockUsers"]);
  });
});

describe("cross-file integration: profiles through the avatar pipeline", () => {
  it("every profile renders a color, initials, and a valid SVG avatar", () => {
    expect(profiles.length).toBeGreaterThan(0);
    for (const p of profiles) {
      const color = generateAvatarColor(p.avatar);
      expect(color.from).toMatch(/^from-/);
      expect(color.to).toMatch(/^to-/);
      expect(color.text).toMatch(/^text-/);

      const initials = getInitials(p.name);
      expect(initials.length).toBeGreaterThanOrEqual(1);
      expect(initials.length).toBeLessThanOrEqual(2);

      const svg = decodeSvg(generateAvatarDataUrl(p.avatar));
      expect(svg).toContain("<svg");
      expect(svg).toContain("url(#g)");
      const stops = [...svg.matchAll(/stop-color='#([0-9a-fA-F]{6})'/g)].map(
        (m) => m[1],
      );
      expect(stops).toHaveLength(2);
      for (const hex of stops) expect(isHex(hex)).toBe(true);

      expect(getStatusColor(p.status)).toMatch(/^bg-[a-z]+-\d+$/);
    }
  });

  it("every mock user renders through the same pipeline", () => {
    for (const u of mockUsers) {
      const color = generateAvatarColor(u.id);
      expect(color.from).toMatch(/^from-/);
      const initials = getInitials(u.name);
      expect(initials.length).toBeLessThanOrEqual(2);
      const svg = decodeSvg(generateAvatarDataUrl(u.id));
      expect(svg).toContain("<svg");
    }
  });

  it("every initial message timestamp formats without 'Invalid'", () => {
    for (const [conversationId, messages] of Object.entries(initialMessages)) {
      for (const m of messages) {
        const rendered = formatTime(m.timestamp);
        expect(rendered, `conv ${conversationId} msg ${m.id}`).not.toContain(
          "Invalid",
        );
        expect(rendered, `conv ${conversationId} msg ${m.id}`).toMatch(
          /^\d{1,2}:\d{2}/,
        );
      }
    }
  });
});

describe("parity: src/lib/avatar-utils vs src/data/avatar-utils (duplicated module)", () => {
  // The two copies must behave identically on every VALID input — if someone
  // fixes or changes one copy only, this surfaces the divergence.
  const ids: (string | number)[] = [
    ...Array.from({ length: 64 }, (_, i) => i),
    "user1",
    "user2",
    "user3",
    "alice-johnson",
    "bob-smith",
    "",
    "a",
    "Émile Zola",
  ];

  it("generateAvatarColor agrees on all valid ids", () => {
    for (const id of ids) {
      expect(dataAvatarUtils.generateAvatarColor(id)).toEqual(
        libAvatarUtils.generateAvatarColor(id),
      );
    }
  });

  it("generateAvatarDataUrl agrees on all valid seeds", () => {
    for (const id of ids) {
      expect(dataAvatarUtils.generateAvatarDataUrl(id)).toBe(
        libAvatarUtils.generateAvatarDataUrl(id),
      );
    }
  });

  it("getInitials agrees on representative names", () => {
    for (const name of ["Ada Lovelace", "madonna", "", "   ", "Émile Zola"]) {
      expect(dataAvatarUtils.getInitials(name)).toBe(
        libAvatarUtils.getInitials(name),
      );
    }
  });

  it("formatTime agrees on representative timestamps", () => {
    for (const ts of [0, Date.UTC(2026, 0, 1, 14, 30), -86400000, NaN]) {
      expect(dataAvatarUtils.formatTime(ts)).toBe(libAvatarUtils.formatTime(ts));
    }
  });

  it("getStatusColor agrees on all statuses", () => {
    const statuses: Array<string | undefined | null> = [
      "online",
      "away",
      "offline",
      undefined,
      null,
      "busy",
    ];
    for (const s of statuses) {
      expect(dataAvatarUtils.getStatusColor(s)).toBe(
        libAvatarUtils.getStatusColor(s),
      );
    }
  });
});
