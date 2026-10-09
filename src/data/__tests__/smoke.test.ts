import { describe, expect, it } from "vitest";
import { generateAvatarColor, getInitials } from "@/data/avatar-utils";

// Smoke test for the harness itself: proves the vitest runner resolves the
// project's "@/" path alias and executes TypeScript tests under src/data/.
describe("harness", () => {
  it("runs tests against src/data modules via the @ alias", () => {
    const color = generateAvatarColor("user1");
    expect(color).toHaveProperty("from");
    expect(color).toHaveProperty("to");
    expect(color).toHaveProperty("text");

    expect(getInitials("Ada Lovelace")).toBe("AL");
  });
});
