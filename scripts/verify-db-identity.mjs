#!/usr/bin/env node
/**
 * DEV-ONLY data-layer identity check for `pnpm dev:up`. Not a product route.
 *
 * Why a script and not a route: the dev identity must be assertable without
 * touching src/middleware.ts (reserved), and middleware redirects every
 * unauthenticated dynamic route. So dev:up runs the app's OWN database client
 * (src/db/index.ts) under the dev server's exact child environment — same
 * process.env precedence, same connection construction — and asserts the
 * connection lands on the project-owned cluster: the same database the
 * migrations ran on.
 *
 * Prints the identity report as JSON; exits 1 on any mismatch.
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db/index.ts";
import { dbIdentityMismatches, PG_DATA_DIR, PG_PORT } from "./dev-up.mjs";

const rowsResult = await db.execute(sql`
  select
    current_database() as database,
    current_setting('port') as server_port,
    current_setting('data_directory') as data_directory,
    inet_server_port() as connection_port
`);
// drizzle's postgres-js execute returns the raw RowList (array-like), not
// { rows } — accept both shapes so the check survives driver upgrades.
const rows = Array.isArray(rowsResult) ? rowsResult : rowsResult.rows;
const row = rows[0];

const report = {
  database: {
    name: row.database,
    serverPort: Number(row.server_port),
    dataDirectory: row.data_directory,
    connectionPort: row.connection_port === null ? null : Number(row.connection_port),
  },
};

const failures = dbIdentityMismatches(report, {
  databaseName: "linkedup",
  port: PG_PORT,
  dataDirectory: PG_DATA_DIR,
});
if (failures.length > 0) {
  console.error("[verify-db-identity] MISMATCH — the app data layer is NOT on the project database:");
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
process.exit(0);
