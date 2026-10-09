import { describe, expect, it } from "vitest";
import { mockUsers } from "@/data/mock-users";

// Runtime mirror of the UserInfo contract declared in src/types/user.ts.
// TypeScript types are erased at runtime, so these tests re-assert the
// schema against the actual exported data — in particular connectionStatus,
// which must be one of the declared ConnectionStatus values
// ("online" | "away" | "offline") and not UI-quality words like
// "excellent" or "good".

const VALID_CONNECTION_STATUSES: readonly string[] = ["online", "away", "offline"];
const VALID_CONNECTION_TYPES: readonly string[] = ["b2b", "collaboration", "mentorship", "investment"];

const isOneOf = (value: unknown, allowed: readonly string[]): boolean =>
  typeof value === "string" && allowed.includes(value);

describe("mockUsers schema (runtime mirror of UserInfo)", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(mockUsers)).toBe(true);
    expect(mockUsers.length).toBeGreaterThan(0);
  });

  it("assigns unique, non-empty ids and non-empty names", () => {
    const ids = mockUsers.map((user) => user.id);
    for (const id of ids) {
      expect(typeof id === "string" && id.length > 0, `id should be a non-empty string, got ${JSON.stringify(id)}`).toBe(true);
    }
    expect(new Set(ids).size, "ids must be unique").toBe(ids.length);

    for (const user of mockUsers) {
      expect(typeof user.name === "string" && user.name.length > 0, `name for ${user.id} should be non-empty`).toBe(true);
    }
  });

  it("defines every required field with the correct type", () => {
    for (const user of mockUsers) {
      // typeof checks double as presence checks: a missing field is
      // undefined and fails the assertion.
      expect(typeof user.id, `id for ${user.id}`).toBe("string");
      expect(typeof user.name, `name for ${user.id}`).toBe("string");
      expect(typeof user.bio, `bio for ${user.id}`).toBe("string");
      expect(typeof user.profession, `profession for ${user.id}`).toBe("string");
      expect(typeof user.company, `company for ${user.id}`).toBe("string");
      expect(typeof user.school, `school for ${user.id}`).toBe("string");
      expect(typeof user.experience, `experience for ${user.id}`).toBe("number");
      expect(Array.isArray(user.sharedInterests), `sharedInterests for ${user.id}`).toBe(true);
      expect(isOneOf(user.connectionType, VALID_CONNECTION_TYPES), `connectionType for ${user.id} must be one of ${VALID_CONNECTION_TYPES.join("|")}`).toBe(true);
    }
  });

  it("types optional fields correctly when present", () => {
    for (const user of mockUsers) {
      const avatarOk = user.avatar === null || typeof user.avatar === "string";
      expect(avatarOk, `avatar for ${user.id} must be string|null`).toBe(true);

      if (user.isBot !== undefined) {
        expect(typeof user.isBot, `isBot for ${user.id}`).toBe("boolean");
      }
      if (user.interests !== undefined) {
        expect(Array.isArray(user.interests), `interests for ${user.id}`).toBe(true);
        for (const interest of user.interests) {
          expect(typeof interest, `interests entries for ${user.id}`).toBe("string");
        }
      }
      if (user.isSpeaking !== undefined) {
        expect(typeof user.isSpeaking, `isSpeaking for ${user.id}`).toBe("boolean");
      }
    }
  });

  it("keeps meetingStats non-negative and averageRating within [0, 5]", () => {
    for (const user of mockUsers) {
      if (user.meetingStats === undefined) continue;
      const { totalMeetings, totalMinutes, averageRating } = user.meetingStats;
      expect(typeof totalMeetings, `totalMeetings for ${user.id}`).toBe("number");
      expect(totalMeetings, `totalMeetings for ${user.id}`).toBeGreaterThanOrEqual(0);
      expect(typeof totalMinutes, `totalMinutes for ${user.id}`).toBe("number");
      expect(totalMinutes, `totalMinutes for ${user.id}`).toBeGreaterThanOrEqual(0);
      expect(typeof averageRating, `averageRating for ${user.id}`).toBe("number");
      expect(averageRating, `averageRating for ${user.id}`).toBeGreaterThanOrEqual(0);
      expect(averageRating, `averageRating for ${user.id}`).toBeLessThanOrEqual(5);
    }
  });

  it("gives every sharedInterest a non-empty name and a type", () => {
    for (const user of mockUsers) {
      for (const interest of user.sharedInterests) {
        expect(
          typeof interest.name === "string" && interest.name.length > 0,
          `sharedInterest name for ${user.id} should be non-empty`
        ).toBe(true);
        expect(
          typeof interest.type === "string" && interest.type.length > 0,
          `sharedInterest type for ${user.id} should be present`
        ).toBe(true);
      }
    }
  });

  it("uses only declared ConnectionStatus values for connectionStatus", () => {
    const offenders = mockUsers
      .filter((user) => !isOneOf(user.connectionStatus, VALID_CONNECTION_STATUSES))
      .map((user) => `${user.id}: ${JSON.stringify(user.connectionStatus)}`);
    expect(offenders, `connectionStatus must be one of ${VALID_CONNECTION_STATUSES.join("|")}`).toEqual([]);
  });
});
