import "./helpers/install_test_host_polyfills";

import { beforeEach, describe, expect, test } from "bun:test";

import { createFakeIndexedDb } from "./helpers/fake_indexeddb";
import {
  persistEditorBundleRecord,
  readPersistedEditorBundleRecords,
  removePersistedEditorBundleRecord,
  updatePersistedEditorBundleEnabled
} from "../src/loader/persistence";

describe("loader persistence", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { indexedDB?: IDBFactory }).indexedDB =
      createFakeIndexedDb();
  });

  test("应按 savedAt 顺序读回 bundle 持久化记录，并支持启用态更新", async () => {
    await persistEditorBundleRecord({
      key: "node:@test/late",
      slot: "node",
      bundleId: "@test/late",
      fileName: "late.iife.js",
      sourceCode: "late",
      enabled: false,
      savedAt: 20
    });
    await persistEditorBundleRecord({
      key: "node:@test/early",
      slot: "node",
      bundleId: "@test/early",
      fileName: "early.iife.js",
      sourceCode: "early",
      enabled: true,
      savedAt: 10
    });

    const recordsBeforeUpdate = await readPersistedEditorBundleRecords();
    expect(recordsBeforeUpdate.map((record) => record.key)).toEqual([
      "node:@test/early",
      "node:@test/late"
    ]);

    await updatePersistedEditorBundleEnabled("node:@test/late", true);
    const recordsAfterUpdate = await readPersistedEditorBundleRecords();
    expect(recordsAfterUpdate.find((record) => record.key === "node:@test/late"))
      .toMatchObject({
        enabled: true
      });
  });

  test("删除后不应再返回对应 bundle 记录", async () => {
    await persistEditorBundleRecord({
      key: "demo:@test/demo",
      slot: "demo",
      bundleId: "@test/demo",
      fileName: "demo.iife.js",
      sourceCode: "demo",
      enabled: true,
      savedAt: 30
    });

    expect(await removePersistedEditorBundleRecord("demo:@test/demo")).toBe(true);
    expect(await readPersistedEditorBundleRecords()).toEqual([]);
  });
});
