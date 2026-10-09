import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

// Infrastructure smoke test: proves the vitest runner + "@/" path alias work.
describe("test infrastructure", () => {
  it("resolves the @ alias and merges classes", () => {
    expect(cn("px-2", false && "hidden", "py-1")).toBe("px-2 py-1");
  });
});
