/**
 * 节点外壳宿主模块。
 *
 * @remarks
 * 负责节点外壳渲染、缺失态回退和 resize 约束解析。
 */

import { Box, Group, Rect } from "leafer-ui";
import * as LeaferUI from "leafer-ui";
import type {
  NodeResizeConfig,
  NodeRegistry
} from "@leafergraph/node";
import type {
  LeaferGraphNodeExecutionState,
  LeaferGraphNodeResizeConstraint
} from "@leafergraph/contracts";
import {
  resolveNodeCategoryBadgeLayout,
  resolveNodeShellLayout,
  type NodeShellLayout,
  type NodeShellLayoutMetrics
} from "./layout";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type { NodeViewState } from "../node_host";
import type {
  CreateNodeShellOptions,
  NodeShellRenderTheme,
  NodeShellView
} from "./view";
import { createNodeShell } from "./view";
import type { NodeShellPortLayout } from "./ports";
import type { LeaferGraphNodeShellStyleConfig } from "../../graph/style";
import { resolveSlotTypeFill } from "./slot_style";
import {
  buildNodeShellProgressSegmentPath
} from "./progress_ring";

type LeaferGraphNodeShellThemeMode = "light" | "dark";
type LeaferGraphAnimationFrameHandle = number;

interface ResolvedNodeShellVisualState {
  signalColor: string;
  progressColor: string;
  progress?: number;
  showProgress: boolean;
  showIndeterminateProgress: boolean;
  errorMessage?: string;
}

const NODE_SHELL_INDETERMINATE_PROGRESS_SEGMENT_RATIO = 0.18;
const NODE_SHELL_INDETERMINATE_PROGRESS_SPEED = 0.0002;

/**
 * 节点壳宿主装配选项。
 */
export interface LeaferGraphNodeShellHostOptions {
  container: HTMLElement;
  nodeViews: Map<string, NodeViewState>;
  nodeRegistry: NodeRegistry;
  layoutMetrics: NodeShellLayoutMetrics;
  style: LeaferGraphNodeShellStyleConfig;
  getThemeMode(): LeaferGraphNodeShellThemeMode;
  resolveSelectedStroke(mode: LeaferGraphNodeShellThemeMode): string;
  resolveRenderTheme(mode: LeaferGraphNodeShellThemeMode): NodeShellRenderTheme;
  resolveNodeExecutionState(nodeId: string): LeaferGraphNodeExecutionState | undefined;
  canResizeNode(nodeId: string): boolean;
  isNodeResizing(nodeId: string): boolean;
  requestRender(): void;
  renderFrame(): void;
  respectReducedMotion: boolean;
}

/**
 * 节点壳呈现宿主。
 * 当前集中收口：
 * 1. 正常节点壳与缺失节点壳的构建
 * 2. 选中态与 resize 句柄显隐的视觉同步
 * 3. 节点分类、端口颜色、信号灯颜色、resize 约束解析
 */
export class LeaferGraphNodeShellHost<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  private readonly options: LeaferGraphNodeShellHostOptions;
  private readonly ownerWindow: Window | null;
  private readonly activeIndeterminateNodeIds = new Set<string>();
  private readonly indeterminateProgressStartedAtByNodeId = new Map<string, number>();
  private frameId: LeaferGraphAnimationFrameHandle | null = null;

  /**
   * 初始化 LeaferGraphNodeShellHost 实例。
   *
   * @param options - 节点壳宿主装配选项。
   */
  constructor(options: LeaferGraphNodeShellHostOptions) {
    this.options = options;
    this.ownerWindow =
      options.container.ownerDocument.defaultView ??
      (typeof window === "undefined" ? null : window);
  }

  /**
   * 销毁当前节点壳宿主持有的动画循环。
   *
   * @returns 无返回值。
   */
  destroy(): void {
    this.stopIndeterminateProgressLoop();
    this.activeIndeterminateNodeIds.clear();
    this.indeterminateProgressStartedAtByNodeId.clear();
  }

  /**
   * 判断节点当前类型是否已经遗失。
   *
   * @param node - 目标节点。
   * @returns 当前节点类型是否缺失。
   */
  isMissingNodeType(node: TNodeState): boolean {
    return !this.options.nodeRegistry.hasNode(node.type);
  }

  /**
   * 根据节点当前运行时状态构建节点壳。
   * 这里把“布局求解 + 分类徽标 + 主题色解析”收敛到一处，
   * 便于首次挂载和后续局部刷新共用同一条逻辑。
   *
   * @param node - 目标节点。
   * @param shellLayout - 节点壳布局。
   * @returns 构建后的节点壳视图。
   */
  buildNodeShell(
    node: TNodeState,
    shellLayout = resolveNodeShellLayout(node, this.options.layoutMetrics)
  ): NodeShellView {
    if (this.isMissingNodeType(node)) {
      return this.createMissingNodeShell(node, shellLayout);
    }

    const category = this.resolveNodeCategory(node);
    const resolvedShellLayout = {
      ...shellLayout,
      ports: shellLayout.ports.map((port) => ({
        ...port,
        slotColor: this.resolveNodePortFill(port)
      }))
    };
    const categoryLayout = resolveNodeCategoryBadgeLayout(
      category,
      resolvedShellLayout.width,
      this.options.layoutMetrics
    );
    const mode = this.options.getThemeMode();
    const theme = this.options.resolveRenderTheme(mode);
    const visualState = this.resolveNodeShellVisualState(node);

    const shellOptions: CreateNodeShellOptions = {
      nodeId: node.id,
      x: node.layout.x,
      y: node.layout.y,
      title: node.title,
      signalColor: visualState.signalColor,
      progressColor: visualState.progressColor,
      progress: visualState.progress,
      showIndeterminateProgress: visualState.showIndeterminateProgress,
      errorMessage: visualState.errorMessage,
      selectedStroke: this.resolveSelectedNodeStroke(),
      shellLayout: resolvedShellLayout,
      categoryLayout,
      theme
    };

    return createNodeShell(shellOptions);
  }

  /**
   * 将运行时 `flags.selected` 同步成节点视觉状态。
   * 当前只恢复外圈选中边框，不恢复卡片本体描边，
   * 这样既能保留选区反馈，也不会让节点内部边框变重。
   *
   * @param state - 当前节点视图状态。
   * @returns 无返回值。
   */
  applyNodeSelectionStyles(state: NodeViewState<TNodeState>): void {
    this.applyNodeShellStatusStyles(state);
  }

  /**
   * 将节点稳定状态统一映射到当前 shell 视图。
   *
   * @param state - 当前节点视图状态。
   * @returns 无返回值。
   */
  applyNodeShellStatusStyles(state: NodeViewState<TNodeState>): void {
    const selected = Boolean(state.state.flags.selected);
    const ringStroke = this.resolveSelectedNodeStroke();
    const theme = this.options.resolveRenderTheme(this.options.getThemeMode());
    const visualState = this.resolveNodeShellVisualState(state.state);

    state.selectedRing.selectedStyle = {
      stroke: ringStroke,
      opacity: theme.selectedRingOpacity
    };
    state.selectedRing.selected = selected;
    this.applySignalStyles(state, theme, visualState);
    this.applyProgressRingStyles(state, visualState);
    this.syncNodeResizeHandleVisibility(state);
  }

  /**
   * 统一计算 resize 图标可见性。
   * 当前规则为：
   * 1. 节点支持 resize
   * 2. 节点未折叠
   * 3. 鼠标悬停在节点上，或当前正在拖拽该节点的 resize 句柄
   *
   * @param state - 当前节点视图状态。
   * @returns 无返回值。
   */
  syncNodeResizeHandleVisibility(state: NodeViewState<TNodeState>): void {
    const canResize = this.options.canResizeNode(state.state.id);
    const visible =
      canResize &&
      !Boolean(state.state.flags.collapsed) &&
      (state.hovered || this.options.isNodeResizing(state.state.id));

    const changed = state.resizeHandle.visible !== visible;
    state.resizeHandle.visible = visible;
    if (changed) {
      this.options.requestRender();
    }
  }

  /**
   * 解析节点 resize 约束。
   * 该结果统一吸收三类来源：
   * 1. `NodeDefinition.resize`
   * 2. 兼容字段 `minWidth / minHeight`
   * 3. 主包默认节点尺寸
   *
   * @param node - 目标节点。
   * @returns 节点 resize 约束。
   */
  resolveNodeResizeConstraint(
    node: TNodeState
  ): LeaferGraphNodeResizeConstraint {
    const definition = this.options.nodeRegistry.getNode(node.type);
    const resize: NodeResizeConfig | undefined = definition?.resize;
    const defaultWidth =
      definition?.size?.[0] ?? this.options.style.defaultNodeWidth;
    const defaultHeight =
      definition?.size?.[1] ?? this.options.style.defaultNodeMinHeight;
    const minWidth = resize?.minWidth ?? definition?.minWidth ?? defaultWidth;
    const minHeight =
      resize?.minHeight ?? definition?.minHeight ?? defaultHeight;
    const maxWidth =
      typeof resize?.maxWidth === "number" && Number.isFinite(resize.maxWidth)
        ? Math.max(minWidth, resize.maxWidth)
        : undefined;
    const maxHeight =
      typeof resize?.maxHeight === "number" && Number.isFinite(resize.maxHeight)
        ? Math.max(minHeight, resize.maxHeight)
        : undefined;
    const snap =
      typeof resize?.snap === "number" &&
      Number.isFinite(resize.snap) &&
      resize.snap > 0
        ? resize.snap
        : undefined;

    return {
      enabled: resize?.enabled ?? true,
      lockRatio: Boolean(resize?.lockRatio),
      minWidth,
      minHeight,
      maxWidth,
      maxHeight,
      snap,
      defaultWidth,
      defaultHeight
    };
  }

  /**
   * 为遗失节点类型创建红色占位壳。
   * 它只保留拖拽、选中和 resize 所需的最小图元，
   * 避免旧数据因节点包缺失而直接不可见。
   *
   * @param node - 目标节点。
   * @param shellLayout - 节点壳布局。
   * @returns 占位节点壳视图。
   */
  private createMissingNodeShell(
    node: TNodeState,
    shellLayout: NodeShellLayout
  ): NodeShellView {
    // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
    const selectedStroke = this.resolveSelectedNodeStroke();
    const theme = this.options.resolveRenderTheme(this.options.getThemeMode());
    const group = new Group({
      x: node.layout.x,
      y: node.layout.y,
      id: `node-${node.id}`,
      name: `node-${node.id}`
    });
    const selectedRing = new Rect({
      x: -this.options.style.selectedRingOutset,
      y: -this.options.style.selectedRingOutset,
      width: shellLayout.width + this.options.style.selectedRingOutset * 2,
      height: shellLayout.height + this.options.style.selectedRingOutset * 2,
      fill: "transparent",
      stroke: selectedStroke,
      strokeWidth: this.options.style.selectedRingStrokeWidth,
      cornerRadius:
        this.options.style.nodeRadius + this.options.style.selectedRingOutset,
      opacity: 0,
      selectedStyle: {
        stroke: selectedStroke,
        opacity: 0.92
      },
      hittable: false
    });
    const card = new Rect({
      width: shellLayout.width,
      height: shellLayout.height,
      fill: this.options.style.missingNodeFill,
      stroke: this.options.style.missingNodeStroke,
      strokeWidth: 1,
      cornerRadius: this.options.style.nodeRadius,
      cursor: "grab"
    });
    const label = new LeaferUI.Text({
      x: 20,
      y: Math.max(shellLayout.height / 2 - 10, 18),
      width: Math.max(shellLayout.width - 40, 24),
      text: node.type,
      textAlign: "center",
      fill: this.options.style.missingNodeTextFill,
      fontFamily: this.options.style.nodeFontFamily,
      fontSize: 14,
      fontWeight: "600",
      hittable: false
    });
    label.textWrap = "break";

    const hiddenHeaderDivider = new Rect({
      width: 0,
      height: 0,
      visible: false,
      fill: "transparent",
      hittable: false
    });
    const missingSignalGlow = new Rect({
      x: theme.signalGlowX,
      y: theme.signalGlowY,
      width: theme.signalGlowSize,
      height: theme.signalGlowSize,
      fill: this.options.style.missingNodeStroke,
      opacity: theme.signalGlowOpacity,
      cornerRadius: 999,
      hittable: false
    });
    const missingSignalLight = new Rect({
      x: theme.signalLightX,
      y: theme.signalLightY,
      width: theme.signalLightSize,
      height: theme.signalLightSize,
      fill: this.options.style.missingNodeTextFill,
      cornerRadius: 999,
      hittable: false
    });
    // 再按当前规则组合结果，并把派生数据一并收口到输出里。
    const hiddenSignalButton = new Rect({
      width: 0,
      height: 0,
      visible: false,
      fill: "rgba(255, 255, 255, 0.001)"
    });
    const hiddenCategoryBadge = new Rect({
      width: 0,
      height: 0,
      visible: false,
      fill: "transparent",
      stroke: "transparent",
      hittable: false
    });
    const hiddenCategoryLabel = new LeaferUI.Text({
      text: "",
      visible: false,
      hittable: false
    });
    const widgetLayer = new Box({
      id: `widgets-${node.id}`,
      name: `widgets-${node.id}`,
      width: 0,
      height: 0,
      resizeChildren: false
    });
    const resizeHandle = new Box({
      name: `node-resize-handle-${node.id}`,
      x: shellLayout.width - 18,
      y: shellLayout.height - 18,
      width: 18,
      height: 18,
      cursor: "nwse-resize",
      visible: false
    });
    resizeHandle.add([
      new Rect({
        width: 18,
        height: 18,
        fill: "rgba(255, 255, 255, 0.001)",
        cornerRadius: 6
      }),
      new LeaferUI.Path({
        path: "M 4 14 L 14 4 M 8 14 L 14 8 M 12 14 L 14 12",
        stroke: "rgba(255, 241, 242, 0.88)",
        strokeWidth: 1.5,
        strokeCap: "round",
        strokeJoin: "round",
        hittable: false
      })
    ]);

    group.add([
      selectedRing,
      card,
      missingSignalGlow,
      missingSignalLight,
      label,
      hiddenSignalButton,
      hiddenCategoryBadge,
      hiddenCategoryLabel,
      widgetLayer,
      resizeHandle
    ]);

    return {
      view: group,
      card,
      selectedRing,
      progressTrack: null,
      progressRing: null,
      progressGeometry: null,
      header: card,
      headerDivider: hiddenHeaderDivider,
      signalGlow: missingSignalGlow,
      signalLight: missingSignalLight,
      signalButton: hiddenSignalButton,
      categoryBadge: hiddenCategoryBadge,
      categoryLabel: hiddenCategoryLabel,
      titleLabel: null,
      titleHitArea: null,
      widgetBackground: null,
      widgetDivider: null,
      resizeHandle,
      portViews: [],
      widgetLayer
    };
  }

  /**
   * 节点选中态统一使用固定描边色，保证整张图的焦点反馈一致。
   *
   * @returns 节点选中描边色。
   */
  private resolveSelectedNodeStroke(): string {
    return this.options.resolveSelectedStroke(this.options.getThemeMode());
  }

  /**
   * 统一解析节点当前应投影到 shell 的视觉状态。
   *
   * @param node - 目标节点。
   * @param theme - 当前节点壳渲染主题。
   * @returns 当前节点对应的 shell 视觉状态。
   */
  private resolveNodeShellVisualState(
    node: TNodeState
  ): ResolvedNodeShellVisualState {
    if (this.isMissingNodeType(node)) {
      return {
        signalColor: this.options.style.missingNodeTextFill,
        progressColor: this.options.style.signalRunningFill,
        showProgress: false,
        showIndeterminateProgress: false
      };
    }

    const executionState = this.options.resolveNodeExecutionState(node.id);
    const progress = this.resolveExecutionProgress(executionState);
    const running = executionState?.status === "running";
    const longTask = this.isNodeLongTask(node);
    const showIndeterminateProgress =
      running && longTask && typeof progress !== "number";
    const showProgress = running && (typeof progress === "number" || showIndeterminateProgress);

    return {
      signalColor: this.resolveSignalColor(executionState),
      progressColor: this.options.style.signalRunningFill,
      progress,
      showProgress,
      showIndeterminateProgress,
      errorMessage: this.resolveExecutionErrorMessage(executionState)
    };
  }

  /**
   * 同步左上角旧信号灯颜色。
   *
   * @param state - 当前节点视图状态。
   * @param theme - 当前主题。
   * @param visualState - 已解析的视觉状态。
   * @returns 无返回值。
   */
  private applySignalStyles(
    state: NodeViewState<TNodeState>,
    theme: NodeShellRenderTheme,
    visualState: ResolvedNodeShellVisualState
  ): void {
    state.shellView.signalGlow.fill = visualState.signalColor;
    state.shellView.signalGlow.opacity = theme.signalGlowOpacity;
    state.shellView.signalLight.fill = visualState.signalColor;
  }

  /**
   * 同步 determinate / indeterminate 进度外环。
   *
   * @param state - 当前节点视图状态。
   * @param visualState - 已解析的视觉状态。
   * @returns 无返回值。
   */
  private applyProgressRingStyles(
    state: NodeViewState<TNodeState>,
    visualState: ResolvedNodeShellVisualState
  ): void {
    const progressTrack = state.shellView.progressTrack;
    const progressRing = state.shellView.progressRing;
    const progressGeometry = state.shellView.progressGeometry;
    if (!progressTrack || !progressRing || !progressGeometry) {
      this.unregisterIndeterminateProgressNode(state.state.id);
      return;
    }

    progressTrack.visible = visualState.showProgress;
    progressTrack.opacity = visualState.showProgress ? 1 : 0;
    progressRing.visible = visualState.showProgress;
    progressRing.stroke = visualState.progressColor;

    if (!visualState.showProgress) {
      progressRing.path = "";
      this.unregisterIndeterminateProgressNode(state.state.id);
      return;
    }

    if (typeof visualState.progress === "number") {
      progressRing.path = buildNodeShellProgressSegmentPath(
        progressGeometry,
        0,
        visualState.progress
      );
      this.unregisterIndeterminateProgressNode(state.state.id);
      return;
    }

    if (!visualState.showIndeterminateProgress) {
      progressRing.path = "";
      this.unregisterIndeterminateProgressNode(state.state.id);
      return;
    }

    if (this.shouldReduceMotion()) {
      progressRing.path = this.buildStaticIndeterminateProgressPath(
        progressGeometry
      );
      this.unregisterIndeterminateProgressNode(state.state.id);
      return;
    }

    const timestamp = this.now();
    this.registerIndeterminateProgressNode(state.state.id, timestamp);
    this.updateIndeterminateProgressPath(state, timestamp);
  }

  /**
   * 当前节点是否被声明为长耗时任务节点。
   *
   * @param node - 目标节点。
   * @returns 是否为长耗时节点。
   */
  private isNodeLongTask(node: TNodeState): boolean {
    return Boolean(this.options.nodeRegistry.getNode(node.type)?.shell?.longTask);
  }

  /**
   * 从执行状态里读取 shell 可用的 determinate progress。
   *
   * @param executionState - 当前执行状态。
   * @returns 归一后的 progress。
   */
  private resolveExecutionProgress(
    executionState: LeaferGraphNodeExecutionState | undefined
  ): number | undefined {
    if (executionState?.status !== "running") {
      return undefined;
    }

    const progress = executionState.progress;
    if (typeof progress !== "number" || !Number.isFinite(progress)) {
      return undefined;
    }

    return Math.max(0, Math.min(1, progress));
  }

  /**
   * 注册一个需要 indeterminate 进度动画的节点。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 无返回值。
   */
  private registerIndeterminateProgressNode(nodeId: string, timestamp: number): void {
    this.activeIndeterminateNodeIds.add(nodeId);
    if (!this.indeterminateProgressStartedAtByNodeId.has(nodeId)) {
      this.indeterminateProgressStartedAtByNodeId.set(nodeId, timestamp);
    }
    this.ensureIndeterminateProgressLoop();
  }

  /**
   * 取消一个 indeterminate 进度动画节点。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 无返回值。
   */
  private unregisterIndeterminateProgressNode(nodeId: string): void {
    this.activeIndeterminateNodeIds.delete(nodeId);
    this.indeterminateProgressStartedAtByNodeId.delete(nodeId);
    if (!this.activeIndeterminateNodeIds.size) {
      this.stopIndeterminateProgressLoop();
    }
  }

  /**
   * 确保 indeterminate 进度外环的 RAF 循环已启动。
   *
   * @returns 无返回值。
   */
  private ensureIndeterminateProgressLoop(): void {
    if (this.frameId !== null || !this.ownerWindow || !this.activeIndeterminateNodeIds.size) {
      return;
    }

    this.frameId = this.ownerWindow.requestAnimationFrame(
      this.handleIndeterminateProgressFrame
    );
  }

  /**
   * 停止 indeterminate 进度外环 RAF 循环。
   *
   * @returns 无返回值。
   */
  private stopIndeterminateProgressLoop(): void {
    if (this.frameId === null || !this.ownerWindow) {
      this.frameId = null;
      return;
    }

    this.ownerWindow.cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  /**
   * 在一帧里更新全部活动中的 indeterminate 进度外环。
   *
   * @param timestamp - 当前帧时间戳。
   * @returns 无返回值。
   */
  private readonly handleIndeterminateProgressFrame = (timestamp: number): void => {
    this.frameId = null;
    if (!this.activeIndeterminateNodeIds.size) {
      return;
    }

    let hasActiveNodes = false;
    let changed = false;

    if (this.shouldReduceMotion()) {
      for (const nodeId of [...this.activeIndeterminateNodeIds]) {
        const state = this.options.nodeViews.get(nodeId) as
          | NodeViewState<TNodeState>
          | undefined;
        const geometry = state?.shellView.progressGeometry;
        const ring = state?.shellView.progressRing;
        if (!state || !geometry || !ring) {
          this.activeIndeterminateNodeIds.delete(nodeId);
          continue;
        }

        ring.path = this.buildStaticIndeterminateProgressPath(geometry);
        changed = true;
        this.activeIndeterminateNodeIds.delete(nodeId);
      }

      if (changed) {
        this.options.renderFrame();
      }
      return;
    }

    for (const nodeId of [...this.activeIndeterminateNodeIds]) {
      const state = this.options.nodeViews.get(nodeId) as
        | NodeViewState<TNodeState>
        | undefined;
      if (!state) {
        this.activeIndeterminateNodeIds.delete(nodeId);
        continue;
      }

      const visualState = this.resolveNodeShellVisualState(state.state);
      if (!visualState.showIndeterminateProgress) {
        this.activeIndeterminateNodeIds.delete(nodeId);
        continue;
      }

      hasActiveNodes = true;
      changed = this.updateIndeterminateProgressPath(state, timestamp) || changed;
    }

    if (changed) {
      this.options.renderFrame();
    }

    if (hasActiveNodes) {
      this.ensureIndeterminateProgressLoop();
    }
  };

  /**
   * 更新单个节点 indeterminate 进度外环路径。
   *
   * @param state - 当前节点视图状态。
   * @param timestamp - 当前时间戳。
   * @returns 当前路径是否被更新。
   */
  private updateIndeterminateProgressPath(
    state: NodeViewState<TNodeState>,
    timestamp: number
  ): boolean {
    const progressRing = state.shellView.progressRing;
    const progressGeometry = state.shellView.progressGeometry;
    if (!progressRing || !progressGeometry) {
      return false;
    }

    const startedAt =
      this.indeterminateProgressStartedAtByNodeId.get(state.state.id) ?? timestamp;
    const elapsedMs = Math.max(0, timestamp - startedAt);

    const nextPath = buildNodeShellProgressSegmentPath(
      progressGeometry,
      (elapsedMs * NODE_SHELL_INDETERMINATE_PROGRESS_SPEED) % 1,
      NODE_SHELL_INDETERMINATE_PROGRESS_SEGMENT_RATIO
    );
    if (progressRing.path === nextPath) {
      return false;
    }

    progressRing.path = nextPath;
    return true;
  }

  /**
   * reduced motion 模式下的静态运行中外环。
   *
   * @param progressGeometry - 当前外环几何。
   * @returns 静态片段路径。
   */
  private buildStaticIndeterminateProgressPath(
    progressGeometry: NonNullable<NodeShellView["progressGeometry"]>
  ): string {
    return buildNodeShellProgressSegmentPath(
      progressGeometry,
      0,
      NODE_SHELL_INDETERMINATE_PROGRESS_SEGMENT_RATIO
    );
  }

  /**
   * 当前环境是否要求减少动态效果。
   *
   * @returns 当前是否需要 reduced motion。
   */
  private shouldReduceMotion(): boolean {
    if (!this.options.respectReducedMotion) {
      return false;
    }

    return Boolean(
      this.ownerWindow?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    );
  }

  /**
   * 读取统一动画时钟。
   *
   * @returns 当前时钟。
   */
  private now(): number {
    return this.ownerWindow?.performance?.now?.() ?? Date.now();
  }

  /**
   * 解析节点分类文本。
   *
   * @param node - 目标节点。
   * @returns 节点分类文案。
   */
  private resolveNodeCategory(node: TNodeState): string {
    const category = node.properties.category;

    if (typeof category === "string" && category) {
      return category;
    }

    return (
      this.options.nodeRegistry.getNode(node.type)?.category ??
      this.startCase(node.type)
    );
  }

  /**
   * 解析节点端口颜色。
   * 优先级依次为：
   * 1. 槽位显式自定义色
   * 2. 槽位类型映射色
   * 3. 输入 / 输出默认色
   *
   * @param port - 端口布局。
   * @returns 节点端口颜色。
   */
  private resolveNodePortFill(port: NodeShellPortLayout): string {
    if (typeof port.slotColor === "string" && port.slotColor) {
      return port.slotColor;
    }

    const typeColor = resolveSlotTypeFill(port.slotType, {
      slotTypeFillMap: this.options.style.slotTypeFillMap,
      genericFill: this.options.style.genericPortFill
    });
    if (typeColor) {
      return typeColor;
    }

    return port.direction === "input"
      ? this.options.style.inputPortFill
      : this.options.style.outputPortFill;
  }

  /**
   * 解析节点状态灯颜色。
   *
   * @param executionState - 当前执行状态。
   * @returns 当前节点状态灯颜色。
   */
  private resolveSignalColor(
    executionState: LeaferGraphNodeExecutionState | undefined
  ): string {
    switch (executionState?.status) {
      case "running":
        return this.options.style.signalRunningFill;
      case "success":
        return this.options.style.signalSuccessFill;
      case "error":
        return this.options.style.signalErrorFill;
      default:
        return this.options.style.signalFill;
    }
  }

  /**
   * 解析节点当前是否需要在画布里展示错误文案。
   *
   * @param executionState - 当前执行状态。
   * @returns 当前错误文案。
   */
  private resolveExecutionErrorMessage(
    executionState: LeaferGraphNodeExecutionState | undefined
  ): string | undefined {
    if (executionState?.status !== "error") {
      return undefined;
    }

    return executionState.lastErrorMessage ?? "节点执行失败，请查看控制台日志";
  }

  /**
   * 把类型名或分类名转换成更友好的首字母大写显示文本。
   *
   * @param value - 当前原始值。
   * @returns 友好的首字母大写文本。
   */
  private startCase(value: string): string {
    return value
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
