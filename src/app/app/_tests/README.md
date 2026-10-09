# Security tests for src/app/app/

Runner: node:test via tsx (already a devDependency). No new dependencies.

Run one part:   npx tsx --test src/app/app/_tests/p01-*.test.ts
Run all:        npm test

Conventions:
- Test files are named <part>-<topic>.test.ts and live only in this directory.
- Tests import security-relevant logic extracted from pages (pure functions);
  no DOM, no React rendering, no network.
- Baseline tsc has 31 pre-existing errors outside src/app/app/ (missing gsap/lenis
  deps in legacy utils, plus one missing module import in call/[id]/page.tsx).
  Tests must not add new type errors.
