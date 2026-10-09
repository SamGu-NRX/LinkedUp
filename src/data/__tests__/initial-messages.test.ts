import { describe, expect, it } from "vitest";
import { initialMessages, profiles } from "@/data/profiles";

// Locks the observable contract of initialMessages against the profiles array.
// Consumer: MyConnections.tsx seeds useState(initialMessages) and renders
// formatTime(message.timestamp) per message; senderId "user" is the local user.
// Timestamps are Date.now()-relative at module load, so the future-dated check
// carries a 60s tolerance for slow test starts.

const conversationKeys = Object.keys(initialMessages).sort();
const profileIds = profiles.map((profile) => profile.id).sort();

// "?? []" keeps this module-level list resilient: a conversation replaced by
// undefined at runtime would otherwise throw here and mask the dedicated
// "stores an array" assertion below.
const allMessages = conversationKeys.flatMap((key) => initialMessages[key] ?? []);

describe("initialMessages", () => {
  it("has exactly one conversation per profile id (no missing keys, no orphans)", () => {
    expect(conversationKeys).toEqual(profileIds);
  });

  it("stores an array for every conversation (never undefined)", () => {
    for (const key of conversationKeys) {
      const value: unknown = initialMessages[key];
      expect(
        Array.isArray(value),
        `initialMessages["${key}"] should be an array`,
      ).toBe(true);
    }
  });

  it("every message has a non-empty string id, content, and senderId", () => {
    for (const message of allMessages) {
      for (const field of ["id", "content", "senderId"] as const) {
        const value: unknown = message[field];
        expect(
          typeof value,
          `message.${field} should be a string (got ${typeof value})`,
        ).toBe("string");
        // Reached only after the type assertion passed, so the cast is safe.
        expect(
          (value as string).trim().length,
          `message.${field} should be non-empty`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("every message has a finite numeric timestamp >= 0", () => {
    for (const message of allMessages) {
      expect(
        Number.isFinite(message.timestamp),
        `message "${message.id}" timestamp should be a finite number`,
      ).toBe(true);
      expect(
        message.timestamp,
        `message "${message.id}" timestamp should not be negative`,
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it("timestamps strictly ascend within each conversation (index order = chronological)", () => {
    for (const key of conversationKeys) {
      const timestamps = initialMessages[key].map((message) => message.timestamp);
      for (let i = 1; i < timestamps.length; i++) {
        expect(
          timestamps[i],
          `conversation "${key}": message at index ${i} must be newer than index ${i - 1}`,
        ).toBeGreaterThan(timestamps[i - 1]);
      }
    }
  });

  it("every senderId is the local user or the conversation's own profile", () => {
    for (const key of conversationKeys) {
      for (const message of initialMessages[key]) {
        expect(
          message.senderId === "user" || message.senderId === key,
          `message "${message.id}" senderId ${JSON.stringify(message.senderId)} must be "user" or "${key}"`,
        ).toBe(true);
      }
    }
  });

  it("message ids are unique across all conversations combined", () => {
    const ids = allMessages.map((message) => message.id);
    expect(new Set(ids).size, `duplicate message ids: ${ids.join(", ")}`).toBe(
      ids.length,
    );
  });

  it("no timestamp is in the future beyond a 60s module-load tolerance", () => {
    for (const message of allMessages) {
      expect(
        message.timestamp,
        `message "${message.id}" timestamp is unrealistically far in the future`,
      ).toBeLessThanOrEqual(Date.now() + 60_000);
    }
  });
});
