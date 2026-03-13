import { Group, Rect, Text } from "leafer-ui";
import type { NodeShellCategoryLayout, NodeShellLayout } from "./node_layout";

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
  cardHoverFill: string;
  cardHoverStroke: string;
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
  accent: string;
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
export interface NodeShellView {
  view: Group;
  card: Rect;
  selectedRing: Rect;
  widgetLayer: Group;
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
    accent,
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
    stroke: accent,
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
    hoverStyle: {
      fill: theme.cardHoverFill,
      stroke: theme.cardHoverStroke
    },
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
    cornerRadius: [theme.nodeRadius, theme.nodeRadius, 0, 0],
    hittable: false
  });

  const headerDivider = new Rect({
    y: theme.headerHeight,
    width: shellLayout.width,
    height: 1,
    fill: theme.headerDividerFill,
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
    titleLabel,
    categoryBadge,
    categoryLabel
  ];

  if (shellLayout.hasWidgets) {
    parts.push(
      new Rect({
        y: shellLayout.widgetTop,
        width: shellLayout.width,
        height: shellLayout.height - shellLayout.widgetTop,
        fill: theme.widgetFill,
        cornerRadius: [0, 0, theme.nodeRadius, theme.nodeRadius],
        hittable: false
      }),
      new Rect({
        y: shellLayout.widgetTop,
        width: shellLayout.width,
        height: 1,
        fill: theme.headerDividerFill,
        hittable: false
      })
    );
  }

  for (const port of shellLayout.ports) {
    parts.push(
      new Rect({
        x: port.portX,
        y: port.portY,
        width: port.portWidth,
        height: port.portHeight,
        fill:
          port.direction === "input"
            ? theme.inputPortFill
            : theme.outputPortFill,
        stroke: theme.portStroke,
        strokeWidth: theme.portStrokeWidth,
        cornerRadius: 999,
        hittable: false
      }),
      new Text({
        x: port.labelX,
        y: port.labelY,
        width: port.labelWidth,
        text: port.label,
        textAlign: port.textAlign,
        fill: theme.slotLabelFill,
        fontFamily: theme.slotLabelFontFamily,
        fontSize: theme.slotLabelFontSize,
        fontWeight: theme.slotLabelFontWeight,
        hittable: false
      })
    );
  }

  const widgetLayer = new Group({ name: `widgets-${nodeId}` });
  group.add([selectedRing, ...parts, widgetLayer]);

  return {
    view: group,
    card,
    selectedRing,
    widgetLayer
  };
}
