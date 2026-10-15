#!/usr/bin/env node
/** Build with this checkout's provisioned development instance, without printing keys. */
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const keys = JSON.parse(fs.readFileSync(".clerk/.tmp/keyless.json", "utf8"));
if (typeof keys.publishableKey !== "string" || typeof keys.secretKey !== "string") {
  throw new Error("Start the local keyless development server before building.");
}
const env = {
  ...process.env,
  DATABASE_URL: "postgresql://postgres@127.0.0.1:54329/linkedup_turn",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: keys.publishableKey,
  CLERK_SECRET_KEY: keys.secretKey,
};
delete env.LINKEDUP_JOURNEY_PROOF;
const result = spawnSync("pnpm", ["build"], { env, stdio: "inherit" });
process.exit(result.status ?? 1);
