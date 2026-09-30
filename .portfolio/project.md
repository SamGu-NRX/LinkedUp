---
# kgu.one builds this project's page from this file (https://kgu.one/projects/linkedup).
# When a change alters what the project does, its results, awards, stack or links,
# update this file in the same change. Rules:
# - Facts only, each one backed by this repo, the resume or a public source.
# - No em dashes and no middle dots.
# - line: at most 120 characters, ending in a period. What someone does or gets,
#   then one mechanism. No adjectives.
# - The body opens with one paragraph of 50 to 80 words, first person: what it is,
#   who used it, the hard part, one fact. The site uses it as the summary.
# - The rest of the body is the full write-up, in plain Markdown (## and ###
#   headings, lists, emphasis, inline code, https links), at most 1,500 words.
title: LinkedUp
kind: project
date: 2025-02
line: LinkedIn, minus the bots. LinkedUp pairs you by shared interests and drops you both into a live video call.
award: 2nd overall, iSTEM@Stevens Hacks
badge: 2nd
stack: [Next.js, FastAPI, pgvector]
links:
  - label: Site
    href: https://linkedup-ai.vercel.app/
  - label: Code
    href: https://github.com/SamGu-NRX/LinkedUp
---

LinkedUp pairs people by what they’re interested in, then opens a live voice and video room so they can talk right away. It embeds each person’s interests with pgvector and matches people whose answers sit close together, not people whose job titles match, and an LLM suggests the first question. I led the five-person team, and it placed second overall at iSTEM@Stevens Hacks 2025.

We built it out of frustration with LinkedIn: cluttered interfaces, bot-filled interactions and networking that felt unproductive. The fix we wanted was blunt. Skip the endless text exchanges and put two people who should talk into a call together.

Matching works on meaning rather than keywords. Each person’s interests become an OpenAI embedding stored in Postgres with pgvector, and the matcher pairs people whose vectors sit close together. That way, two people can match even when they describe the same interest in different words.

Once two people match, Stream opens the voice and video room. An LLM writes a conversation prompt to open with, so the call doesn’t start with two people waiting for the other to speak. Clerk handles sign-in and onboarding, and Supabase holds the data.

## How it’s put together

We built it as a Turborepo monorepo with two apps:

- a Next.js front end with Tailwind and shadcn/ui, deployed on Vercel;
- a FastAPI backend in Python, deployed on Render.

We shipped it in Docker with CI/CD. The public repository holds the Next.js app, including the onboarding flow and the video call, and I wrote most of the code in it.

## The pilot

We ran a pilot with more than 40 users, and match satisfaction came in 140% higher.

The list of what we’d build next is still open in the README. It includes meeting modes beyond one-on-one networking, such as B2B meetings and mentor sessions, better matching models, and machine-learning moderation to keep the community safe. None of that is built yet.
