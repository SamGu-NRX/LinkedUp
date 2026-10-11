import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "fs";
import path from "path";

// Final-state checks for the revised landing: keyboard operation, reduced
// motion, axe (no serious/critical), and configured-link resolution.
// Raw findings land in evidence/linkedup-site/findings/.

test.describe("keyboard operation", () => {
  test("nav and primary actions are keyboard reachable and operable", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Tab through: every focusable control keeps a visible focus outline.
    const focusSamples: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().slice(0, 40),
          outline: style.outlineStyle,
          boxShadow: style.boxShadow,
        };
      });
      if (info) focusSamples.push(`${info.tag}:${info.text}`);
      // Visible focus: some outline/shadow, or not explicitly none.
      if (info) {
        expect(
          info.outline !== "none" || info.boxShadow !== "none",
          `focus not visible on: ${info.text}`,
        ).toBeTruthy();
      }
    }
    fs.mkdirSync(path.join(__dirname, "..", "findings"), { recursive: true });
    fs.writeFileSync(
      path.join(__dirname, "..", "findings", "keyboard-focus-order.json"),
      JSON.stringify(focusSamples, null, 2),
    );

    // Enter on the "How it works" control scrolls to a real section.
    // The nav collapses on mobile, so match whichever "How it works" control
    // is visible in the current viewport.
    const how = page
      .locator("button:visible")
      .filter({ hasText: /how it works/i })
      .first();
    await how.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1200);
    const scrolled = await page.evaluate(() => window.scrollY > 200);
    expect(scrolled, "Enter on 'How it works' did not scroll").toBeTruthy();

    // The demo link is a real anchor pointing at /app (route existence is
    // proven by the link-check spec).
    const demo = page.getByRole("link", { name: /demo|open the app/i }).first();
    await demo.focus();
    await expect(demo).toHaveAttribute("href", /\/app/);
  });
});

test.describe("reduced motion", () => {
  test("page is static under prefers-reduced-motion: reduce", async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const sample = () =>
      page.evaluate(() => {
        const els = [
          ...document.querySelectorAll<HTMLElement>("*[style*='transform']"),
        ].slice(0, 40);
        return els.map((el) => el.style.transform + "|" + el.style.opacity);
      });

    const before = await sample();
    await page.waitForTimeout(1500);
    const after = await sample();

    const changed: number[] = [];
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== after[i]) changed.push(i);
    }
    expect(
      changed,
      `animated elements under reduced motion: ${changed.join(",")}`,
    ).toEqual([]);

    fs.mkdirSync(path.join(__dirname, "..", "findings"), { recursive: true });
    fs.writeFileSync(
      path.join(
        __dirname,
        "..",
        "findings",
        `reduced-motion-${testInfo.project.name}.json`,
      ),
      JSON.stringify(
        { sampledElements: before.length, changedIndexes: changed },
        null,
        2,
      ),
    );
  });
});

test.describe("axe", () => {
  for (const mode of ["load", "full-scroll"] as const) {
    test(`no serious or critical violations (${mode})`, async ({ page }, testInfo) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      if (mode === "full-scroll") {
        // Walk the page so whileInView content has mounted.
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 100));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(800);
      }
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const serious = results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      );
      fs.mkdirSync(path.join(__dirname, "..", "findings"), { recursive: true });
      fs.writeFileSync(
        path.join(
          __dirname,
          "..",
          "findings",
          `axe-${mode}-${testInfo.project.name}.json`,
        ),
        JSON.stringify(
          {
            mode,
            project: testInfo.project.name,
            seriousCritical: serious.map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.map((n) => n.target),
            })),
            allViolationIds: results.violations.map((v) => v.id),
          },
          null,
          2,
        ),
      );
      expect(
        serious,
        `serious/critical axe violations: ${serious.map((v) => v.id).join(", ")}`,
      ).toEqual([]);
    });
  }
});

test.describe("configured links", () => {
  test("every internal href resolves and every anchor target exists", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const hrefs = await page.evaluate(() => [
      ...new Set(
        [...document.querySelectorAll("a[href]")].map((a) =>
          (a as HTMLAnchorElement).getAttribute("href"),
        ),
      ),
    ]);

    const report: Array<{ href: string; status: string }> = [];
    for (const href of hrefs) {
      if (!href) continue;
      if (href.startsWith("/")) {
        const resp = await page.request.get(href, { maxRedirects: 0 });
        // /app is Clerk-gated: a redirect to sign-in still proves the route
        // exists. Accept 200 and 3xx; anything else is broken.
        const ok =
          resp.status() === 200 ||
          (resp.status() >= 300 && resp.status() < 400);
        report.push({ href, status: `${resp.status()} ${ok ? "ok" : "unexpected"}` });
        expect(
          ok,
          `internal href did not resolve: ${href} -> ${resp.status()}`,
        ).toBeTruthy();
      } else if (href.startsWith("#")) {
        const found = await page.evaluate(
          (id) => !!document.getElementById(id.slice(1)),
          href,
        );
        report.push({ href, status: found ? "anchor ok" : "anchor missing" });
        expect(found, `missing anchor target: ${href}`).toBeTruthy();
      } else {
        expect(
          href.startsWith("https://"),
          `external link not https: ${href}`,
        ).toBeTruthy();
        report.push({ href, status: "external https" });
      }
    }
    fs.mkdirSync(path.join(__dirname, "..", "findings"), { recursive: true });
    fs.writeFileSync(
      path.join(__dirname, "..", "findings", "link-check.json"),
      JSON.stringify(report, null, 2),
    );
  });

  test("no claim from the fabricated inventory remains", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const body = await page.evaluate(() => document.body.innerText);
    const banned = [
      "50K+",
      "92%",
      "4.8/5",
      "120+",
      "BS Detection",
      "Trust Score",
      "Industry-Leading Retention",
      "Join thousands",
      "Sarah K.",
      "Alex T.",
      "Mike R.",
      "Less Cringe Than LinkedIn",
    ];
    const found = banned.filter((b) => body.includes(b));
    expect(
      found,
      `fabricated claims still on the page: ${found.join(", ")}`,
    ).toEqual([]);
  });
});
