import { expect, test } from "@playwright/test";

/**
 * The single smoke journey for now: the keyless-Clerk dev server serves the
 * landing page and the Clerk sign-in catch-all. The full J suite (two
 * browsers completing onboarding -> queue -> match -> same call room) is a
 * separate later task and must not be built here.
 */
test("landing and sign-in render through keyless Clerk", async ({ page }) => {
  const home = await page.goto("/");
  expect(home?.status()).toBe(200);
  await expect(page).toHaveTitle(/LinkedUp/i);

  const signIn = await page.goto("/sign-in");
  expect(signIn?.status()).toBe(200);
  // Clerk's <SignIn /> mounts its identifier field once hydrated.
  await expect(page.locator("input[name='identifier']").first()).toBeVisible();
});
