import { describe, expect, it } from "vitest";
import { getStatusColor } from "@/data/avatar-utils";
import type { ConnectionStatus } from "@/types/user";

// The parameter type only admits valid ConnectionStatus values, but the switch's
// default branch exists for arbitrary runtime strings (demo data, API drift), so
// out-of-contract probes are cast through the parameter type on purpose.
const asStatusInput = (
  value: string | null | undefined,
): ConnectionStatus | null | undefined => value as ConnectionStatus;

describe("getStatusColor", () => {
  it('renders an emerald dot for "online"', () => {
    expect(getStatusColor("online")).toBe("bg-emerald-500");
  });

  it('renders an amber dot for "away"', () => {
    expect(getStatusColor("away")).toBe("bg-amber-400");
  });

  it('renders a dark gray dot for "offline"', () => {
    expect(getStatusColor("offline")).toBe("bg-gray-500");
  });

  it("renders the fallback dot for undefined status", () => {
    expect(getStatusColor(undefined)).toBe("bg-gray-400");
  });

  it("renders the fallback dot for null status", () => {
    expect(getStatusColor(null)).toBe("bg-gray-400");
  });

  it.each(["busy", "", "Online", "dnd"])(
    "renders the fallback dot for unknown status %j",
    (status) => {
      expect(getStatusColor(asStatusInput(status))).toBe("bg-gray-400");
    },
  );

  it("returns a single Tailwind bg shade class for every probed status", () => {
    const probes: (string | null | undefined)[] = [
      "online",
      "away",
      "offline",
      undefined,
      null,
      "busy",
      "",
      "Online",
      "dnd",
    ];

    for (const status of probes) {
      expect(getStatusColor(asStatusInput(status))).toMatch(
        /^bg-[a-z]+-[0-9]+$/,
      );
    }
  });
});
