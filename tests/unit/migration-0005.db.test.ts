// @vitest-environment node
// Exercise conflicting pre-0005 data in an isolated schema on the lane DB.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

const MIGRATION = path.resolve(
  __dirname,
  "../../drizzle/0005_queue_live_unique.sql",
);
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54329/linkedup_ship";
const target = new URL(databaseUrl);
if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  target.port !== "54329" ||
  target.pathname !== "/linkedup_ship"
) {
  throw new Error(
    "Migration checks write only to localhost:54329/linkedup_ship",
  );
}

describe("migration 0005 on conflicting data", () => {
  it("expires the waiting entry beside a matched one, keeps the newest of two matched, then builds the index", async () => {
    const sql = postgres(databaseUrl, {
      max: 1,
      onnotice: () => {},
    });
    const schema = `migration_test_${crypto.randomUUID().replaceAll("-", "")}`;
    try {
      await sql.unsafe(`CREATE SCHEMA "${schema}"`);
      await sql.unsafe(`SET search_path TO "${schema}"`);
      for (const tag of [
        "0000_journey_baseline",
        "0001_queue_last_seen",
        "0002_call_signaling",
        "0003_call_maintenance",
        "0004_call_user_budgets",
      ]) {
        const migration = fs.readFileSync(
          path.resolve(__dirname, `../../drizzle/${tag}.sql`),
          "utf8",
        );
        for (const statement of migration.split("--> statement-breakpoint")) {
          await sql.unsafe(statement.replaceAll('"public".', `"${schema}".`));
        }
      }
      await sql.begin(async (tx) => {
        const [x] =
          await tx`INSERT INTO users (clerk_id, email) VALUES (${`witness_mig_x_${Date.now()}`}, 'x@witness.local') RETURNING id`;
        const [y] =
          await tx`INSERT INTO users (clerk_id, email) VALUES (${`witness_mig_y_${Date.now()}`}, 'y@witness.local') RETURNING id`;
        const [z] =
          await tx`INSERT INTO users (clerk_id, email) VALUES (${`witness_mig_z_${Date.now()}`}, 'z@witness.local') RETURNING id`;
        const [room1] =
          await tx`INSERT INTO rooms (queue_type, status, user1_id, user2_id) VALUES ('casual', 'active', ${x.id}, ${y.id}) RETURNING id`;
        const [room2] =
          await tx`INSERT INTO rooms (queue_type, status, user1_id, user2_id) VALUES ('casual', 'active', ${z.id}, ${y.id}) RETURNING id`;
        const [zMatched] =
          await tx`INSERT INTO queue_entries (user_id, queue_type, status, room_id) VALUES (${z.id}, 'casual', 'matched', ${room2.id}) RETURNING id`;
        const [orphan] =
          await tx`INSERT INTO rooms (queue_type, status, user1_id, user2_id) VALUES ('casual', 'active', ${x.id}, ${z.id}) RETURNING id`;
        // X: matched and waiting. Y: matched twice (room1 older, room2 newer).
        const [xMatched] =
          await tx`INSERT INTO queue_entries (user_id, queue_type, status, room_id) VALUES (${x.id}, 'casual', 'matched', ${room1.id}) RETURNING id`;
        const [xWaiting] =
          await tx`INSERT INTO queue_entries (user_id, queue_type, status) VALUES (${x.id}, 'casual', 'waiting') RETURNING id`;
        const [yOld] =
          await tx`INSERT INTO queue_entries (user_id, queue_type, status, room_id) VALUES (${y.id}, 'casual', 'matched', ${room1.id}) RETURNING id`;
        const [yNew] =
          await tx`INSERT INTO queue_entries (user_id, queue_type, status, room_id) VALUES (${y.id}, 'casual', 'matched', ${room2.id}) RETURNING id`;

        const [u, v] =
          await tx`INSERT INTO users (clerk_id, email) VALUES ('same_room_u', 'u@witness.local'), ('same_room_v', 'v@witness.local') RETURNING id`;
        const [sameRoom] =
          await tx`INSERT INTO rooms (queue_type, user1_id, user2_id) VALUES ('casual', ${u.id}, ${v.id}) RETURNING id`;
        const [sameRoomOld] =
          await tx`INSERT INTO queue_entries (user_id, queue_type, status, room_id) VALUES (${u.id}, 'casual', 'matched', ${sameRoom.id}) RETURNING id`;
        const [sameRoomNew] =
          await tx`INSERT INTO queue_entries (user_id, queue_type, status, room_id) VALUES (${u.id}, 'casual', 'matched', ${sameRoom.id}) RETURNING id`;
        await tx`INSERT INTO queue_entries (user_id, queue_type, status, room_id) VALUES (${v.id}, 'casual', 'matched', ${sameRoom.id})`;

        for (const statement of fs
          .readFileSync(MIGRATION, "utf8")
          .split("--> statement-breakpoint")) {
          await tx.unsafe(statement);
        }

        const status = async (id: number) =>
          (await tx`SELECT status FROM queue_entries WHERE id = ${id}`)[0]
            .status;
        const [index] =
          await tx`SELECT indexdef FROM pg_indexes WHERE schemaname = ${schema} AND indexname = 'queue_entries_user_live_unique'`;
        const seen = {
          xMatched: await status(xMatched.id),
          xWaiting: await status(xWaiting.id),
          yOld: await status(yOld.id),
          yNew: await status(yNew.id),
          zMatched: await status(zMatched.id),
          room1: (
            await tx`SELECT status, ended_at IS NOT NULL AS ended FROM rooms WHERE id = ${room1.id}`
          )[0],
          room2: (
            await tx`SELECT status, ended_at IS NOT NULL AS ended FROM rooms WHERE id = ${room2.id}`
          )[0],
          orphan: (
            await tx`SELECT status, ended_at IS NOT NULL AS ended FROM rooms WHERE id = ${orphan.id}`
          )[0],
          sameRoom: (
            await tx`SELECT status, ended_at IS NOT NULL AS ended FROM rooms WHERE id = ${sameRoom.id}`
          )[0],
          sameRoomOld: await status(sameRoomOld.id),
          sameRoomNew: await status(sameRoomNew.id),
          index: Boolean(index),
        };
        await expect(
          tx.savepoint(async (savepoint) => {
            await savepoint`INSERT INTO queue_entries (user_id, queue_type, status) VALUES (${y.id}, 'casual', 'waiting')`;
          }),
        ).rejects.toMatchObject({
          code: "23505",
          constraint_name: "queue_entries_user_live_unique",
        });
        // The other participant can queue again after the losing room ends.
        const [released] =
          await tx`INSERT INTO queue_entries (user_id, queue_type, status) VALUES (${x.id}, 'casual', 'waiting') RETURNING status`;
        expect(released.status).toBe("waiting");
        expect(seen).toEqual({
          xMatched: "exited",
          xWaiting: "expired",
          yOld: "exited",
          yNew: "matched",
          zMatched: "matched",
          room1: { status: "ended", ended: true },
          room2: { status: "active", ended: false },
          orphan: { status: "ended", ended: true },
          sameRoom: { status: "active", ended: false },
          sameRoomOld: "exited",
          sameRoomNew: "matched",
          index: true,
        });
      });
    } finally {
      await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await sql.end({ timeout: 2 });
    }
  }, 30_000);
});
