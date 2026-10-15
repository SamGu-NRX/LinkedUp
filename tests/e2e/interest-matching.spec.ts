import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { deleteClerkUserByEmail } from "./helpers/clerk-keyless";
import {
  deleteJourneyRows,
  interestNamesForUser,
  liveQueueRows,
  one,
  roomRow,
  userRowByEmail,
} from "./helpers/db";
import {
  PROOF_CALL,
  acceptMatch,
  completeOnboarding,
  gotoQueue,
  makePersona,
  signUpPersona,
  waitForQueuePhase,
} from "./helpers/persona";

const screenshots = path.resolve("docs/lane7/screenshots");
const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

type PersistedIntro = {
  reason: string;
  question: string;
  shared_interests: string[];
};

async function expectIntro(
  page: Page,
  variant: "card" | "compact",
  intro: PersistedIntro,
): Promise<void> {
  const region = page.locator(`[data-match-intro="${variant}"]`);
  await expect(region).toBeVisible();
  await expect(
    region.getByRole("heading", { name: "Start with a question" }),
  ).toBeVisible();
  await expect(region.getByText(intro.question, { exact: true })).toBeVisible();
  await expect(region.getByText(intro.reason, { exact: true })).toBeVisible();
  await expect(
    region
      .getByRole("list", { name: "Shared interests" })
      .getByRole("listitem"),
  ).toHaveText(intro.shared_interests);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ),
  }));
  expect(
    dimensions.content,
    "page content fits the viewport horizontally",
  ).toBeLessThanOrEqual(dimensions.viewport);
}

async function capture(page: Page, name: string): Promise<void> {
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(screenshots, `${name}.png`),
    fullPage: false,
  });
}

async function expectReducedMotion(
  page: Page,
  selector: string,
): Promise<void> {
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
  await expect
    .poll(
      () =>
        page
          .locator(selector)
          .evaluate(
            (element) =>
              element
                .getAnimations({ subtree: true })
                .filter(
                  (animation) =>
                    animation.playState === "running" &&
                    Number(animation.effect?.getComputedTiming().duration) > 0,
                ).length,
          ),
      { message: "reduced-motion screen has no running animation" },
    )
    .toBe(0);
}

for (const viewport of viewports) {
  test(`interest matching persists one intro through queue and call at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(420_000);
    testInfo.annotations.push({
      type: "route limitation",
      description:
        "Real synthetic signup and onboarding, then the approved journey-proof queue/call routes. Normal /app middleware acceptance is outside this test.",
    });
    const created: { context: BrowserContext; email: string }[] = [];
    const size = `${viewport.width}x${viewport.height}`;
    await mkdir(screenshots, { recursive: true });

    try {
      const newActor = async (letter: string) => {
        const persona = makePersona(`Interest${letter}`);
        const context = await browser.newContext({
          baseURL: testInfo.project.use.baseURL,
          viewport,
          permissions: ["microphone", "camera"],
          reducedMotion: "no-preference",
        });
        created.push({ context, email: persona.email });
        const page = await context.newPage();
        await signUpPersona(page, persona);
        await completeOnboarding(page, persona);
        const user = await userRowByEmail(persona.email);
        if (!user)
          throw new Error(`No persisted user after onboarding ${letter}`);
        expect(user.onboarding_complete).toBe(true);
        expect(await interestNamesForUser(user.id)).toEqual(
          [...persona.interests].sort(),
        );
        return { page, userId: user.id };
      };
      const a = await newActor("A");
      const b = await newActor("B");

      await gotoQueue(a.page, "casual");
      await waitForQueuePhase(a.page, "waiting");
      await capture(a.page, `waiting-${size}`);
      await a.page.emulateMedia({ reducedMotion: "reduce" });
      await expectReducedMotion(a.page, '[data-queue-phase="waiting"]');
      await capture(a.page, `waiting-reduced-motion-${size}`);
      await a.page.emulateMedia({ reducedMotion: "no-preference" });

      await gotoQueue(b.page, "casual");
      await Promise.all(
        [a, b].map(({ page }) => waitForQueuePhase(page, "matched", 30_000)),
      );
      const [aEntries, bEntries] = await Promise.all([
        liveQueueRows(a.userId),
        liveQueueRows(b.userId),
      ]);
      expect(aEntries).toHaveLength(1);
      expect(bEntries).toHaveLength(1);
      const aEntry = aEntries[0];
      const bEntry = bEntries[0];
      if (!aEntry?.room_id || !bEntry?.room_id)
        throw new Error("Matched users have no persisted room");
      expect(aEntry.status).toBe("matched");
      expect(bEntry.status).toBe("matched");
      expect(bEntry.room_id).toBe(aEntry.room_id);
      const roomId = aEntry.room_id;
      const room = await roomRow(roomId);
      expect(room?.status).toBe("active");
      expect(new Set([room?.user1_id, room?.user2_id])).toEqual(
        new Set([a.userId, b.userId]),
      );
      const intro = await one<PersistedIntro>(
        "SELECT reason, question, shared_interests FROM room_match_intros WHERE room_id = $1",
        [roomId],
      );
      if (!intro) throw new Error("Matched room has no persisted introduction");
      expect(intro.reason.trim().length).toBeGreaterThan(0);
      expect(intro.question.trim().length).toBeGreaterThan(0);
      expect(intro.shared_interests).toEqual(["gaming", "programming"]);
      for (const actor of [a, b]) await expectIntro(actor.page, "card", intro);
      await capture(a.page, `matched-card-${size}`);

      // Reload must reuse the room's introduction rather than generate another.
      await a.page.reload();
      await waitForQueuePhase(a.page, "matched");
      await expectIntro(a.page, "card", intro);
      await a.page.emulateMedia({ reducedMotion: "reduce" });
      await expectReducedMotion(a.page, '[data-queue-phase="matched"]');
      await capture(a.page, `matched-card-reduced-motion-${size}`);

      const join = a.page.getByRole("button", {
        name: "Join the call",
        exact: true,
      });
      await a.page.locator("[data-call-decline]").focus();
      await a.page.keyboard.press("Shift+Tab");
      await expect(join).toBeFocused();
      expect(
        await join.evaluate((button) => {
          const style = getComputedStyle(button);
          return (
            button.matches(":focus-visible") &&
            ((style.outlineStyle !== "none" &&
              parseFloat(style.outlineWidth) > 0) ||
              style.boxShadow !== "none")
          );
        }),
        "Join the call has a visible keyboard focus indicator",
      ).toBe(true);
      await capture(a.page, `matched-card-keyboard-focus-${size}`);
      const enteredCall = a.page.waitForURL(`${PROOF_CALL}${roomId}`);
      await a.page.keyboard.press("Enter");
      await enteredCall;
      expect(await acceptMatch(b.page)).toBe(roomId);
      for (const actor of [a, b]) {
        await expect(actor.page.locator("[data-call-root]")).toBeVisible();
        await expectIntro(actor.page, "compact", intro);
        await expectNoHorizontalOverflow(actor.page);
      }
      await expectReducedMotion(a.page, "[data-call-root]");
      await capture(a.page, `in-call-question-reduced-motion-${size}`);
      await a.page.emulateMedia({ reducedMotion: "no-preference" });
      await capture(a.page, `in-call-question-${size}`);
      expect(
        await one<PersistedIntro>(
          "SELECT reason, question, shared_interests FROM room_match_intros WHERE room_id = $1",
          [roomId],
        ),
      ).toEqual(intro);
    } finally {
      const closed = await Promise.allSettled(
        created.map(({ context }) => context.close()),
      );
      const emails = created.map(({ email }) => email);
      const deleted = await Promise.allSettled([
        deleteJourneyRows(emails),
        ...emails.map((email) => deleteClerkUserByEmail(email)),
      ]);
      const failures = [...closed, ...deleted].filter(
        (result) => result.status === "rejected",
      );
      if (failures.length)
        throw new AggregateError(
          failures.map((result) => result.reason),
          "Interest journey cleanup failed",
        );
    }
  });
}
