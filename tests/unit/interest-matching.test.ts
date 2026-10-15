// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDecisionClient, type ChoiceRequest, type DecisionTransport } from "../../src/lib/interest-matching/decisions";
import { interestOverlap, normalizeInterests, rankCandidates } from "../../src/lib/interest-matching/scoring";
import { proposePair } from "../../src/lib/interest-matching/selection";
import type { WaitingProfile } from "../../src/lib/interest-matching/types";

const start = new Date("2026-10-15T12:00:00Z");
const profile = (id: number, interests: string[], joinedMs = 0): WaitingProfile => ({ entryId: id, userId: id, interests, joinedAt: new Date(+start + joinedMs) });
const unavailable = createDecisionClient(async () => { throw new Error("offline"); });
function answer(request: ChoiceRequest, choice: string, weights?: Record<string, number>) {
  return { answers: [{ type: "choice", name: request.questions[0].name, choice,
    probabilities: request.questions[0].choices.map(({ value }) => ({ value, probability: weights?.[value] ?? (value === choice ? 1 : 0) })) }] };
}
const sampleRequest: ChoiceRequest = { model: "gpt-6-luna", input: "hiking", questions: [{ type: "choice", name: "fit", instructions: "Choose a topic", choices: [{ value: "a", description: "hiking" }, { value: "b", description: "cooking" }] }] };
afterEach(() => vi.useRealTimers());

describe("interest matching", () => {
  it("normalizes unicode, separators, aliases and duplicate interests", () => {
    expect(normalizeInterests(["  ＡＩ ", "machine_learning", "Rock-Climbing", "bouldering", "", "  ", "DEV   TOOLS"])).toEqual(["artificial intelligence", "climbing", "developer tools"]);
    expect(interestOverlap(["AI", "AI", "climbing"], ["machine learning", "hiking"])).toEqual({ score: 0.5, sharedInterests: ["artificial intelligence"] });
    expect(interestOverlap([], [])).toEqual({ score: 0, sharedInterests: [] });
    expect(interestOverlap([], ["hiking"])).toEqual({ score: 0, sharedInterests: [] });
  });
  it("ranks the strongest overlap ahead of the FIFO neighbor", async () => {
    const queue = [profile(1, ["AI", "climbing"]), profile(2, ["cooking"], 1), profile(3, ["machine learning", "bouldering"], 2)];
    expect(rankCandidates(queue[0], queue).map((item) => item.profile.userId)).toEqual([3, 2]);
    expect((await proposePair(queue, new Date(+start + 100), unavailable))?.partner.userId).toBe(3);
  });
  it("holds a low fit before 20 seconds and relaxes at the boundary", async () => {
    const queue = [profile(1, ["climbing"]), profile(2, ["cooking"], 1)];
    expect(await proposePair(queue, new Date(+start + 19_999), unavailable)).toBeNull();
    const pair = await proposePair(queue, new Date(+start + 20_000), unavailable);
    expect(pair?.partner.userId).toBe(2);
    expect(pair?.intro).toEqual({ reason: "A chance to explore a different set of interests.", question: "What's an interest you could talk about for hours?", sharedInterests: [] });
  });
  it("gives an overdue waiter priority over a fresh perfect pair", async () => {
    const queue = [profile(1, ["cooking"]), profile(2, ["climbing"], 19_000), profile(3, ["bouldering"], 19_100)];
    const pair = await proposePair(queue, new Date(+start + 20_000), unavailable, 3);
    expect([pair?.anchor.userId, pair?.partner.userId]).toEqual([1, 2]);
  });
  it("uses semantic probabilities to break equal lexical fit", async () => {
    const queue = [profile(1, ["AI", "robotics"]), profile(2, ["AI", "finance"], 1), profile(3, ["ML", "autonomous robots"], 2)];
    const decide = createDecisionClient(async (request) => answer(request, request.questions[0].name === "semantic_fit" ? "3" : "2"));
    expect((await proposePair(queue, new Date(+start + 100), unavailable))?.partner.userId).toBe(2);
    const pair = await proposePair(queue, new Date(+start + 100), decide);
    expect(pair?.partner.userId).toBe(3);
    expect(pair?.intro.question).toBe("What would you recommend to someone getting into artificial intelligence?");
  });
  it("accepts semantic-only common ground and respects none", async () => {
    const queue = [profile(1, ["birdwatching"]), profile(2, ["ornithology"], 1)];
    const yes = createDecisionClient(async (request) => answer(request, request.questions[0].name === "semantic_fit" ? "2" : "0"));
    const no = createDecisionClient(async (request) => answer(request, "none"));
    expect((await proposePair(queue, new Date(+start + 100), yes))?.partner.userId).toBe(2);
    expect(await proposePair(queue, new Date(+start + 100), no)).toBeNull();
  });
  it.each([0, 1, 2, 3])("uses question choice %i from the four supplied questions", async (index) => {
    const expected = ["What got you into hiking?", "What's something about hiking you've changed your mind about?", "What would you recommend to someone getting into hiking?", "What's the next thing you'd like to try with hiking?"];
    const decide = createDecisionClient(async (request) => answer(request, request.questions[0].name === "semantic_fit" ? "2" : String(index)));
    const pair = await proposePair([profile(1, ["hiking"]), profile(2, ["trekking"])], start, decide);
    expect(pair?.intro.question).toBe(expected[index]);
  });
  const failures: [string, DecisionTransport][] = [
    ["HTTP failure", async () => { throw new Error("HTTP 503"); }],
    ["refusal", async (request) => ({ answers: [{ name: request.questions[0].name, type: "refusal" }] })],
    ["malformed payload", async () => ({ answers: "invalid" })],
    ["wrong answer name", async (request) => ({ answers: [{ ...answer(request, "2").answers[0], name: "other" }] })],
  ];
  it.each(failures)("falls back to overlap and a local intro on %s", async (_name, transport) => {
    const pair = await proposePair([profile(1, ["hiking"]), profile(2, ["cooking"]), profile(3, ["trekking"])], start, createDecisionClient(transport));
    expect(pair?.partner.userId).toBe(3);
    expect(pair?.intro).toEqual({ reason: "You both enjoy hiking.", question: "What got you into hiking?", sharedInterests: ["hiking"] });
  });
  it("bounds a transport that ignores cancellation and still returns a pair", async () => {
    vi.useFakeTimers();
    const decide = createDecisionClient(() => new Promise(() => {}), { timeoutMs: 15 });
    const pending = proposePair([profile(1, ["hiking"]), profile(2, ["trekking"])], start, decide);
    await vi.runAllTimersAsync();
    expect((await pending)?.intro.question).toBe("What got you into hiking?");
  });
  it("rejects invalid probability distributions and uses overlap", async () => {
    const decide = createDecisionClient(async (request) => answer(request, "2", { "2": 0.8, "3": 0.8, none: 0.8 }));
    expect((await proposePair([profile(1, ["hiking"]), profile(2, ["cooking"]), profile(3, ["hiking"])], start, decide))?.partner.userId).toBe(3);
  });
  it("coalesces concurrent requests, expires cached verdicts, and separates changed profiles", async () => {
    let calls = 0;
    let time = 0;
    const decide = createDecisionClient(async (request) => { calls++; return answer(request, "a"); }, { ttlMs: 100, now: () => time });
    const results = await Promise.all([decide(sampleRequest), decide(sampleRequest)]);
    expect(results.map((result) => result?.choice)).toEqual(["a", "a"]);
    expect(calls).toBe(1);
    time = 99;
    expect((await decide(sampleRequest))?.choice).toBe("a");
    expect(calls).toBe(1);
    time = 100;
    expect((await decide(sampleRequest))?.choice).toBe("a");
    expect(calls).toBe(2);
    expect((await decide({ ...sampleRequest, input: "photography" }))?.choice).toBe("a");
    expect(calls).toBe(3);
    const changedSlate: ChoiceRequest = { ...sampleRequest, questions: [{ ...sampleRequest.questions[0], choices: [{ value: "a", description: "photography" }, { value: "b", description: "cooking" }] }] };
    expect((await decide(changedSlate))?.choice).toBe("a");
    expect(calls).toBe(4);
  });
});
