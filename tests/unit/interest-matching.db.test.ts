// @vitest-environment node
import "./support/use-stack-db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { interests, queueEntries, rooms, users } from "@/db/schema";
import { getRoomForUser, pairWaitingUsersTransactional, pairWaitingUsersWith, queueCancel, queueJoin, queueStateForUser, STALE_ENTRY_MS } from "@/lib/matching";
import { preparePair } from "@/lib/interest-matching/postgres";

vi.mock("@/lib/interest-matching/server", () => ({ decideMatch: vi.fn(async () => null) }));

let serial = 0;
async function person(tags: string[]) {
  const clerkId = `interest_witness_${Date.now()}_${serial++}`;
  const [user] = await db.insert(users).values({ clerkId, email: `${clerkId}@example.test`, firstName: "Interest witness" }).returning();
  if (tags.length) await db.insert(interests).values(tags.map((name) => ({ userId: user.id, name, category: "test" })));
  return user;
}
async function wait(userId: number, joinedAt = new Date()) {
  await db.insert(queueEntries).values({ userId, queueType: "casual", joinedAt, lastSeenAt: new Date() });
}
afterEach(async () => {
  await db.execute(sql`DELETE FROM users WHERE clerk_id LIKE 'interest_witness_%'`);
});

describe("interest pairing on Postgres", () => {
  it("a join chooses a later compatible waiter over the first incompatible one", async () => {
    const first = await person(["knitting"]);
    const best = await person(["devtools", "bouldering"]);
    const joiner = await person(["developer tools", "climbing"]);
    await wait(first.id);
    await wait(best.id);
    expect(await queueJoin({ userId: joiner.id, queueType: "casual" })).toMatchObject({ status: "matched" });
    const state = await queueStateForUser(joiner.id);
    expect(state).toMatchObject({ status: "matched", partner: { id: best.id }, intro: {
      reason: "You both enjoy climbing and developer tools.", question: "What got you into climbing?",
    } });
    expect(await queueStateForUser(first.id)).toMatchObject({ status: "waiting" });
  });

  it("waits for fit, then a poll matches the oldest with no overlap once the window ends", async () => {
    const a = await person(["knitting"]);
    const b = await person(["climbing"]);
    await queueJoin({ userId: a.id, queueType: "casual" });
    expect(await queueJoin({ userId: b.id, queueType: "casual" })).toEqual({ status: "waiting" });
    await db.update(queueEntries).set({ joinedAt: new Date(Date.now() - 20_001) }).where(eq(queueEntries.userId, a.id));
    expect(await queueStateForUser(b.id)).toMatchObject({ status: "matched", partner: { id: a.id }, intro: {
      sharedInterests: [], reason: "A chance to explore a different set of interests.",
    } });
  });

  it("an overdue waiter cannot be bypassed by newly arriving compatible pairs", async () => {
    const oldest = await person(["knitting"]);
    const fresh = await person(["climbing"]);
    const joiner = await person(["climbing"]);
    await wait(oldest.id, new Date(Date.now() - 20_001));
    await wait(fresh.id);
    await queueJoin({ userId: joiner.id, queueType: "casual" });
    const state = await queueStateForUser(oldest.id);
    expect(state).toMatchObject({ status: "matched", partner: { id: fresh.id } });
    expect(await queueStateForUser(joiner.id)).toMatchObject({ status: "waiting" });
  });

  it("a cancelled snapshot cannot claim its remaining partner", async () => {
    const a = await person(["climbing"]);
    const b = await person(["bouldering"]);
    await wait(a.id); await wait(b.id);
    const now = new Date();
    const proposal = await preparePair("casual", now, STALE_ENTRY_MS);
    if (!proposal) throw new Error("Expected compatible proposal");
    await queueCancel(a.id);
    expect(await db.transaction((tx) => pairWaitingUsersWith(tx, "casual", now, proposal))).toBeNull();
    expect(await queueStateForUser(b.id)).toMatchObject({ status: "waiting" });
    const persisted = await db.select().from(rooms).where(inArray(rooms.user1Id, [a.id, b.id]));
    expect(persisted).toHaveLength(0);
  });

  it("stores one intro for both participants and preserves it after tags change", async () => {
    const a = await person(["devtools"]);
    const b = await person(["developer tools"]);
    await wait(a.id); await wait(b.id);
    const pair = await pairWaitingUsersTransactional("casual");
    if (!pair) throw new Error("Expected compatible pair");
    await db.update(interests).set({ name: "knitting" }).where(eq(interests.userId, a.id));
    for (const user of [a, b]) {
      expect(await getRoomForUser(user.clerkId, pair.roomId)).toMatchObject({ allowed: true, intro: {
        reason: "You both enjoy developer tools.", question: "What got you into developer tools?", sharedInterests: ["developer tools"],
      } });
      expect(await queueStateForUser(user.id)).toMatchObject({ status: "matched", roomId: pair.roomId, intro: { question: "What got you into developer tools?" } });
    }
  });

  it("simultaneous joins and polls never put a person in two rooms", async () => {
    for (let round = 0; round < 8; round++) {
      const people = await Promise.all([person(["devtools"]), person(["developer tools"]), person(["developer tools"])]);
      await Promise.all(people.map((user) => queueJoin({ userId: user.id, queueType: "casual" })));
      const states = await Promise.all(people.map((user) => queueStateForUser(user.id)));
      expect(states.map((state) => state.status).sort()).toEqual(["matched", "matched", "waiting"]);
      const persisted = await db.select().from(rooms).where(inArray(rooms.user1Id, people.map((user) => user.id)));
      expect(persisted).toHaveLength(1);
      expect(new Set([persisted[0].user1Id, persisted[0].user2Id]).size).toBe(2);
      await db.delete(users).where(inArray(users.id, people.map((user) => user.id)));
    }
  });
});
