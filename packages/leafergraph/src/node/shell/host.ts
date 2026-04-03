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

type LeaferGraphNodeShellThemeMode = "light" | "dark";

/**
 * 节点壳宿主装配选项。
 */
export interface LeaferGraphNodeShellHostOptions {
  nodeRegistry: NodeRegistry;
  layoutMetrics: NodeShellLayoutMetrics;
  style: LeaferGraphNodeShellStyleConfig;
  getThemeMode(): LeaferGraphNodeShellThemeMode;
  resolveSelectedStroke(mode: LeaferGraphNodeShellThemeMode): string;
  resolveRenderTheme(mode: LeaferGraphNodeShellThemeMode): NodeShellRenderTheme;
  resolveNodeExecutionState(nodeId: string): LeaferGraphNodeExecutionState | undefined;
  canResizeNode(nodeId: string): boolean;
  isNodeResizing(nodeId: string): boolean;
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

  /**
   * 初始化 LeaferGraphNodeShellHost 实例。
   *
   * @param options - 节点壳宿主装配选项。
   */
  constructor(options: LeaferGraphNodeShellHostOptions) {
    this.options = options;
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

    const shellOptions: CreateNodeShellOptions = {
      nodeId: node.id,
      x: node.layout.x,
      y: node.layout.y,
      title: node.title,
      signalColor: this.resolveSignalColor(node),
      errorMessage: this.resolveExecutionErrorMessage(node.id),
      selectedStroke: this.resolveSelectedNodeStroke(),
      shellLayout: resolvedShellLayout,
      categoryLayout,
      theme: this.options.resolveRenderTheme(mode)
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
    const selected = Boolean(state.state.flags.selected);
    const ringStroke = this.resolveSelectedNodeStroke();

    state.selectedRing.selectedStyle = {
      stroke: ringStroke,
      opacity: 0.92
    };
    state.selectedRing.selected = selected;
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

    state.resizeHandle.visible = visible;
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
      header: card,
      headerDivider: hiddenHeaderDivider,
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
   * @param node - 目标节点。
   * @returns 当前节点状态灯颜色。
   */
  private resolveSignalColor(node: TNodeState): string {
    switch (this.options.resolveNodeExecutionState(node.id)?.status) {
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
   * @param nodeId - 目标节点 ID。
   * @returns 当前错误文案。
   */
  private resolveExecutionErrorMessage(nodeId: string): string | undefined {
    const executionState = this.options.resolveNodeExecutionState(nodeId);
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

