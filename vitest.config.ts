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
      // Next enforces server-only at build time; Node unit tests run that code.
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/unit/**/*.test.{ts,tsx,mjs}", "tools/call-eval/**/*.test.mjs"],
    // Files run one at a time. Two files share the stack's queue table, and
    // pairing takes the oldest waiting entries of a type whoever owns them:
    // in parallel, call-room.access.db's waiting neighbour paired with a
    // matching witness, then vanished with its room when that file cleaned
    // up (seen 2 of 4 runs before this setting).
    fileParallelism: false,
  },
});
