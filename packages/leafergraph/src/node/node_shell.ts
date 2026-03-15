/**
 * 节点外壳视图模块。
 *
 * @remarks
 * 负责节点卡片、标题区、信号灯和局部装饰图元的创建。
 */

import "@leafer-in/flow";
import { Box, Group, Path, Rect, Text } from "leafer-ui";
import type { NodeShellCategoryLayout, NodeShellLayout } from "./node_layout";
import type { NodeShellPortLayout } from "./node_port";

/**
 * 节点壳渲染需要的样式主题。
 * 当前先由主包集中传入，后续可继续抽成真正的主题系统。
 */
export interface NodeShellRenderTheme {
  nodeRadius: number;
  headerHeight: number;
  selectedRingOutset: number;
  selectedRingStrokeWidth: number;
  selectedRingOpacity: number;
  cardFill: string;
  cardStroke: string;
  cardPressFill: string;
  cardPressStroke: string;
  headerFill: string;
  headerDividerFill: string;
  titleFill: string;
  titleFontFamily: string;
  titleFontSize: number;
  titleFontWeight: string;
  titleX: number;
  titleY: number;
  categoryFill: string;
  categoryStroke: string;
  categoryTextFill: string;
  categoryFontFamily: string;
  categoryFontSize: number;
  categoryFontWeight: string;
  signalGlowX: number;
  signalGlowY: number;
  signalGlowSize: number;
  signalGlowOpacity: number;
  signalLightX: number;
  signalLightY: number;
  signalLightSize: number;
  signalHitPadding: number;
  widgetFill: string;
  inputPortFill: string;
  outputPortFill: string;
  portStroke: string;
  portStrokeWidth: number;
  slotLabelFill: string;
  slotLabelFontFamily: string;
  slotLabelFontSize: number;
  slotLabelFontWeight: string;
}

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
  selectedStroke: string;
  shellLayout: NodeShellLayout;
  categoryLayout: NodeShellCategoryLayout;
  theme: NodeShellRenderTheme;
}

/**
 * 节点壳渲染结果。
 * 主包后续会继续在 `widgetLayer` 中挂接 Widget 图元和生命周期实例。
 */
export interface NodeShellPortView {
  layout: NodeShellPortLayout;
  port: Rect;
  label: Text;
  highlight: Rect;
  hitArea: Rect;
}

export interface NodeShellView {
  view: Group;
  card: Rect;
  selectedRing: Rect;
  header: Rect;
  headerDivider: Rect;
  signalButton: Rect;
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
 */
export function createNodeShell(options: CreateNodeShellOptions): NodeShellView {
  const {
    nodeId,
    x,
    y,
    title,
    signalColor,
    selectedStroke,
    shellLayout,
    categoryLayout,
    theme
  } = options;

  const group = new Group({
    x,
    y,
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

  const card = new Rect({
    width: shellLayout.width,
    height: shellLayout.height,
    fill: theme.cardFill,
    stroke: theme.cardStroke,
    strokeWidth: 1,
    cornerRadius: theme.nodeRadius,
    cursor: "grab",
    pressStyle: {
      fill: theme.cardPressFill,
      stroke: theme.cardPressStroke
    },
    selectedStyle: {
      stroke: selectedStroke,
      strokeWidth: 1.5
    }
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
    text: title,
    fill: theme.titleFill,
    fontFamily: theme.titleFontFamily,
    fontSize: theme.titleFontSize,
    fontWeight: theme.titleFontWeight,
    hittable: false
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
    header,
    headerDivider,
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
    const portHighlight = new Rect({
      x: port.portX - 4,
      y: port.portY - 4,
      width: port.portWidth + 8,
      height: port.portHeight + 8,
      fill: "transparent",
      stroke: "rgba(56, 189, 248, 0.92)",
      strokeWidth: 2,
      cornerRadius: 999,
      opacity: 0,
      visible: false,
      hittable: false
    });
    const portView = new Rect({
      x: port.portX,
      y: port.portY,
      width: port.portWidth,
      height: port.portHeight,
      fill:
        port.slotColor ??
        (port.direction === "input"
          ? theme.inputPortFill
          : theme.outputPortFill),
      stroke: theme.portStroke,
      strokeWidth: theme.portStrokeWidth,
      cornerRadius: 999,
      hittable: false
    });
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
      x: port.portX - 9,
      y: port.portY - 9,
      width: port.portWidth + 18,
      height: port.portHeight + 18,
      fill: "rgba(255, 255, 255, 0.001)",
      cornerRadius: 999,
      cursor: "crosshair"
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
    fill: "rgba(255, 255, 255, 0.001)",
    cornerRadius: 6
  });
  const resizeHandleIcon = new Path({
    x: 0,
    y: 0,
    path: "M 4 14 L 14 4 M 8 14 L 14 8 M 12 14 L 14 12",
    stroke: "rgba(255, 255, 255, 0.72)",
    strokeWidth: 1.5,
    strokeCap: "round",
    strokeJoin: "round",
    hittable: false
  });
  resizeHandle.add([resizeHandleHitArea, resizeHandleIcon]);

  group.add([selectedRing, ...parts, widgetLayer, resizeHandle]);

  return {
    view: group,
    card,
    selectedRing,
    header,
    headerDivider,
    signalButton,
    categoryBadge,
    categoryLabel,
    widgetBackground,
    widgetDivider,
    resizeHandle,
    portViews,
    widgetLayer
  };
}
