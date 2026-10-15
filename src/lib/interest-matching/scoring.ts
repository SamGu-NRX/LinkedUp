import type { RankedCandidate, WaitingProfile } from "./types";

const aliases: Record<string, string> = {
  devtools: "developer tools", "dev tools": "developer tools", "cli tools": "developer tools",
  "rock climbing": "climbing", bouldering: "climbing", "sport climbing": "climbing",
  ai: "artificial intelligence", "machine learning": "artificial intelligence", ml: "artificial intelligence",
  coding: "programming", "software development": "programming", "computer programming": "programming",
  "video games": "gaming", videogames: "gaming", "pc gaming": "gaming",
  "taking photos": "photography", "digital photography": "photography",
  trekking: "hiking", "trail hiking": "hiking",
  cycling: "biking", bicycling: "biking",
  "science fiction": "sci fi", scifi: "sci fi",
  "user experience": "ux design", ux: "ux design",
};

export function normalizeInterests(tags: readonly string[]): string[] {
  return [...new Set(tags.map((tag) => {
    const clean = tag.normalize("NFKC").toLowerCase().trim().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
    return aliases[clean] ?? clean;
  }).filter(Boolean))].sort();
}

/** Dice overlap: duplicate tags carry no extra weight; empty profiles score zero. */
export function interestOverlap(a: readonly string[], b: readonly string[]) {
  const left = normalizeInterests(a);
  const right = new Set(normalizeInterests(b));
  const sharedInterests = left.filter((tag) => right.has(tag));
  return {
    score: left.length + right.size === 0 ? 0 : 2 * sharedInterests.length / (left.length + right.size),
    sharedInterests,
  };
}

// Product policy, not calibrated against real users: allow 20 seconds to find
// common ground, then give the oldest active waiter first claim on their best
// available partner, regardless of fit. Polls retry even with no new arrivals.
// This bounds fit-related delay, not the time until another person is available.
export const RELAX_AFTER_MS = 20_000;
export const MIN_FIT = 0.30;
export const TOP_CANDIDATES = 4;

export function isRelaxed(profile: WaitingProfile, now: Date): boolean {
  return now.getTime() - profile.joinedAt.getTime() >= RELAX_AFTER_MS;
}

export function compareArrival(a: WaitingProfile, b: WaitingProfile): number {
  return a.joinedAt.getTime() - b.joinedAt.getTime() || a.entryId - b.entryId;
}

export function chooseAnchor(profiles: WaitingProfile[], now: Date, joiningUserId?: number): WaitingProfile | undefined {
  const oldest = [...profiles].sort(compareArrival)[0];
  if (!oldest || isRelaxed(oldest, now)) return oldest;
  return profiles.find((profile) => profile.userId === joiningUserId) ?? oldest;
}

export function rankCandidates(anchor: WaitingProfile, profiles: WaitingProfile[]): RankedCandidate[] {
  return profiles.filter((profile) => profile.userId !== anchor.userId).map((profile) => {
    const overlap = interestOverlap(anchor.interests, profile.interests);
    return { profile, overlap: overlap.score, score: overlap.score, sharedInterests: overlap.sharedInterests };
  }).sort(compareFit);
}

export function compareFit(a: RankedCandidate, b: RankedCandidate): number {
  return b.score - a.score || compareArrival(a.profile, b.profile);
}

export function chooseCandidate(anchor: WaitingProfile, ranked: RankedCandidate[], now: Date): RankedCandidate | undefined {
  const best = [...ranked].sort(compareFit)[0];
  return best && (isRelaxed(anchor, now) || best.score >= MIN_FIT) ? best : undefined;
}
