import { defineConfig } from "vitest/config";
import path from "node:path";

// No @vitejs/plugin-react: the plugin build in the lockfile imports a vite
// subpath the resolved vite does not export. esbuild's automatic JSX runtime
// compiles the .tsx tests instead.
export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/unit/**/*.test.{ts,tsx,mjs}"],
  },
});
