import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

// Inert factory mock: the real SDK constructor would validate/normalize its
// input and the real module can pull in DOM/network code. The tests need a
// recorded-but-untouched constructor to assert exact validated arguments.
vi.mock("@stream-io/video-react-sdk", () => ({
  StreamVideoClient: vi.fn(),
}));

import { StreamVideoClient } from "@stream-io/video-react-sdk";
import { createStreamVideoClient, SupabaseUser } from "@/lib/getstream";

const API_KEY = "test-next-public-stream-api-key";
const SECRET_KEY = "test-stream-secret-key";

function stubBothEnvVars(): void {
  vi.stubEnv("NEXT_PUBLIC_STREAM_API_KEY", API_KEY);
  vi.stubEnv("STREAM_SECRET_KEY", SECRET_KEY);
}

/**
 * Deliberate type hole: models a JavaScript caller (or any untyped boundary)
 * passing runtime-invalid input that the TypeScript signature of
 * createStreamVideoClient cannot express. The zod boundary under test is what
 * keeps this cast safe at runtime: every call site below asserts the payload
 * is rejected with a ZodError at path ["user_id"] before StreamVideoClient is
 * ever constructed. If the invalid value ever reached the SDK, these tests
 * would fail and the cast would be proven unsafe.
 */
function asSupabaseUser(value: unknown): SupabaseUser {
  return value as SupabaseUser;
}

/**
 * Returns the stringified issue paths of the ZodError thrown by fn.
 * Fails with a specific message if fn does not throw, or throws something
 * other than a ZodError.
 */
function zodIssuePaths(fn: () => unknown): string[][] {
  try {
    fn();
  } catch (error) {
    if (error instanceof ZodError) {
      return error.issues.map((issue) =>
        issue.path.map((segment) => String(segment)),
      );
    }
    throw new Error(`expected a ZodError, but got: ${String(error)}`);
  }
  throw new Error("expected the call to throw a ZodError, but it resolved");
}

describe("createStreamVideoClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("env validation", () => {
    it("throws a specific error when NEXT_PUBLIC_STREAM_API_KEY is missing", () => {
      vi.stubEnv("STREAM_SECRET_KEY", SECRET_KEY);
      vi.stubEnv("NEXT_PUBLIC_STREAM_API_KEY", undefined);

      expect(() =>
        createStreamVideoClient({ user_id: "alice" }),
      ).toThrowError(
        "createStreamVideoClient: NEXT_PUBLIC_STREAM_API_KEY is not set",
      );
      expect(StreamVideoClient).not.toHaveBeenCalled();
    });

    it("throws a specific error when NEXT_PUBLIC_STREAM_API_KEY is an empty string", () => {
      vi.stubEnv("STREAM_SECRET_KEY", SECRET_KEY);
      vi.stubEnv("NEXT_PUBLIC_STREAM_API_KEY", "");

      expect(() =>
        createStreamVideoClient({ user_id: "alice" }),
      ).toThrowError(
        "createStreamVideoClient: NEXT_PUBLIC_STREAM_API_KEY is not set",
      );
      expect(StreamVideoClient).not.toHaveBeenCalled();
    });

    it("throws a specific error when STREAM_SECRET_KEY is missing", () => {
      vi.stubEnv("NEXT_PUBLIC_STREAM_API_KEY", API_KEY);
      vi.stubEnv("STREAM_SECRET_KEY", undefined);

      expect(() =>
        createStreamVideoClient({ user_id: "alice" }),
      ).toThrowError("createStreamVideoClient: STREAM_SECRET_KEY is not set");
      expect(StreamVideoClient).not.toHaveBeenCalled();
    });

    it("throws a specific error when STREAM_SECRET_KEY is an empty string", () => {
      vi.stubEnv("NEXT_PUBLIC_STREAM_API_KEY", API_KEY);
      vi.stubEnv("STREAM_SECRET_KEY", "");

      expect(() =>
        createStreamVideoClient({ user_id: "alice" }),
      ).toThrowError("createStreamVideoClient: STREAM_SECRET_KEY is not set");
      expect(StreamVideoClient).not.toHaveBeenCalled();
    });

    it("treats a whitespace-only env value as not set", () => {
      vi.stubEnv("STREAM_SECRET_KEY", SECRET_KEY);
      vi.stubEnv("NEXT_PUBLIC_STREAM_API_KEY", "   ");

      expect(() =>
        createStreamVideoClient({ user_id: "alice" }),
      ).toThrowError(
        "createStreamVideoClient: NEXT_PUBLIC_STREAM_API_KEY is not set",
      );
      expect(StreamVideoClient).not.toHaveBeenCalled();
    });
  });

  describe("user validation", () => {
    it("constructs StreamVideoClient with env values and the trimmed user_id", () => {
      stubBothEnvVars();

      createStreamVideoClient({ user_id: "  alice  " });

      expect(StreamVideoClient).toHaveBeenCalledTimes(1);
      expect(StreamVideoClient).toHaveBeenCalledWith({
        apiKey: API_KEY,
        token: SECRET_KEY,
        user: { id: "alice" },
      });
    });

    it("constructs StreamVideoClient with a user_id of exactly 255 characters", () => {
      stubBothEnvVars();
      const maxId = "a".repeat(255);

      createStreamVideoClient({ user_id: maxId });

      expect(StreamVideoClient).toHaveBeenCalledWith({
        apiKey: API_KEY,
        token: SECRET_KEY,
        user: { id: maxId },
      });
    });

    it.each(["", "   "])("rejects user_id %j as empty", (badUserId) => {
      stubBothEnvVars();

      expect(() =>
        createStreamVideoClient({ user_id: badUserId }),
      ).toThrowError(ZodError);
      expect(
        zodIssuePaths(() => createStreamVideoClient({ user_id: badUserId })),
      ).toEqual([["user_id"]]);
      expect(StreamVideoClient).not.toHaveBeenCalled();
    });

    it("rejects a user_id longer than 255 characters", () => {
      stubBothEnvVars();
      const tooLongId = "a".repeat(256);

      expect(() =>
        createStreamVideoClient({ user_id: tooLongId }),
      ).toThrowError(ZodError);
      expect(
        zodIssuePaths(() => createStreamVideoClient({ user_id: tooLongId })),
      ).toEqual([["user_id"]]);
      expect(StreamVideoClient).not.toHaveBeenCalled();
    });

    it.each([123, undefined])(
      "rejects non-string user_id %j",
      (badUserId) => {
        stubBothEnvVars();
        // Deliberate runtime-invalid payload; see asSupabaseUser docstring.
        const payload = asSupabaseUser({ user_id: badUserId });

        expect(() => createStreamVideoClient(payload)).toThrowError(ZodError);
        expect(zodIssuePaths(() => createStreamVideoClient(payload))).toEqual([
          ["user_id"],
        ]);
        expect(StreamVideoClient).not.toHaveBeenCalled();
      },
    );

    it("rejects a user object without a user_id key", () => {
      stubBothEnvVars();
      // Deliberate runtime-invalid payload; see asSupabaseUser docstring.
      const payload = asSupabaseUser({});

      expect(() => createStreamVideoClient(payload)).toThrowError(ZodError);
      expect(zodIssuePaths(() => createStreamVideoClient(payload))).toEqual([
        ["user_id"],
      ]);
      expect(StreamVideoClient).not.toHaveBeenCalled();
    });
  });
});
