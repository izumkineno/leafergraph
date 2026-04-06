/**
 * 节点外壳视图模块。
 *
 * @remarks
 * 负责节点卡片、标题区、信号灯和局部装饰图元的创建。
 */

import "@leafer-in/flow";
import { Box, Group, Path, Rect, Text } from "leafer-ui";
import { setLeaferGraphTextEditMeta } from "@leafergraph/widget-runtime";
export type { NodeShellRenderTheme } from "@leafergraph/theme/graph";
import type { NodeShellRenderTheme } from "@leafergraph/theme/graph";
import type { LeaferGraphNodeLongTaskMode } from "@leafergraph/execution";
import type { NodeShellCategoryLayout, NodeShellLayout } from "./layout";
import {
  resolveNodePortHitAreaBounds,
  type NodeShellPortLayout
} from "./ports";
import { resolveSlotCornerRadius } from "./slot_style";

/**
 * 节点壳渲染入口的输入。
 * 这里只关心节点外观渲染需要的数据，不关心 Widget renderer 或宿主状态容器。
 */
export interface CreateNodeShellOptions {
  nodeId: string;
  x: number;
  y: number;
  title: string;
  signalColor: string;
  errorMessage?: string;
  progressRingState?: NodeShellProgressRingState | null;
  selectedStroke: string;
  shellLayout: NodeShellLayout;
  categoryLayout: NodeShellCategoryLayout;
  theme: NodeShellRenderTheme;
}

/**
 * 节点进度环显示状态。
 */
export interface NodeShellProgressRingState {
  visible: boolean;
  mode: LeaferGraphNodeLongTaskMode;
  progress?: number;
  dashOffset?: number;
}

/**
 * 节点壳渲染结果。
 * 主包后续会继续在 `widgetLayer` 中挂接 Widget 图元和生命周期实例。
 */
export interface NodeShellPortView {
  layout: NodeShellPortLayout;
  port: Group | Path | Rect;
  label: Text;
  highlight: Rect;
  hitArea: Rect;
}

/**
 * 节点壳视图对象。
 */
export interface NodeShellView {
  view: Group;
  card: Rect;
  progressTrack: Rect;
  progressRing: Rect;
  selectedRing: Rect;
  header: Rect;
  headerDivider: Rect;
  signalButton: Rect;
  titleLabel: Text;
  titleHitArea: Rect;
  categoryBadge: Rect;
  categoryLabel: Text;
  widgetBackground: Rect | null;
  widgetDivider: Rect | null;
  resizeHandle: Box;
  portViews: NodeShellPortView[];
  widgetLayer: Box;
}

/**
 * 创建一个完整但不含 Widget 内容的节点壳。
 * 这一步只负责基础壳体、标题、分类、端口和 Widget 容器层。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createNodeShell(options: CreateNodeShellOptions): NodeShellView {
  // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
  const {
    nodeId,
    x,
    y,
    title,
    signalColor,
    errorMessage,
    progressRingState,
    selectedStroke,
    shellLayout,
    categoryLayout,
    theme
  } = options;
  const normalizedErrorMessage = normalizeNodeErrorMessage(errorMessage);
  const normalizedProgressRingState = normalizeNodeProgressRingState(
    progressRingState
  );

  const group = new Group({
    x,
    y,
    id: `node-${nodeId}`,
    name: `node-${nodeId}`
  });

  const selectedRing = new Rect({
    x: -theme.selectedRingOutset,
    y: -theme.selectedRingOutset,
    width: shellLayout.width + theme.selectedRingOutset * 2,
    height: shellLayout.height + theme.selectedRingOutset * 2,
    fill: "transparent",
    stroke: selectedStroke,
    strokeWidth: theme.selectedRingStrokeWidth,
    cornerRadius: theme.nodeRadius + theme.selectedRingOutset,
    opacity: 0,
    selectedStyle: {
      stroke: selectedStroke,
      opacity: theme.selectedRingOpacity
    },
    hittable: false
  });

  const progressRingGeometry = resolveProgressRingGeometry(
    shellLayout,
    theme.selectedRingOutset + 4,
    theme.nodeRadius
  );
  const progressTrack = new Rect({
    x: progressRingGeometry.x,
    y: progressRingGeometry.y,
    width: progressRingGeometry.width,
    height: progressRingGeometry.height,
    fill: "transparent",
    stroke: selectedStroke,
    strokeWidth: theme.selectedRingStrokeWidth,
    opacity: normalizedProgressRingState?.visible ? 0.16 : 0,
    cornerRadius: progressRingGeometry.cornerRadius,
    hittable: false,
    visible: Boolean(normalizedProgressRingState?.visible)
  });
  const progressRing = new Rect({
    x: progressRingGeometry.x,
    y: progressRingGeometry.y,
    width: progressRingGeometry.width,
    height: progressRingGeometry.height,
    fill: "transparent",
    stroke: selectedStroke,
    strokeWidth: theme.selectedRingStrokeWidth,
    strokeCap: "round",
    opacity: normalizedProgressRingState?.visible ? 0.94 : 0,
    cornerRadius: progressRingGeometry.cornerRadius,
    dashPattern: normalizedProgressRingState
      ? resolveProgressRingDashPattern(
          normalizedProgressRingState,
          progressRingGeometry.perimeter,
          theme.selectedRingStrokeWidth
        )
      : undefined,
    dashOffset: normalizedProgressRingState?.dashOffset ?? 0,
    hittable: false,
    visible: Boolean(normalizedProgressRingState?.visible)
  });

  const card = new Rect({
    width: shellLayout.width,
    height: shellLayout.height,
    fill: theme.cardFill,
    stroke: theme.cardStroke,
    strokeWidth: 1,
    cornerRadius: theme.nodeRadius,
    cursor: "grab"
  });

  const header = new Rect({
    width: shellLayout.width,
    height: theme.headerHeight,
    fill: theme.headerFill,
    cornerRadius: shellLayout.collapsed
      ? theme.nodeRadius
      : [theme.nodeRadius, theme.nodeRadius, 0, 0],
    hittable: false
  });

  const headerDivider = new Rect({
    y: theme.headerHeight,
    width: shellLayout.width,
    height: 1,
    fill: theme.headerDividerFill,
    visible: !shellLayout.collapsed,
    hittable: false
  });

  const titleHitArea = new Rect({
    name: `node-title-hit-${nodeId}`,
    width: shellLayout.width,
    height: theme.headerHeight,
    fill: "rgba(255, 255, 255, 0.001)",
    cursor: "grab"
  });

  const signalGlow = new Rect({
    x: theme.signalGlowX,
    y: theme.signalGlowY,
    width: theme.signalGlowSize,
    height: theme.signalGlowSize,
    fill: signalColor,
    opacity: theme.signalGlowOpacity,
    cornerRadius: 999,
    hittable: false
  });

  const signalLight = new Rect({
    x: theme.signalLightX,
    y: theme.signalLightY,
    width: theme.signalLightSize,
    height: theme.signalLightSize,
    fill: signalColor,
    cornerRadius: 999,
    hittable: false
  });

  const signalButton = new Rect({
    name: `node-signal-button-${nodeId}`,
    x: theme.signalGlowX - theme.signalHitPadding,
    y: theme.signalGlowY - theme.signalHitPadding,
    width: theme.signalGlowSize + theme.signalHitPadding * 2,
    height: theme.signalGlowSize + theme.signalHitPadding * 2,
    fill: "rgba(255, 255, 255, 0.001)",
    cornerRadius: 999,
    cursor: "pointer"
  });

  const titleLabel = new Text({
    x: theme.titleX,
    y: theme.titleY,
    width: Math.max(categoryLayout.x - theme.titleX - 12, 1),
    text: title,
    fill: theme.titleFill,
    fontFamily: theme.titleFontFamily,
    fontSize: theme.titleFontSize,
    fontWeight: theme.titleFontWeight,
    hittable: false
  });
  titleLabel.textWrap = "none";
  titleLabel.textOverflow = "...";
  setLeaferGraphTextEditMeta(titleLabel, {
    kind: "node-title",
    nodeId
  });

  const categoryBadge = new Rect({
    x: categoryLayout.x,
    y: categoryLayout.y,
    width: categoryLayout.width,
    height: categoryLayout.height,
    fill: theme.categoryFill,
    stroke: theme.categoryStroke,
    strokeWidth: 1,
    cornerRadius: 999,
    hittable: false
  });

  const categoryLabel = new Text({
    x: categoryLayout.labelX,
    y: categoryLayout.labelY,
    text: categoryLayout.text,
    fill: theme.categoryTextFill,
    fontFamily: theme.categoryFontFamily,
    fontSize: theme.categoryFontSize,
    fontWeight: theme.categoryFontWeight,
    hittable: false
  });

  const parts = [
    card,
    progressTrack,
    progressRing,
    header,
    headerDivider,
    titleHitArea,
    signalGlow,
    signalLight,
    signalButton,
    titleLabel,
    categoryBadge,
    categoryLabel
  ];
  const portViews: NodeShellView["portViews"] = [];
  let widgetBackground: Rect | null = null;
  let widgetDivider: Rect | null = null;

  if (shellLayout.hasWidgets) {
    widgetBackground = new Rect({
      y: shellLayout.widgetTop,
      width: shellLayout.width,
      height: shellLayout.height - shellLayout.widgetTop,
      fill: theme.widgetFill,
      cornerRadius: [0, 0, theme.nodeRadius, theme.nodeRadius],
      hittable: false
    });
    widgetDivider = new Rect({
      y: shellLayout.widgetTop,
      width: shellLayout.width,
      height: 1,
      fill: theme.headerDividerFill,
      hittable: false
    });
    parts.push(widgetBackground, widgetDivider);
  }

  for (const port of shellLayout.ports) {
    const portHitAreaBounds = resolveNodePortHitAreaBounds(port);
    // 再按当前规则组合结果，并把派生数据一并收口到输出里。
    const highlightCornerRadius = resolveSlotFrameCornerRadius(
      port.slotShape,
      Math.max(port.portWidth + 8, port.portHeight + 8)
    );
    const hitAreaCornerRadius = resolveSlotFrameCornerRadius(
      port.slotShape,
      Math.max(portHitAreaBounds.width, portHitAreaBounds.height)
    );
    const portHighlight = new Rect({
      x: port.portX - 4,
      y: port.portY - 4,
      width: port.portWidth + 8,
      height: port.portHeight + 8,
      fill: "transparent",
      stroke: "rgba(56, 189, 248, 0.92)",
      strokeWidth: 2,
      cornerRadius: highlightCornerRadius,
      opacity: 0,
      visible: false,
      hittable: false
    });
    const portView = createNodeShellPortGlyph(port, theme);
    const portLabel = new Text({
      x: port.labelX,
      y: port.labelY,
      width: port.labelWidth,
      text: port.label,
      textAlign: port.textAlign,
      fill: theme.slotLabelFill,
      fontFamily: theme.slotLabelFontFamily,
      fontSize: theme.slotLabelFontSize,
      fontWeight: theme.slotLabelFontWeight,
      visible: port.labelVisible,
      hittable: false
    });
    const portHitArea = new Rect({
      name: `node-port-hit-${nodeId}-${port.direction}-${port.index}`,
      x: portHitAreaBounds.x,
      y: portHitAreaBounds.y,
      width: portHitAreaBounds.width,
      height: portHitAreaBounds.height,
      fill: "rgba(255, 255, 255, 0.001)",
      stroke: "transparent",
      strokeWidth: 0,
      cornerRadius: hitAreaCornerRadius,
      cursor: "crosshair",
      hoverStyle: {
        fill: "rgba(255, 255, 255, 0.001)",
        stroke: "transparent",
        strokeWidth: 0
      },
      pressStyle: {
        fill: "rgba(255, 255, 255, 0.001)",
        stroke: "transparent",
        strokeWidth: 0
      },
      selectedStyle: {
        fill: "rgba(255, 255, 255, 0.001)",
        stroke: "transparent",
        strokeWidth: 0
      }
    });
    portViews.push({
      layout: port,
      highlight: portHighlight,
      port: portView,
      label: portLabel,
      hitArea: portHitArea
    });
    parts.push(portHighlight, portView, portLabel, portHitArea);
  }

  const widgetLayer = new Box({
    id: `widgets-${nodeId}`,
    name: `widgets-${nodeId}`,
    x: shellLayout.widgetBounds.x,
    y: shellLayout.widgetBounds.y,
    width: shellLayout.widgetBounds.width,
    height: shellLayout.widgetBounds.height,
    flow: "y",
    gap: { y: shellLayout.widgetGap },
    padding: [shellLayout.widgetPaddingY, 0, shellLayout.widgetPaddingY, 0],
    resizeChildren: false
  });

  /**
   * 右下角 resize 句柄使用“透明命中区 + 标准对角 grip 图标”的组合，
   * 比纯色小方块更符合常见设计工具的交互预期。
   */
  const resizeHandle = new Box({
    name: `node-resize-handle-${nodeId}`,
    x: shellLayout.width - 18,
    y: shellLayout.height - 18,
    width: 18,
    height: 18,
    cursor: "nwse-resize",
    visible: false
  });
  const resizeHandleHitArea = new Rect({
    width: 18,
    height: 18,
    fill: theme.resizeHandleFill,
    cornerRadius: 6
  });
  const resizeHandleIcon = new Path({
    x: 0,
    y: 0,
    path: "M 4 14 L 14 4 M 8 14 L 14 8 M 12 14 L 14 12",
    stroke: theme.resizeHandleStroke,
    strokeWidth: theme.resizeHandleStrokeWidth,
    strokeCap: "round",
    strokeJoin: "round",
    hittable: false
  });
  resizeHandle.add([resizeHandleHitArea, resizeHandleIcon]);

  group.add([selectedRing, ...parts, widgetLayer, resizeHandle]);

  if (normalizedErrorMessage) {
    const errorBadgeX = 12;
    const errorBadgeY = shellLayout.height + 10;
    const errorBadgeWidth = Math.max(132, shellLayout.width - 24);
    const errorBadgeHeight = 26;
    const errorBadge = new Rect({
      x: errorBadgeX,
      y: errorBadgeY,
      width: errorBadgeWidth,
      height: errorBadgeHeight,
      fill: theme.errorBadgeFill,
      stroke: theme.errorBadgeStroke,
      strokeWidth: 1,
      cornerRadius: 999,
      hittable: false
    });
    const errorLabel = new Text({
      x: errorBadgeX + 12,
      y: errorBadgeY + 7,
      width: errorBadgeWidth - 24,
      height: 14,
      text: `执行失败：${normalizedErrorMessage}`,
      fill: theme.errorBadgeTextFill,
      fontFamily: theme.slotLabelFontFamily,
      fontSize: 10.5,
      fontWeight: "600",
      hittable: false
    });
    errorLabel.textOverflow = "...";
    group.add([errorBadge, errorLabel]);
  }

  return {
    view: group,
    card,
    progressTrack,
    progressRing,
    selectedRing,
    header,
    headerDivider,
    signalButton,
    titleLabel,
    titleHitArea,
    categoryBadge,
    categoryLabel,
    widgetBackground,
    widgetDivider,
    resizeHandle,
    portViews,
    widgetLayer
  };
}

/**
 * 归一化进度环状态。
 *
 * @param progressRingState - 进度环状态。
 * @returns 处理后的结果。
 */
function normalizeNodeProgressRingState(
  progressRingState: NodeShellProgressRingState | null | undefined
): NodeShellProgressRingState | null {
  if (!progressRingState?.visible) {
    return null;
  }

  return {
    visible: true,
    mode: progressRingState.mode,
    progress:
      typeof progressRingState.progress === "number" &&
      Number.isFinite(progressRingState.progress)
        ? Math.min(1, Math.max(0, progressRingState.progress))
        : undefined,
    dashOffset:
      typeof progressRingState.dashOffset === "number" &&
      Number.isFinite(progressRingState.dashOffset)
        ? progressRingState.dashOffset
        : 0
  };
}

/**
 * 解析进度环几何。
 *
 * @param shellLayout - 节点壳布局。
 * @param outset - 外扩距离。
 * @param nodeRadius - 节点圆角。
 * @returns 处理后的几何。
 */
function resolveProgressRingGeometry(
  shellLayout: NodeShellLayout,
  outset: number,
  nodeRadius: number
): {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
  perimeter: number;
} {
  const width = shellLayout.width + outset * 2;
  const height = shellLayout.height + outset * 2;
  const cornerRadius = nodeRadius + outset;

  return {
    x: -outset,
    y: -outset,
    width,
    height,
    cornerRadius,
    perimeter: resolveRoundedRectPerimeter(width, height, cornerRadius)
  };
}

/**
 * 解析进度环 dash 模式。
 *
 * @param state - 进度环状态。
 * @param perimeter - 路径周长。
 * @param strokeWidth - 描边宽度。
 * @returns `dashPattern`。
 */
function resolveProgressRingDashPattern(
  state: NodeShellProgressRingState,
  perimeter: number,
  strokeWidth: number
): number[] {
  if (state.mode === "indeterminate") {
    const segmentLength = Math.max(perimeter * 0.22, strokeWidth * 7);
    const gapLength = Math.max(perimeter - segmentLength, segmentLength);
    return [segmentLength, gapLength];
  }

  const progress = state.progress ?? 0;
  const visibleLength = Math.max(0, Math.min(perimeter, perimeter * progress));
  const hiddenLength = Math.max(perimeter - visibleLength, 0.001);

  return [visibleLength, hiddenLength];
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
  cornerRadius: number
): number {
  const radius = Math.max(0, Math.min(cornerRadius, Math.min(width, height) / 2));
  return 2 * (width + height - 4 * radius) + 2 * Math.PI * radius;
}

/**
 * 归一化节点级错误文案，避免把空白或多行文本直接塞进画布标签。
 *
 * @param errorMessage - 错误消息。
 * @returns 归一后的错误文案。
 */
function normalizeNodeErrorMessage(errorMessage: string | undefined): string | null {
  if (typeof errorMessage !== "string") {
    return null;
  }

  const normalized = errorMessage.replace(/\s+/g, " ").trim();
  return normalized || null;
}

/**
 * 根据 slot 形状创建真正显示在节点壳上的 port glyph。
 *
 * @param port - 端口布局。
 * @param theme - 节点壳渲染主题。
 * @returns 对应的端口图元。
 */
function createNodeShellPortGlyph(
  port: NodeShellPortLayout,
  theme: NodeShellRenderTheme
): Group | Path | Rect {
  const fill =
    port.slotColor ??
    (port.direction === "input" ? theme.inputPortFill : theme.outputPortFill);
  return nodeShellPortGlyphFactories[port.slotShape](port, fill, theme);
}

type NodeShellPortGlyphFactory = (
  port: NodeShellPortLayout,
  fill: string,
  theme: NodeShellRenderTheme
) => Group | Path | Rect;

/**
 * 创建 `box` 形状的端口图元。
 *
 * @param port - 端口布局。
 * @param fill - 端口填充色。
 * @param theme - 节点壳渲染主题。
 * @returns `box` 端口图元。
 */
function createBoxPortGlyph(
  port: NodeShellPortLayout,
  fill: string,
  theme: NodeShellRenderTheme
): Rect {
  return new Rect({
    x: port.portX,
    y: port.portY,
    width: port.portWidth,
    height: port.portHeight,
    fill,
    stroke: theme.portStroke,
    strokeWidth: theme.portStrokeWidth,
    cornerRadius: resolveSlotFrameCornerRadius(
      port.slotShape,
      Math.max(port.portWidth, port.portHeight)
    ),
    hittable: false
  });
}

/**
 * 创建 `arrow` 形状的端口图元。
 *
 * @param port - 端口布局。
 * @param fill - 端口填充色。
 * @param theme - 节点壳渲染主题。
 * @returns `arrow` 端口图元。
 */
function createArrowPortGlyph(
  port: NodeShellPortLayout,
  fill: string,
  theme: NodeShellRenderTheme
): Path {
  return new Path({
    path: buildArrowPortPath(port),
    fill,
    stroke: theme.portStroke,
    strokeWidth: Math.max(1.5, theme.portStrokeWidth * 0.7),
    strokeJoin: "round",
    strokeCap: "round",
    hittable: false
  });
}

/**
 * 创建 `circle` 形状的端口图元。
 *
 * @param port - 端口布局。
 * @param fill - 端口填充色。
 * @param theme - 节点壳渲染主题。
 * @returns `circle` 端口图元。
 */
function createCirclePortGlyph(
  port: NodeShellPortLayout,
  fill: string,
  theme: NodeShellRenderTheme
): Rect {
  return new Rect({
    x: port.portX,
    y: port.portY,
    width: port.portWidth,
    height: port.portHeight,
    fill,
    stroke: theme.portStroke,
    strokeWidth: theme.portStrokeWidth,
    cornerRadius: 999,
    hittable: false
  });
}

const nodeShellPortGlyphFactories = {
  box: createBoxPortGlyph,
  arrow: createArrowPortGlyph,
  grid: createGridPortGlyph,
  circle: createCirclePortGlyph
} satisfies Record<NodeShellPortLayout["slotShape"], NodeShellPortGlyphFactory>;

/**
 * `grid` 形状用 2x2 小格子表达，避免和普通方形端口混淆。
 *
 * @param port - 端口布局。
 * @param fill - 端口填充色。
 * @param theme - 节点壳渲染主题。
 * @returns `grid` 端口图元。
 */
function createGridPortGlyph(
  port: NodeShellPortLayout,
  fill: string,
  theme: NodeShellRenderTheme
): Group {
  const group = new Group({
    hittable: false
  });
  const gap = 1.5;
  const cellWidth = Math.max(2, (port.portWidth - gap) / 2);
  const cellHeight = Math.max(2, (port.portHeight - gap) / 2);
  const strokeWidth = Math.max(1, theme.portStrokeWidth * 0.55);
  const cellRadius = resolveSlotFrameCornerRadius(
    "grid",
    Math.max(cellWidth, cellHeight)
  );

  const cells = [
    [port.portX, port.portY],
    [port.portX + cellWidth + gap, port.portY],
    [port.portX, port.portY + cellHeight + gap],
    [port.portX + cellWidth + gap, port.portY + cellHeight + gap]
  ] as const;

  for (const [x, y] of cells) {
    group.add(
      new Rect({
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        fill,
        stroke: theme.portStroke,
        strokeWidth,
        cornerRadius: cellRadius,
        hittable: false
      })
    );
  }

  return group;
}

/**
 * `arrow` 形状用朝向相关的小三角表达输入/输出方向。
 *
 * @param port - 端口布局。
 * @returns `arrow` 端口的路径字符串。
 */
function buildArrowPortPath(port: NodeShellPortLayout): string {
  const x = port.portX;
  const y = port.portY;
  const width = port.portWidth;
  const height = port.portHeight;
  const centerY = y + height / 2;

  if (port.direction === "input") {
    return `M ${x} ${centerY} L ${x + width} ${y} L ${x + width} ${y + height} Z`;
  }

  return `M ${x + width} ${centerY} L ${x} ${y} L ${x} ${y + height} Z`;
}

/**
 * 非圆形端口统一使用较小圆角，事件方形和显式方形都走这条规则。
 *
 * @param shape - 端口形状。
 * @param size - 基准尺寸。
 * @returns 端口圆角半径。
 */
function resolveSlotFrameCornerRadius(
  shape: NodeShellPortLayout["slotShape"],
  size: number
): number {
  return resolveSlotCornerRadius(shape, size);
}
