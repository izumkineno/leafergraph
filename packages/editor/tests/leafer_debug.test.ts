import "./helpers/install_test_host_polyfills";

import { afterEach, describe, expect, test } from "bun:test";
import { Debug } from "leafer-ui";

import {
  EDITOR_LEAFER_DEBUG_STORAGE_KEY,
  applyLeaferDebugSettings,
  createDefaultEditorLeaferDebugSettings,
  normalizeEditorLeaferDebugSettings,
  parseEditorLeaferDebugTypeListInput,
  resolveInitialEditorLeaferDebugSettings,
  serializeEditorLeaferDebugSettings
} from "../src/debug/leafer_debug";

interface StorageMock {
  clear(): void;
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

const debugRuntime = Debug as typeof Debug & {
  enable: boolean;
  showWarn: boolean;
  showRepaint: boolean;
  showBounds: boolean | "hit";
  filterList: string[];
  excludeList: string[];
  filter?: string | string[];
  exclude?: string | string[];
};

const originalLocalStorage = window.localStorage;
const originalDebugState = {
  enable: debugRuntime.enable,
  showWarn: debugRuntime.showWarn,
  showRepaint: debugRuntime.showRepaint,
  showBounds: debugRuntime.showBounds,
  filterList: [...debugRuntime.filterList],
  excludeList: [...debugRuntime.excludeList]
};

function installStorageMock(
  initialEntries: Record<string, string> = {}
): StorageMock {
  const storage = new Map(Object.entries(initialEntries));
  const mock: StorageMock = {
    clear() {
      storage.clear();
    },
    getItem(key) {
      return storage.has(key) ? storage.get(key) ?? null : null;
    },
    removeItem(key) {
      storage.delete(key);
    },
    setItem(key, value) {
      storage.set(key, value);
    }
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: mock
  });

  return mock;
}

afterEach(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: originalLocalStorage
  });
  debugRuntime.enable = originalDebugState.enable;
  debugRuntime.showWarn = originalDebugState.showWarn;
  debugRuntime.showRepaint = originalDebugState.showRepaint;
  debugRuntime.showBounds = originalDebugState.showBounds;
  debugRuntime.filter = [...originalDebugState.filterList];
  debugRuntime.exclude = [...originalDebugState.excludeList];
});

describe("leafer debug settings helper", () => {
  test("默认配置应保持安全关闭状态", () => {
    expect(createDefaultEditorLeaferDebugSettings()).toEqual({
      enabled: false,
      showWarn: true,
      showRepaint: false,
      showBoundsMode: "off",
      filter: [],
      exclude: []
    });
  });

  test("类型列表输入应按逗号切分并去空白", () => {
    expect(parseEditorLeaferDebugTypeListInput(" RunTime, Life , , Custom ")).toEqual(
      ["RunTime", "Life", "Custom"]
    );
  });

  test("非法 localStorage 配置应回退到默认值", () => {
    installStorageMock({
      [EDITOR_LEAFER_DEBUG_STORAGE_KEY]: "{invalid"
    });

    expect(resolveInitialEditorLeaferDebugSettings()).toEqual(
      createDefaultEditorLeaferDebugSettings()
    );
  });

  test("localStorage 中的合法配置应被恢复并归一化", () => {
    const storedValue = serializeEditorLeaferDebugSettings(
      normalizeEditorLeaferDebugSettings({
        enabled: true,
        showWarn: false,
        showRepaint: true,
        showBoundsMode: "hit",
        filter: ["RunTime", "Life"],
        exclude: ["Custom"]
      })
    );
    installStorageMock({
      [EDITOR_LEAFER_DEBUG_STORAGE_KEY]: storedValue
    });

    expect(resolveInitialEditorLeaferDebugSettings()).toEqual({
      enabled: true,
      showWarn: false,
      showRepaint: true,
      showBoundsMode: "hit",
      filter: ["RunTime", "Life"],
      exclude: ["Custom"]
    });
  });

  test("applyLeaferDebugSettings 应正确映射到 Leafer Debug 全局配置", () => {
    applyLeaferDebugSettings({
      enabled: true,
      showWarn: false,
      showRepaint: true,
      showBoundsMode: "hit",
      filter: ["RunTime", "Life"],
      exclude: ["Custom"]
    });

    expect(debugRuntime.enable).toBe(true);
    expect(debugRuntime.showWarn).toBe(false);
    expect(debugRuntime.showRepaint).toBe(true);
    expect(debugRuntime.showBounds).toBe("hit");
    expect(debugRuntime.filterList).toEqual(["RunTime", "Life"]);
    expect(debugRuntime.excludeList).toEqual(["Custom"]);

    applyLeaferDebugSettings(createDefaultEditorLeaferDebugSettings());

    expect(debugRuntime.enable).toBe(false);
    expect(debugRuntime.showWarn).toBe(true);
    expect(debugRuntime.showRepaint).toBe(false);
    expect(debugRuntime.showBounds).toBe(false);
    expect(debugRuntime.filterList).toEqual([]);
    expect(debugRuntime.excludeList).toEqual([]);
  });
});
