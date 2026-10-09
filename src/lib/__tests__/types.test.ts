/**
 * Type-level contract tests for the public signatures of src/lib.
 *
 * Design notes:
 * - Every src/lib import is a TYPE-only import (`import type`), so this file has
 *   zero runtime coupling to src/lib (and no SDK/DOM side effects at runtime).
 *   All assertions below run through `expectTypeOf<...>()` in type-parameter form.
 * - Because of that, the enforcement surface for these pins is the TypeScript
 *   gate (`npx tsc --noEmit`), which is exactly the point: future signature
 *   drift in src/lib must fail the typecheck. The vitest run proves the file
 *   still parses and executes.
 * - Assertions are written so they stay true under the planned tightening:
 *   structural "accepts" checks (function-type assignability, contravariant in
 *   parameters) instead of exact parameter-tuple equality where the source type
 *   is not exported (e.g. `SupabaseUser` in getstream, `State`/`Action` in
 *   use-toast).
 */

import { describe, expectTypeOf, test } from "vitest";
import type { ClassValue } from "clsx";
import type { StreamVideoClient } from "@stream-io/video-react-sdk";
import type { ConnectionStatus, UserInfo } from "@/types/user";
import type { AvatarColor } from "@/lib/avatar-utils";

import type { cn as cnUtils } from "@/lib/utils";
import type { cn as cnShadcn } from "@/lib/shadcn";
import type { cn as cnShadcnIndex } from "@/lib/shadcn/index";
import type {
  generateAvatarColor,
  generateAvatarDataUrl,
  getInitials,
  formatTime,
  getStatusColor,
  getAvatar,
} from "@/lib/avatar-utils";
import type { createStreamVideoClient } from "@/lib/getstream";
import type { reducer, toast, useToast } from "@/lib/hooks/use-toast";

describe("src/lib type contracts: cn (all three modules)", () => {
  test("cn is not any, accepts a spread of ClassValue, and returns string", () => {
    // Negative contract: no public src/lib export may be `any`.
    expectTypeOf<typeof cnUtils>().not.toBeAny();
    expectTypeOf<typeof cnShadcn>().not.toBeAny();
    expectTypeOf<typeof cnShadcnIndex>().not.toBeAny();

    // Return type: string (exact — drift to `string | undefined` must fail).
    expectTypeOf<typeof cnUtils>().returns.toBeString();
    expectTypeOf<typeof cnShadcn>().returns.toBeString();
    expectTypeOf<typeof cnShadcnIndex>().returns.toBeString();

    // Parameter type: variadic ClassValue spread. A function with a
    // ClassValue[] rest parameter must remain assignable to each cn — this
    // stays true if cn's parameters are tightened as long as a ClassValue[]
    // call still typechecks. Return-width drift is caught by toBeString above.
    expectTypeOf<(...inputs: ClassValue[]) => string>().toExtend<typeof cnUtils>();
    expectTypeOf<(...inputs: ClassValue[]) => string>().toExtend<typeof cnShadcn>();
    expectTypeOf<(...inputs: ClassValue[]) => string>().toExtend<typeof cnShadcnIndex>();

    // Concrete call shapes a ClassValue spread must accept.
    expectTypeOf<typeof cnUtils>().toBeCallableWith(
      "px-2",
      1,
      true,
      null,
      undefined,
      ["py-1"],
      { "text-lg": true },
    );
  });
});

describe("src/lib type contracts: avatar-utils", () => {
  test("generateAvatarColor accepts string and number, returns AvatarColor", () => {
    expectTypeOf<typeof generateAvatarColor>().not.toBeAny();

    // Exact current contract: id: string | number.
    expectTypeOf<typeof generateAvatarColor>().parameters.toEqualTypeOf<
      [string | number]
    >();

    // A call with a string and a call with a number must both typecheck:
    // the pinned function must be assignable to these narrower-parameter
    // function types (parameters are checked contravariantly).
    expectTypeOf<typeof generateAvatarColor>().toExtend<(id: string) => AvatarColor>();
    expectTypeOf<typeof generateAvatarColor>().toExtend<(id: number) => AvatarColor>();

    // Return type is the exported AvatarColor interface.
    expectTypeOf<typeof generateAvatarColor>().returns.toEqualTypeOf<AvatarColor>();
    expectTypeOf<typeof generateAvatarColor>().returns.not.toBeAny();
  });

  test("generateAvatarDataUrl accepts string and number, returns string", () => {
    expectTypeOf<typeof generateAvatarDataUrl>().not.toBeAny();
    expectTypeOf<typeof generateAvatarDataUrl>().returns.toBeString();

    // Documented contract ("String or number used to generate a deterministic
    // gradient"): the pinned function must accept calls with either.
    expectTypeOf<typeof generateAvatarDataUrl>().toExtend<(seed: string) => string>();
    expectTypeOf<typeof generateAvatarDataUrl>().toExtend<(seed: number) => string>();
  });

  test("getInitials(name: string) returns string", () => {
    expectTypeOf<typeof getInitials>().not.toBeAny();
    expectTypeOf<typeof getInitials>().parameters.toEqualTypeOf<[string]>();
    expectTypeOf<typeof getInitials>().returns.toBeString();
  });

  test("formatTime(timestamp: number) returns string", () => {
    expectTypeOf<typeof formatTime>().not.toBeAny();
    expectTypeOf<typeof formatTime>().parameters.toEqualTypeOf<[number]>();
    expectTypeOf<typeof formatTime>().returns.toBeString();
  });

  test("getStatusColor accepts ConnectionStatus | undefined | null, returns string", () => {
    expectTypeOf<typeof getStatusColor>().not.toBeAny();
    expectTypeOf<typeof getStatusColor>().parameters.toEqualTypeOf<
      [ConnectionStatus | undefined | null]
    >();
    expectTypeOf<typeof getStatusColor>().returns.toBeString();
  });

  test("getAvatar accepts UserInfo, returns string", () => {
    expectTypeOf<typeof getAvatar>().not.toBeAny();
    expectTypeOf<typeof getAvatar>().parameters.toEqualTypeOf<[UserInfo]>();
    expectTypeOf<typeof getAvatar>().returns.toBeString();
  });
});

describe("src/lib type contracts: getstream", () => {
  test("createStreamVideoClient accepts { user_id: string }, returns the SDK client type", () => {
    expectTypeOf<typeof createStreamVideoClient>().not.toBeAny();

    // The parameter interface (`SupabaseUser`) is not exported, so pin it
    // structurally: a function taking a plain { user_id: string } argument
    // must be assignable to createStreamVideoClient — i.e. calling it with a
    // { user_id: string } value typechecks. Stays true if the parameter type
    // is widened or re-exported later.
    expectTypeOf<(user: { user_id: string }) => StreamVideoClient>().toExtend<
      typeof createStreamVideoClient
    >();

    // Return type is the SDK client type, not a loose structural stand-in.
    expectTypeOf<typeof createStreamVideoClient>().returns.toEqualTypeOf<StreamVideoClient>();
    expectTypeOf<typeof createStreamVideoClient>().returns.not.toBeAny();
  });
});

describe("src/lib type contracts: hooks/use-toast", () => {
  test("reducer has arity 2, State-like state/action slices, State-like return", () => {
    expectTypeOf<typeof reducer>().not.toBeAny();

    // Arity 2: (state, action). [State, Action] extends [unknown, unknown]
    // holds for any two-parameter signature and fails if arity drifts.
    expectTypeOf<typeof reducer>().parameters.toExtend<[unknown, unknown]>();

    // State and Action are not exported; pin them structurally. State must
    // carry a toasts array whose elements have an id; Action must be
    // discriminated by a string `type`.
    expectTypeOf<typeof reducer>().parameter(0).toExtend<{ toasts: { id: string }[] }>();
    expectTypeOf<typeof reducer>().parameter(1).toExtend<{ type: string }>();
    expectTypeOf<typeof reducer>().returns.toExtend<{ toasts: { id: string }[] }>();
  });

  test("toast returns { id, dismiss } handle and is not any", () => {
    expectTypeOf<typeof toast>().not.toBeAny();
    expectTypeOf<typeof toast>().returns.toExtend<{ id: string; dismiss: () => void }>();
  });

  test("useToast returns { toasts, toast, dismiss } shape", () => {
    expectTypeOf<typeof useToast>().not.toBeAny();

    type UseToastReturn = ReturnType<typeof useToast>;

    // toasts: ToasterToast-like array (elements carry an id).
    expectTypeOf<UseToastReturn["toasts"]>().toExtend<{ id: string }[]>();

    // toast: the same toast function that is exported from the module.
    expectTypeOf<UseToastReturn["toast"]>().toEqualTypeOf<typeof toast>();

    // dismiss: optional string id, void return.
    expectTypeOf<UseToastReturn["dismiss"]>().parameter(0).toExtend<string | undefined>();
    expectTypeOf<UseToastReturn["dismiss"]>().returns.toBeVoid();
  });
});
