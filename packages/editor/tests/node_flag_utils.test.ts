import { describe, expect, test } from "bun:test";

import { sanitizePersistedNodeFlags } from "../src/commands/node_flag_utils";

describe("sanitizePersistedNodeFlags", () => {
  test("应移除 selected 并保留其余可持久化 flags", () => {
    expect(
      sanitizePersistedNodeFlags({
        selected: true,
        collapsed: true,
        pinned: true
      })
    ).toEqual({
      collapsed: true,
      pinned: true
    });
  });

  test("仅有 selected 时应返回 undefined", () => {
    expect(
      sanitizePersistedNodeFlags({
        selected: true
      })
    ).toBeUndefined();
  });

  test("未提供 flags 时应返回 undefined", () => {
    expect(sanitizePersistedNodeFlags(undefined)).toBeUndefined();
  });
});
