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
