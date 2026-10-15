import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the real middleware and layouts with isolated auth/DB boundaries.
// No Clerk requests, environment files or database connections are needed.
async function fixture({ userId = "user_1", claim, record } = {}) {
  const queries = [];
  const context = vm.createContext({ URL });
  const cache = new Map();
  const redirect = destination => { throw new Error(`redirect:${destination}`); };
  const auth = async () => ({
    userId, sessionClaims: { metadata: { onboardingComplete: claim } },
    redirectToSignIn: options => ({ signIn: options.returnBackUrl }),
  });
  const mocks = {
    "@clerk/nextjs/server": {
      auth, clerkMiddleware: handler => handler,
      createRouteMatcher: routes => req => routes.includes(new URL(req.url).pathname),
    },
    "next/server": { NextResponse: { next: () => "next", redirect } },
    "next/navigation": { redirect },
    "@/db": { db: { query: { users: { findFirst: async options => {
      queries.push(options);
      if (record instanceof Error) throw record;
      return record;
    } } } } },
    "@/db/schema": { users: { clerkId: "clerk_id" } },
    "drizzle-orm": { eq: (column, value) => ({ column, value }) },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), Fragment: "fragment" },
    "./app-shell": { default: "AppShell" },
  };
  async function load(id) {
    if (cache.has(id)) return cache.get(id);
    let mod;
    if (Object.hasOwn(mocks, id)) {
      const values = mocks[id];
      mod = new vm.SyntheticModule(Object.keys(values), function () {
        for (const [name, value] of Object.entries(values)) this.setExport(name, value);
      }, { context });
    } else {
      const file = id === "@/lib/onboarding" ? "src/lib/onboarding.ts" : id;
      const source = await readFile(new URL(`../../${file}`, import.meta.url), "utf8");
      const { outputText } = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
      } });
      mod = new vm.SourceTextModule(outputText, { context, identifier: id });
    }
    cache.set(id, mod);
    await mod.link(load);
    return mod;
  }
  async function run(id, ...args) {
    const mod = await load(id);
    if (mod.status !== "evaluated") await mod.evaluate();
    return mod.namespace.default(...args);
  }
  return { queries, middleware: path => run("src/middleware.ts", auth, { url: `https://example.test${path}` }),
    app: () => run("src/app/app/layout.tsx", { children: "app" }),
    onboarding: () => run("src/app/onboarding/layout.tsx", { children: "wizard" }) };
}

for (const claim of [undefined, false]) {
  test(`finished user with ${claim} claim leaves onboarding and enters app`, async () => {
    const f = await fixture({ claim, record: { onboardingComplete: true } });
    assert.equal(await f.middleware("/app"), "next");
    await assert.rejects(f.onboarding(), /redirect:\/app$/);
    assert.equal((await f.app()).type, "AppShell");
    assert.ok(f.queries.every(q => q.where.value === "user_1"));
  });
}
for (const record of [undefined, { onboardingComplete: false }, { onboardingComplete: null }]) {
  test(`unfinished DB record ${JSON.stringify(record)} overrides a completed claim`, async () => {
    const f = await fixture({ claim: true, record });
    assert.equal(await f.middleware("/app"), "next");
    await assert.rejects(f.app(), /redirect:\/onboarding$/);
    assert.equal((await f.onboarding()).props.children, "wizard");
  });
}
test("signed-out private requests retain the original sign-in return URL", async () => {
  const f = await fixture({ userId: null });
  for (const route of ["/app", "/app/profile", "/onboarding", "/api/private"]) {
    assert.equal((await f.middleware(route)).signIn, `https://example.test${route}`);
  }
  for (const route of ["/", "/sign-in", "/sign-up"]) assert.equal(await f.middleware(route), undefined);
  assert.equal(f.queries.length, 0);
});
test("database failure propagates instead of guessing completion", async () => {
  const f = await fixture({ record: new Error("database unavailable") });
  await assert.rejects(f.app(), /database unavailable/);
  await assert.rejects(f.onboarding(), /database unavailable/);
});
