import { StreamVideoClient, User } from "@stream-io/video-react-sdk";
import { z } from "zod";

export interface SupabaseUser {
  user_id: string;
}

// Boundary schema: user_id must arrive as a non-empty string of at most 255
// characters after trimming; the parsed value is the trimmed user_id.
const supabaseUserSchema = z.object({
  user_id: z
    .string({ invalid_type_error: "user_id must be a string" })
    .trim()
    .min(1, "user_id must be a non-empty string")
    .max(255, "user_id must be at most 255 characters long"),
});

/**
 * Reads a required env var and throws a specific error naming the variable
 * when it is missing, empty, or whitespace-only. Without this guard,
 * `undefined` flowed into the Stream SDK via the old `as string` casts and
 * failed deep inside it.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`createStreamVideoClient: ${name} is not set`);
  }
  return value;
}

export function createStreamVideoClient(user: SupabaseUser): StreamVideoClient {
  const apiKey = requireEnv("NEXT_PUBLIC_STREAM_API_KEY");
  // NOTE: STREAM_SECRET_KEY reaching client-side code is suspicious — any
  // NEXT_PUBLIC_ usage pattern that ships a secret into the browser bundle
  // would leak it. Out of scope here; flag for a server-only review.
  const token = requireEnv("STREAM_SECRET_KEY");

  const { user_id } = supabaseUserSchema.parse(user);

  const streamUser: User = {
    id: user_id,
  };

  return new StreamVideoClient({ apiKey, token, user: streamUser });
}
