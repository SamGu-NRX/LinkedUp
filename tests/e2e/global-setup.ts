// tests/e2e/global-setup.ts — runs once, after the webServer is up.
//
// Loads the keyless instance's keys into this process (workers inherit the
// environment), mints a Clerk testing token, and removes journey personas a
// crashed earlier run left behind.
import type { FullConfig } from "@playwright/test";
import { clerkSetup } from "@clerk/testing/playwright";
import { deleteAllJourneyClerkUsers, waitForKeylessKeys } from "./helpers/clerk-keyless";
import { deleteJourneyRows } from "./helpers/db";

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  const keys = await waitForKeylessKeys(baseURL);
  process.env.CLERK_PUBLISHABLE_KEY = keys.publishableKey;
  process.env.CLERK_SECRET_KEY = keys.secretKey;
  await clerkSetup();
  await deleteAllJourneyClerkUsers();
  await deleteJourneyRows();
}
