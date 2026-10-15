// scripts/stack-paths.cjs — where this checkout's local stack lives.
//
// CommonJS so both sides can load it: dev-up.mjs imports it, and the tests'
// database guard (tests/stack-db.ts) requires it from Playwright's CommonJS
// loader, which cannot load dev-up.mjs (it uses import.meta).
const crypto = require("node:crypto");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function readPort(value, fallback) {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`invalid port ${JSON.stringify(value)} (need an integer in 1..65535)`);
  }
  return port;
}

/** Dev-server port. Override with LINKEDUP_DEV_PORT when :3000 is taken by a foreign process. */
const APP_PORT = readPort(process.env.LINKEDUP_DEV_PORT, 3000);
/** Project-owned Postgres port: distinctive, localhost-only, NOT the system 5432. */
const PG_PORT = readPort(process.env.LINKEDUP_PG_PORT, 54329);
const PG_DATA_DIR = process.env.LINKEDUP_PG_DATA_DIR ?? path.join(ROOT, ".local", "pg");
// The socket directory goes inside pg_ctl's -o option string, which is
// split on spaces, and a Unix socket path is capped near 104 bytes on macOS:
// keep it short and space-free, per checkout.
const PG_SOCKET_DIR = path.join(
  "/tmp",
  `linkedup-pg-${crypto.createHash("sha1").update(ROOT).digest("hex").slice(0, 8)}`,
);
const PG_LOG_PATH = path.join(ROOT, ".local", "pg.log");
// Parallel lanes share the server but must never migrate each other's database.
const DATABASE_NAME = process.env.LINKEDUP_DATABASE_NAME ?? "linkedup";
if (!/^[a-z][a-z0-9_]{0,62}$/.test(DATABASE_NAME)) {
  throw new Error("LINKEDUP_DATABASE_NAME must be a lowercase PostgreSQL identifier");
}
const LOCAL_DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/${DATABASE_NAME}`;
const ADMIN_DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres`;

module.exports = {
  ROOT,
  DATABASE_NAME,
  APP_PORT,
  PG_PORT,
  PG_DATA_DIR,
  PG_SOCKET_DIR,
  PG_LOG_PATH,
  LOCAL_DATABASE_URL,
  ADMIN_DATABASE_URL,
};
