import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "..", "..");

describe("mini-graph example smoke build", () => {
  test("bun run build:minimal-graph succeeds", () => {
    const result = spawnSync("bun", ["run", "build:minimal-graph"], {
      cwd: repoRoot,
      encoding: "utf-8"
    });

    expect(result.status, [
      result.stdout,
      result.stderr
    ].filter(Boolean).join("\n")).toBe(0);
  });
});
