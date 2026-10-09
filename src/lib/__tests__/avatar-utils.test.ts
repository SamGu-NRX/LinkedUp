import { describe, it, expect } from "vitest";
import {
  generateAvatarColor,
  generateAvatarDataUrl,
  getInitials,
  formatTime,
  getStatusColor,
  getAvatar,
  type AvatarSeed,
  type AvatarColor,
} from "@/lib/avatar-utils";
import type { ConnectionStatus, UserInfo } from "@/types/user";

// ---------------------------------------------------------------------------
// Pinned palette (retrieved from the unmodified implementation, this session):
// every expected object below was captured by running the original
// avatar-utils.ts before any change. These assertions pin the deterministic
// outputs that must NOT change.
// ---------------------------------------------------------------------------
const PINNED: Record<string, AvatarColor> = {
  violet: { from: "from-violet-500", to: "to-purple-700", text: "text-violet-50" },
  blue: { from: "from-blue-500", to: "to-indigo-600", text: "text-blue-50" },
  emerald: { from: "from-emerald-400", to: "to-teal-600", text: "text-emerald-50" },
  rose: { from: "from-rose-400", to: "to-pink-600", text: "text-rose-50" },
  amber: { from: "from-amber-400", to: "to-orange-600", text: "text-amber-50" },
  cyan: { from: "from-cyan-400", to: "to-blue-600", text: "text-cyan-50" },
  red: { from: "from-red-500", to: "to-pink-500", text: "text-red-50" },
  green: { from: "from-green-400", to: "to-emerald-600", text: "text-green-50" },
  fuchsia: { from: "from-fuchsia-500", to: "to-purple-600", text: "text-fuchsia-50" },
  yellow: { from: "from-yellow-400", to: "to-amber-600", text: "text-yellow-50" },
};

const makeUser = (id: string, avatar: string | null): UserInfo => ({
  id,
  name: "Alice Smith",
  avatar,
  bio: "",
  profession: "",
  company: "",
  school: "",
  experience: 0,
  sharedInterests: [],
  connectionType: "b2b",
});

const DATA_URL_PREFIX = "data:image/svg+xml;charset=utf8,";

/** Decodes the SVG payload of a generated data URL. Assumes valid prefix (asserted by caller). */
const decodeDataUrl = (url: string): string =>
  decodeURIComponent(url.slice(DATA_URL_PREFIX.length));

describe("AvatarSeed", () => {
  it("accepts strings and numbers", () => {
    const seeds: AvatarSeed[] = ["abc", 0, -3, 3.5];
    expect(seeds).toHaveLength(4);
  });
});

describe("generateAvatarColor", () => {
  it('returns the same gradient as before the change for "abc"', () => {
    expect(generateAvatarColor("abc")).toEqual(PINNED.amber);
  });

  it("returns the same gradients as before the change for ids 0..9", () => {
    const expected: AvatarColor[] = [
      PINNED.violet,
      PINNED.blue,
      PINNED.emerald,
      PINNED.rose,
      PINNED.amber,
      PINNED.cyan,
      PINNED.red,
      PINNED.green,
      PINNED.fuchsia,
      PINNED.yellow,
    ];
    expected.forEach((want, id) => {
      expect(generateAvatarColor(id)).toEqual(want);
    });
  });

  it("is deterministic for repeated calls with the same seed", () => {
    expect(generateAvatarColor("Alice")).toEqual(generateAvatarColor("Alice"));
    expect(generateAvatarColor(7)).toEqual(generateAvatarColor(7));
  });

  it("BUG: returns a valid gradient for negative numeric ids (was: undefined)", () => {
    // Before the fix: hash -3 % 10 === -3 -> gradients[-3] -> undefined.
    expect(generateAvatarColor(-3)).toEqual(PINNED.rose);
  });

  it("BUG: returns a valid gradient for non-integer numeric ids (was: undefined)", () => {
    // Before the fix: gradients[3.5] -> undefined.
    expect(generateAvatarColor(3.5)).toEqual(PINNED.rose);
  });

  it("throws TypeError for NaN (was: silently returned undefined)", () => {
    expect(() => generateAvatarColor(NaN)).toThrowError(TypeError);
    expect(() => generateAvatarColor(NaN)).toThrowError(
      "avatar seed must be a finite number, got NaN",
    );
  });

  it("throws TypeError for Infinity and -Infinity", () => {
    expect(() => generateAvatarColor(Infinity)).toThrowError(TypeError);
    expect(() => generateAvatarColor(Infinity)).toThrowError(
      "avatar seed must be a finite number, got Infinity",
    );
    expect(() => generateAvatarColor(-Infinity)).toThrowError(TypeError);
    expect(() => generateAvatarColor(-Infinity)).toThrowError(
      "avatar seed must be a finite number, got -Infinity",
    );
  });

  it("throws TypeError for an empty string", () => {
    expect(() => generateAvatarColor("")).toThrowError(TypeError);
    expect(() => generateAvatarColor("")).toThrowError(
      'avatar seed must be a non-empty string, got ""',
    );
  });

  it("throws TypeError for a whitespace-only string", () => {
    expect(() => generateAvatarColor("   ")).toThrowError(TypeError);
    expect(() => generateAvatarColor("   ")).toThrowError(
      'avatar seed must be a non-empty string, got "   "',
    );
  });

  it("never returns undefined for any finite numeric seed", () => {
    const numericSeeds: number[] = [
      -1e12, -4321, -100, -7, -0.5, 0, 0.5, 7, 100, 4321, 1e12, Number.MAX_SAFE_INTEGER,
    ];
    const palette: AvatarColor[] = Object.values(PINNED);
    for (const seed of numericSeeds) {
      const result: AvatarColor = generateAvatarColor(seed);
      expect(palette).toContainEqual(result);
    }
  });
});

describe("generateAvatarDataUrl", () => {
  it("returns a data URL with the pinned charset prefix", () => {
    const url: string = generateAvatarDataUrl("abc");
    expect(url.startsWith(DATA_URL_PREFIX)).toBe(true);
  });

  it("decodes to an <svg> containing both hex colors for the seed", () => {
    // "abc" maps to the amber gradient: from-amber-400 -> #fbbf24, to-orange-600 -> #ea580c
    // (hex values retrieved from the unmodified implementation's colorMap this session).
    const svg: string = decodeDataUrl(generateAvatarDataUrl("abc"));
    expect(svg).toContain("<svg");
    expect(svg).toContain("#fbbf24");
    expect(svg).toContain("#ea580c");
  });

  it("works for numeric seeds", () => {
    // id 5 maps to the cyan gradient: from-cyan-400 -> #22d3ee, to-blue-600 -> #2563eb
    const svg: string = decodeDataUrl(generateAvatarDataUrl(5));
    expect(svg).toContain("<svg");
    expect(svg).toContain("#22d3ee");
    expect(svg).toContain("#2563eb");
  });

  it("BUG: works for negative numeric seeds (was: TypeError reading 'from' of undefined)", () => {
    const url: string = generateAvatarDataUrl(-3);
    expect(url.startsWith(DATA_URL_PREFIX)).toBe(true);
  });

  it("BUG: works for non-integer numeric seeds (was: TypeError reading 'from' of undefined)", () => {
    const url: string = generateAvatarDataUrl(3.5);
    expect(url.startsWith(DATA_URL_PREFIX)).toBe(true);
  });

  it("propagates the same TypeError as generateAvatarColor for NaN", () => {
    expect(() => generateAvatarDataUrl(NaN)).toThrowError(TypeError);
    expect(() => generateAvatarDataUrl(NaN)).toThrowError(
      "avatar seed must be a finite number, got NaN",
    );
  });

  it("propagates the same TypeError as generateAvatarColor for an empty string", () => {
    expect(() => generateAvatarDataUrl("")).toThrowError(TypeError);
    expect(() => generateAvatarDataUrl("")).toThrowError(
      'avatar seed must be a non-empty string, got ""',
    );
  });
});

describe("getInitials", () => {
  it('returns "?" for an empty string', () => {
    expect(getInitials("")).toBe("?");
  });

  it('returns "?" for a whitespace-only string (never indexes an empty array)', () => {
    expect(getInitials("   ")).toBe("?");
  });

  it("uppercases the first character of a single word", () => {
    expect(getInitials("alice")).toBe("A");
    expect(getInitials("Alice")).toBe("A");
  });

  it("combines the first characters of the first and last word", () => {
    expect(getInitials("alice smith")).toBe("AS");
    expect(getInitials("Alice Smith")).toBe("AS");
  });

  it("collapses runs of spaces between words", () => {
    expect(getInitials("  alice   smith  ")).toBe("AS");
  });

  it('handles a trailing space as a single word ("bob " -> "B")', () => {
    expect(getInitials("bob ")).toBe("B");
  });
});

describe("formatTime", () => {
  it('returns "" for NaN', () => {
    expect(formatTime(NaN)).toBe("");
  });

  it('BUG: returns "" for Infinity (was: "Invalid Date")', () => {
    // Before the fix: isNaN(Infinity) === false -> toLocaleTimeString -> "Invalid Date".
    expect(formatTime(Infinity)).toBe("");
  });

  it('BUG: returns "" for -Infinity (was: "Invalid Date")', () => {
    expect(formatTime(-Infinity)).toBe("");
  });

  it("returns a time-of-day-shaped string for a valid timestamp", () => {
    // Locale-dependent output: this node (en-US) prints "10:13 PM" for 1700000000000.
    // Pin the shape, not the exact text.
    const out: string = formatTime(1700000000000);
    expect(out).toMatch(/^\d{1,2}:\d{2}(:\d{2})?( ?[AP]M)?$/);
  });
});

describe("getStatusColor", () => {
  it('maps "online" to bg-emerald-500', () => {
    expect(getStatusColor("online")).toBe("bg-emerald-500");
  });

  it('maps "away" to bg-amber-400', () => {
    expect(getStatusColor("away")).toBe("bg-amber-400");
  });

  it('maps "offline" to bg-gray-500', () => {
    expect(getStatusColor("offline")).toBe("bg-gray-500");
  });

  it("maps undefined to bg-gray-400", () => {
    expect(getStatusColor(undefined)).toBe("bg-gray-400");
  });

  it("maps null to bg-gray-400", () => {
    expect(getStatusColor(null)).toBe("bg-gray-400");
  });

  it("maps an out-of-domain runtime value to the default bg-gray-400", () => {
    // The cast exists only to smuggle a deliberately invalid runtime value
    // (as could arrive from untyped JS callers) into the defensive default
    // branch; the function itself must tolerate it.
    const bogus = "bogus" as ConnectionStatus;
    expect(getStatusColor(bogus)).toBe("bg-gray-400");
  });
});

describe("getAvatar", () => {
  it("returns user.avatar unchanged when truthy", () => {
    const user: UserInfo = makeUser("u1", "https://example.com/a.png");
    expect(getAvatar(user)).toBe("https://example.com/a.png");
  });

  it("returns a generated data URL when avatar is null", () => {
    const user: UserInfo = makeUser("abc", null);
    const url: string = getAvatar(user);
    expect(url.startsWith(DATA_URL_PREFIX)).toBe(true);
    expect(url).toBe(generateAvatarDataUrl("abc"));
  });

  it("throws TypeError for an empty user.id with no avatar (was: silently broken gradient)", () => {
    // Before the fix: getAvatar({ id: "", avatar: null }) returned a data URL
    // mapping every empty id to the same default gradient.
    expect(() => getAvatar(makeUser("", null))).toThrowError(TypeError);
    expect(() => getAvatar(makeUser("", null))).toThrowError(
      'avatar seed must be a non-empty string, got ""',
    );
  });

  it("throws TypeError for a whitespace-only user.id with no avatar", () => {
    expect(() => getAvatar(makeUser("  ", null))).toThrowError(TypeError);
  });
});
