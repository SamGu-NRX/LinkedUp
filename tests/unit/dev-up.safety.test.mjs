// Witness tests for the dev-up.mjs safety fixes (r4 stack task).
//
// These pin the pure decision logic the bootstrap script relies on:
//   (a) it must only ever stop processes it started itself — identity is
//       verified by pid file AND /proc command line AND working directory;
//   (c) the dev server runs in an isolated, verified local configuration —
//       Clerk/Stream credentials and inherited database URLs are stripped,
//       DATABASE_URL is pinned to the project cluster;
//   (c) the data layer must provably sit on the same project cluster the
//       migrations ran on.
//
// dev-up.mjs is import-safe: the main guard detects a non-main module check,
// so importing it has no side effects.
import { describe, expect, it } from "vitest";
import {
  classifyServerIdentity,
  dbIdentityMismatches,
  envFileProblems,
  metaMatchesExpectation,
  parseListeningPids,
  parseLsofPids,
  pgBinCandidates,
  serverEnvFrom,
} from "../../scripts/dev-up.mjs";

const ROOT = "/home/user/work/linkedup-r4-stack";
const PORT = 3000;

const ourMeta = {
  kind: "linkedup-dev-server",
  pid: 4242,
  port: PORT,
  root: ROOT,
  databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54329/linkedup",
  startedAt: "2026-10-12T06:00:00.000Z",
};

describe("parseListeningPids", () => {
  it("collects every pid bound to the given port", () => {
    const ss = [
      "State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process",
      "LISTEN 0      511          0.0.0.0:3000      0.0.0.0:*    users:((\"next-server\",pid=101,fd=17))",
      "LISTEN 0      511             [::]:3000         [::]:*       users:((\"next-server\",pid=101,fd=18))",
      "LISTEN 0      4096       127.0.0.1:5432    0.0.0.0:*    users:((\"postgres\",pid=77,fd=5))",
      "LISTEN 0      511       127.0.0.1:3001    0.0.0.0:*    users:((\"vite\",pid=55,fd=9))",
    ].join("\n");
    expect(parseListeningPids(ss, 3000)).toEqual([101]);
    expect(parseListeningPids(ss, 5432)).toEqual([77]);
    expect(parseListeningPids(ss, 9999)).toEqual([]);
  });

  it("collects every pid sharing the port and ignores lines without a process column", () => {
    const ssOutput = [
      "LISTEN 0 511 127.0.0.1:3000 0.0.0.0:* users:((\"node\",pid=7,fd=1),(\"node\",pid=8,fd=2))",
      "LISTEN 0 511 127.0.0.1:22 0.0.0.0:*",
    ].join("\n");
    expect(parseListeningPids(ssOutput, 3000).sort()).toEqual([7, 8]);
    expect(parseListeningPids(ssOutput, 22)).toEqual([]);
  });
});

describe("classifyServerIdentity — the script may only stop what it started", () => {
  const nextCmdline = [
    "/bin/sh -c pnpm exec next dev --port 3000",
    "",
  ].join("\u0000");

  it("rejects a missing or foreign meta record (pid file absent or other tool)", () => {
    expect(classifyServerIdentity({ meta: null, cmdline: nextCmdline, cwd: ROOT, root: ROOT, port: PORT })).toBe("none");
    expect(
      classifyServerIdentity({ meta: { kind: "something-else", pid: 5, port: PORT, root: ROOT }, cmdline: nextCmdline, cwd: ROOT, root: ROOT, port: PORT }),
    ).toBe("none");
  });

  it("rejects a record for another port or another checkout root", () => {
    expect(classifyServerIdentity({ meta: { ...ourMeta, port: 3001 }, cmdline: nextCmdline, cwd: ROOT, root: ROOT, port: PORT })).toBe("none");
    expect(classifyServerIdentity({ meta: { ...ourMeta, root: "/elsewhere" }, cmdline: nextCmdline, cwd: ROOT, root: ROOT, port: PORT })).toBe("none");
  });

  it("treats a recorded pid that no longer exists as stale", () => {
    expect(classifyServerIdentity({ meta: ourMeta, cmdline: null, cwd: null, root: ROOT, port: PORT })).toBe("stale");
  });

  it("refuses to kill a foreign process even when the pid file matches", () => {
    expect(classifyServerIdentity({ meta: ourMeta, cmdline: "/usr/bin/vite --port 3000", cwd: ROOT, root: ROOT, port: PORT })).toBe("foreign");
    expect(classifyServerIdentity({ meta: ourMeta, cmdline: "/bin/bash", cwd: ROOT, root: ROOT, port: PORT })).toBe("foreign");
    expect(
      classifyServerIdentity({
        meta: ourMeta,
        cmdline: "pnpm exec next dev --port 3000",
        cwd: "/some/other/checkout",
        root: ROOT,
        port: PORT,
      }),
    ).toBe("foreign");
  });

  it("refuses recycled pids whose command line is not next dev on our port", () => {
    expect(
      classifyServerIdentity({
        meta: ourMeta,
        cmdline: ["node", "/usr/bin/next", "dev", "--port", "3001"].join("\u0000"),
        cwd: ROOT,
        root: ROOT,
        port: PORT,
      }),
    ).toBe("foreign");
    expect(
      classifyServerIdentity({
        meta: ourMeta,
        cmdline: ["node", "/usr/bin/next", "dev"].join("\u0000"), // no --port flag
        cwd: ROOT,
        root: ROOT,
        port: PORT,
      }),
    ).toBe("foreign");
  });

  it("accepts a live process matching pid record, next dev argv and root", () => {
    const cmdline = ["pnpm", "exec", "next", "dev", "--port", "3000"].join("\u0000");
    expect(classifyServerIdentity({ meta: ourMeta, cmdline, cwd: ROOT, root: ROOT, port: PORT })).toBe("ours");
  });

  it("accepts the argv shapes next/pnpm actually produce", () => {
    const directNext = ["node", "/home/user/work/linkedup-r4-stack/node_modules/.bin/../next/dist/bin/next", "dev", "--port", "3000"].join("\u0000");
    expect(classifyServerIdentity({ meta: ourMeta, cmdline: directNext, cwd: ROOT, root: ROOT, port: PORT })).toBe("ours");
  });
});

describe("metaMatchesExpectation — reuse only a correctly-configured server", () => {
  const expected = { port: PORT, root: ROOT, databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54329/linkedup" };

  it("matches when everything is current", () => {
    expect(metaMatchesExpectation(ourMeta, expected)).toBe(true);
  });

  it("rejects a server started against an older database URL or port", () => {
    expect(metaMatchesExpectation({ ...ourMeta, databaseUrl: "postgresql://postgres:postgres@10.0.0.5:5432/linkedup" }, expected)).toBe(false);
    expect(metaMatchesExpectation({ ...ourMeta, port: 3001 }, expected)).toBe(false);
    expect(metaMatchesExpectation(null, expected)).toBe(false);
  });

  it("rejects a server whose journey-proof flag differs from this run's", () => {
    expect(metaMatchesExpectation(ourMeta, { ...expected, journeyProof: true })).toBe(false);
    expect(metaMatchesExpectation({ ...ourMeta, journeyProof: true }, expected)).toBe(false);
    expect(metaMatchesExpectation({ ...ourMeta, journeyProof: true }, { ...expected, journeyProof: true })).toBe(true);
  });
});

describe("serverEnvFrom — isolated, verified local configuration", () => {
  it("strips Clerk/Stream credentials and inherited database URLs, then pins ours", () => {
    const inherited = {
      DATABASE_URL: "postgresql://postgres:pw@supabase.example:5432/prod",
      DIRECT_URL: "postgresql://postgres:pw@supabase.example:5432/prod",
      POSTGRES_URL: "postgresql://postgres:pw@supabase.example:5432/prod",
      SUPABASE_DB_URL: "postgresql://postgres:pw@supabase.example:5432/prod",
      CLERK_SECRET_KEY: "sk_test_leak",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_leak",
      CLERK_ENCRYPTION_KEY: "leak",
      STREAM_API_KEY: "leak",
      STREAM_SECRET: "leak",
      HOME: "/home/user",
      PATH: "/usr/bin",
    };
    const out = serverEnvFrom(inherited, { databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54329/linkedup" });
    expect(out.DATABASE_URL).toBe("postgresql://postgres:postgres@127.0.0.1:54329/linkedup");
    expect(out.DIRECT_URL).toBeUndefined();
    expect(out.POSTGRES_URL).toBeUndefined();
    expect(out.SUPABASE_DB_URL).toBeUndefined();
    expect(Object.keys(out).filter((k) => /CLERK|STREAM/i.test(k))).toEqual([]);
    expect(out.HOME).toBe("/home/user");
    expect(out.PATH).toBe("/usr/bin");
    expect(out.LINKEDUP_DEV_UP).toBe("1");
  });

  it("does not mutate the caller's environment object", () => {
    const inherited = { DATABASE_URL: "old", CLERK_SECRET_KEY: "leak" };
    serverEnvFrom(inherited, { databaseUrl: "x" });
    expect(inherited.DATABASE_URL).toBe("old");
    expect(inherited.CLERK_SECRET_KEY).toBe("leak");
  });
});

describe("dbIdentityMismatches — the data layer must sit on the project cluster", () => {
  const expected = {
    databaseName: "linkedup",
    port: 54329,
    dataDirectory: "/home/user/work/linkedup-r4-stack/.local/pg",
  };
  const goodReport = { database: { name: "linkedup", serverPort: 54329, dataDirectory: expected.dataDirectory } };

  it("passes a matching report", () => {
    expect(dbIdentityMismatches(goodReport, expected)).toEqual([]);
  });

  it("names every drift between the app's connection and the migration target", () => {
    const failures = dbIdentityMismatches(
      { database: { name: "postgres", serverPort: 5432, dataDirectory: "/var/lib/postgresql/17/main" } },
      expected,
    );
    expect(failures).toHaveLength(3);
    expect(failures.join(" ")).toMatch(/database name/);
    expect(failures.join(" ")).toMatch(/server port/);
    expect(failures.join(" ")).toMatch(/data directory/);
  });

  it("fails loudly on a missing or malformed report", () => {
    expect(dbIdentityMismatches(null, expected)).toEqual(["no identity report"]);
    expect(dbIdentityMismatches({}, expected).join(" ")).toMatch(/database name/);
  });
});

describe("envFileProblems — env files Next loads must not undo the isolation", () => {
  const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:54329/linkedup";

  it("accepts .env.local holding only the project DATABASE_URL, and comments", () => {
    expect(
      envFileProblems({ ".env.local": `# local\nDATABASE_URL=${databaseUrl}\n` }, { databaseUrl }),
    ).toEqual([]);
  });

  it("refuses Clerk or Stream keys in any env file Next reads", () => {
    const problems = envFileProblems(
      {
        ".env": "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_x\n",
        ".env.development.local": "export CLERK_SECRET_KEY=sk_test_x\n",
        ".env.local": `DATABASE_URL=${databaseUrl}\nNEXT_PUBLIC_STREAM_API_KEY=abc\n`,
      },
      { databaseUrl },
    );
    expect(problems).toHaveLength(3);
    expect(problems.join("\n")).toMatch(/CLERK_SECRET_KEY/);
  });

  it("refuses another database, or a database URL anywhere but .env.local", () => {
    expect(
      envFileProblems({ ".env.local": "DATABASE_URL=postgres://u:p@db.supabase.co:5432/postgres\n" }, { databaseUrl }),
    ).toHaveLength(1);
    expect(envFileProblems({ ".env": `DATABASE_URL=${databaseUrl}\n` }, { databaseUrl })).toHaveLength(1);
    expect(envFileProblems({ ".env.development": "DIRECT_URL=postgres://x\n" }, { databaseUrl })).toHaveLength(1);
  });
});

describe("parseLsofPids", () => {
  it("reads one pid per line and ignores noise", () => {
    expect(parseLsofPids("123\n456\n123\n\n")).toEqual([123, 456]);
    expect(parseLsofPids("")).toEqual([]);
  });
});

describe("pgBinCandidates", () => {
  it("looks at Linux packages and Homebrew for 17 down to 14, then PATH", () => {
    const dirs = pgBinCandidates("/a/bin:/b/bin");
    expect(dirs[0]).toBe("/usr/lib/postgresql/17/bin");
    expect(dirs).toContain("/opt/homebrew/opt/postgresql@15/bin");
    expect(dirs.slice(-2)).toEqual(["/a/bin", "/b/bin"]);
  });
});
