/**
 * 节点指针选区解析模块。
 *
 * @remarks
 * 负责根据左键、右键和修饰键解析节点命中的选区动作，供 viewport 统一处理点击选中语义。
 */
export type NodePointerSelectionAction =
  | "preserve-selection"
  | "select-node"
  | "toggle-node";

/** 统一解析一次节点左/右键命中的选区动作。 */
export function resolveNodePointerSelectionAction(input: {
  isSecondaryPointer: boolean;
  shouldToggleSelection: boolean;
  hasMultipleSelected: boolean;
  isNodeSelected: boolean;
}): NodePointerSelectionAction {
  if (input.isSecondaryPointer) {
    return input.isNodeSelected ? "preserve-selection" : "select-node";
  }

  if (input.shouldToggleSelection) {
    return "toggle-node";
  }

  if (input.hasMultipleSelected && input.isNodeSelected) {
    return "select-node";
  }

  return "select-node";
}
