import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://localhost:3207" },
  webServer: {
    command: "node scripts/interest-matching/stack.mjs",
    url: "http://localhost:3207/sign-in",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
