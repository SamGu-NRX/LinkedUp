// @vitest-environment node
// The journey-proof path must not exist in production or on Vercel.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
  journeyProofEnabled,
} from "@/lib/journey-proof-guard.mjs";

const ON = { LINKEDUP_JOURNEY_PROOF: "1", NODE_ENV: "development" };

describe("journeyProofEnabled", () => {
  it("is off without the flag", () => {
    expect(journeyProofEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(journeyProofEnabled({ NODE_ENV: "production", VERCEL: "1" })).toBe(false);
  });

  it("is on with the flag on a local development server", () => {
    expect(journeyProofEnabled(ON, { phase: "phase-development-server" })).toBe(true);
  });

  it.each([
    ["any Vercel deployment", { ...ON, VERCEL: "1" }, {}],
    ["a production NODE_ENV", { ...ON, NODE_ENV: "production" }, {}],
    ["a production build", ON, { phase: PHASE_PRODUCTION_BUILD }],
    ["a production server", ON, { phase: PHASE_PRODUCTION_SERVER }],
  ])("refuses the flag on %s", (_name, env, context) => {
    expect(() => journeyProofEnabled(env, context)).toThrow(/refused/);
  });
});

describe("next.config.mjs", () => {
  afterEach(() => vi.unstubAllEnvs());
  /** The config Next would load for a phase, and its rewrites. */
  async function load(phase: string) {
    const mod = (await import("../../next.config.mjs")) as { default: unknown };
    const config = (typeof mod.default === "function" ? mod.default(phase, {}) : mod.default) as {
      rewrites: () => Promise<unknown>;
    };
    return config.rewrites();
  }

  it("registers the ICE tunnel only on the local proof server", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LINKEDUP_JOURNEY_PROOF", "1");
    vi.stubEnv("VERCEL", "");
    expect(await load("phase-development-server")).toMatchObject({ beforeFiles: expect.arrayContaining([
      { source: "/onboarding", has: [{ type: "query", key: "journey-proof", value: "ice" }], destination: "/api/call/ice" },
    ]) });
    vi.stubEnv("LINKEDUP_JOURNEY_PROOF", "");
    expect(await load("phase-development-server")).toEqual([]);
  });

  it("refuses a production build with the flag set, and a Vercel deployment", async () => {
    const saved = { ...process.env };
    try {
      Object.assign(process.env, { LINKEDUP_JOURNEY_PROOF: "1" });
      await expect(load(PHASE_PRODUCTION_BUILD)).rejects.toThrow(/refused/);
      Object.assign(process.env, { VERCEL: "1" });
      await expect(load("phase-development-server")).rejects.toThrow(/refused/);
    } finally {
      for (const key of ["LINKEDUP_JOURNEY_PROOF", "VERCEL"]) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      }
    }
  });
});
