#!/usr/bin/env node
/**
 * One-command local stack for LinkedUp (fully keyless dev).
 *
 *   pnpm dev:up
 *
 * 1. Ensures .env.local carries the project DATABASE_URL (127.0.0.1:54329/linkedup).
 * 2. Initializes (initdb) and starts a PROJECT-OWNED PostgreSQL cluster in
 *    .local/pg on a localhost-only port (54329), with whichever PostgreSQL
 *    14+ server binaries the machine has (Linux packages or Homebrew).
 *    System clusters, system credentials and sudo are never touched.
 * 3. Creates the `linkedup` database if missing.
 * 4. Applies Drizzle migrations (drizzle-kit migrate, idempotent).
 * 5. Runs the repo seed script when one exists (scripts/seed.* / src/db/seed.*).
 * 6. Starts keyless `next dev` and PROVES the actual keyless app — not just an
 *    HTTP 200: the landing page is LinkedUp's, /sign-in renders Clerk without
 *    any keys, /app serves the app shell, and the app's data layer (scripts/
 *    verify-db-identity.mjs, the app's own db client) proves the app is
 *    connected to the same project database the migrations ran on.
 *
 * Env isolation: Next loads .env, .env.local, .env.development and
 * .env.development.local for every variable the process does not already
 * set. dev:up strips Clerk/Stream/database variables from the server's
 * process env, and REFUSES to start while any of those files defines one
 * (other than .env.local's DATABASE_URL, which must be the project
 * database): otherwise a checkout with Clerk keys in an env file would run
 * against that tenant.
 *
 * Safety: this script only ever stops processes IT started, verified by its
 * pid file AND the live process's identity (process group, command line,
 * working directory; /proc on Linux, ps and lsof on macOS). A foreign
 * process holding the dev port makes dev:up refuse to start instead of
 * killing it.
 *
 * Idempotent: a healthy, correctly-configured server on the dev port is
 * reused; one of ours with a stale configuration is replaced.
 */

import { execFileSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");

const log = (msg) => console.log(`[dev:up] ${msg}`);
const die = (msg) => {
  console.error(`[dev:up] ERROR: ${msg}`);
  process.exit(1);
};

/** Dev-server port. Override with LINKEDUP_DEV_PORT when :3000 is taken by a foreign process. */
const APP_PORT = readPort(process.env.LINKEDUP_DEV_PORT, 3000);
const BASE_URL = `http://127.0.0.1:${APP_PORT}`;
/** Project-owned Postgres port: distinctive, localhost-only, NOT the system 5432. */
export const PG_PORT = readPort(process.env.LINKEDUP_PG_PORT, 54329);
export const PG_DATA_DIR = path.join(ROOT, ".local", "pg");
// The socket directory goes inside pg_ctl's -o option string, which is
// split on spaces, and a Unix socket path is capped near 104 bytes on macOS:
// keep it short and space-free, per checkout.
export const PG_SOCKET_DIR = path.join(
  "/tmp",
  `linkedup-pg-${crypto.createHash("sha1").update(ROOT).digest("hex").slice(0, 8)}`,
);
export const PG_LOG_PATH = path.join(ROOT, ".local", "pg.log");
export const LOCAL_DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/linkedup`;
export const ADMIN_DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres`;
const PG_BIN = findPgBin();
// Per-checkout tag: /tmp is shared across sandboxes and checkouts, and the
// record must never be confused between two trees (its root is identity).
const ROOT_TAG = crypto.createHash("sha1").update(ROOT).digest("hex").slice(0, 8);
const DEV_LOG_PATH = path.join(os.tmpdir(), `linkedup-next-dev-${ROOT_TAG}.log`);
const DEV_META_PATH = path.join(os.tmpdir(), `linkedup-next-dev-${ROOT_TAG}.json`);
// Measured 2026-10-12 on the shared 2-core sandbox: with a foreign matrix run
// at load ~40, initdb took 48s and the landing page's first compile exceeded
// 240s (still running when this budget expired — the server itself was Ready
// in 6.3s). 600s covers a loaded box; under normal load the wait ends early.
const READINESS_TIMEOUT_MS = 600_000;
/** Strings in served HTML that mean the stack left keyless mode (key set, secret missing). */
const KEYLESS_FAILURE_MARKERS = ["Missing secretKey", "Application not found"];

function readPort(value, fallback) {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    die(`invalid port ${JSON.stringify(value)} (need an integer in 1..65535)`);
  }
  return port;
}

/** Directories that may hold PostgreSQL server binaries, newest major first. */
export function pgBinCandidates(pathEnv = process.env.PATH ?? "") {
  const majors = [17, 16, 15, 14];
  return [
    ...majors.flatMap((v) => [
      `/usr/lib/postgresql/${v}/bin`,
      `/usr/local/pg${v}/bin`,
      `/opt/homebrew/opt/postgresql@${v}/bin`,
      `/usr/local/opt/postgresql@${v}/bin`,
    ]),
    ...pathEnv.split(path.delimiter).filter(Boolean),
  ];
}

/** Locate PostgreSQL server binaries (initdb, pg_ctl, psql, pg_isready); null when absent. */
function findPgBin() {
  for (const dir of pgBinCandidates()) {
    if (["initdb", "pg_ctl", "psql", "pg_isready"].every((b) => existsSync(path.join(dir, b)))) return dir;
  }
  return null;
}

function requirePgBin() {
  if (!PG_BIN) {
    die(
      "PostgreSQL server binaries (initdb, pg_ctl, psql, pg_isready) not found on PATH or in the " +
        "usual Linux/Homebrew locations. Install PostgreSQL 14 or newer and rerun.",
    );
  }
  return PG_BIN;
}

const pg = (bin) => path.join(requirePgBin(), bin);

/** execFileSync that throws a readable Error on nonzero exit. */
function run(cmd, args, opts = {}) {
  const { capture = false, env } = opts;
  try {
    const result = execFileSync(cmd, args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      ...(env ? { env } : {}),
    });
    return capture ? result : undefined;
  } catch (err) {
    const detail = err.stderr || err.message;
    throw new Error(`${cmd} ${args.join(" ")} failed: ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for the unit tests in tests/unit/dev-up.safety.test.mjs)
// ---------------------------------------------------------------------------

/** PIDs of processes listening on `port`, parsed from `ss -ltnp` output. */
export function parseListeningPids(ssOutput, port) {
  const pids = new Set();
  for (const line of ssOutput.split("\n")) {
    const cols = line.trim().split(/\s+/);
    // Columns: State Recv-Q Send-Q Local-Address:Port Peer-Address:Port [Process..]
    const local = cols[3]?.replace(/\]$/, "");
    if (!local) continue;
    const m = local.match(/:(\d+)$/);
    if (!m || Number(m[1]) !== port) continue;
    for (const pid of line.matchAll(/pid=(\d+)/g)) pids.add(Number(pid[1]));
  }
  return [...pids];
}

/** PIDs from `lsof -nP -iTCP:<port> -sTCP:LISTEN -t` output (one pid per line). */
export function parseLsofPids(lsofOutput) {
  return [...new Set(lsofOutput.split("\n").map((l) => Number(l.trim())).filter((n) => Number.isInteger(n) && n > 0))];
}

/**
 * Env-file problems that would let Next load credentials or another database
 * into the dev server. Next reads these files for every variable the process
 * env does not set, so stripping the process env alone is not isolation.
 * `files` maps a file name to its content (absent files omitted).
 */
export const NEXT_ENV_FILES = [".env", ".env.local", ".env.development", ".env.development.local"];
export function envFileProblems(files, { databaseUrl }) {
  const problems = [];
  for (const [name, content] of Object.entries(files)) {
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const [, key, value] = m;
      if (/CLERK|STREAM/i.test(key)) {
        problems.push(`${name} defines ${key}: dev would leave keyless mode`);
      } else if (/^(DATABASE_URL|POSTGRES_URL|DIRECT_URL|SUPABASE_DB_URL)$/.test(key)) {
        const unquoted = value.replace(/^["']|["']$/g, "");
        if (!(name === ".env.local" && key === "DATABASE_URL" && unquoted === databaseUrl)) {
          problems.push(`${name} defines ${key}: only .env.local's DATABASE_URL=${databaseUrl} is allowed`);
        }
      }
    }
  }
  return problems;
}

/**
 * Classifies the process recorded in `meta` (our pid file) against live
 * process facts. Returns:
 *   "none"    — no usable record (never started here, or recorded for a
 *               different port/root): a port holder is foreign.
 *   "stale"   — the recorded process no longer exists.
 *   "foreign" — a live process that is NOT one of ours (pid recycled, wrong
 *               command line, or wrong working directory): never kill it.
 *   "ours"    — live process verified by recorded pid AND command line AND
 *               working directory: safe to stop.
 * The pid alone is never trusted — pids are recycled by the OS.
 */
export function classifyServerIdentity({ meta, cmdline, cwd, root, port }) {
  if (!meta || typeof meta !== "object") return "none";
  if (meta.kind !== "linkedup-dev-server") return "none";
  if (meta.port !== port || meta.root !== root) return "none";
  if (typeof cmdline !== "string") return "stale"; // /proc gone: process exited
  const args = cmdline.split("\u0000").filter(Boolean);
  const isNextDev =
    args.some((a) => a === "next" || /(^|[\\/@])next$/.test(a)) &&
    args.some((a) => a === "dev") &&
    args.some((a) => a === "--port") &&
    args.includes(String(port));
  if (!isNextDev) return "foreign";
  if (cwd !== root) return "foreign";
  return "ours";
}

/** True when meta records exactly the configuration dev:up would start now. */
export function metaMatchesExpectation(meta, { port, root, databaseUrl }) {
  return Boolean(
    meta &&
      meta.kind === "linkedup-dev-server" &&
      meta.port === port &&
      meta.root === root &&
      meta.databaseUrl === databaseUrl,
  );
}

/**
 * The dev server's environment: an isolated, verified local configuration.
 * Strips any Clerk/Stream credentials (dev stays keyless) and any inherited
 * database URL — an inherited DATABASE_URL (e.g. a hosted Supabase URL
 * exported in the calling shell) would otherwise win over .env.local and let
 * the app drift from the database the migrations ran on — then pins
 * DATABASE_URL to the project cluster.
 */
export function serverEnvFrom(env, { databaseUrl }) {
  const out = { ...env };
  for (const key of Object.keys(out)) {
    if (/CLERK|STREAM/i.test(key)) delete out[key];
    if (/^(DATABASE_URL|POSTGRES_URL|DIRECT_URL|SUPABASE_DB_URL)$/.test(key)) {
      delete out[key];
    }
  }
  out.DATABASE_URL = databaseUrl;
  out.LINKEDUP_DEV_UP = "1";
  return out;
}

/**
 * Compares the app data layer's identity report (scripts/verify-db-identity.mjs)
 * with the expected project cluster. Returns the list of mismatches
 * (empty = verified).
 */
export function dbIdentityMismatches(report, expected) {
  if (!report || typeof report !== "object") return ["no identity report"];
  const db = report.database ?? {};
  const failures = [];
  if (db.name !== expected.databaseName) {
    failures.push(
      `database name ${JSON.stringify(db.name)} != ${JSON.stringify(expected.databaseName)}`,
    );
  }
  if (Number(db.serverPort) !== expected.port) {
    failures.push(`server port ${JSON.stringify(db.serverPort)} != ${expected.port}`);
  }
  if (db.dataDirectory !== expected.dataDirectory) {
    failures.push(
      `data directory ${JSON.stringify(db.dataDirectory)} != ${JSON.stringify(expected.dataDirectory)}`,
    );
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Live-process readers (same-user introspection): /proc on Linux, ps/lsof
// elsewhere. cmdline comes back NUL-separated in both cases.
// ---------------------------------------------------------------------------

const HAS_PROC = existsSync("/proc/self/stat");

function capture(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

function procCmdline(pid) {
  if (HAS_PROC) {
    try {
      return readFileSync(`/proc/${pid}/cmdline`, "utf8");
    } catch {
      return null;
    }
  }
  const out = capture("ps", ["-ww", "-o", "command=", "-p", String(pid)]);
  // ps joins argv with spaces; none of the arguments checked contain spaces.
  return out && out.trim() ? out.trim().split(/\s+/).join("\u0000") : null;
}

function procCwd(pid) {
  if (HAS_PROC) {
    try {
      return readlinkSync(`/proc/${pid}/cwd`);
    } catch {
      return null;
    }
  }
  const out = capture("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]);
  const line = out?.split("\n").find((l) => l.startsWith("n"));
  return line ? line.slice(1) : null;
}

function procPgid(pid) {
  if (HAS_PROC) {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      const fields = stat.slice(stat.lastIndexOf(")") + 1).trim().split(/\s+/);
      return Number(fields[2]); // after (comm): state, ppid, pgrp
    } catch {
      return null;
    }
  }
  const out = capture("ps", ["-o", "pgid=", "-p", String(pid)]);
  const n = Number(out?.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** PIDs listening on a TCP port (lsof where it exists, else ss). */
function listeningPids(port) {
  if (existsSync("/usr/sbin/lsof") || existsSync("/usr/bin/lsof")) {
    // lsof exits 1 when nothing listens: capture() returns null then.
    return parseLsofPids(capture("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]) ?? "");
  }
  const ss = capture("ss", ["-ltnp"]);
  if (ss === null) die("need lsof or ss to inspect the dev port");
  return parseListeningPids(ss, port);
}

function describePids(pids) {
  return pids
    .map((pid) => {
      const cmdline = procCmdline(pid);
      const args = cmdline ? cmdline.split("\u0000").filter(Boolean).join(" ") : "(gone)";
      return `pid ${pid}: ${args.slice(0, 120)}`;
    })
    .join("; ");
}

// ---------------------------------------------------------------------------
// 1. .env.local
// ---------------------------------------------------------------------------

function ensureEnvFile() {
  const envPath = path.join(ROOT, ".env.local");
  let lines = [];
  if (existsSync(envPath)) {
    lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  }
  const idx = lines.findIndex((line) => /^DATABASE_URL=/.test(line.trim()));
  if (idx >= 0 && lines[idx].trim() === `DATABASE_URL=${LOCAL_DATABASE_URL}`) {
    log(".env.local already points at the local database — kept");
    return;
  }
  if (idx >= 0) {
    lines[idx] = `DATABASE_URL=${LOCAL_DATABASE_URL}`;
  } else {
    lines.push(`DATABASE_URL=${LOCAL_DATABASE_URL}`);
  }
  writeFileSync(envPath, lines.filter((l) => l !== "").join("\n") + "\n");
  log(".env.local DATABASE_URL set to the local database");
}

/** Refuse to serve while an env file Next loads carries credentials or another database. */
function assertEnvFilesIsolated() {
  const files = {};
  for (const name of NEXT_ENV_FILES) {
    const p = path.join(ROOT, name);
    if (existsSync(p)) files[name] = readFileSync(p, "utf8");
  }
  const problems = envFileProblems(files, { databaseUrl: LOCAL_DATABASE_URL });
  if (problems.length) {
    die(
      `env files Next would load are not isolated:\n  - ${problems.join("\n  - ")}\n` +
        "Move those variables out of this checkout's env files (dev:up never edits them beyond .env.local's DATABASE_URL).",
    );
  }
  log(`env files isolated (${Object.keys(files).join(", ") || "none present"})`);
}

// ---------------------------------------------------------------------------
// 2. Project-owned PostgreSQL cluster (.local/pg on :54329, localhost-only)
// ---------------------------------------------------------------------------

function pgIsReady() {
  try {
    run(pg("pg_isready"), ["-h", "127.0.0.1", "-p", String(PG_PORT)], { capture: true });
    return true;
  } catch {
    return false;
  }
}

function initdbIfNeeded() {
  const pgBin = requirePgBin();
  if (existsSync(path.join(PG_DATA_DIR, "PG_VERSION"))) {
    // A cluster made by another major version cannot be started by this one.
    const clusterMajor = readFileSync(path.join(PG_DATA_DIR, "PG_VERSION"), "utf8").trim();
    const binMajor = (run(path.join(pgBin, "pg_ctl"), ["--version"], { capture: true }).match(/(\d+)\./) ?? [])[1];
    if (binMajor && clusterMajor !== binMajor) {
      die(
        `${PG_DATA_DIR} holds a PostgreSQL ${clusterMajor} cluster but the server binaries are ${binMajor}. ` +
          "Remove .local/pg (project data only) or install the matching PostgreSQL.",
      );
    }
    return;
  }
  mkdirSync(PG_DATA_DIR, { recursive: true });
  mkdirSync(PG_SOCKET_DIR, { recursive: true });
  // A leftover empty/broken directory (a previously interrupted init) would
  // make initdb refuse; start clean.
  if (existsSync(PG_DATA_DIR)) rmSync(PG_DATA_DIR, { recursive: true, force: true });
  mkdirSync(PG_DATA_DIR, { recursive: true });
  const pwFile = path.join(PG_DATA_DIR, "..", "pg-pwfile");
  writeFileSync(pwFile, "postgres\n");
  try {
    run(path.join(pgBin, "initdb"), [
      "-D", PG_DATA_DIR,
      "--username=postgres",
      "--pwfile", pwFile,
      "--auth-host=scram-sha-256",
      "--auth-local=trust",
      "--encoding=UTF8",
    ]);
  } finally {
    unlinkSync(pwFile);
  }
  log(`initialized project Postgres cluster in ${PG_DATA_DIR}`);
}

function startProjectPostgres() {
  const pgBin = requirePgBin();
  mkdirSync(PG_SOCKET_DIR, { recursive: true }); // /tmp may have been cleaned
  // -o flags pin the project port, a project socket directory and a
  // localhost-only listener — the system cluster on 5432 is never involved.
  run(path.join(pgBin, "pg_ctl"), [
    "-D", PG_DATA_DIR,
    "-l", PG_LOG_PATH,
    "-o", `-p ${PG_PORT} -k ${PG_SOCKET_DIR} -c listen_addresses=127.0.0.1`,
    "-w",
    "start",
  ]);
}

function ensurePostgres() {
  if (pgIsReady()) {
    // Something answers on our port: it must be THIS project's cluster.
    const dataDir = run(
      pg("psql"),
      [ADMIN_DATABASE_URL, "-tAc", "SHOW data_directory"],
      { capture: true },
    ).trim();
    if (dataDir !== `${PG_DATA_DIR}/` && dataDir !== PG_DATA_DIR) {
      die(
        `port ${PG_PORT} answers but it is not this project's cluster (data_directory ${dataDir}). ` +
          "Free the port or set LINKEDUP_PG_PORT.",
      );
    }
    log(`project PostgreSQL already running on :${PG_PORT} — kept`);
    return;
  }
  const startedAt = Date.now();
  initdbIfNeeded();
  startProjectPostgres();
  const deadline = Date.now() + 30_000;
  while (!pgIsReady()) {
    if (Date.now() > deadline) die("project PostgreSQL did not become ready within 30s");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
  }
  log(`project PostgreSQL ready on 127.0.0.1:${PG_PORT} (started in ${Date.now() - startedAt}ms)`);

  const hasDb = run(
    pg("psql"),
    [ADMIN_DATABASE_URL, "-tAc", "SELECT 1 FROM pg_database WHERE datname = 'linkedup'"],
    { capture: true },
  ).trim();
  if (hasDb === "1") {
    log("database 'linkedup' already exists — kept");
  } else {
    run(pg("psql"), [ADMIN_DATABASE_URL, "-c", "CREATE DATABASE linkedup"]);
    log("database 'linkedup' created");
  }
}

// ---------------------------------------------------------------------------
// 3. Migrations + seed
// ---------------------------------------------------------------------------

function runMigrations() {
  log("applying Drizzle migrations (drizzle-kit migrate)");
  run("pnpm", ["exec", "drizzle-kit", "migrate"], {
    env: serverEnvFrom(process.env, { databaseUrl: LOCAL_DATABASE_URL }),
  });
}

const SEED_CANDIDATES = [
  "scripts/seed.ts",
  "scripts/seed.mjs",
  "scripts/seed.js",
  "src/db/seed.ts",
  "src/db/seed.mjs",
  "src/db/seed.js",
];

function runSeedIfPresent() {
  const seedFile = SEED_CANDIDATES.find((f) => existsSync(path.join(ROOT, f)));
  if (!seedFile) {
    log("no seed script found (scripts/seed.* or src/db/seed.*) — skipping seed");
    return;
  }
  log(`seeding via ${seedFile} (idempotent)`);
  run("pnpm", ["exec", "tsx", seedFile], {
    env: serverEnvFrom(process.env, { databaseUrl: LOCAL_DATABASE_URL }),
  });
}

// ---------------------------------------------------------------------------
// 4. Keyless dev server on :3000 — started, identified and verified by us
// ---------------------------------------------------------------------------

/** HTTP status or null when nothing answered. */
async function fetchStatus(url, { timeoutMs = 5_000 } = {}) {
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "linkedup-dev-up/2.0" },
    });
    await res.arrayBuffer().catch(() => {}); // free the socket
    return res.status;
  } catch {
    return null;
  }
}

/** HTTP status + body (capped) or { status: null } when nothing answered. */
async function fetchBody(url, { timeoutMs = 90_000 } = {}) {
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "linkedup-dev-up/2.0" },
    });
    const text = (await res.text()).slice(0, 200_000);
    return { status: res.status, body: text };
  } catch {
    return { status: null, body: "" };
  }
}

/** Our recorded server meta, or null. */
function readDevMeta() {
  try {
    return JSON.parse(readFileSync(DEV_META_PATH, "utf8"));
  } catch {
    return null;
  }
}

function clearDevMeta() {
  try {
    unlinkSync(DEV_META_PATH);
  } catch {
    /* already gone */
  }
}

/** Stop a server dev:up itself started (identity already verified). */
function stopOurServer(meta) {
  const pgid = procPgid(meta.pid);
  const targets = [pgid ? -pgid : null, meta.pid].filter((t) => t !== null && t !== 0);
  for (const target of targets) {
    try {
      process.kill(target, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (procPgid(meta.pid) === null) return; // process group gone
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
  }
  for (const target of targets) {
    try {
      process.kill(target, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
}

async function startDevServer() {
  const out = openSync(DEV_LOG_PATH, "a");
  const child = spawn("pnpm", ["exec", "next", "dev", "--port", String(APP_PORT)], {
    cwd: ROOT,
    detached: true, // own process group: survives dev:up, killable as -pgid
    stdio: ["ignore", out, out],
    env: serverEnvFrom(process.env, { databaseUrl: LOCAL_DATABASE_URL }),
  });
  const meta = {
    kind: "linkedup-dev-server",
    pid: child.pid,
    port: APP_PORT,
    root: ROOT,
    databaseUrl: LOCAL_DATABASE_URL,
    startedAt: new Date().toISOString(),
  };
  writeFileSync(DEV_META_PATH, JSON.stringify(meta, null, 2));
  child.unref();
  log(`starting keyless next dev on :${APP_PORT} (pid ${child.pid}, log ${DEV_LOG_PATH})`);

  let exited = null;
  child.once("exit", (code, signal) => {
    exited = { code, signal };
  });

  const deadline = Date.now() + READINESS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exited) {
      dumpLogTail();
      die(`next dev exited early (code ${exited.code}, signal ${exited.signal})`);
    }
    const status = await fetchStatus(`${BASE_URL}/`);
    if (status === 200) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  dumpLogTail();
  die(`dev server not ready (HTTP 200 on /) within ${READINESS_TIMEOUT_MS / 1000}s`);
}

// ---------------------------------------------------------------------------
// 5. Proof: the actual keyless app, and the same database as the migrations
// ---------------------------------------------------------------------------

/**
 * (d) HTTP 200 alone proves nothing — any service can answer 200. Prove:
 *   1. the landing page is LinkedUp's (title marker from the app layout),
 *   2. keyless Clerk serves /sign-in with no keys configured (a keyed-but-
 *      secretless stack 500s with "Missing secretKey"),
 *   3. the protected /app route serves LinkedUp's app shell with no Clerk
 *      error page — keyless SSR cannot enforce a server-side auth redirect
 *      (measured: clerkMiddleware without keys serves the shell with 200);
 *      unauthenticated redirect semantics are the journey suite's job, this
 *      step proves the stack runs keyless and clean,
 *   4. the app's data layer reports it is connected to the project database
 *      (scripts/verify-db-identity.mjs under the server's exact env).
 */
async function verifyAppAndKeylessMode() {
  const meta = readDevMeta();
  if (!meta) die("no dev server record — cannot verify the running app");

  const home = await fetchBody(`${BASE_URL}/`);
  if (home.status !== 200) {
    die(`/ answered ${home.status ?? "no response"} — expected the LinkedUp landing page`);
  }
  const titleMatch = home.body.match(/<title>([^<]*)<\/title>/i);
  if (!titleMatch || !/linkedup/i.test(titleMatch[1])) {
    die(
      `port ${APP_PORT} serves something that is not LinkedUp ` +
        `(title: ${JSON.stringify(titleMatch?.[1] ?? "(none)")}) — refusing to mistake it for the app`,
    );
  }

  const signIn = await fetchBody(`${BASE_URL}/sign-in`);
  if (signIn.status !== 200) {
    dumpLogTail();
    die(`/sign-in returned ${signIn.status ?? "no response"} — keyless Clerk did not serve the sign-in page`);
  }
  for (const marker of KEYLESS_FAILURE_MARKERS) {
    if (signIn.body.includes(marker)) {
      die(`/sign-in renders "${marker}" — the stack is not keyless-clean (check .env.local for Clerk keys)`);
    }
  }

  const appPage = await fetchBody(`${BASE_URL}/app`);
  if (appPage.status !== 200) {
    die(`/app returned ${appPage.status ?? "no response"} — the protected app route did not render`);
  }
  for (const marker of KEYLESS_FAILURE_MARKERS) {
    if (appPage.body.includes(marker)) {
      die(`/app renders "${marker}" — the stack is not keyless-clean (check .env.local for Clerk keys)`);
    }
  }
  if (!/dashboard/i.test(appPage.body)) {
    die("/app did not render the LinkedUp app shell (no dashboard content) — is something else serving the port?");
  }

  // The server's env was built by serverEnvFrom (no Clerk/Stream/database
  // variables inherited) and assertEnvFilesIsolated refused any env file
  // that would put them back; the data layer check below proves which
  // database the app's own client reaches.
  log("asserting the app data layer uses the project database (app's own client)");
  run("pnpm", ["exec", "tsx", "scripts/verify-db-identity.mjs"], {
    env: serverEnvFrom(process.env, { databaseUrl: LOCAL_DATABASE_URL }),
  });

  log(
    `verified: LinkedUp on :${APP_PORT} · keyless Clerk sign-in · /app shell clean · ` +
      `env files isolated · data layer on ${LOCAL_DATABASE_URL} (${PG_DATA_DIR})`,
  );
}

/**
 * Decides what to do about the dev port: reuse a healthy server of ours,
 * replace one of ours with a stale configuration, or REFUSE when a foreign
 * process holds the port.
 */
async function ensureDevServer() {
  const meta = readDevMeta();
  const holders = listeningPids(APP_PORT);
  const identity = classifyServerIdentity({
    meta,
    cmdline: meta ? procCmdline(meta.pid) : null,
    cwd: meta ? procCwd(meta.pid) : null,
    root: ROOT,
    port: APP_PORT,
  });

  if (holders.length === 0) {
    if (identity === "ours" || identity === "stale") clearDevMeta();
    await startDevServer();
    return;
  }

  if (identity === "ours") {
    const healthy = (await fetchStatus(`${BASE_URL}/`, { timeoutMs: 30_000 })) === 200;
    if (healthy && metaMatchesExpectation(meta, {
      port: APP_PORT,
      root: ROOT,
      databaseUrl: LOCAL_DATABASE_URL,
    })) {
      log(`healthy dev server already on :${APP_PORT} — reusing it`);
      return;
    }
    log(`replacing a dev:up-started server on :${APP_PORT} (stale configuration or unhealthy)`);
    stopOurServer(meta);
    await startDevServer();
    return;
  }

  die(
    `port ${APP_PORT} is held by ${describePids(holders)} — dev:up never kills processes it ` +
      "did not start. Free the port or set LINKEDUP_DEV_PORT.",
  );
}

function dumpLogTail() {
  try {
    const content = readFileSync(DEV_LOG_PATH, "utf8");
    const lines = content.trimEnd().split("\n").slice(-40);
    console.error(`--- last ${lines.length} lines of ${DEV_LOG_PATH} ---`);
    console.error(lines.join("\n"));
  } catch {
    /* log unavailable */
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

/**
 * `--down`: stop what dev:up started — the dev server recorded in its pid
 * file (identity verified as above) and the project Postgres cluster in
 * .local/pg (pg_ctl on that data directory only). Data stays on disk.
 */
function down() {
  const meta = readDevMeta();
  const identity = classifyServerIdentity({
    meta,
    cmdline: meta ? procCmdline(meta.pid) : null,
    cwd: meta ? procCwd(meta.pid) : null,
    root: ROOT,
    port: APP_PORT,
  });
  if (identity === "ours") {
    stopOurServer(meta);
    log(`stopped the dev server (pid ${meta.pid})`);
  } else if (identity === "foreign") {
    log(`the recorded pid ${meta.pid} is not our dev server any more — left alone`);
  }
  clearDevMeta();
  if (existsSync(path.join(PG_DATA_DIR, "postmaster.pid"))) {
    run(pg("pg_ctl"), ["-D", PG_DATA_DIR, "-m", "fast", "-w", "stop"]);
    log("stopped the project PostgreSQL cluster");
  }
}

async function main() {
  if (process.argv.includes("--down")) {
    down();
    return;
  }
  log(`stack: project Postgres on 127.0.0.1:${PG_PORT} (data ${PG_DATA_DIR}, binaries ${PG_BIN ?? "missing"}), dev server on :${APP_PORT}`);
  ensureEnvFile();
  assertEnvFilesIsolated();
  ensurePostgres();
  runMigrations();
  runSeedIfPresent();

  await ensureDevServer();
  await verifyAppAndKeylessMode();

  log(`done. app: http://localhost:${APP_PORT} · db: ${LOCAL_DATABASE_URL}`);
}

if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  main().catch((err) => die(err.stack || err.message));
}
