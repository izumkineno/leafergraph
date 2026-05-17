/**
 * API host 运行时接线类型。
 *
 * @remarks
 * 这些类型只承载装配期的结构约束，不绑定具体 scene-runtime 实现。
 */

import type { Box } from "leafer-ui";
import type {
  GraphDocument,
  GraphLink,
  InstallNodeModuleOptions,
  NodeDefinition,
  NodeModule,
  NodeSerializeResult,
  RegisterNodeOptions,
  RegisterWidgetOptions
} from "@leafergraph/core/node";
import type {
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphConnectionPortState,
  LeaferGraphConnectionValidationResult,
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphGraphExecutionEvent,
  LeaferGraphGraphExecutionState,
  LeaferGraphInteractionActivityState,
  LeaferGraphInteractionCommitEvent,
  LeaferGraphLinkPropagationEvent,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeExecutionState,
  LeaferGraphNodeInspectorState,
  LeaferGraphNodeResizeConstraint,
  LeaferGraphNodeStateChangeEvent,
  LeaferGraphMoveNodeInput,
  LeaferGraphResizeNodeInput,
  LeaferGraphSelectionUpdateMode,
  LeaferGraphUpdateNodeInput,
  LeaferGraphWidgetEntry,
  LeaferGraphWidgetRenderInstance,
  LeaferGraphNodePlugin,
  LeaferGraphOptions,
  RuntimeFeedbackEvent
} from "@leafergraph/core/contracts";
import type { LeaferGraphThemeMode, LeaferGraphWidgetThemeContext } from "@leafergraph/core/theme";
import type { LeaferGraphRenderableNodeState } from "./types";

/** 启动装配宿主对外暴露的最小运行时壳面。 */
export interface LeaferGraphBootstrapRuntimeLike {
  use(plugin: LeaferGraphNodePlugin): Promise<void>;
  installModule(
    module: NodeModule,
    options?: InstallNodeModuleOptions
  ): unknown;
  initialize(options: LeaferGraphOptions): Promise<void>;
  replaceGraphDocument(document?: LeaferGraphOptions["document"]): void;
  registerNode(definition: NodeDefinition, options?: RegisterNodeOptions): void;
  unregisterNode(type: string): void;
  listNodes(): NodeDefinition[];
  registerWidget(
    entry: LeaferGraphWidgetEntry,
    options?: RegisterWidgetOptions
  ): void;
  unregisterWidget(type: string): void;
  getWidget(type: string): LeaferGraphWidgetEntry | undefined;
  listWidgets(): LeaferGraphWidgetEntry[];
}

/** 统一运行反馈宿主。 */
export interface LeaferGraphRuntimeFeedbackHost {
  subscribe(listener: (event: RuntimeFeedbackEvent) => void): () => void;
  projectRuntimeFeedback(feedback: RuntimeFeedbackEvent): void;
  destroy?(): void;
}

/** 交互提交事件源。 */
export interface LeaferGraphInteractionCommitSource {
  subscribe(
    listener: (event: LeaferGraphInteractionCommitEvent) => void
  ): () => void;
}

/** 用户交互宿主。 */
export interface LeaferGraphInteractionHost {
  getInteractionActivityState(): LeaferGraphInteractionActivityState;
  subscribeInteractionActivity(
    listener: (state: LeaferGraphInteractionActivityState) => void
  ): () => void;
  destroy(): void;
}

/** 连接创建相关的运行时。 */
export interface LeaferGraphInteractionRuntimeHost {
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
}

/** 节点运行时宿主壳面。 */
export interface LeaferGraphNodeRuntimeHost<
  TNodeState extends LeaferGraphRenderableNodeState
> {
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
  projectExternalNodeExecution(event: LeaferGraphNodeExecutionEvent): void;
  projectExternalNodeState(event: LeaferGraphNodeStateChangeEvent): void;
  projectExternalLinkPropagation(
    event: LeaferGraphLinkPropagationEvent
  ): void;
  dispose?(): void;
}

/** 图级执行宿主壳面。 */
export interface LeaferGraphGraphExecutionHost {
  play(): boolean;
  step(): boolean;
  stop(): boolean;
  getGraphExecutionState(): LeaferGraphGraphExecutionState;
  subscribeGraphExecution(
    listener: (event: LeaferGraphGraphExecutionEvent) => void
  ): () => void;
  dispose?(): void;
  projectExternalGraphExecution(event: LeaferGraphGraphExecutionEvent): void;
}

/** 主题宿主。 */
export interface LeaferGraphThemeHostLike {
  setThemeMode(mode: LeaferGraphThemeMode): void;
  getWidgetTheme(): LeaferGraphWidgetThemeContext;
}

/** 视图宿主。 */
export interface LeaferGraphViewHostLike {
  fitView(padding: number): boolean;
  setNodeSelected(nodeId: string, selected: boolean): boolean;
  listSelectedNodeIds(): string[];
  isNodeSelected(nodeId: string): boolean;
  setSelectedNodeIds(
    nodeIds: readonly string[],
    mode?: LeaferGraphSelectionUpdateMode
  ): string[];
  clearSelectedNodes(): string[];
}

/** Widget 运行时宿主。 */
export interface LeaferGraphWidgetHostLike {
  destroyNodeWidgets(
    widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>,
    widgetLayer: Box
  ): void;
  dispose?(): void;
}

/** 节点运行时宿主的最小场景接口。 */
export interface LeaferGraphSceneRuntimeHost<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  setNodeWidgetValue(
    nodeId: string,
    widgetIndex: number,
    newValue: unknown
  ): boolean;
  findLinksByNode(nodeId: string): GraphLink[];
  getLink(linkId: string): GraphLink | undefined;
  applyGraphOperation(operation: GraphOperation): GraphOperationApplyResult;
  createNode(input: LeaferGraphCreateNodeInput): TNodeState;
  removeNode(nodeId: string): boolean;
  updateNode(
    nodeId: string,
    input: LeaferGraphUpdateNodeInput
  ): TNodeState | undefined;
  moveNode(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): TNodeState | undefined;
  resizeNode(
    nodeId: string,
    size: LeaferGraphResizeNodeInput
  ): TNodeState | undefined;
  createLink(input: LeaferGraphCreateLinkInput, source?: string): GraphLink;
  removeLink(linkId: string): boolean;
}

/** 场景 runtime 组装结果的最小结构。 */
export interface LeaferGraphSceneRuntimeAssemblyResult<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  nodeShellHost: { destroy(): void };
  widgetHost: LeaferGraphWidgetHostLike;
  viewHost: LeaferGraphViewHostLike;
  sceneRuntimeHost: LeaferGraphSceneRuntimeHost<TNodeState>;
  nodeRuntimeHost: LeaferGraphNodeRuntimeHost<TNodeState>;
  runtimeFeedbackHost: LeaferGraphRuntimeFeedbackHost;
  dataFlowAnimationHost: { destroy(): void };
  graphExecutionHost: LeaferGraphGraphExecutionHost;
  interactionHost: LeaferGraphInteractionHost;
  interactionRuntimeHost: LeaferGraphInteractionRuntimeHost;
  interactionCommitSource: LeaferGraphInteractionCommitSource;
  restoreHost: {
    replaceGraphDocument(document: GraphDocument): void;
  };
}

/** Widget 环境装配结果。 */
export interface LeaferGraphWidgetEnvironment {
  widgetRegistry: {
    dispose?(): void;
  };
  themeHost: LeaferGraphThemeHostLike;
  widgetEditingManager: {
    destroy(): void;
  };
  widgetEditingContext: unknown;
}
