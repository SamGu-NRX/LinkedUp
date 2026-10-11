import path from "node:path";
import { defineConfig } from "vitest/config";

// Demo-scoped Vitest configuration. The repository's root vitest.config.ts
// stays untouched (it is outside this task's ownership): it discovers the
// lib suites (src/**/*.test.ts, node environment). This config discovers
// the demo component suites (.test.tsx, jsdom) and is run from the repo
// root:
//
//   pnpm exec vitest run --config src/lib/demo/vitest.demo.config.ts
//
// Paths resolve against the working directory, matching how the repo's
// root vitest.config.ts resolves its relative include and alias.

const repoRoot = process.cwd();

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(repoRoot, "src"),
    },
  },
  // The repo tsconfig sets "jsx": "preserve" for Next's own compiler; under
  // Vitest the JSX must actually be transformed, so override it here.
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "react",
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/components/demo/**/*.test.tsx"],
    setupFiles: ["src/components/demo/demo-test-setup.ts"],
  },
});
