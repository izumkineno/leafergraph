/**
 * `LeaferGraphApiHost` 内部类型定义。
 *
 * @remarks
 * 这一层负责承载 facade 子模块共享的最小上下文和视图壳面类型，
 * 避免各 helper 再次直接感知完整宿主实现。
 */

import type { App, Box, Group } from "leafer-ui";
import type {
  InstallNodeModuleOptions,
  GraphDocument,
  NodeDefinition,
  NodeModule,
  NodeSerializeResult,
  RegisterNodeOptions,
  RegisterWidgetOptions
} from "@leafergraph/node";
import type {
  LeaferGraphNodePlugin,
  LeaferGraphOptions,
  LeaferGraphWidgetEntry,
  LeaferGraphWidgetRenderInstance
} from "@leafergraph/contracts";
import type { LeaferGraphThemeMode } from "@leafergraph/theme";
import type {
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphGraphExecutionEvent,
  LeaferGraphGraphExecutionState,
  LeaferGraphHistoryRecord,
  LeaferGraphInteractionActivityState,
  RuntimeAdapter,
  LeaferGraphConnectionPortState,
  LeaferGraphLinkPropagationEvent,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeStateChangeEvent,
  LeaferGraphNodeInspectorState,
  LeaferGraphNodeExecutionState,
  LeaferGraphConnectionValidationResult,
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphMoveNodeInput,
  LeaferGraphNodeResizeConstraint,
  LeaferGraphSelectionUpdateMode,
  LeaferGraphResizeNodeInput,
  LeaferGraphUpdateNodeInput
} from "@leafergraph/contracts";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type { LeaferGraphBootstrapRuntimeLike } from "../../graph/host/bootstrap";
import type { LeaferGraphHistorySource } from "../../graph/history";
import type { LeaferGraphSceneRuntimeHost } from "../../graph/host/scene_runtime";
import type { LeaferGraphInteractionCommitSource } from "../../interaction/interaction_commit_source";

/**
 * 连线视图在公共 API 中暴露的最小交互对象。
 */
export interface LeaferGraphInteractionTargetLike {
  name?: string;
  parent?: unknown | null;
  on_?: App["on_"];
  off_?: App["off_"];
}

/**
 * API facade 依赖的最小节点视图结构。
 */
export type LeaferGraphApiNodeViewState<
  TNodeState extends LeaferGraphRenderableNodeState
> = {
  state: TNodeState;
  view: Group;
  widgetLayer: Box;
  widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>;
};

/**
 * API facade 依赖的最小连线视图结构。
 */
export type LeaferGraphApiLinkViewState = {
  linkId: string;
  view: LeaferGraphInteractionTargetLike;
};

/**
 * 主包公共 API 所依赖的最小运行时壳面。
 */
export interface LeaferGraphApiRuntime<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  app: {
    destroy(): void;
  };
  bootstrapRuntime: LeaferGraphBootstrapRuntimeLike;
  getGraphDocument(): GraphDocument;
  runtimeAdapter: RuntimeAdapter;
  widgetEditingManager: {
    destroy(): void;
  };
  dataFlowAnimationHost: {
    destroy(): void;
  };
  sceneRuntime: Pick<
    LeaferGraphSceneRuntimeHost<TNodeState, LeaferGraphApiNodeViewState<TNodeState>>,
    | "setNodeWidgetValue"
    | "findLinksByNode"
    | "getLink"
    | "applyGraphOperation"
    | "createNode"
    | "removeNode"
    | "updateNode"
    | "moveNode"
    | "resizeNode"
    | "createLink"
    | "removeLink"
  >;
  historySource: Pick<LeaferGraphHistorySource, "emit" | "subscribe" | "destroy">;
  destroyHistoryCapture(): void;
  interactionCommitSource: Pick<
    LeaferGraphInteractionCommitSource,
    "subscribe"
  >;
  interactionHost: {
    getInteractionActivityState(): LeaferGraphInteractionActivityState;
    subscribeInteractionActivity(
      listener: (state: LeaferGraphInteractionActivityState) => void
    ): () => void;
    destroy(): void;
  };
  interactionRuntime: {
    resolvePort(
      nodeId: string,
      direction: LeaferGraphConnectionPortState["direction"],
      slot: number
    ): LeaferGraphConnectionPortState | undefined;
    resolvePortAtPoint(
      point: { x: number; y: number },
      direction: LeaferGraphConnectionPortState["direction"]
    ): LeaferGraphConnectionPortState | undefined;
    setConnectionSourcePort(port: LeaferGraphConnectionPortState | null): void;
    setConnectionCandidatePort(
      port: LeaferGraphConnectionPortState | null
    ): void;
    setConnectionPreview(
      source: LeaferGraphConnectionPortState,
      pointer: { x: number; y: number },
      target?: LeaferGraphConnectionPortState
    ): void;
    clearConnectionPreview(): void;
    canCreateLink(
      source: LeaferGraphConnectionPortState,
      target: LeaferGraphConnectionPortState
    ): LeaferGraphConnectionValidationResult;
  };
  nodeRuntimeHost: {
    getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined;
    getNodeInspectorState(nodeId: string): LeaferGraphNodeInspectorState | undefined;
    setNodeCollapsed(nodeId: string, collapsed: boolean): boolean;
    getNodeResizeConstraint(
      nodeId: string
    ): LeaferGraphNodeResizeConstraint | undefined;
    getNodeExecutionState(nodeId: string): LeaferGraphNodeExecutionState | undefined;
    canResizeNode(nodeId: string): boolean;
    resetNodeSize(nodeId: string): TNodeState | undefined;
    playFromNode(nodeId: string, context?: unknown): boolean;
    subscribeNodeState(
      listener: (event: LeaferGraphNodeStateChangeEvent) => void
    ): () => void;
    subscribeNodeExecution(
      listener: (event: LeaferGraphNodeExecutionEvent) => void
    ): () => void;
    projectExternalNodeExecution(
      event: LeaferGraphNodeExecutionEvent
    ): void;
    projectExternalNodeState(
      event: LeaferGraphNodeStateChangeEvent
    ): void;
    projectExternalLinkPropagation(
      event: LeaferGraphLinkPropagationEvent
    ): void;
  };
  graphExecutionHost: {
    play(): boolean;
    step(): boolean;
    stop(): boolean;
    getGraphExecutionState(): LeaferGraphGraphExecutionState;
    subscribeGraphExecution(
      listener: (event: LeaferGraphGraphExecutionEvent) => void
    ): () => void;
    projectExternalGraphExecution(
      event: LeaferGraphGraphExecutionEvent
    ): void;
  };
  themeHost: {
    setThemeMode(mode: LeaferGraphThemeMode): void;
  };
  viewHost: {
    fitView(padding: number): boolean;
    setNodeSelected(nodeId: string, selected: boolean): boolean;
    listSelectedNodeIds(): string[];
    isNodeSelected(nodeId: string): boolean;
    setSelectedNodeIds(
      nodeIds: readonly string[],
      mode?: LeaferGraphSelectionUpdateMode
    ): string[];
    clearSelectedNodes(): string[];
  };
  widgetHost: {
    destroyNodeWidgets(
      widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>,
      widgetLayer: Box
    ): void;
  };
}

/**
 * API facade 初始化时依赖的最小装配选项。
 */
export interface LeaferGraphApiHostOptions<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState = LeaferGraphApiLinkViewState
> {
  runtime: LeaferGraphApiRuntime<TNodeState>;
  nodeViews: Map<string, TNodeViewState>;
  linkViews: readonly TLinkViewState[];
}

/**
 * API 子模块共享的最小上下文。
 */
export interface LeaferGraphApiHostContext<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState = LeaferGraphApiLinkViewState
> {
  readonly options: LeaferGraphApiHostOptions<TNodeState, TNodeViewState, TLinkViewState>;
  shouldCaptureHistory(): boolean;
  captureDocumentBeforeHistory(): GraphDocument | null;
  captureNodeSnapshotBeforeHistory(
    nodeId: string
  ): NodeSerializeResult | undefined;
  resolveNodeSizeForHistory(
    nodeId: string,
    snapshot: NodeSerializeResult
  ): { width: number; height: number };
  emitHistoryRecord(record: LeaferGraphHistoryRecord | null): void;
  runWithoutHistoryCapture<T>(callback: () => T): T;
  notifyHistoryReset(reason: LeaferGraphHistoryResetReason): void;
}

/**
 * API facade 可发出的历史重置原因。
 */
export type LeaferGraphHistoryResetReason =
  | "replace-document"
  | "apply-document-diff";

/**
 * API 初始化会透传的主包配置。
 */
export type LeaferGraphApiInitializeOptions = LeaferGraphOptions;

/**
 * API registry helper 暴露的节点插件输入。
 */
export type LeaferGraphApiPlugin = LeaferGraphNodePlugin;

/**
 * API registry helper 暴露的模块安装输入。
 */
export type LeaferGraphApiModuleInput = {
  module: NodeModule;
  options?: InstallNodeModuleOptions;
};

/**
 * API registry helper 暴露的节点注册输入。
 */
export type LeaferGraphApiNodeRegistration = {
  definition: NodeDefinition;
  options?: RegisterNodeOptions;
};

/**
 * API registry helper 暴露的 widget 注册输入。
 */
export type LeaferGraphApiWidgetRegistration = {
  entry: LeaferGraphWidgetEntry;
  options?: RegisterWidgetOptions;
};

/**
 * API mutation helper 暴露的正式图操作输入。
 */
export type LeaferGraphApiGraphOperation = GraphOperation;

/**
 * API mutation helper 返回的图操作结果。
 */
export type LeaferGraphApiGraphOperationResult = GraphOperationApplyResult;

/**
 * API mutation helper 暴露的节点创建输入。
 */
export type LeaferGraphApiCreateNodeInput = LeaferGraphCreateNodeInput;

/**
 * API mutation helper 暴露的节点更新输入。
 */
export type LeaferGraphApiUpdateNodeInput = LeaferGraphUpdateNodeInput;

/**
 * API mutation helper 暴露的节点移动输入。
 */
export type LeaferGraphApiMoveNodeInput = LeaferGraphMoveNodeInput;

/**
 * API mutation helper 暴露的节点 resize 输入。
 */
export type LeaferGraphApiResizeNodeInput = LeaferGraphResizeNodeInput;

/**
 * API mutation helper 暴露的连线创建输入。
 */
export type LeaferGraphApiCreateLinkInput = LeaferGraphCreateLinkInput;
