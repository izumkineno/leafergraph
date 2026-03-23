import "./helpers/install_test_host_polyfills";
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import * as backend from "../src/backend";

describe("editor public exports", () => {
  test("root 与 ui 入口文件存在且声明公共导出", () => {
    const rootEntry = resolve(import.meta.dir, "../src/index.ts");
    const uiEntry = resolve(import.meta.dir, "../src/ui.ts");
    const shellEntry = resolve(import.meta.dir, "../src/shell/index.ts");
    const viewportEntry = resolve(import.meta.dir, "../src/ui/viewport/index.ts");

    expect(existsSync(rootEntry)).toBeTruthy();
    expect(existsSync(uiEntry)).toBeTruthy();
    expect(existsSync(shellEntry)).toBeTruthy();
    expect(existsSync(viewportEntry)).toBeTruthy();

    const rootSource = readFileSync(rootEntry, "utf8");
    const uiSource = readFileSync(uiEntry, "utf8");

    expect(rootSource.includes("EditorProvider")).toBeTruthy();
    expect(rootSource.includes("EditorShell")).toBeTruthy();
    expect(rootSource.includes("createEditorController")).toBeTruthy();
    expect(uiSource.includes("ui/workspace")).toBeTruthy();
    expect(uiSource.includes("ui/viewport")).toBeTruthy();
  });

  test("backend 入口暴露 authority 接线工厂", () => {
    expect(typeof backend.createEditorRemoteAuthorityAppRuntime).toBe("function");
    expect(typeof backend.createWebSocketRemoteAuthorityTransport).toBe(
      "function"
    );
    expect(typeof backend.createRemoteGraphDocumentSessionBinding).toBe(
      "function"
    );
  });

  test("官方样式入口存在", () => {
    expect(
      existsSync(resolve(import.meta.dir, "../src/styles.css"))
    ).toBeTruthy();
  });

  test("package.json 声明稳定 exports", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(import.meta.dir, "../package.json"), "utf8")
    ) as {
      exports?: Record<string, string>;
    };

    expect(packageJson.exports?.["."]).toBe("./src/index.ts");
    expect(packageJson.exports?.["./shell"]).toBe("./src/shell/index.ts");
    expect(packageJson.exports?.["./ui"]).toBe("./src/ui.ts");
    expect(packageJson.exports?.["./ui/viewport"]).toBe(
      "./src/ui/viewport/index.ts"
    );
    expect(packageJson.exports?.["./backend"]).toBe("./src/backend.ts");
    expect(packageJson.exports?.["./styles.css"]).toBe("./src/styles.css");
  });
});
