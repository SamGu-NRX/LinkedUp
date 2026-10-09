// Equivalence + contract tests for the three identical cn() helpers:
//   src/lib/shadcn.ts, src/lib/utils.ts, src/lib/shadcn/index.ts
// Pure string functions — node environment is sufficient (no jsdom needed).
// Expected strings below were verified against tailwind-merge 3.0.2 / clsx 2.1.1.
import { describe, it, expect, expectTypeOf } from "vitest";
import { type ClassValue } from "clsx";
import { cn as cnShadcn } from "@/lib/shadcn";
import { cn as cnUtils } from "@/lib/utils";
import { cn as cnShadcnIndex } from "@/lib/shadcn/index";

type CnCase = {
  readonly name: string;
  readonly inputs: readonly ClassValue[];
  readonly expected: string;
};

const HELPERS: readonly { readonly label: string; readonly cn: typeof cnShadcn }[] = [
  { label: "@/lib/shadcn", cn: cnShadcn },
  { label: "@/lib/utils", cn: cnUtils },
  { label: "@/lib/shadcn/index", cn: cnShadcnIndex },
];

const MATRIX: readonly CnCase[] = [
  { name: "plain strings", inputs: ["foo", "bar"], expected: "foo bar" },
  { name: "drops false", inputs: ["foo", false, "bar"], expected: "foo bar" },
  { name: "drops null", inputs: ["foo", null, "bar"], expected: "foo bar" },
  { name: "drops undefined", inputs: ["foo", undefined, "bar"], expected: "foo bar" },
  { name: "drops 0", inputs: ["foo", 0, "bar"], expected: "foo bar" },
  { name: 'drops ""', inputs: ["foo", "", "bar"], expected: "foo bar" },
  { name: "no inputs", inputs: [], expected: "" },
  { name: "array input", inputs: [["foo", "bar"]], expected: "foo bar" },
  {
    name: "nested arrays with falsy entries",
    inputs: ["foo", ["bar", false, ["baz"]]],
    expected: "foo bar baz",
  },
  { name: "conflicting padding classes (p-2 vs p-4)", inputs: ["p-2", "p-4"], expected: "p-4" },
  { name: "conflicting x-padding classes (px-2 vs px-4)", inputs: ["px-2", "px-4"], expected: "px-4" },
  {
    name: "arbitrary value conflict (w-[37px] vs w-[42px])",
    inputs: ["w-[37px]", "w-[42px]"],
    expected: "w-[42px]",
  },
  { name: "arbitrary value kept next to unrelated class", inputs: ["w-[37px]", "grid"], expected: "w-[37px] grid" },
  {
    name: "variant in a different group survives",
    inputs: ["bg-red-500", "hover:bg-blue-500"],
    expected: "bg-red-500 hover:bg-blue-500",
  },
  {
    name: "same-variant conflict (hover:bg-*)",
    inputs: ["hover:bg-red-500", "hover:bg-blue-500"],
    expected: "hover:bg-blue-500",
  },
  { name: "important suffix conflict (px-2! vs px-4!)", inputs: ["px-2!", "px-4!"], expected: "px-4!" },
  // Verified tailwind-merge 3.0.2 behavior: an important-suffix class does NOT override
  // its non-important counterpart, so both are kept.
  { name: "important suffix vs plain class", inputs: ["px-2", "px-4!"], expected: "px-2 px-4!" },
  { name: "mixed real-world call", inputs: ["px-2 py-1", false && "hidden", "px-4"], expected: "py-1 px-4" },
];

describe("cn() helpers (shadcn.ts / utils.ts / shadcn/index.ts)", () => {
  it("returns the exact expected string for every matrix case", () => {
    for (const helper of HELPERS) {
      for (const testCase of MATRIX) {
        const actual = helper.cn(...testCase.inputs);
        expect(
          actual,
          `${helper.label} case "${testCase.name}": expected ${JSON.stringify(testCase.expected)}, got ${JSON.stringify(actual)}`,
        ).toBe(testCase.expected);
      }
    }
  });

  it("all three helpers return identical strings for every matrix case", () => {
    for (const testCase of MATRIX) {
      const outputs = HELPERS.map((helper) => helper.cn(...testCase.inputs));
      expect(
        new Set(outputs).size,
        `divergence in case "${testCase.name}": ${JSON.stringify(outputs)}`,
      ).toBe(1);
    }
  });

  // Compile-time contract: every export is exactly (...inputs: ClassValue[]) => string.
  // Enforced by `npx tsc --noEmit` (expectTypeOf is a runtime no-op in plain test runs).
  it("each helper is typed (...inputs: ClassValue[]) => string", () => {
    expectTypeOf(cnShadcn).toEqualTypeOf<(...inputs: ClassValue[]) => string>();
    expectTypeOf(cnUtils).toEqualTypeOf<(...inputs: ClassValue[]) => string>();
    expectTypeOf(cnShadcnIndex).toEqualTypeOf<(...inputs: ClassValue[]) => string>();
    expect(HELPERS).toHaveLength(3);
  });
});
