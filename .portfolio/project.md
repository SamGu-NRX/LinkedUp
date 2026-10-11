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
line: LinkedIn, minus the bots. LinkedUp matches you on what your interests mean, then puts you both on a video call.
award: 2nd overall, iSTEM@Stevens Hacks
badge: 2nd
stack: [Next.js, FastAPI, pgvector]
links:
  - label: Site
    href: https://linkedup-ai.vercel.app/
  - label: Code
    href: https://github.com/SamGu-NRX/LinkedUp
---

LinkedUp is networking without the feed. You pick your interests, and it puts you on a video call with the person whose interests mean the closest thing to yours, even when you each name them differently. Doing that live, with real calls, was the hard part. I led the five-person team, we piloted it with more than 40 users, and it placed second overall at iSTEM@Stevens Hacks 2025.

## Why we built it

We built it out of frustration with LinkedIn: cluttered screens, bots everywhere, and networking that rarely turned into a conversation. Our answer was blunt. Skip the message thread and put two people who should talk on a call.

## What you get

- **A match on meaning, not keywords.** Your interests become an OpenAI embedding stored in Postgres with pgvector, and the matcher pairs the closest ones.
- **A call, not a thread.** Once you match, Stream opens a voice and video room for the two of you.
- **Something to say first.** The call shows discussion prompts drawn from both people’s interests, so neither of you waits for the other to start.

## How it’s put together

- A Turborepo monorepo with two apps: a Next.js front end with Tailwind and shadcn/ui on Vercel, and a FastAPI backend in Python on Render.
- Clerk for sign-in and onboarding, and Supabase for the data.
- Shipped in Docker with CI/CD.

The public repository holds the Next.js app, including onboarding and the call, and I wrote most of its code.

## The pilot

A pilot with more than 40 users showed 140% higher match satisfaction.

The README’s list of what comes next is still open: meeting modes beyond one-on-one networking, such as B2B meetings and mentor sessions, better matching, and machine-learning moderation. The app has placeholder screens for some of those modes, and none of them works yet.
