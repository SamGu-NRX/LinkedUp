// tests/e2e/global-teardown.ts — leave the throwaway Clerk instance and the
// stack database without journey personas (each test also cleans its own).
import { deleteAllJourneyClerkUsers } from "./helpers/clerk-keyless";
import { deleteJourneyRows } from "./helpers/db";

export default async function globalTeardown(): Promise<void> {
  if (!process.env.CLERK_SECRET_KEY) return;
  await deleteAllJourneyClerkUsers();
  await deleteJourneyRows();
}
