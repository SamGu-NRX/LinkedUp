// next.config.mjs

/** @type {import('next').NextConfig} */

import withSvgr from "@svgr/webpack";
import { journeyProofEnabled } from "./src/lib/journey-proof-guard.mjs";

/** Set by the exported function below; Next passes the phase on load. */
let currentPhase;

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
    // serverActions: {
    //   allowedOrigins: ["app.localhost:3000"],
    // },
    turbo: {
      rules: {
        "*.svg": {
          loaders: ["@svgr/webpack"],
          as: "*.js",
        },
      },
    },
  },

  // JOURNEY-PROOF TEST PATH, off unless LINKEDUP_JOURNEY_PROOF=1 (only the
  // e2e journeys set it, through dev:up). The reserved middleware sends any
  // signed-in user whose session token lacks metadata.onboardingComplete
  // back to /onboarding, and the keyless test instance's tokens never carry
  // that claim, so a finished user loops (tests/unit/middleware.onboarding-
  // loop.witness.test.ts). These rewrites serve the real queue and call
  // room (and the call's signaling endpoint) at /onboarding?journey-proof=...,
  // the one URL the middleware lets
  // a signed-in user reach. Rewrites apply after the middleware has run, so
  // sign-in is still required, and the pages keep the DB onboarding gate.
  // Sam decides the middleware; delete this with src/app/journey-proof/.
  // Refused outright (an error, not a quiet "off") in production builds and
  // servers and on Vercel: src/lib/journey-proof-guard.mjs.
  async rewrites() {
    if (!journeyProofEnabled(process.env, { phase: currentPhase })) return [];
    return {
      beforeFiles: [
        {
          source: "/onboarding",
          has: [{ type: "query", key: "journey-proof", value: "queue" }],
          destination: "/journey-proof/queue",
        },
        {
          source: "/onboarding",
          has: [
            { type: "query", key: "journey-proof", value: "call" },
            { type: "query", key: "room", value: "(?<room>[0-9a-f-]{36})" },
          ],
          destination: "/journey-proof/call/:room",
        },
        {
          source: "/onboarding",
          has: [
            { type: "query", key: "journey-proof", value: "summary" },
            { type: "query", key: "room", value: "(?<room>[0-9a-f-]{36})" },
          ],
          destination: "/journey-proof/summary/:room",
        },
        {
          source: "/onboarding",
          has: [{ type: "query", key: "journey-proof", value: "history" }],
          destination: "/journey-proof/history",
        },
        {
          source: "/onboarding",
          has: [{ type: "query", key: "journey-proof", value: "ice" }],
          destination: "/api/call/ice",
        },
        {
          // The call's signaling endpoint: an API route, which the
          // middleware would also send back to /onboarding.
          source: "/onboarding",
          has: [{ type: "query", key: "journey-proof", value: "signal" }],
          destination: "/api/call/signal",
        },
      ],
    };
  },

  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: [
        {
          loader: "@svgr/webpack",
          options: {
            svgo: true, // Disable SVGO optimization if you encounter issues
          },
        },
      ],
    });
    return config;
  },
};

// Next calls this with its phase. Checking the guard here too makes a
// production build with the flag set fail at once, not at first request.
export default function config(phase) {
  currentPhase = phase;
  journeyProofEnabled(process.env, { phase });
  return nextConfig;
}
