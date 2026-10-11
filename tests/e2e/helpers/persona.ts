// tests/e2e/helpers/persona.ts — synthetic personas that walk the REAL
// sign-up + five-step onboarding wizard, then queue and call.
//
// Everything here drives the live keyless-Clerk dev stack: no mocks, no
// shortcuts through the UI. Personas are run-salted so concurrent runs and
// reruns never collide on emails or handles.
import { expect, type Page } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

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
    email: `j${letter.toLowerCase()}+clerk_test_${RUN_SALT}_${Math.random()
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

/** Signs up a persona through the real Clerk sign-up form (test token). */
export async function signUpPersona(
  page: Page,
  persona: Persona,
): Promise<void> {
  await setupClerkTestingToken({ page });
  await page.goto("/sign-up");
  await page.waitForLoadState("domcontentloaded");

  await page.locator('input[id="firstName-field"]').fill(persona.firstName);
  await page.locator('input[id="lastName-field"]').fill(persona.lastName);
  await page.locator('input[id="emailAddress-field"]').fill(persona.email);
  await page.locator('input[id="password-field"]').fill(persona.password);

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL(/sign-up\/verify/, { timeout: 60_000 });

  const otp = page.getByRole("textbox", { name: /verification code/i });
  await otp.waitFor({ state: "visible", timeout: 30_000 });
  // The testing token auto-fills/verifies; wait for Clerk's success state.
  await page.getByText("Success").first().waitFor({ timeout: 30_000 });
}

const GENDER_LABEL: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  "non-binary": "Non-binary",
  "prefer-not-to-say": "Prefer not to say",
};

/**
 * Walks the real five-step onboarding wizard for a signed-up persona.
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

  const keyless = page.getByRole("button", { name: /keyless prompt/i });
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

  await page.locator('[role="combobox"]').first().click();
  await page
    .getByRole("option", { name: GENDER_LABEL[persona.gender] })
    .click({ force: true });
  await page.waitForTimeout(600);
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
  await page
    .getByRole("heading", { name: "Welcome to the Club!" })
    .waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "Start Connecting" }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
}

/** Queue phases the engine renders on [data-queue-phase]. */
export type QueuePhase = "loading" | "error" | "waiting" | "matched";

/** Navigates to the smart-connection queue for a type; the engine auto-joins. */
export async function gotoQueue(
  page: Page,
  queueType: "casual" | "professional",
): Promise<void> {
  await page.goto(`/app/smart-connection?type=${queueType}`);
  await page
    .locator('[data-queue-phase="waiting"], [data-queue-phase="matched"]')
    .waitFor({ state: "visible", timeout: 60_000 });
}

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
  await page.waitForURL(/\/app\/call\/[0-9a-f-]{36}/, { timeout: 30_000 });
  return page.url().match(/\/app\/call\/([0-9a-f-]{36})/)![1];
}

/** Best-effort: expect() wrapper so failures carry readable context. */
export async function expectVisible(
  page: Page,
  selector: string,
): Promise<void> {
  await expect(page.locator(selector)).toBeVisible();
}
