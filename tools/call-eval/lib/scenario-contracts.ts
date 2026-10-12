/**
 * Verbatim pass conditions from docs/plan/CALL-PLAN.md — the H table under
 * "## Evals: the two-peer harness (H)" and the "Polish checks (P)" list
 * (mirrored in tools/call-eval/CONTRACT.md). These strings are the contract:
 * scenarios must not paraphrase them. contracts.mjs extracts them at runtime
 * for results and summary output because the runner runs on plain Node (no
 * TS import).
 */

export const H_PASS_CONDITIONS = {
  "H-01":
    "each decodes the other's barcode color within 5 s; remote frames advance at >= 15 fps over 5 s",
  "H-02": "each receiver's analyser peak is the sender's tone +-10 Hz within 3 s",
  "H-03":
    "remote `data-audio-muted` flips within 1 s; received tone energy falls below threshold; unmute restores both",
  "H-04":
    "remote `data-video-off` within 1 s; the sender's capture track is `ended` (camera released); on resumes frames",
  "H-05": "switching to the second fake camera keeps frames flowing without a failed phase",
  "H-06": "context without media permission shows an actionable error; granting and `retry-media` joins",
  "H-07":
    "one peer offline 3 s, 10 s, 30 s: honest `reconnecting`, media resumes within 10 s of restore, no duplicate tiles",
  "H-08": "recovers within 10 s",
  "H-09": "reloaded peer rejoins; no ghost participant after 10 s",
  "H-10": "survivor shows the peer gone within 15 s",
  "H-11":
    "all local tracks `ended`, all wrapped connections `closed`, no `getStats` traffic afterwards, server session closed",
  "H-12": "simultaneous join in both orders, 20 seeds: always connects",
  "H-13": "five leave/rejoin cycles: live connection and track counts return to baseline",
  "H-14": "a signed-in non-participant gets a named rejection and no media",
  "H-15":
    "5% and 15% loss with 300 ms delay, by a method `getStats` proves affects RTP: call stays connected, A/V recovers",
  "H-16": "informational: all pairs receive media",
} as const;

export const P_PASS_CONDITIONS = {
  "P-01": "lobby, connected, reconnecting, failed and ended states at 1440x900 and 390x844, screenshots committed",
  "P-02": "axe shows no serious or critical violations in any state",
  "P-03": "every control is reachable and operable by keyboard, with visible focus",
  "P-04": "`prefers-reduced-motion` removes non-essential motion",
  "P-05": "long names (40+ characters), missing avatar and a slow join (5 s) keep the layout intact",
} as const;

export type HScenarioId = keyof typeof H_PASS_CONDITIONS;
export type PScenarioId = keyof typeof P_PASS_CONDITIONS;

export const H_IDS = Object.keys(H_PASS_CONDITIONS) as HScenarioId[];
export const P_IDS = Object.keys(P_PASS_CONDITIONS) as PScenarioId[];

/** Pinned fixture constants (CONTRACT.md "Fixtures"). */
export const TONES = { A: 440, B: 660, C: 880, D: 1100 } as const;
export const PEER_COLORS = {
  A: [205, 35, 35],
  B: [35, 150, 85],
  C: [45, 85, 175],
  D: [210, 150, 30],
} as const;
export const SECOND_CAMERA_COLOR = [170, 40, 170] as const;

/**
 * y4m -> Chromium round-trips shift identity colors (limited-range swscale
 * without in_range); frame counters decode exactly, so classification uses
 * nearest-color matching within this per-channel tolerance, never equality.
 */
export const COLOR_TOLERANCE = 16;
