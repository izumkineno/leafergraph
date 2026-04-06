/**
 * 节点运行时 controller。
 *
 * @remarks
 * 负责持有运行时状态对象，并把快照、执行、状态分发和连线变化委托给 `runtime/*` 子模块。
 */

import { LeaferGraphNodeExecutionHost } from "@leafergraph/execution";
import type {
  GraphLink
} from "@leafergraph/node";
import type {
  LeaferGraphLinkPropagationEvent,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeResizeConstraint,
  LeaferGraphNodeStateChangeEvent,
  LeaferGraphNodeStateChangeReason
} from "@leafergraph/contracts";
import type {
  LeaferGraphCreateEntryExecutionTaskOptions,
  LeaferGraphNodeExecutionTask,
  LeaferGraphNodeExecutionTaskResult
} from "@leafergraph/execution";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import {
  notifyLeaferGraphLinkCreated,
  notifyLeaferGraphLinkRemoved
} from "./connections";
import {
  canLeaferGraphExecuteNode,
  clearAllLeaferGraphNodeExecutionStates,
  clearLeaferGraphNodeExecutionState,
  createLeaferGraphEntryExecutionTask,
  emitLeaferGraphNodeWidgetAction,
  executeLeaferGraphExecutionTask,
  getLeaferGraphNodeExecutionState,
  initializeLeaferGraphNodeRuntimeExecutionSubscriptions,
  listLeaferGraphNodeIdsByType,
  playLeaferGraphFromNode,
  projectLeaferGraphExternalLinkPropagation,
  projectLeaferGraphExternalNodeExecution,
  subscribeLeaferGraphLinkPropagation,
  subscribeLeaferGraphNodeExecution
} from "./execution";
import {
  getLeaferGraphNodeInspectorState,
  getLeaferGraphNodeSnapshot
} from "./snapshot";
import {
  notifyLeaferGraphNodeStateChanged,
  projectLeaferGraphExternalNodeState,
  subscribeLeaferGraphNodeState
} from "./state";
import type {
  LeaferGraphNodeRuntimeContext,
  LeaferGraphNodeRuntimeHostOptions,
  LeaferGraphRuntimeNodeViewState
} from "./types";

export type {
  LeaferGraphCreateEntryExecutionTaskOptions,
  LeaferGraphNodeExecutionTask,
  LeaferGraphNodeExecutionTaskResult
} from "@leafergraph/execution";

/**
 * 节点运行时宿主 controller。
 */
export class LeaferGraphNodeRuntimeHost<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
> {
  private readonly stateListeners = new Set<
    (event: LeaferGraphNodeStateChangeEvent) => void
  >();
  private progressRingAnimationHandle: ReturnType<typeof setTimeout> | null = null;
  private readonly options: LeaferGraphNodeRuntimeHostOptions<
    TNodeState,
    TNodeViewState
  >;
  private readonly nodeExecutionHost: LeaferGraphNodeExecutionHost<TNodeState>;
  private readonly context: LeaferGraphNodeRuntimeContext<
    TNodeState,
    TNodeViewState
  >;

  /**
   * 初始化 LeaferGraphNodeRuntimeHost 实例。
   *
   * @param options - 节点运行时宿主装配选项。
   */
  constructor(
    options: LeaferGraphNodeRuntimeHostOptions<TNodeState, TNodeViewState>
  ) {
    this.options = options;
    this.nodeExecutionHost = new LeaferGraphNodeExecutionHost({
      nodeRegistry: options.nodeRegistry,
      widgetRegistry: options.widgetRegistry,
      graphNodes: options.graphNodes,
      graphLinks: options.graphLinks
    });

    const context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState> = {
      options,
      nodeExecutionHost: this.nodeExecutionHost,
      stateListeners: this.stateListeners,
      refreshExecutedNode: (nodeId) => this.refreshExecutedNode(nodeId),
      notifyNodeStateChanged: (nodeId, reason) =>
        notifyLeaferGraphNodeStateChanged(context, nodeId, reason),
      syncLongTaskProgressAnimation: () =>
        this.syncLongTaskProgressAnimation()
    };
    this.context = context;

    initializeLeaferGraphNodeRuntimeExecutionSubscriptions(this.context);
  }

  /**
   * 获取节点快照。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 可序列化节点快照。
   */
  getNodeSnapshot(nodeId: string) {
    return getLeaferGraphNodeSnapshot(this.context, nodeId);
  }

  /**
   * 设置节点折叠态。
   *
   * @param nodeId - 目标节点 ID。
   * @param collapsed - 目标折叠状态。
   * @returns 当前是否成功更新折叠态。
   */
  setNodeCollapsed(nodeId: string, collapsed: boolean): boolean {
    const node = this.options.graphNodes.get(nodeId);
    const state = this.options.nodeViews.get(nodeId);
    if (!node || !state) {
      return false;
    }

    const nextCollapsed = Boolean(collapsed);
    if (Boolean(node.flags.collapsed) === nextCollapsed) {
      return true;
    }

    node.flags.collapsed = nextCollapsed;
    this.options.sceneRuntime.refreshNodeView(state);
    this.options.sceneRuntime.updateConnectedLinks(nodeId);
    this.options.sceneRuntime.requestRender();
    this.context.notifyNodeStateChanged(nodeId, "collapsed");
    return true;
  }

  /**
   * 获取节点 resize 约束。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 节点 resize 约束。
   */
  getNodeResizeConstraint(
    nodeId: string
  ): LeaferGraphNodeResizeConstraint | undefined {
    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return undefined;
    }

    return this.options.resolveNodeResizeConstraint(node);
  }

  /**
   * 获取节点执行状态。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 节点执行状态。
   */
  getNodeExecutionState(nodeId: string) {
    return getLeaferGraphNodeExecutionState(this.context, nodeId);
  }

  /**
   * 获取节点检查面板状态。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 节点检查快照。
   */
  getNodeInspectorState(nodeId: string) {
    return getLeaferGraphNodeInspectorState(this.context, nodeId);
  }

  /**
   * 判断是否可以 resize 节点。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 当前节点是否可 resize。
   */
  canResizeNode(nodeId: string): boolean {
    return Boolean(this.getNodeResizeConstraint(nodeId)?.enabled);
  }

  /**
   * 判断是否可以执行节点。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 当前节点是否支持执行。
   */
  canExecuteNode(nodeId: string): boolean {
    return canLeaferGraphExecuteNode(this.context, nodeId);
  }

  /**
   * 按类型列出节点 ID 列表。
   *
   * @param type - 目标节点类型。
   * @returns 节点 ID 列表。
   */
  listNodeIdsByType(type: string): string[] {
    return listLeaferGraphNodeIdsByType(this.context, type);
  }

  /**
   * 重置节点尺寸。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 重置后的节点状态。
   */
  resetNodeSize(nodeId: string): TNodeState | undefined {
    const constraint = this.getNodeResizeConstraint(nodeId);
    if (!constraint?.enabled) {
      return undefined;
    }

    return this.options.sceneRuntime.resizeNode(nodeId, {
      width: constraint.defaultWidth,
      height: constraint.defaultHeight
    });
  }

  /**
   * 从某个节点开始执行。
   *
   * @param nodeId - 目标节点 ID。
   * @param context - 当前执行上下文。
   * @returns 当前是否成功处理执行。
   */
  playFromNode(nodeId: string, context?: unknown): boolean {
    return playLeaferGraphFromNode(this.context, nodeId, context);
  }

  /**
   * 创建条目执行任务。
   *
   * @param nodeId - 目标节点 ID。
   * @param options - 执行任务创建选项。
   * @returns 条目执行任务。
   */
  createEntryExecutionTask(
    nodeId: string,
    options: LeaferGraphCreateEntryExecutionTaskOptions
  ): LeaferGraphNodeExecutionTask | undefined {
    return createLeaferGraphEntryExecutionTask(this.context, nodeId, options);
  }

  /**
   * 执行单个执行任务。
   *
   * @param task - 目标执行任务。
   * @param stepIndex - 当前步骤序号。
   * @returns 执行任务结果。
   */
  executeExecutionTask(
    task: LeaferGraphNodeExecutionTask,
    stepIndex: number
  ): LeaferGraphNodeExecutionTaskResult {
    return executeLeaferGraphExecutionTask(this.context, task, stepIndex);
  }

  /**
   * 订阅节点执行事件。
   *
   * @param listener - 目标监听器。
   * @returns 取消订阅函数。
   */
  subscribeNodeExecution(
    listener: (event: LeaferGraphNodeExecutionEvent) => void
  ): () => void {
    return subscribeLeaferGraphNodeExecution(this.context, listener);
  }

  /**
   * 投影外部节点执行事件。
   *
   * @param event - 外部节点执行事件。
   * @returns 无返回值。
   */
  projectExternalNodeExecution(event: LeaferGraphNodeExecutionEvent): void {
    projectLeaferGraphExternalNodeExecution(this.context, event);
  }

  /**
   * 订阅连线传播事件。
   *
   * @param listener - 目标监听器。
   * @returns 取消订阅函数。
   */
  subscribeLinkPropagation(
    listener: (event: LeaferGraphLinkPropagationEvent) => void
  ): () => void {
    return subscribeLeaferGraphLinkPropagation(this.context, listener);
  }

  /**
   * 投影外部连线传播事件。
   *
   * @param event - 外部连线传播事件。
   * @returns 无返回值。
   */
  projectExternalLinkPropagation(event: LeaferGraphLinkPropagationEvent): void {
    projectLeaferGraphExternalLinkPropagation(this.context, event);
  }

  /**
   * 订阅节点状态变化。
   *
   * @param listener - 目标监听器。
   * @returns 取消订阅函数。
   */
  subscribeNodeState(
    listener: (event: LeaferGraphNodeStateChangeEvent) => void
  ): () => void {
    return subscribeLeaferGraphNodeState(this.context, listener);
  }

  /**
   * 投影外部节点状态事件。
   *
   * @param event - 外部节点状态事件。
   * @returns 无返回值。
   */
  projectExternalNodeState(event: LeaferGraphNodeStateChangeEvent): void {
    projectLeaferGraphExternalNodeState(this.context, event);
  }

  /**
   * 派发内部节点状态变化事件。
   *
   * @param nodeId - 目标节点 ID。
   * @param reason - 节点状态变化原因。
   * @returns 无返回值。
   */
  notifyNodeStateChanged(
    nodeId: string,
    reason: LeaferGraphNodeStateChangeReason
  ): void {
    this.context.notifyNodeStateChanged(nodeId, reason);
  }

  /**
   * 清理节点执行状态。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 无返回值。
   */
  clearNodeExecutionState(nodeId: string): void {
    clearLeaferGraphNodeExecutionState(this.context, nodeId);
    this.syncLongTaskProgressAnimation();
  }

  /**
   * 清理全部执行状态。
   *
   * @returns 无返回值。
   */
  clearAllExecutionStates(): void {
    clearAllLeaferGraphNodeExecutionStates(this.context);
    this.syncLongTaskProgressAnimation();
  }

  /**
   * 同步长任务进度环动画状态。
   *
   * @returns 无返回值。
   */
  syncLongTaskProgressAnimation(): void {
    const hasActiveRing = this.updateLongTaskProgressRings();
    this.options.sceneRuntime.requestRender();
    if (hasActiveRing) {
      this.ensureProgressRingAnimation();
    } else {
      this.stopProgressRingAnimation();
    }
  }

  /**
   * 销毁节点运行时宿主。
   *
   * @returns 无返回值。
   */
  destroy(): void {
    this.stopProgressRingAnimation();
  }

  /**
   * 响应正式连线创建。
   *
   * @param link - 新创建的正式连线。
   * @returns 无返回值。
   */
  notifyLinkCreated(link: GraphLink): void {
    notifyLeaferGraphLinkCreated(this.context, link);
  }

  /**
   * 响应正式连线移除。
   *
   * @param link - 被移除的正式连线。
   * @returns 无返回值。
   */
  notifyLinkRemoved(link: GraphLink): void {
    notifyLeaferGraphLinkRemoved(this.context, link);
  }

  /**
   * 派发节点 Widget 动作，并推进后续执行任务。
   *
   * @param nodeId - 目标节点 ID。
   * @param action - 目标动作名。
   * @param param - 动作参数。
   * @param options - 额外动作配置。
   * @returns 当前动作是否被处理。
   */
  emitNodeWidgetAction(
    nodeId: string,
    action: string,
    param?: unknown,
    options?: Record<string, unknown>
  ): boolean {
    return emitLeaferGraphNodeWidgetAction(
      this.context,
      nodeId,
      action,
      param,
      options
    );
  }

  /**
   * 刷新一个刚刚执行过的节点及其相连连线。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 无返回值。
   */
  private refreshExecutedNode(nodeId: string): void {
    const state = this.options.nodeViews.get(nodeId);
    if (state) {
      this.options.sceneRuntime.refreshNodeView(state);
    }

    this.options.sceneRuntime.updateConnectedLinks(nodeId);
    this.options.sceneRuntime.requestRender();
  }

  /**
   * 更新当前长任务进度环。
   *
   * @returns 当前是否存在活跃的不确定进度长任务。
   */
  private updateLongTaskProgressRings(): boolean {
    let hasActiveRing = false;
    const now = Date.now();

    for (const [nodeId, state] of this.options.nodeViews.entries()) {
      const executionState = this.nodeExecutionHost.getNodeExecutionState(nodeId);
      const node = this.options.graphNodes.get(nodeId);
      const progressRing = state.shellView?.progressRing;
      const progressTrack = state.shellView?.progressTrack;
      const progressMode = node?.properties.progressMode;

      if (!progressRing || !progressTrack) {
        continue;
      }

      const isRunning = executionState?.status === "running";
      const isDeterminate = progressMode === "determinate" && isRunning;

      if (!isRunning || (progressMode !== "determinate" && progressMode !== "indeterminate")) {
        progressTrack.visible = false;
        progressRing.visible = false;
        continue;
      }

      if (
        typeof progressRing.width !== "number" ||
        typeof progressRing.height !== "number"
      ) {
        progressTrack.visible = false;
        progressRing.visible = false;
        continue;
      }

      const ringWidth = progressRing.width;
      const ringHeight = progressRing.height;
      const ringCornerRadius = progressRing.cornerRadius;

      progressTrack.visible = true;
      progressRing.visible = true;
      progressTrack.opacity = 0.16;
      progressRing.opacity = 0.94;

      if (isDeterminate) {
        progressRing.dashOffset = 0;
        progressRing.dashPattern = resolveProgressRingDashPattern(
          ringWidth,
          ringHeight,
          ringCornerRadius,
          executionState?.progress ?? 0
        );
        continue;
      }

      hasActiveRing = true;
      progressRing.dashOffset = resolveIndeterminateDashOffset(
        ringWidth,
        ringHeight,
        ringCornerRadius,
        executionState?.lastExecutedAt ?? now,
        now
      );
    }

    return hasActiveRing;
  }

  /**
   * 确保长任务进度环动画已经启动。
   *
   * @returns 无返回值。
   */
  private ensureProgressRingAnimation(): void {
    if (this.progressRingAnimationHandle !== null) {
      return;
    }

    const tick = (): void => {
      this.progressRingAnimationHandle = null;
      const hasActiveRing = this.updateLongTaskProgressRings();
      this.options.sceneRuntime.requestRender();

      if (hasActiveRing) {
        this.progressRingAnimationHandle = setTimeout(tick, 48);
      }
    };

    this.progressRingAnimationHandle = setTimeout(tick, 48);
  }

  /**
   * 停止长任务进度环动画。
   *
   * @returns 无返回值。
   */
  private stopProgressRingAnimation(): void {
    if (this.progressRingAnimationHandle === null) {
      return;
    }

    clearTimeout(this.progressRingAnimationHandle);
    this.progressRingAnimationHandle = null;
  }
}

/**
 * 解析确定进度的 dash 模式。
 *
 * @param ring - 进度环。
 * @param progress - 进度值。
 * @returns `dashPattern`。
 */
function resolveProgressRingDashPattern(
  width: number,
  height: number,
  cornerRadius: unknown,
  progress: number
): number[] {
  const perimeter = resolveRoundedRectPerimeter(width, height, cornerRadius);
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const visibleLength = Math.max(0, perimeter * clampedProgress);
  const hiddenLength = Math.max(perimeter - visibleLength, 0.001);

  return [visibleLength, hiddenLength];
}

/**
 * 解析不确定进度的 dash 偏移。
 *
 * @param ring - 进度环。
 * @param startedAt - 开始时间戳。
 * @param now - 当前时间戳。
 * @returns `dashOffset`。
 */
function resolveIndeterminateDashOffset(
  width: number,
  height: number,
  cornerRadius: unknown,
  startedAt: number,
  now: number
): number {
  const perimeter = resolveRoundedRectPerimeter(width, height, cornerRadius);
  const elapsed = Math.max(0, now - startedAt);
  return (elapsed * 0.18) % Math.max(perimeter, 1);
}

/**
 * 计算圆角矩形的近似周长。
 *
 * @param width - 宽度。
 * @param height - 高度。
 * @param cornerRadius - 圆角。
 * @returns 近似周长。
 */
function resolveRoundedRectPerimeter(
  width: number,
  height: number,
  cornerRadius: unknown
): number {
  const radiusValue = typeof cornerRadius === "number" ? cornerRadius : 0;
  const radius = Math.max(0, Math.min(radiusValue, Math.min(width, height) / 2));
  return 2 * (width + height - 4 * radius) + 2 * Math.PI * radius;
}
