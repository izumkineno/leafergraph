import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  collectWorkspacePackages,
  getPackageRule,
  normalizeWorkspaceSpecifier
} from "../workspace_boundaries.shared.mjs";

const tempDirectories: string[] = [];

afterEach(() => {
  while (tempDirectories.length) {
    const directoryPath = tempDirectories.pop();
    if (directoryPath) {
      rmSync(directoryPath, { recursive: true, force: true });
    }
  }
});

describe("normalizeWorkspaceSpecifier", () => {
  test("keeps legacy top-level package names stable", () => {
    expect(normalizeWorkspaceSpecifier("@leafergraph/node/testing")).toBe("@leafergraph/node");
    expect(normalizeWorkspaceSpecifier("@leafergraph/theme/colors")).toBe("@leafergraph/theme");
  });

  test("keeps split core and extension package names stable", () => {
    expect(normalizeWorkspaceSpecifier("@leafergraph/core/node/testing")).toBe(
      "@leafergraph/core/node"
    );
    expect(normalizeWorkspaceSpecifier("@leafergraph/extensions/authoring/testing")).toBe(
      "@leafergraph/extensions/authoring"
    );
  });
});

describe("collectWorkspacePackages", () => {
  test("discovers nested packages/core/* and packages/extensions/* workspaces", () => {
    const repoRoot = createTempRepo();

    writeWorkspacePackage(repoRoot, "packages/node", "@leafergraph/node");
    writeWorkspacePackage(repoRoot, "packages/core/node", "@leafergraph/core/node");
    writeWorkspacePackage(
      repoRoot,
      "packages/extensions/authoring",
      "@leafergraph/extensions/authoring"
    );
    writeWorkspacePackage(repoRoot, "example/mini-graph", "leafergraph-minimal-graph-example");

    const workspacePackages = collectWorkspacePackages(repoRoot, [
      "packages/*",
      "packages/core/*",
      "packages/extensions/*",
      "example/*"
    ]);

    expect([...workspacePackages.keys()].sort()).toEqual([
      "@leafergraph/core/node",
      "@leafergraph/extensions/authoring",
      "@leafergraph/node",
      "leafergraph-minimal-graph-example"
    ]);
  });
});

describe("package split boundary rules", () => {
  test("maps split package names onto the existing boundary envelopes", () => {
    expect(getPackageRule("@leafergraph/core/node")).toEqual(getPackageRule("@leafergraph/node"));
    expect(getPackageRule("@leafergraph/core/execution")).toEqual(
      getPackageRule("@leafergraph/execution")
    );
    expect(getPackageRule("@leafergraph/extensions/authoring")).toEqual(
      getPackageRule("@leafergraph/authoring")
    );
  });

  test("root workspace declares the split package globs", () => {
    const rootPackageJson = JSON.parse(
      readFileSync(path.resolve(import.meta.dir, "../../package.json"), "utf8")
    );

    expect(rootPackageJson.workspaces).toEqual(
      expect.arrayContaining(["packages/core/*", "packages/extensions/*"])
    );
  });
});

function createTempRepo() {
  const directoryPath = mkdtempSync(path.join(tmpdir(), "leafergraph-workspace-boundaries-"));
  tempDirectories.push(directoryPath);
  return directoryPath;
}

function writeWorkspacePackage(repoRoot: string, relativePath: string, packageName: string) {
  const directoryPath = path.join(repoRoot, relativePath);
  mkdirSync(directoryPath, { recursive: true });
  writeFileSync(
    path.join(directoryPath, "package.json"),
    JSON.stringify(
      {
        name: packageName,
        version: "0.0.0",
        scripts: {
          build: "echo build"
        }
      },
      null,
      2
    )
  );
}
