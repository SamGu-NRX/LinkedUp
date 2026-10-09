import { describe, expect, it } from "vitest";
import { formatTime } from "@/data/avatar-utils";

// Contract: formatted locale time (HH:MM-ish) or "" when the timestamp is invalid.
// Locale-tolerant assertions only — never hard-code hour12 or a timezone.
const TIME_LIKE = /^\d{1,2}:\d{2}/;

describe("formatTime", () => {
  it("returns an empty string for NaN", () => {
    expect(formatTime(NaN)).toBe("");
  });

  it("returns an empty string for Infinity", () => {
    expect(formatTime(Infinity)).toBe("");
  });

  it("returns an empty string for -Infinity", () => {
    expect(formatTime(-Infinity)).toBe("");
  });

  it("formats valid Date.UTC timestamps as a time-like string", () => {
    const samples = [
      Date.UTC(2026, 0, 1, 0, 7),
      Date.UTC(2026, 5, 15, 9, 41),
      Date.UTC(2026, 5, 15, 13, 5),
      Date.UTC(2026, 11, 31, 23, 59),
    ];

    for (const timestamp of samples) {
      expect(formatTime(timestamp)).toMatch(TIME_LIKE);
    }
  });

  it('formats timestamp 0 and pre-1970 timestamps without "Invalid"', () => {
    for (const timestamp of [0, -86_400_000]) {
      const out = formatTime(timestamp);
      expect(out).not.toContain("Invalid");
      expect(out).toMatch(TIME_LIKE);
    }
  });

  it('never returns "Invalid" or throws across 500 finite timestamps spanning epoch to year 275760', () => {
    const MAX_FINITE_MS = 8_640_000_000_000_000; // Date constructor limit (year ~275760)

    for (let i = 0; i < 500; i++) {
      const timestamp = (i / 499) * MAX_FINITE_MS;
      // A throw propagates and fails the test — formatTime must never throw.
      expect(formatTime(timestamp)).not.toContain("Invalid");
    }
  });
});
