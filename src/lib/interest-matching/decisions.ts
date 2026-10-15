import { z } from "zod";

export type ChoiceRequest = {
  model: "gpt-6-luna";
  input: string;
  questions: [{ type: "choice"; name: string; instructions: string; choices: { value: string; description: string }[] }];
};
export type DecisionTransport = (request: ChoiceRequest, signal: AbortSignal) => Promise<unknown>;
export type ChoiceVerdict = { choice: string; probabilities: Map<string, number> };

const responseSchema = z.object({ answers: z.array(z.union([
  z.object({ type: z.literal("refusal"), name: z.string() }),
  z.object({
    type: z.literal("choice"), name: z.string(), choice: z.string(),
    probabilities: z.array(z.object({ value: z.string(), probability: z.number().finite().min(0).max(1) })),
  }),
])) });

function parseVerdict(value: unknown, request: ChoiceRequest): ChoiceVerdict | null {
  const parsed = responseSchema.safeParse(value);
  if (!parsed.success) return null;
  const question = request.questions[0];
  const answers = parsed.data.answers.filter((answer) => answer.name === question.name);
  const answer = answers[0];
  if (answers.length !== 1 || answer?.type !== "choice") return null;
  const allowed = new Set(question.choices.map((choice) => choice.value));
  const probabilities = new Map(answer.probabilities.map((item) => [item.value, item.probability]));
  if (!allowed.has(answer.choice) || probabilities.size !== allowed.size || answer.probabilities.length !== allowed.size) return null;
  if ([...probabilities.keys()].some((key) => !allowed.has(key))) return null;
  const total = [...probabilities.values()].reduce((sum, p) => sum + p, 0);
  if (Math.abs(total - 1) > 0.02) return null;
  return { choice: answer.choice, probabilities };
}

/** Bounded per-process cache also coalesces concurrent polls and caches failures.
 * Choice probabilities are relative to the slate, so cached pair verdicts must
 * include every shortlisted candidate and their current tags in the key.
 */
export function createDecisionClient(transport: DecisionTransport, {
  timeoutMs = 1_500, ttlMs = 60_000, maxEntries = 512, now = Date.now,
}: { timeoutMs?: number; ttlMs?: number; maxEntries?: number; now?: () => number } = {}) {
  const cache = new Map<string, { until: number; result: Promise<ChoiceVerdict | null> }>();
  return async (request: ChoiceRequest): Promise<ChoiceVerdict | null> => {
    const key = JSON.stringify(request);
    const cached = cache.get(key);
    if (cached && cached.until > now()) return cached.result;
    cache.delete(key);
    if (cache.size >= maxEntries) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    const result = (async () => {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // Promise.race also bounds a broken transport that ignores AbortSignal.
        const response = await Promise.race([
          Promise.resolve().then(() => transport(request, controller.signal)),
          new Promise<null>((resolve) => {
            timer = setTimeout(() => { controller.abort(); resolve(null); }, timeoutMs);
          }),
        ]);
        return parseVerdict(response, request);
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })();
    cache.set(key, { until: now() + ttlMs, result });
    return result;
  };
}

export type DecisionClient = ReturnType<typeof createDecisionClient>;
