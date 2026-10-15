// Lane 7's local runner. Reuses the shared cluster, migrates only linkedup_match,
// and never starts/stops Postgres or reads another worktree's environment.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { spawn } from "node:child_process";

const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:54329/linkedup_match";
const admin = postgres("postgresql://postgres:postgres@127.0.0.1:54329/postgres", { max: 1, connect_timeout: 5, onnotice: () => {} });
try {
  const [existing] = await admin`SELECT 1 FROM pg_database WHERE datname = 'linkedup_match'`;
  if (!existing) await admin`CREATE DATABASE linkedup_match`;
} finally {
  await admin.end();
}
const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
try {
  const [identity] = await client`SELECT current_database() AS name, inet_server_port() AS port`;
  if (identity.name !== "linkedup_match" || identity.port !== 54329) throw new Error("Lane 7 database identity mismatch");
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("Lane 7 database ready: linkedup_match on localhost:54329");
} finally {
  await client.end();
}
if (!process.argv.includes("--database-only")) {
  const env = { ...process.env, DATABASE_URL: databaseUrl, LINKEDUP_JOURNEY_PROOF: "1", OPENAI_API_KEY: "" };
  // Keyless dev only. A shell's unrelated credentials must not select a tenant.
  delete env.CLERK_SECRET_KEY;
  delete env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const server = spawn("pnpm", ["exec", "next", "dev", "--port", "3207"], { env, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
  server.on("exit", (code) => { process.exitCode = code ?? 1; });
}
