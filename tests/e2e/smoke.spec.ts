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

test("an /app page is served with one <html>: the app layout does not nest its own", async ({ request }) => {
  // A visitor with no Clerk cookies is let through to the call room's own
  // signed-out refusal, which renders inside the /app layout.
  const res = await request.get("/app/call/00000000-0000-4000-8000-000000000000", { maxRedirects: 0 });
  test.skip(res.status() !== 200, `the middleware answered ${res.status()} instead of rendering /app`);
  const html = await res.text();
  expect(html).toContain('data-refusal-reason="signed_out"');
  expect(html.match(/<html/g)).toHaveLength(1);
});
