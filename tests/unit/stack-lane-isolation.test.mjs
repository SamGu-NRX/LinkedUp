// @vitest-environment node
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
it("selects a lane database without changing the shared server", () => {
  const output = execFileSync(
    process.execPath,
    [
      "-e",
      "process.stdout.write(JSON.stringify(require('./scripts/stack-paths.cjs')))",
    ],
    {
      env: {
        ...process.env,
        LINKEDUP_DATABASE_NAME: "linkedup_ship",
        LINKEDUP_DEV_PORT: "3206",
        LINKEDUP_PG_DATA_DIR: "/tmp/shared-linkedup-test",
      },
      encoding: "utf8",
    },
  );
  const paths = JSON.parse(output);
  expect(new URL(paths.LOCAL_DATABASE_URL).pathname).toBe("/linkedup_ship");
  expect(paths.APP_PORT).toBe(3206);
  expect(paths.PG_DATA_DIR).toBe("/tmp/shared-linkedup-test");
});
it("rejects database names that could inject SQL", () => {
  expect(() =>
    execFileSync(
      process.execPath,
      ["-e", "require('./scripts/stack-paths.cjs')"],
      {
        env: {
          ...process.env,
          LINKEDUP_DATABASE_NAME: "bad; drop database postgres",
        },
        stdio: "pipe",
      },
    ),
  ).toThrow(/LINKEDUP_DATABASE_NAME must be a lowercase PostgreSQL identifier/);
});
