// tests/e2e/helpers/normal-route.ts — the normal-route reachability probe.
//
// The reserved middleware (src/middleware.ts:23) gates every protected route
// on the PRESENTED SESSION TOKEN carrying metadata.onboardingComplete. The
// app writes that value into Clerk publicMetadata (src/app/onboarding/_actions.ts),
// but it reaches a token only when the Clerk instance's session-token
// customization includes it — a dashboard setting. This module collects the
// exact evidence of whether the instance the stack runs on issues the claim:
//
//   - the decoded __session claims of a signed-in, finished persona;
//   - where the middleware sends each normal-route URL (queue, call, APIs);
//   - Clerk's own CLI refusal for unclaimed instances ("Unsupported config
//     key for an unclaimed accountless application: session"), captured by
//     running `clerk config pull` against the keyless instance's secret.
//
// Nothing here intercepts the app: the probe navigates like a user and reads
// cookies via Playwright's own context API.
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { BrowserContext, Page } from "@playwright/test";
import { KEYLESS_PATH } from "./clerk-keyless";

const execFileP = promisify(execFile);

/** The normal-route URLs a finished user should reach in the app. */
export const NORMAL_ROUTES = {
  queue: "/app/smart-connection?type=casual",
  call: "/app/call/00000000-0000-0000-0000-000000000000",
  signalApi: "/api/call/signal",
  iceApi: "/api/call/ice?room=00000000-0000-0000-0000-000000000000",
} as const;

export interface RouteOutcome {
  url: string;
  /** Where the browser/request actually ended up. */
  finalUrl: string;
  status: number | null;
  bouncedToOnboarding: boolean;
}

/** The signed-in persona's session-token payload (JWT claims). */
export async function sessionClaims(context: BrowserContext): Promise<Record<string, unknown>> {
  const cookie = (await context.cookies()).find((c) => c.name === "__session");
  if (!cookie) throw new Error("no __session cookie: the persona is not signed in");
  const payload = cookie.value.split(".")[1];
  if (!payload) throw new Error("__session cookie is not a JWT");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
}

/** Where the middleware sends one normal-route URL for this signed-in context. */
export async function probeRoute(context: BrowserContext, url: string): Promise<RouteOutcome> {
  // APIRequestContext shares the browser context's cookie jar. Redirects are
  // NOT followed: for a finished persona the middleware's bounce is a LOOP
  // (middleware sends /app -> /onboarding, the onboarding layout sends a
  // DB-complete user back to /app), so following them exhausts any budget.
  // The first hop's Location header IS the evidence.
  let status: number | null = null;
  let location: string | null = null;
  try {
    const res = await context.request.get(url, { maxRedirects: 0 });
    status = res.status();
    location = res.headers()?.location ?? null;
  } catch (err) {
    const e = err as { message?: string };
    status = null;
    location = `probe error: ${e.message?.split("\n")[0]?.slice(0, 160) ?? "unknown"}`;
  }
  const finalUrl = location ?? url;
  return {
    url,
    finalUrl,
    status,
    bouncedToOnboarding:
      finalUrl.startsWith("/") ? finalUrl.startsWith("/onboarding") : new URL(finalUrl).pathname === "/onboarding",
  };
}

/** Every NORMAL_ROUTES URL probed in order. */
export async function probeNormalRoutes(context: BrowserContext): Promise<RouteOutcome[]> {
  const out: RouteOutcome[] = [];
  for (const url of Object.values(NORMAL_ROUTES)) out.push(await probeRoute(context, url));
  return out;
}

/**
 * A signed-in, finished persona can open the normal queue: the middleware
 * let the document through instead of bouncing it to /onboarding.
 */
export async function normalRouteReachable(context: BrowserContext): Promise<boolean> {
  const claims = await sessionClaims(context);
  const onboardingComplete = (
    claims as { metadata?: { onboardingComplete?: unknown } }
  )?.metadata?.onboardingComplete;
  if (onboardingComplete !== true) return false;
  const outcomes = await probeNormalRoutes(context);
  return !outcomes[0]!.bouncedToOnboarding;
}

/** Clerk's own CLI verdict on customizing this instance's session tokens. */
export async function clerkSessionConfigVerdict(): Promise<string> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is unset: tests/e2e/global-setup.ts did not run");
  try {
    const { stdout } = await execFileP("npx", ["-y", "clerk@latest", "config", "pull", "--keys", "session"], {
      env: { ...process.env, CLERK_SECRET_KEY: secretKey },
      timeout: 60_000,
    });
    return stdout.trim().slice(0, 500);
  } catch (err) {
    // The CLI's refusal comes back on stderr/nonzero exit — that IS the verdict.
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return (e.stdout ?? e.stderr ?? e.message ?? "").trim().slice(0, 500);
  }
}

/** Read-only snapshot of the keyless instance's stored keys file (no secrets logged). */
export async function keylessInstanceKind(): Promise<string> {
  try {
    const raw = JSON.parse(await readFile(path.resolve(KEYLESS_PATH), "utf8")) as Record<string, unknown>;
    return typeof raw.instance_type === "string" ? raw.instance_type : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * One-line human summary of the blocked setup, for annotations and the
 * scorecard. Claims evidence first; the CLI verdict is the citation.
 */
export async function blockedSetupSummary(context: BrowserContext): Promise<string[]> {
  const lines: string[] = [];
  const claims = await sessionClaims(context);
  lines.push(
    `session-token claims: ${JSON.stringify(claims)} — metadata.onboardingComplete ${
      (claims as { metadata?: { onboardingComplete?: unknown } })?.metadata?.onboardingComplete === true
        ? "present"
        : "ABSENT"
    }`,
  );
  for (const o of await probeNormalRoutes(context)) {
    lines.push(`GET ${o.url} -> ${o.status} ${o.finalUrl}${o.bouncedToOnboarding ? " (middleware bounce)" : ""}`);
  }
  lines.push(`clerk CLI config pull: ${await clerkSessionConfigVerdict()}`);
  lines.push(`keyless instance type: ${await keylessInstanceKind()}`);
  return lines;
}

/** Opens the normal queue (used only when normalRouteReachable held). */
export async function gotoNormalQueue(page: Page, queueType: "casual" | "professional"): Promise<void> {
  await page.goto(`/app/smart-connection?type=${queueType}`);
  await page.locator('[data-queue-phase="waiting"], [data-queue-phase="matched"]').waitFor({
    state: "visible",
    timeout: 60_000,
  });
}
