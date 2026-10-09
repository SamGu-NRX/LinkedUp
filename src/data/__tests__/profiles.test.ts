import { describe, expect, it } from "vitest";
import { profiles } from "@/data/profiles";

// Locked invariants for the demo data behind MyConnections. The dashboard
// seeds activeProfile = profiles[0] and renders the whole array, so a single
// malformed entry breaks the connections screen at mount time. These tests
// assert the observable contract of the data, not its implementation.

const VALID_STATUSES = ["online", "away", "offline"] as const;
const VALID_INTEREST_TYPES = ["academic", "industry", "skill"] as const;
const VALID_CONNECTION_TYPES = [
  "b2b",
  "collaboration",
  "mentorship",
  "investment",
] as const;

// Public effect of the private generateAvatarId: lowercase the name and turn
// every whitespace run into a single dash.
const expectedAvatarId = (name: string): string =>
  name.toLowerCase().replace(/\s+/g, "-");

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

describe("profiles data invariants", () => {
  it("exports at least one profile so the dashboard can seed activeProfile from profiles[0]", () => {
    expect(
      profiles.length,
      "profiles must not be empty: MyConnections reads profiles[0] on mount"
    ).toBeGreaterThan(0);
  });

  it("gives every profile a unique, non-empty string id", () => {
    const ids = profiles.map((profile) => profile.id);
    ids.forEach((id, index) => {
      expect(
        isNonEmptyString(id),
        `profiles[${index}].id must be a non-empty string, got ${JSON.stringify(id)}`
      ).toBe(true);
    });
    expect(new Set(ids).size, "profile ids must be unique").toBe(ids.length);
  });

  it("limits every profile status to online, away or offline", () => {
    profiles.forEach((profile, index) => {
      expect(
        VALID_STATUSES,
        `profiles[${index}].status ${JSON.stringify(profile.status)} is not an allowed status`
      ).toContain(profile.status);
    });
  });

  it("derives every avatar id from the profile name (lowercase, whitespace runs as dashes)", () => {
    profiles.forEach((profile, index) => {
      expect(
        profile.avatar,
        `profiles[${index}].avatar must equal generateAvatarId(profile.name)`
      ).toBe(expectedAvatarId(profile.name));
    });
  });

  it("stores lastCallDate as a YYYY-MM-DD string that parses to a real date", () => {
    profiles.forEach((profile, index) => {
      expect(
        profile.lastCallDate,
        `profiles[${index}].lastCallDate must match YYYY-MM-DD`
      ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(
        Number.isNaN(new Date(profile.lastCallDate).getTime()),
        `profiles[${index}].lastCallDate must parse to a real date, got ${JSON.stringify(profile.lastCallDate)}`
      ).toBe(false);
    });
  });

  it("gives every profile at least one shared interest with a valid type and non-empty name", () => {
    profiles.forEach((profile, index) => {
      expect(
        profile.sharedInterests.length,
        `profiles[${index}].sharedInterests must contain at least one entry`
      ).toBeGreaterThan(0);
      profile.sharedInterests.forEach((interest, interestIndex) => {
        expect(
          VALID_INTEREST_TYPES,
          `profiles[${index}].sharedInterests[${interestIndex}].type ${JSON.stringify(interest.type)} is not an allowed type`
        ).toContain(interest.type);
        expect(
          isNonEmptyString(interest.name),
          `profiles[${index}].sharedInterests[${interestIndex}].name must be a non-empty string`
        ).toBe(true);
      });
    });
  });

  it("reports a non-negative integer experience for every profile", () => {
    profiles.forEach((profile, index) => {
      expect(
        Number.isInteger(profile.experience) && profile.experience >= 0,
        `profiles[${index}].experience must be an integer >= 0, got ${profile.experience}`
      ).toBe(true);
    });
  });

  it("fills bio, profession, company and school with non-empty strings for every profile", () => {
    const textFields = ["bio", "profession", "company", "school"] as const;
    profiles.forEach((profile, index) => {
      textFields.forEach((field) => {
        expect(
          isNonEmptyString(profile[field]),
          `profiles[${index}].${field} must be a non-empty string, got ${JSON.stringify(profile[field])}`
        ).toBe(true);
      });
    });
  });

  it("limits every connectionType to b2b, collaboration, mentorship or investment", () => {
    profiles.forEach((profile, index) => {
      expect(
        VALID_CONNECTION_TYPES,
        `profiles[${index}].connectionType ${JSON.stringify(profile.connectionType)} is not an allowed connectionType`
      ).toContain(profile.connectionType);
    });
  });
});
