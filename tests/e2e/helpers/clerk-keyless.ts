// tests/e2e/helpers/clerk-keyless.ts — the throwaway Clerk instance the
// stack runs on, as seen from the test process.
//
// With no keys configured, `next dev` provisions an unclaimed development
// instance on its first page load and writes its keys to
// .clerk/.tmp/keyless.json (CALL-PLAN L-D1). @clerk/testing needs that
// instance's secret key to mint a testing token, and journeys delete the
// synthetic users they create through the same key (development instances
// cap their user count). The keys stay in this process's environment: they
// are never logged or written anywhere else.
import fs from "node:fs";
import path from "node:path";

export const KEYLESS_PATH = path.resolve(__dirname, "../../../.clerk/.tmp/keyless.json");

/** Every synthetic journey email carries this marker (and Clerk's +clerk_test). */
export const JOURNEY_EMAIL_MARK = "+clerk_test_journey";

export async function waitForKeylessKeys(
  baseURL: string,
  timeoutMs = 120_000,
): Promise<{ publishableKey: string; secretKey: string }> {
  const deadline = Date.now() + timeoutMs;
  let provoked = false;
  for (;;) {
    if (fs.existsSync(KEYLESS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(KEYLESS_PATH, "utf8")) as {
        publishableKey?: string;
        secretKey?: string;
      };
      if (parsed.publishableKey && parsed.secretKey) {
        return { publishableKey: parsed.publishableKey, secretKey: parsed.secretKey };
      }
    }
    if (!provoked) {
      // A server render under keyless mode provisions the instance.
      await fetch(new URL("/sign-in", baseURL)).catch(() => {});
      provoked = true;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `No keyless Clerk keys at ${KEYLESS_PATH} after ${timeoutMs} ms. Is the stack running ` +
          "in keyless mode (pnpm dev:up, no Clerk keys in env files)?",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

/** Clerk's Backend API, authenticated with the keyless instance's secret. */
async function clerkApi<T>(method: "GET" | "DELETE", pathAndQuery: string): Promise<T> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is unset: tests/e2e/global-setup.ts did not run");
  const res = await fetch(`https://api.clerk.com/v1${pathAndQuery}`, {
    method,
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok && !(method === "DELETE" && res.status === 404)) {
    throw new Error(`Clerk Backend API ${method} ${pathAndQuery.split("?")[0]} answered ${res.status}`);
  }
  return (await res.json()) as T;
}

type ClerkUser = { id: string; email_addresses: { email_address: string }[] };

/** Delete one synthetic user by email. Missing users are fine. */
export async function deleteClerkUserByEmail(email: string): Promise<void> {
  if (!email.includes(JOURNEY_EMAIL_MARK)) {
    throw new Error(`Refusing to delete a Clerk user that is not a journey persona: ${email}`);
  }
  const found = await clerkApi<ClerkUser[]>("GET", `/users?email_address=${encodeURIComponent(email)}`);
  for (const user of found) await clerkApi("DELETE", `/users/${user.id}`);
}

/** Delete every journey persona left on the instance (crashed runs). */
export async function deleteAllJourneyClerkUsers(): Promise<number> {
  let deleted = 0;
  for (;;) {
    const page = await clerkApi<ClerkUser[]>(
      "GET",
      `/users?query=${encodeURIComponent(JOURNEY_EMAIL_MARK)}&limit=100`,
    );
    const personas = page.filter((u) =>
      u.email_addresses.some((e) => e.email_address.includes(JOURNEY_EMAIL_MARK)),
    );
    if (personas.length === 0) return deleted;
    for (const user of personas) {
      await clerkApi("DELETE", `/users/${user.id}`);
      deleted += 1;
    }
  }
}
