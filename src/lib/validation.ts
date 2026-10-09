import { z } from "zod";

/**
 * Shared runtime-validation module for src/lib boundaries.
 *
 * Every schema here is strict: zod's default no-coercion behavior applies, so a
 * value must already be of the declared type ("42" is not a number). Use
 * `parseOrThrow` at module boundaries to turn zod failures into a single,
 * deterministic, log-safe Error instead of leaking raw ZodError instances.
 */

/** Maximum characters of the received-value repr included in parseOrThrow errors. */
const REPR_MAX_LENGTH = 200;

/**
 * Render `value` as a short, deterministic, log-safe string for error messages.
 *
 * Strings are JSON-quoted so leading/trailing whitespace stays visible; numbers
 * use String() so NaN and Infinity are distinguishable from null; objects and
 * arrays go through JSON.stringify with circular references replaced by
 * "[circular]"; anything that cannot be serialized degrades to a placeholder
 * instead of throwing. Output longer than REPR_MAX_LENGTH characters is
 * truncated with a trailing "..." so the repr is at most REPR_MAX_LENGTH
 * characters long.
 */
function valueRepr(value: unknown): string {
  let raw: string;
  if (typeof value === "string") {
    raw = JSON.stringify(value);
  } else if (typeof value === "number") {
    raw = String(value);
  } else if (value === undefined) {
    raw = "undefined";
  } else if (value === null) {
    raw = "null";
  } else if (typeof value === "bigint") {
    raw = `${value.toString()}n`;
  } else if (typeof value === "function") {
    raw = value.name.length > 0 ? `[function ${value.name}]` : "[function (anonymous)]";
  } else if (typeof value === "symbol") {
    raw = value.toString();
  } else {
    const seen = new WeakSet<object>();
    try {
      const json = JSON.stringify(value, (_key: string, nested: unknown): unknown => {
        if (typeof nested === "object" && nested !== null) {
          if (seen.has(nested)) {
            return "[circular]";
          }
          seen.add(nested);
        }
        return nested;
      });
      raw = json === undefined ? "[unserializable]" : json;
    } catch {
      raw = "[unserializable]";
    }
  }
  if (raw.length > REPR_MAX_LENGTH) {
    return `${raw.slice(0, REPR_MAX_LENGTH - 3)}...`;
  }
  return raw;
}

/**
 * Format a zod issue path as a compact, readable selector: [] -> "<root>",
 * ["user", 0, "id"] -> ".user[0].id". Symbol keys are rendered via String()
 * so the output stays deterministic and printable.
 */
function formatPath(path: (string | number | symbol)[]): string {
  if (path.length === 0) {
    return "<root>";
  }
  return path
    .map((part) => (typeof part === "number" ? `[${String(part)}]` : `.${String(part)}`))
    .join("");
}

/**
 * One "at path <path>: <zod message>" line per issue. invalid_union issues are
 * kept (so the union's own failing path is never lost) and their member errors
 * are flattened beneath them, so the message names the domain each union member
 * expected instead of a bare "Invalid input".
 */
function describeIssues(issues: z.ZodIssue[]): string[] {
  const lines: string[] = [];
  for (const issue of issues) {
    lines.push(`at path ${formatPath(issue.path)}: ${issue.message}`);
    if (issue.code === "invalid_union") {
      for (const unionError of issue.unionErrors) {
        lines.push(...describeIssues(unionError.issues));
      }
    }
  }
  return lines;
}

/**
 * Parse `value` with `schema` and return the parsed (transformed) value on
 * success. On failure, throw a plain Error — never the raw ZodError — whose
 * message is deterministic and safe to log: it names the caller-supplied
 * `context`, every failing issue path (union member errors flattened), and a
 * repr of the received value truncated to REPR_MAX_LENGTH characters, e.g.
 *
 *   Invalid value for user profile: expected valid input at path <root>: Expected number, received string, received "oops"
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, context: string): T {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  const lines = describeIssues(result.error.issues);
  throw new Error(
    `Invalid value for ${context}: expected valid input ${lines.join("; ")}, received ${valueRepr(value)}`,
  );
}

/**
 * An avatar seed: either a non-empty trimmed string or a finite number.
 * Accepting both lets callers pass a name-like seed or a numeric hash.
 */
export const avatarSeedSchema: z.ZodUnion<[z.ZodString, z.ZodNumber]> = z.union([
  z.string().trim().min(1),
  z.number().finite(),
]);

/** Parsed avatar-seed value: a trimmed non-empty string or a finite number. */
export type AvatarSeedT = z.infer<typeof avatarSeedSchema>;

/**
 * A non-empty string, trimmed before the length rule is enforced. `min`
 * (default 1) is the minimum length of the TRIMMED value. Throws RangeError
 * when `min` is outside its valid domain (an integer >= 1), rather than
 * building a schema that would silently accept empty strings.
 */
export function nonEmptyStringSchema(min: number = 1): z.ZodString {
  if (!Number.isInteger(min) || min < 1) {
    throw new RangeError(
      `nonEmptyStringSchema: min must be an integer >= 1, received ${valueRepr(min)}`,
    );
  }
  return z.string().trim().min(min);
}

/** Any finite number: NaN and both infinities are rejected. */
export const finiteNumberSchema: z.ZodNumber = z.number().finite();

/**
 * A timestamp in milliseconds since the Unix epoch (1970-01-01T00:00:00Z).
 * Must be a finite number; negative values represent pre-epoch times.
 */
export const finiteTimestampSchema: z.ZodNumber = z.number().finite();

/**
 * A stream user id: a trimmed, non-empty string of at most 255 characters
 * (a common limit for streaming-provider user identifiers).
 */
export const streamUserIdSchema: z.ZodString = z.string().trim().min(1).max(255);
