#!/usr/bin/env node
/**
 * One-command local stack for LinkedUp (fully keyless dev).
 *
 *   pnpm dev:up
 *
 * 1. Ensures .env.local carries the local DATABASE_URL (localhost:5432).
 * 2. Starts the local PostgreSQL 17 cluster ("17 main") if it is down.
 * 3. Creates the `linkedup` database if missing.
 * 4. Applies Drizzle migrations (drizzle-kit migrate, idempotent).
 * 5. Runs the repo seed script when one exists (scripts/seed.* / src/db/seed.*).
 * 6. Starts keyless `next dev` on :3000 and waits for HTTP 200 on /.
 *
 * Safety: this script only ever stops processes IT started, verified by its
 * pid file AND /proc identity (process group, command line, working
 * directory). A foreign process holding the dev port makes dev:up refuse to
 * start instead of killing it.
 *
 * Idempotent: a healthy, correctly-configured server on the dev port is
 * reused; one of ours with a stale configuration is replaced.
 */

import { execFileSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import {
  existsSync,
  openSync,
  readFileSync,
  readlinkSync,
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
const LOCAL_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/linkedup";
const ADMIN_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";
const PG_CLUSTER_VERSION = "17";
const PG_CLUSTER_NAME = "main";
// Per-checkout tag: /tmp is shared across sandboxes and checkouts, and the
// record must never be confused between two trees (its root is identity).
const ROOT_TAG = crypto.createHash("sha1").update(ROOT).digest("hex").slice(0, 8);
const DEV_LOG_PATH = path.join(os.tmpdir(), `linkedup-next-dev-${ROOT_TAG}.log`);
const DEV_META_PATH = path.join(os.tmpdir(), `linkedup-next-dev-${ROOT_TAG}.json`);
const READINESS_TIMEOUT_MS = 240_000;

function readPort(value, fallback) {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    die(`invalid port ${JSON.stringify(value)} (need an integer in 1..65535)`);
  }
  return port;
}

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

/**
 * Classifies the process recorded in `meta` (our pid file) against live /proc
 * facts. Returns:
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

// ---------------------------------------------------------------------------
// /proc readers (same-user introspection of live processes)
// ---------------------------------------------------------------------------

function procCmdline(pid) {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, "utf8");
  } catch {
    return null;
  }
}

function procCwd(pid) {
  try {
    return readlinkSync(`/proc/${pid}/cwd`);
  } catch {
    return null;
  }
}

function procPgid(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 1).trim().split(/\s+/);
    return Number(fields[2]); // after (comm): state, ppid, pgrp
  } catch {
    return null;
  }
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

// ---------------------------------------------------------------------------
// 2. PostgreSQL cluster
// ---------------------------------------------------------------------------

function pgClusterStatus() {
  const out = run("pg_lsclusters", [], { capture: true });
  const match = out.match(
    new RegExp(`^${PG_CLUSTER_VERSION}\\s+${PG_CLUSTER_NAME}\\s+\\d+\\s+(\\w+)`, "m"),
  );
  return match ? match[1] : null;
}

function startPgCluster() {
  // First attempt without sudo is expected to fail for non-root shells —
  // capture it so the permission error does not alarm the user.
  try {
    run("pg_ctlcluster", [PG_CLUSTER_VERSION, PG_CLUSTER_NAME, "start"], { capture: true });
  } catch {
    // Non-root shells need sudo for the Debian cluster wrapper.
    try {
      run("sudo", ["-n", "pg_ctlcluster", PG_CLUSTER_VERSION, PG_CLUSTER_NAME, "start"]);
    } catch (err) {
      die(`could not start PostgreSQL cluster ${PG_CLUSTER_VERSION} ${PG_CLUSTER_NAME}: ${err.message}`);
    }
  }
}

function waitForPgReady() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      run("pg_isready", ["-h", "127.0.0.1", "-p", "5432"], { capture: true });
      return;
    } catch {
      process.stdout.write(".");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  die("PostgreSQL did not become ready within 30s");
}

function ensurePostgres() {
  const status = pgClusterStatus();
  if (status === "online") {
    log(`PostgreSQL ${PG_CLUSTER_VERSION} ${PG_CLUSTER_NAME} already online — kept`);
  } else {
    log(`PostgreSQL ${PG_CLUSTER_VERSION} ${PG_CLUSTER_NAME} is ${status ?? "unknown"} — starting`);
    startPgCluster();
  }
  waitForPgReady();

  // The role password must match the local DATABASE_URL (localhost TCP only).
  if (!canConnect(ADMIN_DATABASE_URL)) {
    log("setting postgres role password for local TCP auth");
    try {
      run("sudo", [
        "-n", "-u", "postgres", "psql", "-p", "5432",
        "-c", "ALTER USER postgres PASSWORD 'postgres';",
      ]);
    } catch (err) {
      die(`could not set the postgres role password: ${err.message}`);
    }
    if (!canConnect(ADMIN_DATABASE_URL)) {
      die("cannot authenticate to local PostgreSQL as postgres:postgres@localhost:5432");
    }
  }

  const hasDb = run(
    "psql",
    [ADMIN_DATABASE_URL, "-tAc", "SELECT 1 FROM pg_database WHERE datname = 'linkedup'"],
    { capture: true },
  ).trim();
  if (hasDb === "1") {
    log("database 'linkedup' already exists — kept");
  } else {
    run("psql", [ADMIN_DATABASE_URL, "-c", "CREATE DATABASE linkedup"]);
    log("database 'linkedup' created");
  }
}

function canConnect(url) {
  try {
    run("psql", [url, "-tAc", "SELECT 1"], { capture: true });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 3. Migrations + seed
// ---------------------------------------------------------------------------

function runMigrations() {
  log("applying Drizzle migrations (drizzle-kit migrate)");
  run("pnpm", ["exec", "drizzle-kit", "migrate"], {
    env: { ...process.env, DATABASE_URL: LOCAL_DATABASE_URL },
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
  log(`seeding via ${seedFile}`);
  const seedEnv = { ...process.env, DATABASE_URL: LOCAL_DATABASE_URL };
  if (seedFile.endsWith(".ts")) {
    run("pnpm", ["exec", "tsx", seedFile], { env: seedEnv });
  } else {
    run("node", [seedFile], { env: seedEnv });
  }
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
    env: keylessEnv(),
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

/** Dev must stay keyless: strip any Clerk/Stream credentials from the child env. */
function keylessEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/CLERK|STREAM/i.test(key)) delete env[key];
  }
  return env;
}

/**
 * Decides what to do about the dev port: reuse a healthy server of ours,
 * replace one of ours with a stale configuration, or REFUSE when a foreign
 * process holds the port.
 */
async function ensureDevServer() {
  const meta = readDevMeta();
  const holders = parseListeningPids(run("ss", ["-ltnp"], { capture: true }), APP_PORT);
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

async function main() {
  ensureEnvFile();
  ensurePostgres();
  runMigrations();
  runSeedIfPresent();

  await ensureDevServer();

  log("keyless dev server is ready (HTTP 200 on /)");
  const routes = ["/", "/sign-in", "/app"];
  for (const route of routes) {
    const status = await fetchStatus(`${BASE_URL}${route}`);
    log(`  ${route} -> ${status ?? "no response"}`);
  }
  log(`done. app: http://localhost:${APP_PORT} · db: ${LOCAL_DATABASE_URL}`);
}

if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  main().catch((err) => die(err.stack || err.message));
}
