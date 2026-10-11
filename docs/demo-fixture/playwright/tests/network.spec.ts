// Zero-remote-effect proof: records every request (including failures) across
// a whole demo run — natural queue match, in-call, local chat, leave, restart,
// and a rehearsed failure — then asserts that no request leaves the harness.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

import { attachNetworkLog, openDemo } from "./helpers";

test.describe("zero remote effect", () => {
  test("a whole demo run makes zero outbound (non-local) requests @desktop", async ({ page }) => {
    test.setTimeout(180_000);
    const log = attachNetworkLog(page);

    await openDemo(page);

    // Profile choice, then let the simulated queue match NATURALLY (8s on the
    // scripted clock) — the most the wait can ever do.
    await page.getByRole("button", { name: /sample profile option/i }).first().click();
    await page.getByRole("button", { name: "Continue to the simulated queue" }).click();
    await page
      .getByRole("button", { name: "Open the simulated meeting" })
      .click({ timeout: 30_000 });

    // Device check → in call
    await page.getByRole("button", { name: "Enter the simulated meeting" }).click();
    await expect(page.getByTestId("demo-in-call")).toBeVisible();

    // A local-only chat message
    await page.getByTestId("demo-chat-input").fill("Hello from the sample visitor");
    await page.getByRole("button", { name: "Add locally" }).click();
    await expect(page.getByTestId("demo-chat-log")).toContainText(
      "Hello from the sample visitor",
    );

    // One rehearsed failure and its recovery
    await page.getByText("Demo controls — rehearse a failure path (sample only)").click();
    await page.getByRole("button", { name: /Rehearse: queue expired/ }).click();
    await page
      .getByRole("heading", { name: "Sample queue: the simulated wait expired" })
      .waitFor();
    await page.getByRole("button", { name: "Rejoin the sample queue" }).click();

    // Back through the queue to the meeting, then leave
    await page.getByRole("button", { name: "Skip the simulated wait" }).click();
    await page.getByRole("button", { name: "Open the simulated meeting" }).click();
    await page.getByRole("button", { name: "Enter the simulated meeting" }).click();
    await page.getByRole("button", { name: "Leave the simulated meeting" }).click();
    await page
      .getByRole("heading", { name: "You left the simulated meeting" })
      .waitFor();
    await page.getByRole("button", { name: "Start the sample flow again" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // The whole run: zero requests to any non-local host, successful or failed.
    const external = log.external;
    writeFileSync(
      path.resolve(process.cwd(), "docs/demo-fixture/evidence/network-log.txt"),
      [
        `Requests recorded during a whole sample-demo run (${log.requests.length} total, all hosts):`,
        ...log.renderLines(),
        "",
        `External (non-local) requests: ${external.length}`,
      ].join("\n"),
    );
    expect(
      external,
      "the demo must make zero outbound requests — recorded:\n" +
        external.map((r) => `${r.url} (${r.failure ?? r.resourceType})`).join("\n"),
    ).toEqual([]);
  });
});
