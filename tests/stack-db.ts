// tests/stack-db.ts — the one database tests may write to.
//
// Unit DB tests and the e2e journeys delete and rewrite rows, so they must
// never reach a database other than the project cluster that `pnpm dev:up`
// runs for this checkout (.local/pg on 127.0.0.1:54329, scripts/dev-up.mjs).
// Two checks, both loud:
//   1. the URL: an inherited DATABASE_URL that is not the stack's URL is
//      refused rather than silently used or silently replaced;
//   2. the server: the Postgres answering on that port must serve this
//      checkout's data directory, so another checkout's cluster (or any
//      other server) bound to the same port is refused too.
import fs from "node:fs";
import postgres from "postgres";
import { LOCAL_DATABASE_URL, PG_DATA_DIR } from "../scripts/stack-paths.cjs";

/** Where a URL points, without its credentials. */
function describeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}:${u.port || "(default port)"}${u.pathname}`;
  } catch {
    return "an unparseable URL";
  }
}

/** The stack's URL, or an error if the environment points somewhere else. */
export function stackDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  const inherited = env.DATABASE_URL;
  if (inherited !== undefined && inherited !== LOCAL_DATABASE_URL) {
    throw new Error(
      `Refusing DATABASE_URL (${describeUrl(inherited)}): tests write only to this checkout's stack ` +
        `database ${describeUrl(LOCAL_DATABASE_URL)}. Unset DATABASE_URL or set it to that URL.`,
    );
  }
  return LOCAL_DATABASE_URL;
}

const realpath = (p: string) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
};

/** Null when the server's data directory is this checkout's cluster. */
export function dataDirectoryProblem(reported: string): string | null {
  if (realpath(reported) === realpath(PG_DATA_DIR)) return null;
  return (
    `the Postgres on ${describeUrl(LOCAL_DATABASE_URL)} serves ${reported}, ` +
    `not this checkout's cluster ${PG_DATA_DIR}`
  );
}

/** Connect once and confirm the server is this checkout's cluster. */
export async function assertStackCluster(url: string = stackDatabaseUrl()): Promise<void> {
  const sql = postgres(url, { max: 1, idle_timeout: 1, connect_timeout: 5, onnotice: () => {} });
  try {
    let reported: string;
    try {
      const rows = await sql<{ data_directory: string }[]>`SHOW data_directory`;
      reported = rows[0].data_directory;
    } catch (error) {
      throw new Error(
        `Cannot reach the stack database ${describeUrl(url)} (${(error as Error).message}). ` +
          "Start it with `pnpm dev:up`.",
      );
    }
    const problem = dataDirectoryProblem(reported);
    if (problem) throw new Error(`Refusing to run against this database: ${problem}.`);
  } finally {
    await sql.end({ timeout: 1 });
  }
}
