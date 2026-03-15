import { Box } from "leafer-ui";
import * as LeaferUI from "leafer-ui";
import type { NodeRuntimeState } from "@leafergraph/node";
import type {
  LeaferGraphWidgetEditingContext,
  LeaferGraphWidgetRenderInstance,
  LeaferGraphWidgetRenderer,
  LeaferGraphWidgetThemeContext
} from "./plugin";
import { LeaferGraphWidgetRegistry } from "./widget_registry";

const MISSING_WIDGET_FILL = "rgba(220, 38, 38, 0.92)";
const MISSING_WIDGET_STROKE = "rgba(127, 29, 29, 0.78)";
const MISSING_WIDGET_TEXT_FILL = "#FFF1F2";

/** Widget 在节点内部的最小布局描述。 */
export interface LeaferGraphWidgetLayoutItem {
  bounds: {
    width: number;
    height: number;
  };
}

/** Widget 宿主实例化时需要的回调能力。 */
interface LeaferGraphWidgetHostOptions {
  registry: LeaferGraphWidgetRegistry;
  getTheme(): LeaferGraphWidgetThemeContext;
  getEditing(): LeaferGraphWidgetEditingContext;
  setNodeWidgetValue(nodeId: string, widgetIndex: number, newValue: unknown): void;
  requestRender(): void;
  emitNodeWidgetAction(
    nodeId: string,
    action: string,
    param?: unknown,
    options?: Record<string, unknown>
  ): boolean;
}

/**
 * Widget 宿主。
 * 先集中承担三件事：
 * 1. 渲染节点内部 widgets
 * 2. 统一调度 widget 的 update / destroy
 * 3. 提供缺失 widget 的 fallback renderer
 */
export class LeaferGraphWidgetHost {
  private readonly options: LeaferGraphWidgetHostOptions;

  constructor(options: LeaferGraphWidgetHostOptions) {
    this.options = options;
  }

  /** 渲染一个节点的全部 widgets。 */
  renderNodeWidgets(
    node: NodeRuntimeState,
    widgetLayer: Box,
    layoutItems: readonly LeaferGraphWidgetLayoutItem[]
  ): Array<LeaferGraphWidgetRenderInstance | null> {
    const instances: Array<LeaferGraphWidgetRenderInstance | null> = [];

    for (let index = 0; index < node.widgets.length; index += 1) {
      const widget = node.widgets[index];
      const layoutItem = layoutItems[index];
      if (!layoutItem) {
        instances.push(null);
        continue;
      }

      const { width, height } = layoutItem.bounds;
      const group = new Box({
        name: `widget-${node.id}-${index}`,
        width,
        height,
        resizeChildren: false
      });
      const renderer = this.options.registry.resolveRenderer(widget.type);
      const instance = renderer({
        ui: LeaferUI,
        group,
        node,
        widget,
        widgetIndex: index,
        value: widget.value,
        theme: this.options.getTheme(),
        editing: this.options.getEditing(),
        bounds: {
          x: 0,
          y: 0,
          width,
          height
        },
        setValue: (newValue) => {
          this.options.setNodeWidgetValue(node.id, index, newValue);
        },
        requestRender: () => {
          this.options.requestRender();
        },
        emitAction: (action, param, extra) =>
          this.options.emitNodeWidgetAction(node.id, action, param, {
            ...(extra ?? {}),
            source: "widget",
            widgetIndex: index,
            widgetName: widget.name,
            widgetType: widget.type
          })
      });

      instances.push(instance ?? null);
      widgetLayer.add(group);
    }

    return instances;
  }

  /** 更新某个节点 widget 的值，并触发对应 renderer 的增量更新。 */
  updateNodeWidgetValue(
    node: NodeRuntimeState,
    widgetIndex: number,
    newValue: unknown,
    widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>
  ): boolean {
    const widget = node.widgets[widgetIndex];
    if (!widget) {
      return false;
    }

    widget.value = newValue;
    widgetInstances[widgetIndex]?.update?.(newValue);
    this.options.requestRender();
    return true;
  }

  /** 销毁一个节点上已经挂载的全部 widget 实例。 */
  destroyNodeWidgets(
    widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>,
    widgetLayer: Box
  ): void {
    for (const instance of widgetInstances) {
      instance?.destroy?.();
    }

    widgetInstances.length = 0;
    widgetLayer.removeAll();
  }
}

/**
 * 缺失 Widget 类型时的统一占位渲染。
 * 当前直接使用红色块级提示，避免未知类型静默消失导致用户误判数据已丢失。
 */
export function createMissingWidgetRenderer(): LeaferGraphWidgetRenderer {
  return (context) => {
    const surface = new LeaferUI.Rect({
      width: context.bounds.width,
      height: context.bounds.height,
      fill: MISSING_WIDGET_FILL,
      stroke: MISSING_WIDGET_STROKE,
      strokeWidth: 1,
      cornerRadius: 12
    });
    const label = new LeaferUI.Text({
      x: 14,
      y: Math.max(context.bounds.height / 2 - 9, 12),
      width: Math.max(context.bounds.width - 28, 24),
      text: context.widget.type,
      textAlign: "center",
      fill: MISSING_WIDGET_TEXT_FILL,
      fontFamily: context.theme.tokens.fontFamily,
      fontSize: 12,
      fontWeight: "600",
      hittable: false
    });
    label.textWrap = "break";
    context.group.add([surface, label]);

    return {
      destroy() {
        context.group.removeAll();
      }
    };
  };
}
