import { describe, expect, it } from "vitest";
import { getInitials } from "@/data/avatar-utils";

// Behavioral contract for getInitials: uppercase initial of the first and last
// whitespace-separated word; "?" when there is no word to take an initial from.
describe("getInitials", () => {
  it("returns the uppercased first letter of the first and last word", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
  });

  it("returns a single uppercase initial for a one-word name", () => {
    expect(getInitials("madonna")).toBe("M");
    expect(getInitials("x")).toBe("X");
  });

  it("uses the first and last word, skipping middle words", () => {
    expect(getInitials("Ada Mae Lovelace")).toBe("AL");
  });

  it("ignores leading, trailing, and repeated internal whitespace", () => {
    expect(getInitials("  Ada   Lovelace  ")).toBe("AL");
  });

  it('returns "?" for an empty string', () => {
    expect(getInitials("")).toBe("?");
  });

  it('returns "?" for a whitespace-only string', () => {
    expect(getInitials("   ")).toBe("?");
  });

  it('returns "?" for a null input at runtime', () => {
    expect(getInitials(null as unknown as string)).toBe("?");
  });

  it('returns "?" for an undefined input at runtime', () => {
    expect(getInitials(undefined as unknown as string)).toBe("?");
  });

  it("uppercases non-ASCII initial letters", () => {
    expect(getInitials("Émile Zola")).toBe("ÉZ");
    expect(getInitials("émile zola")).toBe("ÉZ");
  });

  it("keeps digit initials as-is", () => {
    expect(getInitials("4chan user")).toBe("4U");
  });

  it("does not split on hyphens", () => {
    expect(getInitials("jean-pierre")).toBe("J");
    expect(getInitials("jean-pierre dupont")).toBe("JD");
  });

  it("upholds shape invariants across 200 programmatic names", () => {
    const firstWords = [
      "ada", "ADA", "grace", "Grace", "émile", "ÉMILE", "x", "X",
      "4chan", "jean-pierre", "o'brien", "liú", "ana", "m", "zoe", "ZOE",
    ];
    const lastWords = [
      "lovelace", "HOPPER", "turing", "zola", "user", "wang", "o'brien",
      "schmidt", "y", "dupont", "ström", "xu", "müller", "m", "Zoe", "x",
    ];

    for (let i = 0; i < 200; i++) {
      const first = firstWords[i % firstWords.length];
      const last = lastWords[(i * 7) % lastWords.length];
      const lead = " ".repeat(i % 3);
      const inner = " ".repeat(1 + (i % 2) * 2);
      const trail = " ".repeat((i + 1) % 2);
      // Every 13th name drops the last word to cover single-word shapes.
      const name =
        i % 13 === 0
          ? `${lead}${first}${trail}`
          : `${lead}${first}${inner}${last}${trail}`;

      const initials = getInitials(name);
      const label = `name ${JSON.stringify(name)} (i=${i})`;

      expect(initials, `${label} should not be empty`).not.toBe("");
      expect(
        initials.length,
        `${label} -> ${JSON.stringify(initials)} should be at most 2 chars`,
      ).toBeLessThanOrEqual(2);
      // Every generated name contains at least one word, so "?" is never right.
      expect(initials, `${label} should not degrade to "?"`).not.toBe("?");

      const letters = initials.match(/\p{L}/gu) ?? [];
      for (const letter of letters) {
        expect(
          letter,
          `initial ${JSON.stringify(letter)} of ${label} should be uppercase`,
        ).toBe(letter.toUpperCase());
      }
    }
  });
});
