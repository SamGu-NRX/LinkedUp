---
# kgu.one builds this project's page from this file (https://kgu.one/projects/linkedup).
# When a change alters what the project does, its results, awards, stack or links,
# update this file in the same change. Rules:
# - Facts only, each one backed by this repo, the resume or a public source.
# - No em dashes and no middle dots.
# - line: at most 120 characters, ending in a period. What someone does or gets,
#   then one mechanism. No adjectives.
# - The paragraph after this header: 50 to 80 words, first person. What it is, who
#   used it, the hard part, one fact.
title: LinkedUp
kind: project
date: 2025-02
line: Matches people at events by shared interests, then opens a video room so they can talk.
award: 2nd overall, iSTEM@Stevens Hacks
badge: 2nd
stack: [Next.js, FastAPI, pgvector]
links:
  - label: Site
    href: https://linkedup-ai.vercel.app/
  - label: Code
    href: https://github.com/SamGu-NRX/LinkedUp
---

LinkedUp embeds each attendee’s interests with pgvector and pairs people whose answers sit close together, not whose job titles match. A match opens a live voice and video room on Stream, and an LLM suggests the first question so nobody stares at the other person. I led the five-person team; it placed second overall at iSTEM@Stevens Hacks 2025, and in a pilot with more than 40 users, match satisfaction came in 140% higher.
