import "./helpers/install_test_host_polyfills";

import { beforeEach, describe, expect, test } from "bun:test";

import {
  EDITOR_WORKSPACE_PANE_STORAGE_KEYS,
  persistWorkspacePaneOpen,
  resolveInitialWorkspacePaneOpen
} from "../src/shell/workspace_preferences";

describe("workspace preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("未命中本地存储时应回退到调用方提供的默认值", () => {
    expect(resolveInitialWorkspacePaneOpen("left", true)).toBe(true);
    expect(resolveInitialWorkspacePaneOpen("right", false)).toBe(false);
  });

  test("命中本地存储后应返回持久化的 pane 可见性", () => {
    window.localStorage.setItem(
      EDITOR_WORKSPACE_PANE_STORAGE_KEYS.left,
      "false"
    );
    window.localStorage.setItem(
      EDITOR_WORKSPACE_PANE_STORAGE_KEYS.right,
      "true"
    );

    expect(resolveInitialWorkspacePaneOpen("left", true)).toBe(false);
    expect(resolveInitialWorkspacePaneOpen("right", false)).toBe(true);
  });

  test("persistWorkspacePaneOpen 应把 pane 开关写回浏览器存储", () => {
    persistWorkspacePaneOpen("left", false);
    persistWorkspacePaneOpen("right", true);

    expect(
      window.localStorage.getItem(EDITOR_WORKSPACE_PANE_STORAGE_KEYS.left)
    ).toBe("false");
    expect(
      window.localStorage.getItem(EDITOR_WORKSPACE_PANE_STORAGE_KEYS.right)
    ).toBe("true");
  });
});
