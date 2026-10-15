// tests/e2e/helpers/persona.ts — synthetic personas that walk the REAL
// sign-up + five-step onboarding wizard, then queue and call.
//
// Everything here drives the live keyless-Clerk dev stack: no mocks, no
// shortcuts through the UI. Personas are run-salted so concurrent runs and
// reruns never collide on emails or handles.
import { expect, type Page } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { JOURNEY_EMAIL_MARK } from "./clerk-keyless";
import { userRowByEmail } from "./db";

export type Gender = "male" | "female" | "non-binary" | "prefer-not-to-say";

export interface Persona {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  age: number;
  gender: Gender;
  field: string;
  jobTitle: string;
  company: string;
  linkedinUrl: string;
  bio: string;
  interests: string[];
}

const RUN_SALT = Date.now();

export function makePersona(
  letter: string,
  overrides: Partial<Persona> = {},
): Persona {
  return {
    firstName: `Journey${letter}`,
    lastName: `Tester${RUN_SALT.toString(36)}`,
    email: `j${letter.toLowerCase()}${JOURNEY_EMAIL_MARK}_${RUN_SALT}_${Math.random()
      .toString(36)
      .slice(2, 7)}@example.com`,
    password: "Journey-Test-4242!",
    age: 25,
    gender: "prefer-not-to-say",
    field: "Software Development",
    jobTitle: `Journey Tester ${letter}`,
    company: "E2E Corp",
    linkedinUrl: `journey${letter.toLowerCase()}${RUN_SALT.toString(36)}`,
    bio: `Synthetic journey-testing persona ${letter} for automated LinkedUp runs.`,
    interests: ["Programming", "Video Games"],
    ...overrides,
  };
}

/** Clerk's fixed verification code for +clerk_test addresses on development instances. */
export const CLERK_TEST_CODE = "424242";

/**
 * Signs up a persona through the real Clerk sign-up form: details, then the
 * email verification step, where it types Clerk's test code. The testing
 * token only lets the browser past Clerk's bot protection; it verifies
 * nothing.
 */
export async function signUpPersona(
  page: Page,
  persona: Persona,
): Promise<void> {
  await setupClerkTestingToken({ page });
  await page.goto("/sign-up");

  const fillIfPresent = async (selector: string, value: string) => {
    const field = page.locator(selector);
    if (await field.count()) await field.fill(value);
  };
  await page.locator('input[name="emailAddress"]').waitFor({ timeout: 60_000 });
  await fillIfPresent('input[name="firstName"]', persona.firstName);
  await fillIfPresent('input[name="lastName"]', persona.lastName);
  await page.locator('input[name="emailAddress"]').fill(persona.email);
  await fillIfPresent('input[name="password"]', persona.password);
  // At 390px the expanded development prompt covers Continue. Collapse the
  // actual expanded control rather than clicking through its overlay.
  const prompt = page.getByRole("button", { name: "Keyless prompt", exact: true, expanded: true });
  if (await prompt.count()) await prompt.click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // Clerk renders the code as one autocomplete=one-time-code input; typing
  // the six digits submits it.
  const code = page.locator('input[autocomplete="one-time-code"]').first();
  await code.waitFor({ state: "visible", timeout: 60_000 });
  await code.pressSequentially(CLERK_TEST_CODE, { delay: 50 });
  // Signed up means Clerk has an active session. Clerk's own redirect after
  // sign-up does not finish on this stack: its server action posts to
  // /sign-up/verify-email-address, which the reserved middleware redirects
  // to /onboarding (signed in, no onboarding claim), and the page stays put.
  // Signed up = Clerk's client holds a session for this browser. The next
  // page load turns it into the app's session cookie.
  await page.waitForFunction(
    () =>
      ((window as unknown as { Clerk?: { client?: { sessions?: unknown[] } } }).Clerk?.client?.sessions
        ?.length ?? 0) > 0,
    undefined,
    { timeout: 60_000 },
  );
}

const GENDER_LABEL: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  "non-binary": "Non-binary",
  "prefer-not-to-say": "Prefer not to say",
};

/**
 * Walks the real five-step onboarding wizard for a signed-up persona and
 * returns once Postgres records them onboarded. What the browser does next
 * is the middleware loop (witnessed in journeys.spec.ts), so journeys
 * continue through the journey-proof path.
 * The Clerk keyless-mode prompt overlay re-renders the tree, so portal
 * options are force-clicked after a settle beat.
 */
export async function completeOnboarding(
  page: Page,
  persona: Persona,
): Promise<void> {
  await page.goto("/onboarding");
  await page
    .getByRole("heading", { name: "Create Your Profile" })
    .waitFor({ timeout: 60_000 });

  const keyless = page.getByRole("button", { name: /keyless prompt/i, expanded: true });
  if (await keyless.count()) {
    await keyless.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }

  // Step 1 — Basic Info: age slider (keyboard) + gender select.
  // The Clerk keyless prompt can re-render the tree and steal focus, so the
  // slider value is verified after pressing; silent no-ops are retried.
  const slider = page.locator('[role="slider"]').first();
  await slider.waitFor({ state: "visible", timeout: 20_000 });
  const sliderValue = async () =>
    Number((await slider.getAttribute("aria-valuenow")) ?? NaN);
  for (let attempt = 0; attempt < 5; attempt++) {
    await slider.focus(); // keyboard-driven: the thumb is focusable
    const now = await sliderValue();
    if (Number.isNaN(now)) {
      await page.waitForTimeout(400);
      continue;
    }
    const delta = persona.age - now;
    for (let i = 0; i < Math.abs(delta); i++) {
      await page.keyboard.press(delta > 0 ? "ArrowRight" : "ArrowLeft");
    }
    await page.waitForTimeout(200); // let the re-render settle before re-reading
    if ((await sliderValue()) === persona.age) break;
  }
  const finalAge = await sliderValue();
  if (finalAge !== persona.age) {
    throw new Error(
      `Age slider did not reach ${persona.age} (stuck at ${finalAge})`,
    );
  }

  const gender = page.getByRole("combobox").first();
  // The default is already selected for most personas. Opening that portal
  // needlessly let Clerk's keyless prompt steal focus and close the list.
  if (await gender.textContent() !== GENDER_LABEL[persona.gender]) {
    await gender.press("Space");
    await page.getByRole("option", { name: GENDER_LABEL[persona.gender], exact: true }).click({ timeout: 15_000 });
  }
  await expect(gender).toHaveText(GENDER_LABEL[persona.gender]);
  await page.getByRole("button", { name: "Continue", exact: true }).first().click();

  // Step 2 — Professional Info: field combobox + title/company/linkedin.
  await page
    .getByRole("heading", { name: "Professional Information" })
    .waitFor({ timeout: 20_000 });
  await page.locator('[role="combobox"]').first().click();
  await page.waitForTimeout(600);
  await page
    .getByRole("option", { name: persona.field, exact: true })
    .click({ force: true });
  await page.waitForTimeout(400);
  await page.locator('input[name="jobTitle"]').fill(persona.jobTitle);
  await page.locator('input[name="company"]').fill(persona.company);
  await page.locator('input[name="linkedinUrl"]').fill(persona.linkedinUrl);
  await page.getByRole("button", { name: "Continue", exact: true }).first().click();

  // Step 3 — Bio.
  await page.getByRole("heading", { name: "About You" }).waitFor({ timeout: 20_000 });
  await page.locator("textarea").first().fill(persona.bio);
  await page.getByRole("button", { name: "Continue", exact: true }).first().click();

  // Step 4 — Interests: toggle the persona's picks.
  await page
    .getByRole("heading", { name: "Your Interests" })
    .waitFor({ timeout: 20_000 });
  for (const interest of persona.interests) {
    await page
      .getByRole("button", { name: interest, exact: true })
      .click({ force: true });
  }
  await page.getByRole("button", { name: "Continue", exact: true }).first().click();

  // Step 5 — Summary: submit and pass the congrats screen.
  await page
    .getByRole("button", { name: "Complete Profile" })
    .waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Complete Profile" }).click();
  // Done = the action marked the person onboarded in Postgres. The
  // "Welcome to the Club!" screen does not reliably appear: the action's
  // revalidation re-runs the /onboarding layout, which redirects a finished
  // user to /app, which the reserved middleware sends back to /onboarding.
  await expect
    .poll(async () => (await userRowByEmail(persona.email))?.onboarding_complete ?? false, {
      timeout: 60_000,
      message: "users.onboarding_complete after Complete Profile",
    })
    .toBe(true);
}

/**
 * The labelled journey-proof path (src/app/journey-proof/): the real queue
 * and call room, served at the only URL the reserved middleware lets a
 * signed-in user without the onboarding claim reach.
 */
export const PROOF_QUEUE = "/onboarding?journey-proof=queue";
export const PROOF_CALL = "/onboarding?journey-proof=call&room=";
const PROOF_CALL_URL = /\/onboarding\?journey-proof=call&room=([0-9a-f-]{36})/;

/** Opens the queue for a type; the engine joins on mount. */
export async function gotoQueue(
  page: Page,
  queueType: "casual" | "professional",
): Promise<void> {
  await page.goto(`${PROOF_QUEUE}&type=${queueType}`);
  await page.locator('[data-journey-proof="queue"]').waitFor({ timeout: 60_000 });
  await page
    .locator('[data-queue-phase="waiting"], [data-queue-phase="matched"]')
    .waitFor({ state: "visible", timeout: 60_000 });
}

/** Queue phases the engine renders on [data-queue-phase]. */
export type QueuePhase = "loading" | "error" | "waiting" | "matched";

/** Waits until the queue engine reports the given phase. */
export async function waitForQueuePhase(
  page: Page,
  phase: QueuePhase,
  timeoutMs = 60_000,
): Promise<void> {
  await page
    .locator(`[data-queue-phase="${phase}"]`)
    .waitFor({ state: "visible", timeout: timeoutMs });
}

/** Accepts the match and lands in the call room; returns the room id. */
export async function acceptMatch(page: Page): Promise<string> {
  await page.locator("[data-call-accept]").click();
  await page.waitForURL(PROOF_CALL_URL, { timeout: 30_000 });
  await page.locator("[data-call-root]").waitFor({ state: "visible", timeout: 60_000 });
  return page.url().match(PROOF_CALL_URL)![1];
}

/** Best-effort: expect() wrapper so failures carry readable context. */
export async function expectVisible(
  page: Page,
  selector: string,
): Promise<void> {
  await expect(page.locator(selector)).toBeVisible();
}
