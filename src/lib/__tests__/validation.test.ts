import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AvatarSeedT,
  avatarSeedSchema,
  finiteNumberSchema,
  finiteTimestampSchema,
  nonEmptyStringSchema,
  parseOrThrow,
  streamUserIdSchema,
} from "../validation";

/** Run `parse`, return the thrown Error's message, or fail the test if nothing threw. */
function captureErrorMessage(parse: () => unknown): string {
  try {
    parse();
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    throw new Error(`expected an Error to be thrown, received ${String(error)}`);
  }
  throw new Error("expected the parse call to throw, but it returned normally");
}

describe("avatarSeedSchema", () => {
  it("accepts a non-empty trimmed string and applies the trim", () => {
    expect(avatarSeedSchema.parse("sprout")).toBe("sprout");
    expect(avatarSeedSchema.parse("  sprout  ")).toBe("sprout");
    expect(avatarSeedSchema.parse("a".repeat(300))).toBe("a".repeat(300)); // no upper bound
  });

  it("accepts finite numbers, including boundary values", () => {
    expect(avatarSeedSchema.parse(0)).toBe(0);
    expect(avatarSeedSchema.parse(-1)).toBe(-1);
    expect(avatarSeedSchema.parse(3.5)).toBe(3.5);
  });

  it("rejects empty and whitespace-only strings", () => {
    expect(() => avatarSeedSchema.parse("")).toThrowError();
    expect(() => avatarSeedSchema.parse("   ")).toThrowError();
  });

  it("rejects non-finite numbers and non-string non-number types", () => {
    expect(() => avatarSeedSchema.parse(Number.NaN)).toThrowError();
    expect(() => avatarSeedSchema.parse(Number.POSITIVE_INFINITY)).toThrowError();
    expect(() => avatarSeedSchema.parse(Number.NEGATIVE_INFINITY)).toThrowError();
    expect(avatarSeedSchema.safeParse(true).success).toBe(false);
    expect(avatarSeedSchema.safeParse(null).success).toBe(false);
    expect(avatarSeedSchema.safeParse(undefined).success).toBe(false);
    expect(avatarSeedSchema.safeParse({ seed: 1 }).success).toBe(false);
  });
});

describe("nonEmptyStringSchema", () => {
  it("defaults to min 1 and trims before validating", () => {
    const schema = nonEmptyStringSchema();
    expect(schema.parse("x")).toBe("x");
    expect(schema.parse("  padded  ")).toBe("padded");
    expect(() => schema.parse("")).toThrowError();
    expect(() => schema.parse("   ")).toThrowError(); // trims to empty
    expect(schema.parse("a".repeat(300))).toBe("a".repeat(300)); // no upper bound
  });

  it("enforces the custom min against the trimmed value", () => {
    const schema = nonEmptyStringSchema(3);
    expect(schema.parse("  abc  ")).toBe("abc"); // exactly 3 after trim
    expect(() => schema.parse(" ab ")).toThrowError(); // "ab" is only 2 after trim
    expect(() => schema.parse("ab")).toThrowError();
  });

  it("rejects an invalid min configuration instead of building a useless schema", () => {
    expect(() => nonEmptyStringSchema(0)).toThrowError(RangeError);
    expect(() => nonEmptyStringSchema(-1)).toThrowError(RangeError);
    expect(() => nonEmptyStringSchema(1.5)).toThrowError(RangeError);
    expect(() => nonEmptyStringSchema(Number.NaN)).toThrowError(RangeError);
    expect(() => nonEmptyStringSchema(Number.POSITIVE_INFINITY)).toThrowError(RangeError);
  });
});

describe("finiteNumberSchema", () => {
  it("accepts finite numbers including 0, -1, and non-integers", () => {
    expect(finiteNumberSchema.parse(0)).toBe(0);
    expect(finiteNumberSchema.parse(-1)).toBe(-1);
    expect(finiteNumberSchema.parse(3.5)).toBe(3.5);
  });

  it("rejects NaN and both infinities", () => {
    expect(() => finiteNumberSchema.parse(Number.NaN)).toThrowError();
    expect(() => finiteNumberSchema.parse(Number.POSITIVE_INFINITY)).toThrowError();
    expect(() => finiteNumberSchema.parse(Number.NEGATIVE_INFINITY)).toThrowError();
  });

  it("rejects null, booleans, and numeric strings instead of coercing", () => {
    expect(() => finiteNumberSchema.parse("42")).toThrowError();
    expect(() => finiteNumberSchema.parse("")).toThrowError();
    expect(() => finiteNumberSchema.parse(null)).toThrowError();
    expect(() => finiteNumberSchema.parse(true)).toThrowError();
  });
});

describe("finiteTimestampSchema", () => {
  it("accepts finite millisecond values, including 0 and pre-epoch negatives", () => {
    expect(finiteTimestampSchema.parse(0)).toBe(0);
    expect(finiteTimestampSchema.parse(1728566400000)).toBe(1728566400000);
    expect(finiteTimestampSchema.parse(-500)).toBe(-500); // before the epoch
  });

  it("rejects non-finite values and numeric strings instead of coercing", () => {
    expect(() => finiteTimestampSchema.parse(Number.NaN)).toThrowError();
    expect(() => finiteTimestampSchema.parse(Number.POSITIVE_INFINITY)).toThrowError();
    expect(() => finiteTimestampSchema.parse("1728566400000")).toThrowError();
  });
});

describe("streamUserIdSchema", () => {
  it("accepts a trimmed non-empty id and applies the trim", () => {
    expect(streamUserIdSchema.parse("user-1")).toBe("user-1");
    expect(streamUserIdSchema.parse("  user-1  ")).toBe("user-1");
  });

  it("accepts exactly 255 characters after trimming and rejects longer ids", () => {
    const maxId = "u".repeat(255);
    expect(streamUserIdSchema.parse(maxId)).toBe(maxId);
    expect(streamUserIdSchema.parse(`  ${maxId}  `)).toBe(maxId); // 255 after trim
    expect(() => streamUserIdSchema.parse("u".repeat(256))).toThrowError();
    expect(() => streamUserIdSchema.parse("u".repeat(300))).toThrowError();
  });

  it("rejects empty, whitespace-only, and non-string values", () => {
    expect(() => streamUserIdSchema.parse("")).toThrowError();
    expect(() => streamUserIdSchema.parse("   ")).toThrowError();
    expect(streamUserIdSchema.safeParse(123).success).toBe(false); // no coercion
  });
});

describe("parseOrThrow", () => {
  it("returns the parsed value with transforms applied", () => {
    expect(parseOrThrow(nonEmptyStringSchema(), "  hello  ", "greeting")).toBe("hello");
    const userId: string = parseOrThrow(streamUserIdSchema, "  u-42 ", "user id");
    expect(userId).toBe("u-42");
    const trimmedSeed: AvatarSeedT = parseOrThrow(avatarSeedSchema, "  leaf  ", "avatar seed");
    expect(trimmedSeed).toBe("leaf");
    const seed: AvatarSeedT = parseOrThrow(avatarSeedSchema, 7, "avatar seed");
    expect(seed).toBe(7);
  });

  it("throws a plain Error, not the raw ZodError", () => {
    const failing = () => parseOrThrow(finiteNumberSchema, "oops", "user profile");
    expect(failing).toThrowError(Error);
    expect(failing).not.toThrowError(z.ZodError);
  });

  it("includes the context, the issue path, and the received repr in the message", () => {
    expect(() => parseOrThrow(finiteNumberSchema, "oops", "user profile")).toThrowError(
      'Invalid value for user profile: expected valid input at path <root>: Expected number, received string, received "oops"',
    );
  });

  it("formats nested paths with dot and index selectors", () => {
    const schema = z.object({ user: z.object({ id: z.number() }), tags: z.array(z.string()) });
    expect(() => parseOrThrow(schema, { user: { id: "x" }, tags: ["ok"] }, "profile")).toThrowError(
      ".user.id",
    );
    expect(() =>
      parseOrThrow(schema, { user: { id: 1 }, tags: ["ok", 2] }, "profile"),
    ).toThrowError(".tags[1]");
  });

  it("lists every issue path when multiple fields fail", () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const message = captureErrorMessage(() => parseOrThrow(schema, {}, "profile"));
    expect(message).toContain("Invalid value for profile");
    expect(message).toContain(".name");
    expect(message).toContain(".age");
  });

  it("flattens union failures so each member's expected domain is named", () => {
    const message = captureErrorMessage(() => parseOrThrow(avatarSeedSchema, null, "avatar seed"));
    expect(message).toContain("Invalid value for avatar seed");
    expect(message).toContain("at path <root>");
    expect(message).toContain("Expected string");
    expect(message).toContain("Expected number");
  });

  it("truncates the received repr to 200 characters", () => {
    const longString = "a".repeat(250);
    const message = captureErrorMessage(() =>
      parseOrThrow(finiteNumberSchema, longString, "long value"),
    );
    expect(message).toContain(`"${"a".repeat(150)}`); // leading slice is present
    expect(message).not.toContain("a".repeat(250)); // full value is absent
    expect(message.endsWith("...")).toBe(true); // truncation marker
    expect(message.length).toBeLessThan(400);
  });

  it("renders log-safe reprs for tricky values", () => {
    expect(() => parseOrThrow(finiteNumberSchema, undefined, "x")).toThrowError(
      "received undefined",
    );
    expect(() => parseOrThrow(finiteNumberSchema, Number.NaN, "x")).toThrowError("received NaN");
    expect(() => parseOrThrow(nonEmptyStringSchema(), "   ", "x")).toThrowError('received "   "');
    expect(() => parseOrThrow(finiteNumberSchema, { name: "  " }, "x")).toThrowError(
      '{"name":"  "}',
    );
  });

  it("produces identical messages for identical failures", () => {
    const first = captureErrorMessage(() => parseOrThrow(avatarSeedSchema, null, "avatar seed"));
    const second = captureErrorMessage(() => parseOrThrow(avatarSeedSchema, null, "avatar seed"));
    expect(first).toBe(second);
  });
});

describe("coercion policy", () => {
  it("rejects values of the wrong type instead of coercing (zod defaults)", () => {
    expect(() => finiteNumberSchema.parse("42")).toThrowError();
    expect(() => finiteTimestampSchema.parse(true)).toThrowError();
    expect(() => streamUserIdSchema.parse(123)).toThrowError();
    expect(() => nonEmptyStringSchema().parse(42)).toThrowError();
    expect(avatarSeedSchema.safeParse("  ").success).toBe(false);
  });
});
