import { describe, expect, it } from "vitest";
import { generateAvatarDataUrl } from "@/data/avatar-utils";

// generateAvatarDataUrl is the public window onto the private getTailwindColor
// map: whatever hex a gradient class resolves to ends up embedded in the SVG's
// two <stop> elements. These tests read that rendering back out and prove the
// map covers every gradient generateAvatarColor can produce. If a class is
// ever missing from the map, getTailwindColor silently falls back to "6366f1"
// and the avatar loses its intended color with no error raised anywhere —
// which is exactly what the non-fallback assertions below guard against.

const FALLBACK_HEX = "6366f1"; // hard-coded default inside getTailwindColor
const SVG_DATA_URL_PREFIX = "data:image/svg+xml;charset=utf8,";

// ids 0..9: numeric seeds hash to themselves, so each id picks its own gradient
const GRADIENT_IDS = Array.from({ length: 10 }, (_, id) => id);

/** Pull the two gradient stop colors out of a generated avatar data URL. */
const extractStopColors = (dataUrl: string): string[] => {
  if (!dataUrl.startsWith(SVG_DATA_URL_PREFIX)) {
    throw new Error(`expected an SVG data URL, got: ${dataUrl.slice(0, 60)}`);
  }
  const svg = decodeURIComponent(dataUrl.slice(SVG_DATA_URL_PREFIX.length));
  // Hex case carries no meaning in SVG colors; normalize for comparisons.
  return [...svg.matchAll(/stop-color='#([^']+)'/g)].map((m) =>
    m[1].toLowerCase(),
  );
};

describe("generateAvatarDataUrl color-map coverage", () => {
  it.each(GRADIENT_IDS)(
    "gradient %i renders two distinct stops, neither the missing-entry fallback",
    (id) => {
      const stops = extractStopColors(generateAvatarDataUrl(id));

      expect(stops, `id ${id}: expected exactly 2 gradient stops`).toHaveLength(
        2,
      );
      for (const stop of stops) {
        expect(stop, `id ${id}: stop is not 6-char hex`).toMatch(
          /^[0-9a-f]{6}$/,
        );
        expect(
          stop,
          `id ${id}: ${stop} is the fallback — a gradient class is missing from the private color map`,
        ).not.toBe(FALLBACK_HEX);
      }
      expect(stops[0], `id ${id}: from/to stops are identical`).not.toBe(
        stops[1],
      );
    },
  );

  it("the 10 gradients resolve to 10 distinct from/to hex pairs", () => {
    const pairs = GRADIENT_IDS.map((id) => {
      const [from, to] = extractStopColors(generateAvatarDataUrl(id));
      return `${from}->${to}`;
    });

    expect(
      new Set(pairs).size,
      `expected 10 distinct pairs, got: ${pairs.join(", ")}`,
    ).toBe(10);
  });
});
