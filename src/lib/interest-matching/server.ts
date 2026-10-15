import "server-only";
import { createDecisionClient } from "./decisions";

// The key is read only by this server module. Tests inject a fake transport;
// a missing key is an ordinary deterministic-only deployment.
export const decideMatch = createDecisionClient(async (request, signal) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const response = await fetch("https://api.openai.com/v1/decisions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json();
});
