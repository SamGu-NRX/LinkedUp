// @vitest-environment node
// Migration 0005 (one live queue entry per person) on data that breaks the
// new index: a person with a waiting entry beside a matched one, and a
// person with two matched entries. Runs the migration's own SQL inside a
// transaction on the stack database and rolls it back, so the database is
// left as it was.
import "./support/use-stack-db";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

const MIGRATION = path.resolve(__dirname, "../../drizzle/0005_queue_live_unique.sql");
const ROLLBACK = new Error("rollback");

describe("migration 0005 on conflicting data", () => {
  it("expires the waiting entry beside a matched one, keeps the newest of two matched, then builds the index", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
    let seen: Record<string, unknown> | null = null;
    try {
      await sql
        .begin(async (tx) => {
          // The database before 0005: the waiting-only index.
          await tx.unsafe(`DROP INDEX IF EXISTS queue_entries_user_live_unique`);
          await tx.unsafe(`CREATE UNIQUE INDEX queue_entries_user_waiting_unique ON queue_entries (user_id) WHERE status = 'waiting'`);
          const [x] = await tx`INSERT INTO users (clerk_id, email) VALUES (${`witness_mig_x_${Date.now()}`}, 'x@witness.local') RETURNING id`;
          const [y] = await tx`INSERT INTO users (clerk_id, email) VALUES (${`witness_mig_y_${Date.now()}`}, 'y@witness.local') RETURNING id`;
          const [z] = await tx`INSERT INTO users (clerk_id, email) VALUES (${`witness_mig_z_${Date.now()}`}, 'z@witness.local') RETURNING id`;
          const [room1] = await tx`INSERT INTO rooms (queue_type, status, user1_id, user2_id) VALUES ('casual', 'active', ${x.id}, ${y.id}) RETURNING id`;
          const [room2] = await tx`INSERT INTO rooms (queue_type, status, user1_id, user2_id) VALUES ('casual', 'active', ${z.id}, ${y.id}) RETURNING id`;
          // X: matched and waiting. Y: matched twice (room1 older, room2 newer).
          const [xMatched] = await tx`INSERT INTO queue_entries (user_id, queue_type, status, room_id) VALUES (${x.id}, 'casual', 'matched', ${room1.id}) RETURNING id`;
          const [xWaiting] = await tx`INSERT INTO queue_entries (user_id, queue_type, status) VALUES (${x.id}, 'casual', 'waiting') RETURNING id`;
          const [yOld] = await tx`INSERT INTO queue_entries (user_id, queue_type, status, room_id) VALUES (${y.id}, 'casual', 'matched', ${room1.id}) RETURNING id`;
          const [yNew] = await tx`INSERT INTO queue_entries (user_id, queue_type, status, room_id) VALUES (${y.id}, 'casual', 'matched', ${room2.id}) RETURNING id`;

          for (const statement of fs.readFileSync(MIGRATION, "utf8").split("--> statement-breakpoint")) {
            await tx.unsafe(statement);
          }

          const status = async (id: number) => (await tx`SELECT status FROM queue_entries WHERE id = ${id}`)[0].status;
          const [index] = await tx`SELECT indexdef FROM pg_indexes WHERE indexname = 'queue_entries_user_live_unique'`;
          seen = {
            xMatched: await status(xMatched.id),
            xWaiting: await status(xWaiting.id),
            yOld: await status(yOld.id),
            yNew: await status(yNew.id),
            index: Boolean(index),
          };
          throw ROLLBACK;
        })
        .catch((error) => {
          if (error !== ROLLBACK) throw error;
        });
    } finally {
      await sql.end({ timeout: 2 });
    }
    expect(seen).toEqual({ xMatched: "matched", xWaiting: "expired", yOld: "exited", yNew: "matched", index: true });
  }, 30_000);
});
