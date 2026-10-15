// @vitest-environment node
// The guard every DB-writing test goes through (tests/stack-db.ts).
import { describe, expect, it } from "vitest";
import { dataDirectoryProblem, stackDatabaseUrl } from "../stack-db";
import { LOCAL_DATABASE_URL, PG_DATA_DIR } from "../../scripts/stack-paths.cjs";

describe("stackDatabaseUrl", () => {
  it("allows only the explicitly selected lane database on the shared cluster", () => {
    const url = "postgresql://postgres:postgres@127.0.0.1:54329/linkedup_match";
    expect(stackDatabaseUrl({ LINKEDUP_TEST_DATABASE: "linkedup_match", DATABASE_URL: url })).toBe(url);
    for (const invalid of [url.replace("linkedup_match", "linkedup"), url.replace("54329", "5432"), url.replace("127.0.0.1", "example.com")]) {
      expect(() => stackDatabaseUrl({ LINKEDUP_TEST_DATABASE: "linkedup_match", DATABASE_URL: invalid })).toThrow("Refusing DATABASE_URL");
    }
    expect(() => stackDatabaseUrl({ LINKEDUP_TEST_DATABASE: "linkedup", DATABASE_URL: LOCAL_DATABASE_URL })).toThrow("Refusing DATABASE_URL");
  });
  it("uses the stack's URL when nothing is inherited", () => {
    expect(stackDatabaseUrl({})).toBe(LOCAL_DATABASE_URL);
  });

  it("accepts an inherited URL only when it is the stack's", () => {
    expect(stackDatabaseUrl({ DATABASE_URL: LOCAL_DATABASE_URL })).toBe(LOCAL_DATABASE_URL);
  });

  it.each([
    ["the system Postgres", "postgresql://postgres:postgres@localhost:5432/linkedup"],
    ["a hosted database", "postgresql://app:s3cret-pw@db.example.supabase.co:5432/postgres"],
    ["the stack port, another database", LOCAL_DATABASE_URL.replace(/\/linkedup$/, "/postgres")],
    ["an empty value", ""],
  ])("refuses %s, without echoing credentials", (_name, url) => {
    let message = "";
    try {
      stackDatabaseUrl({ DATABASE_URL: url });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/^Refusing DATABASE_URL/);
    expect(message).not.toContain("s3cret-pw");
  });
});

describe("dataDirectoryProblem", () => {
  it("accepts this checkout's cluster", () => {
    expect(dataDirectoryProblem(PG_DATA_DIR)).toBeNull();
  });

  it("refuses any other data directory", () => {
    expect(dataDirectoryProblem("/opt/homebrew/var/postgresql@15")).toMatch(/not this checkout's cluster/);
  });
});
