// src/lib/demo/demo-adapter.test.ts
//
// The sample adapter's suite: synthetic identity integrity (Sampleton cast,
// prefixed branded ids, deterministic pairing) and the view-model mappings
// the demo feeds to shared, provider-free components.

import { describe, expect, it } from "vitest";
import { getInitials } from "@/lib/avatar-utils";
import {
  SAMPLE_PERSONAS,
  SAMPLE_PROFILES,
  samplePersonaForProfile,
  sampleProfileById,
} from "./sample-personas";
import {
  resolveSampleMediaCheck,
  sampleAudioLevel,
  sampleSpeakingPattern,
} from "./sample-media";
import {
  sharedInterestNames,
  toMeetingUserViews,
  toUserCardView,
} from "./demo-views";
import { samplePersonaId, sampleProfileId } from "./sample-identity";

describe("synthetic identity integrity", () => {
  it("constructs branded ids with the explicit sample prefixes", () => {
    expect(samplePersonaId("test")).toBe("sample-persona:test");
    expect(sampleProfileId("test")).toBe("sample-profile:test");
  });

  it("ships three fictional profiles and three fictional personas", () => {
    expect(SAMPLE_PROFILES).toHaveLength(3);
    expect(SAMPLE_PERSONAS).toHaveLength(3);
    for (const profile of SAMPLE_PROFILES) {
      expect(profile.id).toMatch(/^sample-profile:/);
      expect(profile.label.length).toBeGreaterThan(0);
      expect(profile.interests.length).toBeGreaterThan(0);
    }
    for (const persona of SAMPLE_PERSONAS) {
      expect(persona.id).toMatch(/^sample-persona:/);
      expect(persona.name).toContain("Sampleton");
      expect(persona.name.startsWith("user_")).toBe(false);
      expect(persona.conversationStarter.length).toBeGreaterThan(0);
    }
  });

  it("pairs each profile with a distinct persona, deterministically", () => {
    const paired = SAMPLE_PROFILES.map((profile) => samplePersonaForProfile(profile.id));
    const unique = new Set(paired.map((persona) => persona.id));
    expect(unique.size).toBe(SAMPLE_PROFILES.length);
    for (const profile of SAMPLE_PROFILES) {
      expect(samplePersonaForProfile(profile.id)).toBe(
        samplePersonaForProfile(profile.id),
      );
    }
  });

  it("falls back to the first persona for unknown ids instead of dead-ending", () => {
    expect(samplePersonaForProfile(sampleProfileId("nonexistent"))).toBe(
      SAMPLE_PERSONAS[0],
    );
  });

  it("resolves profiles by id", () => {
    expect(sampleProfileById(SAMPLE_PROFILES[1].id)).toBe(SAMPLE_PROFILES[1]);
    expect(sampleProfileById(sampleProfileId("missing"))).toBeUndefined();
  });
});

describe("view-model mappings for shared components", () => {
  it("maps a persona to the shared UserCard shape with sample labelling baked in", () => {
    const view = toUserCardView(SAMPLE_PERSONAS[0]);
    expect(view.name).toContain("sample persona");
    expect(view.name).toContain(SAMPLE_PERSONAS[0].name);
    expect(view.isBot).toBe(true);
    expect(view.avatar).toBeNull();
    expect(view.bio).toBe(SAMPLE_PERSONAS[0].bio);
    expect(view.experience).toBe(SAMPLE_PERSONAS[0].experience);
    expect(view.sharedInterests).toEqual([...SAMPLE_PERSONAS[0].interests]);
  });

  it("maps the visitor and persona to the meeting User shapes with sample labels", () => {
    const { you, partner } = toMeetingUserViews(SAMPLE_PERSONAS[0]);
    expect(you.name).toContain("Sample visitor");
    expect(partner.name).toContain("sample persona");
    expect(partner.name).toContain(SAMPLE_PERSONAS[0].name);
    expect(partner.role).toBe(SAMPLE_PERSONAS[0].profession);
    expect(partner.interests.length).toBeGreaterThan(0);
  });

  it("computes shared interests between profile and persona case-insensitively", () => {
    const shared = sharedInterestNames(SAMPLE_PROFILES[0], SAMPLE_PERSONAS[0]);
    expect(shared).toContain("Design systems");
    expect(shared).toContain("Accessibility");
    expect(shared).not.toContain("Developer tools");
  });
});

describe("inert media adapter", () => {
  it("returns labelled generated visuals for the ok script", () => {
    const result = resolveSampleMediaCheck("ok", SAMPLE_PERSONAS[0]);
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.visitorFrame.kind).toBe("generated-visual");
    expect(result.visitorFrame.label).toMatch(/simulated/i);
    expect(result.visitorFrame.label).toMatch(/no camera/i);
    expect(result.partnerFrame.label).toMatch(/sample persona/i);
    expect(result.partnerFrame.initials).toBe(getInitials(SAMPLE_PERSONAS[0].name));
  });

  it("returns readable rehearsed reasons for the two device-check failures", () => {
    const unavailable = resolveSampleMediaCheck("media-unavailable", SAMPLE_PERSONAS[0]);
    expect(unavailable.outcome).toBe("media-unavailable");
    if (unavailable.outcome === "media-unavailable") {
      expect(unavailable.reason).toMatch(/no camera/i);
      expect(unavailable.reason).toMatch(/nothing is broken|rehearsed/i);
    }
    const refused = resolveSampleMediaCheck("permission-refused", SAMPLE_PERSONAS[0]);
    expect(refused.outcome).toBe("permission-refused");
    if (refused.outcome === "permission-refused") {
      expect(refused.reason).toMatch(/permission was refused/i);
      expect(refused.reason).toMatch(/never requested|rehearsed/i);
    }
  });

  it("produces deterministic scripted audio levels within [0, 1]", () => {
    for (const tick of [0, 3, 7, 12, 45]) {
      const level = sampleAudioLevel(tick);
      expect(level.level).toBeGreaterThanOrEqual(0);
      expect(level.level).toBeLessThanOrEqual(1);
      expect(level).toEqual(sampleAudioLevel(tick));
    }
  });

  it("produces a deterministic speaking pattern", () => {
    expect(sampleSpeakingPattern(0)).toEqual({ you: true, partner: true });
    expect(sampleSpeakingPattern(3)).toEqual(sampleSpeakingPattern(3));
  });
});
