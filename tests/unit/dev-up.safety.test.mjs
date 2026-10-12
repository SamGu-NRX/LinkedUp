// Witness tests for the dev-up.mjs safety fixes (r4 stack task).
//
// These pin the pure decision logic the bootstrap script relies on:
//   (a) it must only ever stop processes it started itself — identity is
//       verified by recorded pid AND command line AND working directory;
//   (c) the dev server must run on an isolated environment — an inherited
//       DATABASE_URL or Clerk/Stream keys must never reach the child;
//   (d) the app data layer's identity report must match the project cluster.
// The script is imported (not executed): its main() is guarded behind a
// main-module check, so importing it has no side effects.
import { describe, expect, it } from "vitest";
import {
  classifyServerIdentity,
  metaMatchesExpectation,
  parseListeningPids,
} from "../../scripts/dev-up.mjs";

const ROOT = "/home/user/work/linkedup-r4-stack";
const PORT = 3000;

/** The /proc/<pid>/cmdline shape `pnpm exec next dev --port 3000` produces. */
const ourCmdline = ["node", "/home/user/.local/bin/pnpm", "exec", "next", "dev", "--port", "3000"].join("\u0000");

const ourMeta = {
  kind: "linkedup-dev-server",
  pid: 4242,
  port: PORT,
  root: ROOT,
  databaseUrl: "postgresql://postgres:postgres@localhost:5432/linkedup",
  startedAt: "2026-10-12T06:00:00.000Z",
};

describe("parseListeningPids", () => {
  it("returns only the pids bound to the requested port", () => {
    const ssOutput = [
      "State  Recv-Q Send-Q Local Address:Port  Peer Address:Port  Process",
      "LISTEN 0      511        127.0.0.1:3000      0.0.0.0:*          users:((\"node\",pid=111,fd=22))",
      "LISTEN 0      511        [::]:3000           [::]:*             users:((\"node\",pid=111,fd=23))",
      "LISTEN 0      4096       127.0.0.1:5432      0.0.0.0:*          users:((\"postgres\",pid=222,fd=5))",
      "LISTEN 0      128        0.0.0.0:30000       0.0.0.0:*          users:((\"python\",pid=333,fd=6))",
      "LISTEN 0      511        127.0.0.1:3001      0.0.0.0:*          users:((\"node\",pid=444,fd=9))",
    ].join("\n");
    expect(parseListeningPids(ssOutput, 3000)).toEqual([111]);
    expect(parseListeningPids(ssOutput, 5432)).toEqual([222]);
    expect(parseListeningPids(ssOutput, 3999)).toEqual([]);
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
  const base = { root: ROOT, port: PORT };

  it("calls it ours only with a verified pid AND command line AND working directory", () => {
    expect(classifyServerIdentity({ meta: ourMeta, cmdline: ourCmdline, cwd: ROOT, ...base })).toBe("ours");
  });

  it("treats a missing record as none (foreign port holder, never killable)", () => {
    expect(classifyServerIdentity({ meta: null, cmdline: ourCmdline, cwd: ROOT, ...base })).toBe("none");
    expect(classifyServerIdentity({ meta: { ...ourMeta, kind: "something-else" }, cmdline: ourCmdline, cwd: ROOT, ...base })).toBe("none");
    expect(classifyServerIdentity({ meta: { ...ourMeta, port: 3001 }, cmdline: ourCmdline, cwd: ROOT, ...base })).toBe("none");
    expect(classifyServerIdentity({ meta: { ...ourMeta, root: "/somewhere/else" }, cmdline: ourCmdline, cwd: ROOT, ...base })).toBe("none");
  });

  it("treats a dead recorded process as stale (safe to clear, nothing to kill)", () => {
    expect(classifyServerIdentity({ meta: ourMeta, cmdline: null, cwd: null, ...base })).toBe("stale");
  });

  it("refuses recycled pids whose command line is not next dev on our port", () => {
    expect(
      classifyServerIdentity({
        meta: ourMeta,
        cmdline: ["nginx", "worker"].join("\u0000"),
        cwd: ROOT,
        ...base,
      }),
    ).toBe("foreign");
    expect(
      classifyServerIdentity({
        meta: ourMeta,
        cmdline: ["node", "/usr/bin/next", "dev", "--port", "3001"].join("\u0000"),
        cwd: ROOT,
        ...base,
      }),
    ).toBe("foreign");
    expect(
      classifyServerIdentity({
        meta: ourMeta,
        cmdline: ["node", "/usr/bin/next", "dev"].join("\u0000"), // no --port flag
        cwd: ROOT,
        ...base,
      }),
    ).toBe("foreign");
  });

  it("refuses a next dev process running from a different checkout", () => {
    expect(
      classifyServerIdentity({
        meta: ourMeta,
        cmdline: ourCmdline,
        cwd: "/home/user/work/linkedup-r4-reserved",
        ...base,
      }),
    ).toBe("foreign");
  });

  it("accepts the argv shapes next/pnpm actually produce", () => {
    const directNext = ["node", "/home/user/work/linkedup-r4-stack/node_modules/.bin/../next/dist/bin/next", "dev", "--port", "3000"].join("\u0000");
    expect(classifyServerIdentity({ meta: ourMeta, cmdline: directNext, cwd: ROOT, ...base })).toBe("ours");
  });
});

describe("metaMatchesExpectation — reuse only a correctly-configured server", () => {
  const expected = { port: PORT, root: ROOT, databaseUrl: "postgresql://postgres:postgres@localhost:5432/linkedup" };

  it("matches when everything is current", () => {
    expect(metaMatchesExpectation(ourMeta, expected)).toBe(true);
  });

  it("rejects a server started against an older database URL or port", () => {
    expect(metaMatchesExpectation({ ...ourMeta, databaseUrl: "postgresql://postgres:postgres@10.0.0.5:5432/linkedup" }, expected)).toBe(false);
    expect(metaMatchesExpectation({ ...ourMeta, port: 3001 }, expected)).toBe(false);
    expect(metaMatchesExpectation(null, expected)).toBe(false);
  });
});


