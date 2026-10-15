// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const migrationsFolder = path.resolve(__dirname, "../../drizzle");
const fixture = fs.readFileSync(
  path.resolve(__dirname, "../fixtures/production-main-schema.sql"),
  "utf8",
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

async function inSchema(
  run: (sql: postgres.Sql, schema: string) => Promise<void>,
) {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  const schema = `migration_test_${crypto.randomUUID().replaceAll("-", "")}`;
  try {
    await sql.unsafe(`CREATE SCHEMA "${schema}"`);
    await sql.unsafe(`SET search_path TO "${schema}"`);
    await run(sql, schema);
  } finally {
    await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await sql.end({ timeout: 2 });
  }
}

async function withMigrationFolder(
  schema: string,
  run: (folder: string) => Promise<void>,
) {
  const temp = fs.mkdtempSync(
    path.join(process.env.TMPDIR ?? "/tmp", "linkedup-migrations-"),
  );
  try {
    fs.cpSync(migrationsFolder, temp, { recursive: true });
    for (const file of fs
      .readdirSync(temp)
      .filter((name) => name.endsWith(".sql"))) {
      const fullPath = path.join(temp, file);
      fs.writeFileSync(
        fullPath,
        fs
          .readFileSync(fullPath, "utf8")
          .replaceAll('"public".', `"${schema}".`),
      );
    }
    await run(temp);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

async function applyMigration(sql: postgres.Sql, tag: string, schema: string) {
  for (const statement of fs
    .readFileSync(path.join(migrationsFolder, `${tag}.sql`), "utf8")
    .split("--> statement-breakpoint")) {
    await sql.unsafe(statement.replaceAll('"public".', `"${schema}".`));
  }
}

describe("production migration adoption", () => {
  for (const shape of ["empty", "main"] as const) {
    it(`migrates ${shape} schema twice without changing existing data`, async () => {
      await inSchema(async (sql, schema) => {
        if (shape === "main") await sql.unsafe(fixture);
        if (shape === "main")
          await sql`INSERT INTO users (clerk_id, email) VALUES ('legacy_user', 'legacy@example.test')`;

        // Keep table references and the official migrator's journal in this
        // test's schema. No statement can reach the app's public tables.
        await withMigrationFolder(schema, async (temp) => {
          const db = drizzle(sql);
          const config = { migrationsFolder: temp, migrationsSchema: schema };
          await migrate(db, config);
          await migrate(db, config);
          const [journal] = await sql.unsafe(
            `SELECT count(*)::int AS count FROM "${schema}".__drizzle_migrations`,
          );
          const expectedCount = fs
            .readdirSync(temp)
            .filter((name) => name.endsWith(".sql")).length;
          expect(journal.count).toBe(expectedCount);
          const [user] =
            await sql`INSERT INTO users (clerk_id, email, first_name, last_name) VALUES ('new_user', 'new@example.test', 'New', 'User') RETURNING first_name, last_name`;
          expect(user).toEqual({ first_name: "New", last_name: "User" });
          const rows = await sql`SELECT clerk_id FROM users ORDER BY clerk_id`;
          expect(rows.map((row) => row.clerk_id)).toEqual(
            shape === "main" ? ["legacy_user", "new_user"] : ["new_user"],
          );
        });
      });
    }, 30_000);
  }

  it("repairs the orphan left by the already-applied original 0005", async () => {
    await inSchema(async (sql, schema) => {
      await withMigrationFolder(schema, async (temp) => {
        const db = drizzle(sql);
        const config = { migrationsFolder: temp, migrationsSchema: schema };
        const journalPath = path.join(temp, "meta/_journal.json");
        const fullJournal = z
          .object({
            version: z.string(),
            dialect: z.literal("postgresql"),
            entries: z.array(
              z.object({
                idx: z.number().int(),
                version: z.string(),
                when: z.number().int(),
                tag: z.string(),
                breakpoints: z.boolean(),
              }),
            ),
          })
          .parse(JSON.parse(fs.readFileSync(journalPath, "utf8")));
        fs.writeFileSync(
          journalPath,
          JSON.stringify({
            ...fullJournal,
            entries: fullJournal.entries.slice(0, 5),
          }),
        );
        await migrate(db, config);
        const people =
          await sql`INSERT INTO users (clerk_id, email) VALUES ('a', 'a@test.local'), ('b', 'b@test.local'), ('c', 'c@test.local') RETURNING id`;
        const [a, b, c] = people;
        const [oldRoom] =
          await sql`INSERT INTO rooms (queue_type, user1_id, user2_id) VALUES ('casual', ${a.id}, ${b.id}) RETURNING id`;
        const [newRoom] =
          await sql`INSERT INTO rooms (queue_type, user1_id, user2_id) VALUES ('casual', ${b.id}, ${c.id}) RETURNING id`;
        await sql`INSERT INTO queue_entries (user_id, queue_type, status, room_id) VALUES (${a.id}, 'casual', 'matched', ${oldRoom.id}), (${b.id}, 'casual', 'matched', ${oldRoom.id}), (${b.id}, 'casual', 'matched', ${newRoom.id}), (${c.id}, 'casual', 'matched', ${newRoom.id})`;
        const original = fs.readFileSync(
          path.resolve(
            __dirname,
            "../fixtures/original-0005-queue-live-unique.sql",
          ),
          "utf8",
        );
        fs.writeFileSync(
          path.join(temp, "0005_queue_live_unique.sql"),
          original,
        );
        fs.writeFileSync(
          journalPath,
          JSON.stringify({
            ...fullJournal,
            entries: fullJournal.entries.slice(0, 6),
          }),
        );
        await migrate(db, config);
        const [before] =
          await sql`SELECT r.status AS room, q.status AS participant FROM rooms r JOIN queue_entries q ON q.room_id = r.id AND q.user_id = ${a.id} WHERE r.id = ${oldRoom.id}`;
        expect(before).toEqual({ room: "active", participant: "matched" });
        fs.writeFileSync(journalPath, JSON.stringify(fullJournal));
        fs.writeFileSync(
          path.join(temp, "0005_queue_live_unique.sql"),
          fs.readFileSync(
            path.join(migrationsFolder, "0005_queue_live_unique.sql"),
            "utf8",
          ),
        );
        await migrate(db, config);
        await migrate(db, config);
        const applied = await sql.unsafe(
          `SELECT hash, created_at FROM "${schema}".__drizzle_migrations ORDER BY created_at`,
        );
        expect(applied).toHaveLength(8);
        expect(applied[5].hash).toBe(
          crypto.createHash("sha256").update(original).digest("hex"),
        );
        const [old] =
          await sql`SELECT status, ended_at IS NOT NULL AS ended FROM rooms WHERE id = ${oldRoom.id}`;
        expect(old).toEqual({ status: "ended", ended: true });
        const queue =
          await sql`SELECT user_id, status FROM queue_entries ORDER BY id`;
        expect(queue.map((entry) => entry.status)).toEqual([
          "exited",
          "exited",
          "matched",
          "matched",
        ]);
        const [healthy] =
          await sql`SELECT status, ended_at IS NOT NULL AS ended FROM rooms WHERE id = ${newRoom.id}`;
        expect(healthy).toEqual({ status: "active", ended: false });
        const [released] =
          await sql`INSERT INTO queue_entries (user_id, queue_type) VALUES (${a.id}, 'casual') RETURNING status`;
        expect(released.status).toBe("waiting");
      });
    });
  });

  it("rejects a mismatched legacy column with a specific error", async () => {
    await inSchema(async (sql, schema) => {
      await sql.unsafe(fixture);
      await sql`ALTER TABLE users ALTER COLUMN email TYPE text`;
      await expect(
        applyMigration(sql, "0000_journey_baseline", schema),
      ).rejects.toThrow(/baseline mismatch.*users.*email/i);
    });
  });

  it("rejects an unexpected required column and leaves adoption unapplied", async () => {
    await inSchema(async (sql, schema) => {
      await sql.unsafe(fixture);
      await sql`INSERT INTO users (clerk_id, email) VALUES ('legacy', 'legacy@test.local')`;
      await sql`ALTER TABLE users ADD COLUMN tenant_id integer NOT NULL DEFAULT 1`;
      await sql`ALTER TABLE users ALTER COLUMN tenant_id DROP DEFAULT`;
      await withMigrationFolder(schema, async (temp) => {
        await expect(
          migrate(drizzle(sql), {
            migrationsFolder: temp,
            migrationsSchema: schema,
          }),
        ).rejects.toThrow(/baseline mismatch.*users.*tenant_id/i);
        const [journal] = await sql.unsafe(
          `SELECT count(*)::int AS count FROM "${schema}".__drizzle_migrations`,
        );
        expect(journal.count).toBe(0);
        const [legacy] =
          await sql`SELECT clerk_id, email, tenant_id FROM users`;
        expect(legacy).toEqual({
          clerk_id: "legacy",
          email: "legacy@test.local",
          tenant_id: 1,
        });
        const [names] =
          await sql`SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema = ${schema} AND table_name = 'users' AND column_name IN ('first_name', 'last_name')`;
        expect(names.count).toBe(0);
      });
    });
  });

  it("rejects an existing index with the wrong columns", async () => {
    await inSchema(async (sql, schema) => {
      await applyMigration(sql, "0000_journey_baseline", schema);
      await sql`DROP INDEX queue_entries_pairing_idx`;
      await sql`CREATE INDEX queue_entries_pairing_idx ON queue_entries (status)`;
      await expect(
        applyMigration(sql, "0000_journey_baseline", schema),
      ).rejects.toThrow(/baseline mismatch.*queue_entries_pairing_idx/i);
    });
  });

  it("rejects a mismatched legacy foreign key", async () => {
    await inSchema(async (sql, schema) => {
      await sql.unsafe(fixture);
      await sql`ALTER TABLE interests DROP CONSTRAINT interests_user_id_users_id_fk`;
      await sql`ALTER TABLE interests ADD CONSTRAINT interests_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL`;
      await expect(
        applyMigration(sql, "0000_journey_baseline", schema),
      ).rejects.toThrow(/baseline mismatch.*interests_user_id_users_id_fk/i);
    });
  });
});
