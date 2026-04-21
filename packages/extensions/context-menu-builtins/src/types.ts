/**
 * LeaferGraph context-menu builtins 契约模块。
 *
 * @remarks
 * 负责定义内建右键菜单功能依赖的宿主能力、剪贴板状态和功能开关，
 * 让内建菜单能力可以在不耦合 editor 壳层的前提下被宿主复用。
 */

import type {
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphSelectionUpdateMode
} from "@leafergraph/core/contracts";
import type {
  GraphLink,
  NodeDefinition,
  NodeSerializeResult
} from "@leafergraph/core/node";
import type {
  LeaferContextMenu,
  LeaferContextMenuContext,
  LeaferContextMenuResolver
} from "@leafergraph/extensions/context-menu";

/**
 * 右键菜单剪贴板快照。
 */
export interface LeaferGraphContextMenuClipboardFragment {
  /** 当前复制或剪切得到的节点快照。 */
  nodes: NodeSerializeResult[];
  /** 当前复制或剪切得到的连线快照。 */
  links: GraphLink[];
}

/**
 * 右键菜单内建功能使用的剪贴板状态。
 */
export interface LeaferGraphContextMenuClipboardState {
  /** 读取当前剪贴板片段。 */
  getFragment(): LeaferGraphContextMenuClipboardFragment | null;
  /** 写入当前剪贴板片段。 */
  setFragment(fragment: LeaferGraphContextMenuClipboardFragment | null): void;
  /** 清空当前剪贴板片段。 */
  clear(): void;
  /** 当前是否存在可粘贴片段。 */
  hasFragment(): boolean;
}

/**
 * 内建菜单动作 ID。
 */
export type LeaferGraphContextMenuBuiltinActionId =
  | "graph.copy"
  | "graph.cut"
  | "graph.paste"
  | "graph.duplicate"
  | "graph.select-all"
  | "graph.delete-selection"
  | "graph.undo"
  | "graph.redo";

/**
 * 菜单内建历史能力宿主。
 */
export interface LeaferGraphContextMenuBuiltinHistoryHost {
  /** 执行撤销。 */
  undo(): boolean;
  /** 执行重做。 */
  redo(): boolean;
  /** 当前是否允许撤销。 */
  canUndo?(): boolean;
  /** 当前是否允许重做。 */
  canRedo?(): boolean;
}

/**
 * 单个内建菜单功能的开关结构。
 */
export type LeaferGraphContextMenuBuiltinFeatureToggle =
  | boolean
  | {
      /** 是否启用该功能。 */
      enabled?: boolean;
    };

/**
 * 内建菜单功能开关集合。
 */
export interface LeaferGraphContextMenuBuiltinFeatureFlags {
  /** 是否启用画布空白区新增节点入口。 */
  canvasAddNode?: LeaferGraphContextMenuBuiltinFeatureToggle;
  /** 是否启用画布粘贴入口。 */
  canvasPaste?: LeaferGraphContextMenuBuiltinFeatureToggle;
  /** 是否启用画布运行控制入口。 */
  canvasControls?: LeaferGraphContextMenuBuiltinFeatureToggle;
  /** 是否启用画布撤销入口。 */
  canvasUndo?: LeaferGraphContextMenuBuiltinFeatureToggle;
  /** 是否启用画布重做入口。 */
  canvasRedo?: LeaferGraphContextMenuBuiltinFeatureToggle;
  /** 是否启用全选入口。 */
  canvasSelectAll?: LeaferGraphContextMenuBuiltinFeatureToggle;
  /** 是否启用删除选区入口。 */
  canvasDeleteSelection?: LeaferGraphContextMenuBuiltinFeatureToggle;
  /** 是否启用从当前节点开始运行入口。 */
  nodeRunFromHere?: LeaferGraphContextMenuBuiltinFeatureToggle;
  /** 是否启用节点复制入口。 */
  nodeCopy?: LeaferGraphContextMenuBuiltinFeatureToggle;
  /** 是否启用节点剪切入口。 */
  nodeCut?: LeaferGraphContextMenuBuiltinFeatureToggle;
  /** 是否启用节点复制副本入口。 */
  nodeDuplicate?: LeaferGraphContextMenuBuiltinFeatureToggle;
  /** 是否启用节点删除入口。 */
  nodeDelete?: LeaferGraphContextMenuBuiltinFeatureToggle;
  /** 是否启用连线删除入口。 */
  linkDelete?: LeaferGraphContextMenuBuiltinFeatureToggle;
}

/**
 * 内建菜单功能依赖的最小图宿主能力。
 */
export interface LeaferGraphContextMenuBuiltinsHost {
  /** 列出当前已注册节点定义。 */
  listNodes(): readonly NodeDefinition[];
  /** 列出当前全部节点 ID。 */
  listNodeIds?(): readonly string[];
  /** 读取指定节点的可序列化快照。 */
  getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined;
  /** 按节点查找相关连线。 */
  findLinksByNode(nodeId: string): readonly GraphLink[];
  /** 当前节点是否处于选中态。 */
  isNodeSelected(nodeId: string): boolean;
  /** 列出当前选区节点 ID。 */
  listSelectedNodeIds(): string[];
  /** 按模式更新选区。 */
  setSelectedNodeIds(
    nodeIds: readonly string[],
    mode?: LeaferGraphSelectionUpdateMode
  ): string[];
  /** 在图中创建节点。 */
  createNode(
    input: LeaferGraphCreateNodeInput,
    context: LeaferContextMenuContext
  ): Promise<{ nodeId: string }> | { nodeId: string };
  /** 在图中创建连线。 */
  createLink(
    input: LeaferGraphCreateLinkInput,
    context: LeaferContextMenuContext
  ): Promise<{ linkId: string }> | { linkId: string };
  /** 启动图执行。 */
  play(context: LeaferContextMenuContext): Promise<void> | void;
  /** 单步执行。 */
  step(context: LeaferContextMenuContext): Promise<void> | void;
  /** 停止执行。 */
  stop(context: LeaferContextMenuContext): Promise<void> | void;
  /** 适配当前视图。 */
  fitView(context: LeaferContextMenuContext): Promise<void> | void;
  /** 从指定节点开始执行。 */
  playFromNode(
    nodeId: string,
    context: LeaferContextMenuContext
  ): Promise<void> | void;
  /** 删除指定节点。 */
  removeNode(
    nodeId: string,
    context: LeaferContextMenuContext
  ): Promise<void> | void;
  /** 批量删除节点。 */
  removeNodes?(
    nodeIds: readonly string[],
    context: LeaferContextMenuContext
  ): Promise<void> | void;
  /** 删除指定连线。 */
  removeLink(
    linkId: string,
    context: LeaferContextMenuContext
  ): Promise<void> | void;
}

/**
 * 内建菜单装配选项。
 */
export interface LeaferGraphContextMenuBuiltinOptions {
  /** 图宿主能力。 */
  host: LeaferGraphContextMenuBuiltinsHost;
  /** 功能开关。 */
  features?: LeaferGraphContextMenuBuiltinFeatureFlags;
  /** 剪贴板状态；未提供时通常由 builtins 自己创建默认实现。 */
  clipboard?: LeaferGraphContextMenuClipboardState;
  /** 历史宿主能力。 */
  history?: LeaferGraphContextMenuBuiltinHistoryHost;
  /** 动作 ID 到快捷键标签的解析函数。 */
  resolveShortcutLabel?(
    actionId: LeaferGraphContextMenuBuiltinActionId
  ): string | undefined;
  /** 粘贴时默认应用的位移。 */
  pasteOffset?: {
    /** 横向偏移。 */
    x: number;
    /** 纵向偏移。 */
    y: number;
  };
}

/**
 * 内建菜单功能注册阶段可读取的上下文。
 */
export interface LeaferGraphContextMenuBuiltinFeatureRegistrationContext {
  /** 当前菜单实例。 */
  menu: LeaferContextMenu;
  /** 图宿主能力。 */
  host: LeaferGraphContextMenuBuiltinsHost;
  /** 剪贴板状态。 */
  clipboard: LeaferGraphContextMenuClipboardState;
  /** 历史宿主能力。 */
  history?: LeaferGraphContextMenuBuiltinHistoryHost;
  /** 原始 builtins 装配选项。 */
  options: LeaferGraphContextMenuBuiltinOptions;
  /** 注册一个 resolver，并返回取消注册函数。 */
  registerResolver(
    key: string,
    resolver: LeaferContextMenuResolver
  ): () => void;
  /** 解析某个动作的快捷键标签。 */
  resolveShortcutLabel(
    actionId: LeaferGraphContextMenuBuiltinActionId
  ): string | undefined;
  /** 在图中创建节点。 */
  createNode(
    input: LeaferGraphCreateNodeInput,
    context: LeaferContextMenuContext
  ): Promise<{ nodeId: string }> | { nodeId: string };
  /** 在图中创建连线。 */
  createLink(
    input: LeaferGraphCreateLinkInput,
    context: LeaferContextMenuContext
  ): Promise<{ linkId: string }> | { linkId: string };
  /** 启动图执行。 */
  play(context: LeaferContextMenuContext): Promise<void> | void;
  /** 单步执行。 */
  step(context: LeaferContextMenuContext): Promise<void> | void;
  /** 停止执行。 */
  stop(context: LeaferContextMenuContext): Promise<void> | void;
  /** 适配视图。 */
  fitView(context: LeaferContextMenuContext): Promise<void> | void;
  /** 从指定节点开始执行。 */
  playFromNode(
    nodeId: string,
    context: LeaferContextMenuContext
  ): Promise<void> | void;
  /** 删除指定节点。 */
  removeNode(
    nodeId: string,
    context: LeaferContextMenuContext
  ): Promise<void> | void;
  /** 批量删除节点。 */
  removeNodes(
    nodeIds: readonly string[],
    context: LeaferContextMenuContext
  ): Promise<void> | void;
  /** 删除指定连线。 */
  removeLink(
    linkId: string,
    context: LeaferContextMenuContext
  ): Promise<void> | void;
}

/**
 * 单个内建菜单功能定义。
 */
export interface LeaferGraphContextMenuBuiltinFeatureDefinition {
  /** 功能 ID，对应开关字段名。 */
  id: keyof LeaferGraphContextMenuBuiltinFeatureFlags;
  /** 在菜单上注册该功能，并返回取消注册函数。 */
  register(
    context: LeaferGraphContextMenuBuiltinFeatureRegistrationContext
  ): () => void;
}
