// src/lib/demo/sample-personas.ts
//
// The demo's synthetic cast. Every entry is explicitly a sample: names carry
// the "Sampleton" surname and every surface that renders one must also show
// a sample badge. Nothing here is fetched, persisted, or derived from real
// accounts — the data is compiled into the bundle.

import { samplePersonaId, sampleProfileId, type SamplePersona, type SampleProfile } from "./sample-identity";

export const SAMPLE_PROFILES: readonly SampleProfile[] = [
  {
    id: sampleProfileId("design-systems"),
    label: "Design systems and accessibility",
    description:
      "For the sample flow, this profile stands in for a visitor who cares about inclusive interfaces.",
    interests: [
      { type: "skill", name: "Design systems" },
      { type: "skill", name: "Accessibility" },
      { type: "academic", name: "Human-computer interaction" },
    ],
  },
  {
    id: sampleProfileId("data-ml"),
    label: "Data and applied machine learning",
    description:
      "For the sample flow, this profile stands in for a visitor who works with data day to day.",
    interests: [
      { type: "academic", name: "Machine learning" },
      { type: "skill", name: "Python" },
      { type: "industry", name: "Analytics" },
    ],
  },
  {
    id: sampleProfileId("founders"),
    label: "Early-stage products",
    description:
      "For the sample flow, this profile stands in for a visitor building something new.",
    interests: [
      { type: "industry", name: "Startups" },
      { type: "skill", name: "Prototyping" },
      { type: "skill", name: "User research" },
    ],
  },
];

export const SAMPLE_PERSONAS: readonly SamplePersona[] = [
  {
    id: samplePersonaId("ada"),
    name: "Ada Sampleton",
    tagline: "Staff product designer (sample persona)",
    bio: "A scripted sample persona. In the real product this card would describe a professional who exists outside this demo; here it is fixed fixture data.",
    profession: "Staff Product Designer",
    company: "Sampleworks Collective",
    experience: 9,
    interests: [
      { type: "skill", name: "Design systems" },
      { type: "skill", name: "Accessibility" },
      { type: "industry", name: "Developer tools" },
    ],
    connectionType: "collaboration",
    conversationStarter:
      "How do you decide when a component deserves a place in the design system?",
  },
  {
    id: samplePersonaId("ravi"),
    name: "Ravi Sampleton",
    tagline: "Applied scientist (sample persona)",
    bio: "A scripted sample persona. In the real product this card would describe a professional who exists outside this demo; here it is fixed fixture data.",
    profession: "Applied Scientist",
    company: "Sampleton Analytics Lab",
    experience: 6,
    interests: [
      { type: "academic", name: "Machine learning" },
      { type: "skill", name: "Python" },
      { type: "industry", name: "Analytics" },
    ],
    connectionType: "mentorship",
    conversationStarter:
      "What is the smallest dataset you have seen produce a genuinely useful model?",
  },
  {
    id: samplePersonaId("june"),
    name: "June Sampleton",
    tagline: "Founder (sample persona)",
    bio: "A scripted sample persona. In the real product this card would describe a professional who exists outside this demo; here it is fixed fixture data.",
    profession: "Founder",
    company: "Sample & Field Co.",
    experience: 4,
    interests: [
      { type: "industry", name: "Startups" },
      { type: "skill", name: "Prototyping" },
      { type: "skill", name: "User research" },
    ],
    connectionType: "b2b",
    conversationStarter:
      "What is one thing you shipped quickly that you would now do differently?",
  },
];

/**
 * The scripted pairing rule for the sample demo. The real product's matching
 * is not reimplemented here — the demo simply walks a fixed script:
 * the visitor's chosen profile selects which sample persona appears.
 */
export function samplePersonaForProfile(
  profileId: SampleProfile["id"],
): SamplePersona {
  switch (profileId) {
    case "sample-profile:design-systems":
      return SAMPLE_PERSONAS[0];
    case "sample-profile:data-ml":
      return SAMPLE_PERSONAS[1];
    case "sample-profile:founders":
      return SAMPLE_PERSONAS[2];
  }
  // Unknown id: fall back to the first persona rather than dead-ending.
  return SAMPLE_PERSONAS[0];
}

export function sampleProfileById(
  profileId: SampleProfile["id"],
): SampleProfile | undefined {
  return SAMPLE_PROFILES.find((profile) => profile.id === profileId);
}
