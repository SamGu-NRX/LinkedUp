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
 * Idempotent: a healthy server on :3000 is reused, a stale one is replaced.
 * No Clerk or Stream keys are required or forwarded to the dev server.
 */

import { execFileSync, spawn } from "node:child_process";
import { existsSync, openSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const LOCAL_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/linkedup";
const ADMIN_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";
const PG_CLUSTER_VERSION = "17";
const PG_CLUSTER_NAME = "main";
const DEV_LOG_PATH = path.join(os.tmpdir(), "linkedup-next-dev.log");
const DEV_PID_PATH = path.join(os.tmpdir(), "linkedup-next-dev.pid");
const READINESS_TIMEOUT_MS = 240_000;

const log = (msg) => console.log(`[dev:up] ${msg}`);
const die = (msg) => {
  console.error(`[dev:up] ERROR: ${msg}`);
  process.exit(1);
};

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
// 1. .env.local
// ---------------------------------------------------------------------------

function ensureEnvFile() {
  const envPath = path.join(ROOT, ".env.local");
  let lines = [];
  if (existsSync(envPath)) {
    lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  }
  const idx = lines.findIndex((line) => /^DATABASE_URL=/.test(line.trim()));
  if (idx >= 0 && lines[idx].includes("localhost:5432/linkedup")) {
    log(".env.local already points at the local database — kept");
    return;
  }
  if (idx >= 0) {
    lines[idx] = `DATABASE_URL=${LOCAL_DATABASE_URL}`;
  } else {
    lines.push(`DATABASE_URL=${LOCAL_DATABASE_URL}`);
  }
  writeFileSync(envPath, lines.filter((l) => l !== "").join("\n") + "\n");
  log(`.env.local DATABASE_URL set to the local database`);
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
    log("note: drizzle-kit has no seed command and the repo has no seed yet; add one at those paths and dev:up will run it");
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
// 4. Keyless dev server on :3000
// ---------------------------------------------------------------------------

/** HTTP status or null when nothing answered. */
async function fetchStatus(url) {
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
      headers: { "user-agent": "linkedup-dev-up/1.0" },
    });
    await res.arrayBuffer().catch(() => {}); // free the socket
    return res.status;
  } catch {
    return null;
  }
}

/** PIDs of processes listening on the dev port, via ss (iproute2). */
function pidsListeningOnPort() {
  try {
    const out = run("ss", ["-ltnp"], { capture: true });
    const pids = new Set();
    for (const line of out.split("\n")) {
      if (!line.includes(`:${PORT} `)) continue;
      for (const m of line.matchAll(/pid=(\d+)/g)) pids.add(Number(m[1]));
    }
    return [...pids];
  } catch {
    return [];
  }
}

function killStaleServer() {
  // Prefer our own recorded process group, then whatever holds the port.
  const candidates = [];
  try {
    const pid = Number(readFileSync(DEV_PID_PATH, "utf8").trim());
    if (pid > 0) candidates.push(-pid, pid);
  } catch {
    /* no pid file */
  }
  candidates.push(...pidsListeningOnPort());
  let killed = false;
  for (const pid of candidates) {
    try {
      process.kill(pid, "SIGTERM");
      killed = true;
    } catch {
      /* already gone or not ours */
    }
  }
  if (!killed) return;
  log("replacing stale process on port 3000");
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (pidsListeningOnPort().length === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  for (const pid of candidates) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
}

/** Dev must stay keyless: strip any Clerk/Stream credentials from the child env. */
function keylessEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/CLERK|STREAM/i.test(key)) delete env[key];
  }
  return env;
}

async function startDevServer() {
  const out = openSync(DEV_LOG_PATH, "a");
  const child = spawn("pnpm", ["exec", "next", "dev", "--port", String(PORT)], {
    cwd: ROOT,
    detached: true, // own process group: survives dev:up, killable as -pid
    stdio: ["ignore", out, out],
    env: keylessEnv(),
  });
  writeFileSync(DEV_PID_PATH, String(child.pid));
  child.unref();
  log(`starting keyless next dev on :${PORT} (pid ${child.pid}, log ${DEV_LOG_PATH})`);

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

  const current = await fetchStatus(`${BASE_URL}/`);
  if (current === 200) {
    log(`healthy dev server already on :${PORT} — reusing it`);
  } else {
    killStaleServer();
    await startDevServer();
  }

  log("keyless dev server is ready (HTTP 200 on /)");
  const routes = ["/", "/sign-in", "/app"];
  for (const route of routes) {
    const status = await fetchStatus(`${BASE_URL}${route}`);
    log(`  ${route} -> ${status ?? "no response"}`);
  }
  log(`done. app: http://localhost:${PORT} · db: ${LOCAL_DATABASE_URL}`);
}

main().catch((err) => die(err.stack || err.message));
