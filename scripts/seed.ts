/**
 * Idempotent dev-data seed for the local stack (`pnpm dev:up` runs it; direct
 * entry point: `pnpm db:seed`).
 *
 * Scope: DEVELOPMENT DATA ONLY — synthetic personas that never correspond to
 * real people (clerk ids `dev_seed_*`, emails `@linkedup.local`). Re-running
 * is always safe: users insert with ON CONFLICT DO NOTHING, interests are
 * inserted only when missing. Case-specific seed design (the "10 seeds each"
 * journey fixtures) belongs to the journey-suite task — extend or replace
 * this file there.
 *
 * drizzle-kit 0.30.5 has no seed command, so this script IS the seed step.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db/index";
import { interests, users } from "../src/db/schema";

const DEV_USERS = [
  {
    clerkId: "dev_seed_alina",
    email: "dev-seed-alina@linkedup.local",
    firstName: "Alina (dev seed)",
    lastName: "Okafor",
    jobTitle: "Product Engineer",
    company: "LinkedUp Dev",
    field: "Engineering",
    bio: "Synthetic dev persona created by scripts/seed.ts. Never a real person.",
  },
  {
    clerkId: "dev_seed_bram",
    email: "dev-seed-bram@linkedup.local",
    firstName: "Bram (dev seed)",
    lastName: "Vogel",
    jobTitle: "Data Scientist",
    company: "LinkedUp Dev",
    field: "Data",
    bio: "Synthetic dev persona created by scripts/seed.ts. Never a real person.",
  },
  {
    clerkId: "dev_seed_chidi",
    email: "dev-seed-chidi@linkedup.local",
    firstName: "Chidi (dev seed)",
    lastName: "Nwosu",
    jobTitle: "Design Lead",
    company: "LinkedUp Dev",
    field: "Design",
    bio: "Synthetic dev persona created by scripts/seed.ts. Never a real person.",
  },
];

const DEV_INTERESTS = [
  { clerkId: "dev_seed_alina", name: "Distributed systems", category: "Technology" },
  { clerkId: "dev_seed_alina", name: "Developer tooling", category: "Technology" },
  { clerkId: "dev_seed_bram", name: "Machine learning", category: "Technology" },
  { clerkId: "dev_seed_bram", name: "Open data", category: "Technology" },
  { clerkId: "dev_seed_chidi", name: "Interface design", category: "Design" },
  { clerkId: "dev_seed_chidi", name: "Accessibility", category: "Design" },
];

async function main() {
  const inserted = await db
    .insert(users)
    .values(DEV_USERS)
    .onConflictDoNothing({ target: users.clerkId })
    .returning({ id: users.id, clerkId: users.clerkId });

  const seededIds = DEV_USERS.map((u) => u.clerkId);
  const allRows = await db
    .select({ id: users.id, clerkId: users.clerkId })
    .from(users)
    .where(inArray(users.clerkId, seededIds));
  const idByClerkId = new Map(allRows.map((r) => [r.clerkId, r.id]));

  let interestsAdded = 0;
  for (const interest of DEV_INTERESTS) {
    const userId = idByClerkId.get(interest.clerkId);
    if (userId === undefined) continue;
    const existing = await db
      .select({ id: interests.id })
      .from(interests)
      .where(and(eq(interests.userId, userId), eq(interests.name, interest.name)));
    if (existing.length === 0) {
      await db.insert(interests).values({
        userId,
        name: interest.name,
        category: interest.category,
        customId: `dev_seed_${interest.name.toLowerCase().replace(/\s+/g, "_")}`,
      });
      interestsAdded += 1;
    }
  }

  const newlyInserted = inserted.length;
  const total = allRows.length;
  console.log(
    `[seed] users: ${newlyInserted === 0 ? "already seeded — kept" : `${newlyInserted} inserted`} ` +
      `(${total} dev personas present) · interests: ` +
      `${interestsAdded === 0 ? "already seeded — kept" : `${interestsAdded} inserted`}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
