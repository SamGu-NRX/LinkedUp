// @vitest-environment node
// The guard every DB-writing test goes through (tests/stack-db.ts).
import { describe, expect, it } from "vitest";
import { dataDirectoryProblem, stackDatabaseUrl } from "../stack-db";
import { LOCAL_DATABASE_URL, PG_DATA_DIR } from "../../scripts/dev-up.mjs";

describe("stackDatabaseUrl", () => {
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
