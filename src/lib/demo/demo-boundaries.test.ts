// src/lib/demo/demo-boundaries.test.ts
//
// The demo's enforced boundaries, tested against the actual sources:
//
// 1. Nothing under src/app/demo, src/components/demo, or src/lib/demo
//    imports @clerk/*, @stream-io/*, @supabase/*, or the server-only modules
//    (actions, db, providers, getstream, middleware) — read from disk, with
//    comments stripped before scanning so prose like "never calls getUserMedia"
//    cannot satisfy or mask the scan.
// 2. No forbidden browser API appears in executable demo code:
//    getUserMedia, navigator.mediaDevices, WebRTC, WebSocket, fetch, XHR,
//    sendBeacon.
// 3. The sample identity is runtime-distinct from Clerk ids: prefixed, and
//    never shaped like a Clerk user id.
//
// What is and is not exercised (stated explicitly per the task):
// - The production verified-session check (src/app/onboarding/_actions.ts)
//   calls Clerk's auth() and cannot run without the Clerk runtime, so the
//   "production verifier rejects the sample identity" property is tested at
//   TWO layers that run offline: (a) the type-level rejection in
//   src/lib/demo/demo-identity.type-test.ts (enforced by `tsc --noEmit`,
//   which is a milestone gate), and (b) the import scan below, which proves
//   the demo tree never imports or invokes that action. The Clerk runtime
//   itself was NOT exercised — that requires real Clerk infrastructure and
//   is deliberately out of scope for an offline fixture task.
// - Shared production components are imported only where they are
//   provider-free (TimeManager, TopBar, TimeDisplay, ConnectionBadge, ui
//   primitives, motion wrappers, avatar-utils); the scan's positive-control
//   test proves the scanner actually sees those imports, so it cannot pass
//   vacuously.

import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

const DEMO_TREES = [
  "src/app/demo",
  "src/components/demo",
  "src/lib/demo",
];

/** Package import prefixes the demo tree must never reference. */
const FORBIDDEN_PACKAGE_PREFIXES = [
  "@clerk/",
  "@stream-io/",
  "@supabase/",
];

/**
 * Internal module prefixes the demo tree must never reference. These are the
 * provider-coupled, database-coupled, and server-action layers, plus any
 * production route module (the demo owns src/app/demo alone).
 */
const FORBIDDEN_INTERNAL_PREFIXES = [
  "@/actions/",
  "@/actions",
  "@/db",
  "@/lib/getstream",
  "@/providers",
  "@/app/",
  "@/middleware",
];

/** Browser/platform APIs that must not appear in executable demo code. */
const FORBIDDEN_API_TOKENS = [
  "getUserMedia",
  "mediaDevices",
  "RTCPeerConnection",
  "RTCSessionDescription",
  "sendBeacon",
  "XMLHttpRequest",
  "WebSocket",
  "fetch(",
  "addEventListener(\"beforeunload\"",
];



interface ScannedFile {
  relativePath: string;
  source: string;
  /** Source with comments stripped — the scan never inspects prose. */
  executable: string;
  /** Import specifiers extracted from the executable source. */
  imports: string[];
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\n)\s*\/\/[^\n]*/g, "$1");
}

function extractImports(executable: string): string[] {
  const specifiers = new Set<string>();
  const patterns = [
    /from\s*["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /require\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of executable.matchAll(pattern)) {
      specifiers.add(match[1]);
    }
  }
  return [...specifiers];
}

async function walkDemoTree(): Promise<ScannedFile[]> {
  const files: ScannedFile[] = [];
  for (const tree of DEMO_TREES) {
    const absoluteTree = path.join(REPO_ROOT, tree);
    const entries = await readdir(absoluteTree, { recursive: true });
    for (const entry of entries) {
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      const absolutePath = path.join(absoluteTree, entry);
      const source = await readFile(absolutePath, "utf8");
      const executable = stripComments(source);
      files.push({
        relativePath: path.join(tree, entry),
        source,
        executable,
        imports: extractImports(executable),
      });
    }
  }
  return files;
}

let scanned: ScannedFile[] | undefined;

async function scannedFiles(): Promise<ScannedFile[]> {
  scanned ??= await walkDemoTree();
  return scanned;
}

describe("demo tree import boundaries", () => {
  it("never imports Clerk, Stream, or Supabase packages", async () => {
    for (const file of await scannedFiles()) {
      for (const specifier of file.imports) {
        for (const prefix of FORBIDDEN_PACKAGE_PREFIXES) {
          expect(
            specifier.startsWith(prefix),
            `${file.relativePath} imports "${specifier}"`,
          ).toBe(false);
        }
      }
    }
  });

  it("never imports server actions, database, providers, getstream, middleware, or production routes", async () => {
    for (const file of await scannedFiles()) {
      for (const specifier of file.imports) {
        for (const prefix of FORBIDDEN_INTERNAL_PREFIXES) {
          expect(
            specifier.startsWith(prefix),
            `${file.relativePath} imports "${specifier}"`,
          ).toBe(false);
        }
      }
    }
  });

  it("never imports the production verified-session action module by any route", async () => {
    for (const file of await scannedFiles()) {
      // Scanner-file exclusion, same self-scan paradox as the token scan:
      // this assertion's own literal names the module it forbids.
      if (file.relativePath.endsWith("demo-boundaries.test.ts")) continue;
      expect(
        file.executable.includes("onboarding/_actions"),
        `${file.relativePath} references onboarding/_actions`,
      ).toBe(false);
    }
  });

  it("contains no real media, WebRTC, network, or beacon calls in executable code", async () => {
    for (const file of await scannedFiles()) {
      // The scanner excludes itself from the token scan: its own token list
      // necessarily contains the token strings as executable data (the
      // classic self-scan paradox). Every other demo file is scanned whole.
      if (file.relativePath.endsWith("demo-boundaries.test.ts")) continue;
      for (const token of FORBIDDEN_API_TOKENS) {
        expect(
          file.executable.includes(token),
          `${file.relativePath} uses "${token}" in executable code`,
        ).toBe(false);
      }
    }
  });

  it("scanner positive control: sees the allowed shared imports it should see", async () => {
    const files = await scannedFiles();
    const allImports = new Set(files.flatMap((file) => file.imports));
    // Prove the scanner reads real import statements — if these allowed
    // imports are absent, the scan above is vacuous and this fails.
    expect([...allImports].some((s) => s.includes("video-meeting/time-manager"))).toBe(true);
    expect([...allImports].some((s) => s.includes("video-meeting/top-bar"))).toBe(true);
  });

  it("scanner positive control: covers the three owned trees", async () => {
    const files = await scannedFiles();
    for (const tree of DEMO_TREES) {
      expect(
        files.some((file) => file.relativePath.startsWith(tree)),
        `no files scanned under ${tree}`,
      ).toBe(true);
    }
    // The boundary test lives in one of the trees it scans; self-exclusion
    // would make the guarantee weaker than it reads.
    expect(files.length).toBeGreaterThan(10);
  });
});

describe("sample identity is runtime-distinct from Clerk identities", () => {
  it("prefixes every sample id so it cannot collide with a Clerk user id", async () => {
    const { SAMPLE_PERSONAS } = await import("./sample-personas");
    const { samplePersonaId, sampleProfileId } = await import("./sample-identity");
    expect(samplePersonaId("x")).toMatch(/^sample-persona:/);
    expect(sampleProfileId("x")).toMatch(/^sample-profile:/);
    for (const persona of SAMPLE_PERSONAS) {
      expect(persona.id.startsWith("user_")).toBe(false);
      expect(persona.id.startsWith("sample-persona:")).toBe(true);
    }
  });
});
