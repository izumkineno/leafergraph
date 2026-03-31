import type {
  ShortcutController,
  ShortcutFunctionRegistry,
  ShortcutKeymapRegistry
} from "../core/types";

export type LeaferGraphShortcutFunctionId =
  | "graph.copy"
  | "graph.cut"
  | "graph.paste"
  | "graph.duplicate"
  | "graph.select-all"
  | "graph.clear-selection"
  | "graph.delete-selection"
  | "graph.fit-view"
  | "graph.undo"
  | "graph.redo"
  | "graph.play"
  | "graph.step"
  | "graph.stop";

export interface LeaferGraphShortcutHistoryHost {
  undo(): boolean;
  redo(): boolean;
  canUndo?(): boolean;
  canRedo?(): boolean;
}

export interface LeaferGraphShortcutClipboardHost {
  copySelection(): boolean;
  cutSelection(): boolean;
  pasteClipboard(): boolean;
  duplicateSelection(): boolean;
  canCopySelection?(): boolean;
  canCutSelection?(): boolean;
  canPasteClipboard?(): boolean;
  canDuplicateSelection?(): boolean;
}

export interface LeaferGraphShortcutHost {
  listNodeIds(): readonly string[];
  listSelectedNodeIds(): readonly string[];
  setSelectedNodeIds(nodeIds: readonly string[]): readonly string[];
  clearSelectedNodes(): readonly string[];
  removeNode(nodeId: string): void;
  fitView(): void;
  play(): void;
  step(): void;
  stop(): void;
  isTextEditingActive?(): boolean;
  isContextMenuOpen?(): boolean;
  getInteractionActivityState?(): {
    active: boolean;
    mode: string;
  };
}

export interface LeaferGraphShortcutRuntimeData {
  host: LeaferGraphShortcutHost;
  history?: LeaferGraphShortcutHistoryHost;
  clipboard?: LeaferGraphShortcutClipboardHost;
}

export interface RegisterLeaferGraphShortcutFunctionsOptions {
  host: LeaferGraphShortcutHost;
  history?: LeaferGraphShortcutHistoryHost;
  clipboard?: LeaferGraphShortcutClipboardHost;
}

export interface RegisterLeaferGraphShortcutKeymapOptions {
  enableClipboardBindings?: boolean;
  enableExecutionBindings?: boolean;
  enableHistoryBindings?: boolean;
  platform?: "mac" | "windows" | "linux";
}

export interface BindLeaferGraphShortcutsOptions {
  target: EventTarget;
  host: LeaferGraphShortcutHost;
  history?: LeaferGraphShortcutHistoryHost;
  clipboard?: LeaferGraphShortcutClipboardHost;
  scopeElement?: HTMLElement;
  enableExecutionBindings?: boolean;
  platform?: "mac" | "windows" | "linux";
}

export interface BoundLeaferGraphShortcuts {
  controller: ShortcutController;
  functionRegistry: ShortcutFunctionRegistry<LeaferGraphShortcutRuntimeData>;
  keymapRegistry: ShortcutKeymapRegistry;
  resolveShortcutLabel(functionId: LeaferGraphShortcutFunctionId): string | undefined;
  listShortcutLabels(functionId: LeaferGraphShortcutFunctionId): string[];
  destroy(): void;
}
