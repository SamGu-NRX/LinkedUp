// src/lib/demo/demo-views.ts
//
// Explicit mapping from the demo's branded sample identities to the plain
// view-model shapes the shared, provider-free components accept
// (UserInfo for UserCard, User for TopBar/VideoArea).
//
// These are display copies only: the branded identity never leaks past the
// mapper, and no field here is ever sent to or read from a service.

import type { UserInfo, ConnectionStatus } from "@/types/user";
import type { User } from "@/types/meeting";
import type { SamplePersona, SampleProfile } from "./sample-identity";

/** Display view of the sample visitor's own tile. */
export const SAMPLE_VISITOR_VIEW: Readonly<Pick<UserInfo, "id" | "name">> & {
  readonly sampleLabel: string;
} = {
  id: "sample-visitor",
  name: "Sample visitor (you)",
  sampleLabel: "simulated preview",
};

/**
 * Map a sample persona to the shared UserCard's prop shape. The persona's
 * sample-ness is part of the mapped copy, so the card can never present the
 * persona as a real person even before badges are added.
 */
export function toUserCardView(persona: SamplePersona): UserInfo {
  return {
    id: persona.id,
    name: `${persona.name} (sample persona)`,
    avatar: null, // generated locally from the id — never a remote image
    bio: persona.bio,
    profession: persona.profession,
    company: persona.company,
    school: "Sample University (fictional)",
    experience: persona.experience,
    sharedInterests: persona.interests.map((interest) => ({ ...interest })),
    connectionType: persona.connectionType,
    connectionStatus: "good" satisfies ConnectionStatus,
    isBot: true, // the shared card marks fixtures; sample personas are fixtures
    meetingStats: {
      totalMeetings: 0,
      totalMinutes: 0,
      averageRating: 0,
    },
  };
}

/**
 * Map a sample persona to the shared meeting User shape used by TopBar and
 * VideoArea. Keys follow the production room's `you` / `partner` convention.
 */
export function toMeetingUserViews(
  persona: SamplePersona,
): { you: User; partner: User } {
  return {
    you: {
      id: "you",
      name: "Sample visitor (you)",
      avatar: "", // VideoArea renders placeholder tiles; no image is fetched
      role: "Visitor (sample mode)",
      company: "—",
      interests: [],
      meetingStats: { totalMeetings: 0, totalMinutes: 0, averageRating: 0 },
    },
    partner: {
      id: persona.id,
      name: `${persona.name} — sample persona`,
      avatar: "",
      role: persona.profession,
      company: persona.company,
      interests: persona.interests.map((interest) => interest.name),
      meetingStats: { totalMeetings: 0, totalMinutes: 0, averageRating: 0 },
    },
  };
}

/** Synthetic connection quality shown on the sample tiles — fixed, not measured. */
export const SAMPLE_CONNECTION_STATES = {
  you: { status: "good", latency: 0 },
  partner: { status: "good", latency: 0 },
} as const;

/** Shared interests between the visitor's chosen profile and the persona. */
export function sharedInterestNames(
  profile: SampleProfile,
  persona: SamplePersona,
): string[] {
  const profileNames = new Set(profile.interests.map((i) => i.name.toLowerCase()));
  return persona.interests
    .filter((interest) => profileNames.has(interest.name.toLowerCase()))
    .map((interest) => interest.name);
}
