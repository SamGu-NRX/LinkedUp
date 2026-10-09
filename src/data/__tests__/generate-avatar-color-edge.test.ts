import { describe, expect, it } from "vitest";
import { generateAvatarColor, generateAvatarDataUrl } from "@/data/avatar-utils";

// The 10 canonical gradient triples, indexed by numeric id 0..9. A result is
// "valid" only if it deep-matches one of these; anything else (undefined,
// a partial shape, an out-of-set object) is a defect.
const canonicalTriples = Array.from({ length: 10 }, (_, i) => generateAvatarColor(i));

// Both sides are plain {from,to,text} literals built by the same module, so a
// JSON string comparison is a faithful deep-equality check here.
const isKnownTriple = (candidate: unknown): boolean =>
  typeof candidate === "object" &&
  candidate !== null &&
  canonicalTriples.some((t) => JSON.stringify(t) === JSON.stringify(candidate));

describe("generateAvatarColor with hostile numeric ids", () => {
  it.each([-3, -1, -10])(
    "returns a valid gradient triple for negative id %d",
    (id) => {
      const result = generateAvatarColor(id);
      expect(isKnownTriple(result)).toBe(true);
    },
  );

  it("maps -0 to the same triple as id 0", () => {
    expect(generateAvatarColor(-0)).toEqual(generateAvatarColor(0));
  });

  it("maps NaN to index 0 (same triple as id 0)", () => {
    expect(generateAvatarColor(NaN)).toEqual(generateAvatarColor(0));
  });

  it("uses absolute-value semantics: generateAvatarColor(-3) equals generateAvatarColor(3)", () => {
    expect(generateAvatarColor(-3)).toEqual(generateAvatarColor(3));
  });
});

describe("generateAvatarDataUrl with hostile numeric seeds", () => {
  it("returns a data URL for seed -3 that never contains 'undefined'", () => {
    const url = generateAvatarDataUrl(-3);
    expect(typeof url).toBe("string");
    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    expect(url).not.toContain("undefined");
  });
});

describe("generateAvatarColor guard: valid-input behavior unchanged", () => {
  it("numeric ids 0..9 still produce ten distinct gradient triples", () => {
    const distinct = new Set(
      Array.from({ length: 10 }, (_, i) => JSON.stringify(generateAvatarColor(i))),
    );
    expect(distinct.size).toBe(10);
  });

  it("string hash still depends only on the sum of char codes ('ab' === 'ba')", () => {
    expect(generateAvatarColor("ab")).toEqual(generateAvatarColor("ba"));
  });

  it("large positive numeric ids still select a valid gradient triple", () => {
    expect(isKnownTriple(generateAvatarColor(123456789))).toBe(true);
  });
});
