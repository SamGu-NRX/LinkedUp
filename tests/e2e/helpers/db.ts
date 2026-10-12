// tests/e2e/helpers/db.ts — direct Postgres access for journey assertions.
//
// The journeys assert on REAL state: the users row an onboarding run wrote,
// the queue entries the matcher flipped, the room the pair landed in. The
// test process talks only to the stack's own Postgres (tests/stack-db.ts):
// an inherited DATABASE_URL pointing elsewhere is refused at import, and
// the first query confirms the server is this checkout's cluster.
import { Pool, type QueryResultRow } from "pg";
import { assertStackCluster, stackDatabaseUrl } from "../../stack-db";

const connectionString = stackDatabaseUrl();

export const dbPool = new Pool({ connectionString });

let verified: Promise<void> | null = null;
function stackVerified(): Promise<void> {
  verified ??= assertStackCluster(connectionString);
  return verified;
}

export async function one<T extends QueryResultRow>(
  sql: string,
  params: unknown[],
): Promise<T | null> {
  await stackVerified();
  const res = await dbPool.query<T>(sql, params);
  return res.rows[0] ?? null;
}

export async function many<T extends QueryResultRow>(
  sql: string,
  params: unknown[],
): Promise<T[]> {
  await stackVerified();
  const res = await dbPool.query<T>(sql, params);
  return res.rows;
}

/** The users row for a journey persona (email is run-salted and unique). */
export async function userRowByEmail(email: string): Promise<{
  id: number;
  clerk_id: string;
  onboarding_complete: boolean;
  age: number | null;
  gender: string | null;
  field: string | null;
} | null> {
  return one(
    `SELECT id, clerk_id, onboarding_complete, age, gender, field
       FROM users WHERE email = $1`,
    [email],
  );
}

/** All queue entries ever created for a user, newest first. */
export async function queueRowsForUser(userId: number): Promise<
  { id: number; queue_type: string; status: string; room_id: string | null }[]
> {
  return many(
    `SELECT id, queue_type, status, room_id
       FROM queue_entries WHERE user_id = $1 ORDER BY id DESC`,
    [userId],
  );
}

export async function roomRow(
  roomId: string,
): Promise<{
  id: string;
  queue_type: string;
  status: string;
  user1_id: number;
  user2_id: number;
} | null> {
  return one(
    `SELECT id, queue_type, status, user1_id, user2_id
       FROM rooms WHERE id = $1`,
    [roomId],
  );
}

/**
 * One JSONL line per journey case: case, status, duration, optional error.
 * Readable with plain `jq` after the run — the scorecard IS the summary.
 */
export async function appendScorecard(entry: {
  case: string;
  status: "passed" | "failed";
  durationMs: number;
  error?: string;
}): Promise<void> {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(
    "test-results/j-scorecard.jsonl",
    `${JSON.stringify(entry)}\n`,
  );
}
