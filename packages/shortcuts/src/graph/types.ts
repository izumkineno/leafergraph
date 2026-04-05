/**
 * LeaferGraph 快捷键扩展的图宿主契约模块。
 *
 * @remarks
 * 负责定义图级快捷键功能 ID、宿主能力和绑定结果，
 * 让快捷键系统只依赖最小的图操作抽象。
 */

import type {
  ShortcutController,
  ShortcutFunctionRegistry,
  ShortcutKeymapRegistry
} from "../core/types";

/**
 * LeaferGraph 内建快捷键功能 ID。
 */
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

/**
 * 历史能力宿主。
 */
export interface LeaferGraphShortcutHistoryHost {
  /** 执行一次撤销。 */
  undo(): boolean;
  /** 执行一次重做。 */
  redo(): boolean;
  /** 当前是否允许撤销。 */
  canUndo?(): boolean;
  /** 当前是否允许重做。 */
  canRedo?(): boolean;
}

/**
 * 剪贴板能力宿主。
 */
export interface LeaferGraphShortcutClipboardHost {
  /** 复制当前选区。 */
  copySelection(): boolean | Promise<boolean>;
  /** 剪切当前选区。 */
  cutSelection(): boolean | Promise<boolean>;
  /** 粘贴当前剪贴板内容。 */
  pasteClipboard(): boolean | Promise<boolean>;
  /** 复制并创建当前选区副本。 */
  duplicateSelection(): boolean | Promise<boolean>;
  /** 当前是否允许复制。 */
  canCopySelection?(): boolean;
  /** 当前是否允许剪切。 */
  canCutSelection?(): boolean;
  /** 当前是否允许粘贴。 */
  canPasteClipboard?(): boolean;
  /** 当前是否允许复制当前选区。 */
  canDuplicateSelection?(): boolean;
}

/**
 * 图级快捷键宿主能力。
 */
export interface LeaferGraphShortcutHost {
  /** 列出当前图中全部节点 ID。 */
  listNodeIds(): readonly string[];
  /** 列出当前选区节点 ID。 */
  listSelectedNodeIds(): readonly string[];
  /** 用给定节点 ID 完全替换选区。 */
  setSelectedNodeIds(nodeIds: readonly string[]): readonly string[];
  /** 清空当前选区。 */
  clearSelectedNodes(): readonly string[];
  /** 删除指定节点。 */
  removeNode(nodeId: string): Promise<void> | void;
  /** 执行视图适配。 */
  fitView(): Promise<void> | void;
  /** 启动图级执行。 */
  play(): Promise<void> | void;
  /** 推进一步执行。 */
  step(): Promise<void> | void;
  /** 停止图级执行。 */
  stop(): Promise<void> | void;
  /** 当前是否存在文本编辑态。 */
  isTextEditingActive?(): boolean;
  /** 当前是否已有上下文菜单处于打开状态。 */
  isContextMenuOpen?(): boolean;
  /** 当前是否存在会占用键盘交互的图级手势。 */
  getInteractionActivityState?(): {
    active: boolean;
    mode: string;
  };
}

/**
 * 图快捷键函数执行时可读取的运行时数据。
 */
export interface LeaferGraphShortcutRuntimeData {
  /** 图宿主能力。 */
  host: LeaferGraphShortcutHost;
  /** 历史宿主能力。 */
  history?: LeaferGraphShortcutHistoryHost;
  /** 剪贴板宿主能力。 */
  clipboard?: LeaferGraphShortcutClipboardHost;
}

/**
 * 注册图快捷键函数时使用的输入选项。
 */
export interface RegisterLeaferGraphShortcutFunctionsOptions {
  /** 图宿主能力。 */
  host: LeaferGraphShortcutHost;
  /** 历史宿主能力。 */
  history?: LeaferGraphShortcutHistoryHost;
  /** 剪贴板宿主能力。 */
  clipboard?: LeaferGraphShortcutClipboardHost;
}

/**
 * 注册默认快捷键映射时使用的输入选项。
 */
export interface RegisterLeaferGraphShortcutKeymapOptions {
  /** 是否注册复制、剪切、粘贴等剪贴板绑定。 */
  enableClipboardBindings?: boolean;
  /** 是否注册运行控制相关绑定。 */
  enableExecutionBindings?: boolean;
  /** 是否注册撤销、重做相关绑定。 */
  enableHistoryBindings?: boolean;
  /** 当前平台类型。 */
  platform?: "mac" | "windows" | "linux";
}

/**
 * 把快捷键系统直接绑定到图宿主时的输入选项。
 */
export interface BindLeaferGraphShortcutsOptions {
  /** 键盘事件目标。 */
  target: EventTarget;
  /** 图宿主能力。 */
  host: LeaferGraphShortcutHost;
  /** 历史宿主能力。 */
  history?: LeaferGraphShortcutHistoryHost;
  /** 剪贴板宿主能力。 */
  clipboard?: LeaferGraphShortcutClipboardHost;
  /** 作用域解析可依赖的宿主元素。 */
  scopeElement?: HTMLElement;
  /** 是否启用运行控制快捷键。 */
  enableExecutionBindings?: boolean;
  /** 当前平台类型。 */
  platform?: "mac" | "windows" | "linux";
}

/**
 * 图快捷键绑定后的返回对象。
 */
export interface BoundLeaferGraphShortcuts {
  /** 实际处理键盘事件的控制器。 */
  controller: ShortcutController;
  /** 当前图快捷键函数注册表。 */
  functionRegistry: ShortcutFunctionRegistry<LeaferGraphShortcutRuntimeData>;
  /** 当前图快捷键绑定注册表。 */
  keymapRegistry: ShortcutKeymapRegistry;
  /** 按功能 ID 解析单个用户可读快捷键标签。 */
  resolveShortcutLabel(functionId: LeaferGraphShortcutFunctionId): string | undefined;
  /** 按功能 ID 列出全部快捷键标签。 */
  listShortcutLabels(functionId: LeaferGraphShortcutFunctionId): string[];
  /** 释放控制器和注册表资源。 */
  destroy(): void;
}
