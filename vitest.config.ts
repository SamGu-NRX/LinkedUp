import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mirror the project's tsconfig path alias so tests can import "@/..."
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": r("./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
