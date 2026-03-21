import { describe, expect, test } from "bun:test";

import { resolveNodePointerSelectionAction } from "../src/ui/viewport/node_pointer_selection";

describe("resolveNodePointerSelectionAction", () => {
  test("多选状态下左键点中已选节点应收缩为单选", () => {
    expect(
      resolveNodePointerSelectionAction({
        isSecondaryPointer: false,
        shouldToggleSelection: false,
        hasMultipleSelected: true,
        isNodeSelected: true
      })
    ).toBe("select-node");
  });

  test("右键点中已选节点时应保留当前多选", () => {
    expect(
      resolveNodePointerSelectionAction({
        isSecondaryPointer: true,
        shouldToggleSelection: false,
        hasMultipleSelected: true,
        isNodeSelected: true
      })
    ).toBe("preserve-selection");
  });

  test("带切换修饰键时应走 toggle 语义", () => {
    expect(
      resolveNodePointerSelectionAction({
        isSecondaryPointer: false,
        shouldToggleSelection: true,
        hasMultipleSelected: true,
        isNodeSelected: false
      })
    ).toBe("toggle-node");
  });
});
