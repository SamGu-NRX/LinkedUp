import { describe, expect, it } from "vitest";
import { generateAvatarDataUrl } from "@/data/avatar-utils";

const DATA_URL_PREFIX = "data:image/svg+xml;charset=utf8,";

/**
 * Decode the wire payload of a generateAvatarDataUrl result back to its SVG
 * source — the same single decodeURIComponent a browser applies to a data URL.
 */
function decodeSvg(dataUrl: string): string {
  expect(dataUrl.startsWith(DATA_URL_PREFIX)).toBe(true);
  return decodeURIComponent(dataUrl.slice(DATA_URL_PREFIX.length));
}

/** Collect every 6-char hex stop-color value from an SVG source string. */
function extractStops(svg: string): string[] {
  const re = /stop-color='#([0-9a-f]{6})'/g;
  const stops: string[] = [];
  for (let match = re.exec(svg); match !== null; match = re.exec(svg)) {
    stops.push(match[1]);
  }
  return stops;
}

/** Extract the gradient rotation angle, or null when absent. */
function extractRotate(svg: string): number | null {
  const match = svg.match(/gradientTransform='rotate\((\d+)\)'/);
  return match ? Number(match[1]) : null;
}

describe("generateAvatarDataUrl", () => {
  it("returns a data URL with the svg+xml;charset=utf8 prefix", () => {
    expect(generateAvatarDataUrl("user-123").startsWith(DATA_URL_PREFIX)).toBe(
      true,
    );
  });

  it("references the gradient with a single encoding: decoded SVG says fill='url(#g)' with no %23 or %2523 left", () => {
    const svg = decodeSvg(generateAvatarDataUrl("user-123"));
    expect(svg).toContain("fill='url(#g)'");
    expect(svg).not.toContain("%23");
    expect(svg).not.toContain("%2523");
  });

  // Expected hex pairs pinned from the gradient table + getTailwindColor map:
  // seed "a" hashes to 97 (gradient index 7: green-400/emerald-600),
  // "user-123" hashes to 642 (index 2: emerald-400/teal-600),
  // 0 hashes to 0 (index 0: violet-500/purple-700 -> 8b5cf6/7e22ce).
  it.each([
    { seed: "a", from: "4ade80", to: "059669" },
    { seed: "user-123", from: "34d399", to: "0d9488" },
    { seed: 0, from: "8b5cf6", to: "7e22ce" },
  ])(
    "emits exactly two stops, from hex then to hex of the selected gradient (seed $seed)",
    ({ seed, from, to }) => {
      const svg = decodeSvg(generateAvatarDataUrl(seed));
      const stops = extractStops(svg);
      expect(stops).toHaveLength(2);
      expect(stops[0]).not.toBe(stops[1]);
      expect(stops).toEqual([from, to]);
    },
  );

  it("rotates the gradient deterministically from the seed", () => {
    // Same seed -> byte-identical URL.
    expect(generateAvatarDataUrl("user-123")).toBe(
      generateAvatarDataUrl("user-123"),
    );

    // "a" and 97 hash identically (char code of "a" is 97), so both the
    // gradient and the rotation angle must agree.
    expect(generateAvatarDataUrl("a")).toBe(generateAvatarDataUrl(97));
    const angleFromA = extractRotate(decodeSvg(generateAvatarDataUrl("a")));
    const angleFrom97 = extractRotate(decodeSvg(generateAvatarDataUrl(97)));
    expect(angleFromA).toBe(angleFrom97);
    expect(angleFromA).toBe(97);

    // rotate(<angle>) is present, and different seeds can give different angles.
    const seeds: (string | number)[] = ["a", "b", "user-123", 0, 42];
    for (const seed of seeds) {
      const svg = decodeSvg(generateAvatarDataUrl(seed));
      expect(extractRotate(svg)).not.toBeNull();
    }
    const angles = new Set(
      seeds.map((seed) =>
        extractRotate(decodeSvg(generateAvatarDataUrl(seed))),
      ),
    );
    expect(angles.size).toBeGreaterThan(1);
  });

  it("decodes to an SVG with one linearGradient id='g' and one rect that references url(#g)", () => {
    const svg = decodeSvg(generateAvatarDataUrl("user-123"));
    expect(svg.match(/<linearGradient\b/g) ?? []).toHaveLength(1);
    expect(svg).toContain("<linearGradient id='g'");
    expect(svg.match(/<rect\b/g) ?? []).toHaveLength(1);
    expect(svg).toContain("<rect width='100' height='100' fill='url(#g)'");
  });
});
