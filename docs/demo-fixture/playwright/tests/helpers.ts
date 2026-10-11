// Shared helpers for the sample-demo evidence suite.

import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

/**
 * The real prerendered /demo route HTML produced by `pnpm build`. The harness
 * serves this document for the one intercepted request; see the config header.
 */
export function prerenderedDemoHtml(): string {
  return readFileSync(
    path.resolve(process.cwd(), ".next/server/app/demo.html"),
    "utf8",
  );
}

/** Installs the /demo document interception and navigates to the real URL. */
export async function openDemo(page: Page): Promise<void> {
  const html = prerenderedDemoHtml();
  await page.route("**/demo", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: html,
    }),
  );
  await page.goto("/demo");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

// ---------------------------------------------------------------------------
// Network log
// ---------------------------------------------------------------------------

export interface RequestRecord {
  url: string;
  method: string;
  resourceType: string;
  failed: boolean;
  failure?: string;
}

export interface NetworkLog {
  requests: RequestRecord[];
  external: RequestRecord[];
  renderLines(): string[];
}

function isLocalUrl(url: string): boolean {
  // data:, blob:, about: have no remote host.
  if (!/^https?:/i.test(url)) return true;
  const host = new URL(url).hostname;
  return (
    host === "127.0.0.1" ||
    host === "localhost" ||
    host === "::1" ||
    host === "[::1]" ||
    host === "0.0.0.0"
  );
}

/**
 * Records every request (including failures) from page open to collection.
 * `external` is the subset whose host is not the harness — for the demo it
 * must be empty.
 */
export function attachNetworkLog(page: Page): NetworkLog {
  const requests: RequestRecord[] = [];
  const failures = new Map<string, string>();
  page.on("request", (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      failed: false,
    });
  });
  page.on("requestfailed", (request) => {
    failures.set(request.url(), request.failure()?.errorText ?? "unknown");
  });
  return {
    requests,
    get external() {
      return requests.filter((r) => !isLocalUrl(r.url));
    },
    renderLines(): string[] {
      return requests.map((r) => {
        const failure = failures.get(r.url);
        const status = r.failed || failure ? ` FAILED(${failure ?? "?"})` : "";
        return `${r.method} ${r.resourceType.padEnd(10)} ${r.url}${status}`;
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Keyboard-only navigation
// ---------------------------------------------------------------------------

/** Presses Tab until the focused element's accessible label matches `label`. */
export async function tabTo(
  page: Page,
  label: RegExp,
  maxStops = 60,
): Promise<void> {
  for (let i = 0; i < maxStops; i += 1) {
    const active = await page.evaluate(() => {
      const el = document.activeElement;
      // body/html or a node detached by the last stage transition means
      // focus is not established yet — body's textContent is the whole
      // page and must never be treated as a match.
      if (
        !el ||
        el === document.body ||
        el === document.documentElement ||
        !el.isConnected
      ) {
        return null;
      }
      return el.getAttribute("aria-label") ?? el.textContent ?? "";
    });
    if (active !== null && label.test(active)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab focus never reached ${label}`);
}

// ---------------------------------------------------------------------------
// Full sample flow walk (mouse era: clicks; assertions at every stage)
// ---------------------------------------------------------------------------

export async function walkToInCall(page: Page): Promise<void> {
  // Stage: profile choice
  await page.getByRole("button", { name: /sample profile option/i }).first().click();
  await page.getByRole("button", { name: "Continue to the simulated queue" }).click();

  // Stage: queue waiting — the simulated wait can be skipped honestly.
  await page.getByRole("button", { name: "Skip the simulated wait" }).click();

  // Stage: connection explanation
  await page.getByRole("button", { name: "Open the simulated meeting" }).click();

  // Stage: meeting preview
  await page.getByRole("button", { name: "Enter the simulated meeting" }).click();

  // Stage: in call
  await expect(page.getByTestId("demo-in-call")).toBeVisible();
}

/** Settle entry motion before an axe scan measures the resting state. */
export async function settleForAxe(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      "*, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }",
  });
  await page.waitForTimeout(800);
}

export async function screenshot(
  page: Page,
  project: string,
  name: string,
): Promise<void> {
  await page.screenshot({
    path: path.resolve(
      process.cwd(),
      "docs/demo-fixture/screenshots",
      project,
      `${name}.png`,
    ),
    fullPage: true,
  });
}
