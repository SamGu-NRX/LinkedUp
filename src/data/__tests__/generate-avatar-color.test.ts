import { describe, expect, it } from "vitest";

import { generateAvatarColor } from "@/data/avatar-utils";

// Independent re-implementation of the documented string-hash contract: the
// gradient index for a string id is the sum of its character codes.
const charCodeSum = (id: string): number =>
  id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);

const signature = (color: { from: string; to: string; text: string }): string =>
  `${color.from}|${color.to}|${color.text}`;

describe("generateAvatarColor", () => {
  it("returns the identical triple when called twice with the same id", () => {
    expect(generateAvatarColor("user-42")).toEqual(
      generateAvatarColor("user-42"),
    );
    expect(generateAvatarColor(7)).toEqual(generateAvatarColor(7));
  });

  it("maps a string id to the gradient of its character-code sum", () => {
    // "abc" hashes to 97 + 98 + 99 = 294.
    expect(charCodeSum("abc")).toBe(294);
    expect(generateAvatarColor("abc")).toEqual(generateAvatarColor(294));

    for (const id of ["LinkedUp", "sam-gu", "Sgu07966"]) {
      expect(generateAvatarColor(id)).toEqual(
        generateAvatarColor(charCodeSum(id)),
      );
    }
  });

  it("maps numeric ids 0 through 9 to ten distinct gradients", () => {
    const triples = Array.from({ length: 10 }, (_, id) =>
      generateAvatarColor(id),
    );
    expect(new Set(triples.map(signature)).size).toBe(10);
  });

  it("returns non-empty from-/to-/text- prefixed Tailwind classes for every id", () => {
    const ids: Array<string | number> = [
      0,
      3,
      9,
      12345,
      "a",
      "",
      "user-9",
      "S@M!",
    ];
    for (const id of ids) {
      const color = generateAvatarColor(id);
      expect(color.from).toMatch(/^from-.+/);
      expect(color.to).toMatch(/^to-.+/);
      expect(color.text).toMatch(/^text-.+/);
    }
  });

  it("maps a single-character string id to its character code's gradient", () => {
    expect(generateAvatarColor("a")).toEqual(generateAvatarColor(97));
  });

  it("hashes digit strings by character code, not numeric value", () => {
    // "5" hashes as the char code 53, so it must NOT collide with the number 5.
    expect(generateAvatarColor("5")).toEqual(generateAvatarColor(53));
    expect(generateAvatarColor("5")).not.toEqual(generateAvatarColor(5));
  });

  it("maps the empty string to the zero-hash gradient", () => {
    expect(generateAvatarColor("")).toEqual(generateAvatarColor(0));
  });
});
