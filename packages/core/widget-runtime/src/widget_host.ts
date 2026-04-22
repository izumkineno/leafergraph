/**
 * Widget 宿主模块。
 *
 * @remarks
 * 负责节点内部 Widget 渲染、增量更新、销毁和缺失态回退。
 */

import { Box } from "leafer-ui";
import * as LeaferUI from "leafer-ui";
import type { NodeRuntimeState } from "@leafergraph/core/node";
import type {
  LeaferGraphWidgetEditingContext,
  LeaferGraphWidgetRenderInstance,
  LeaferGraphWidgetRenderer
} from "@leafergraph/core/contracts";
import type { LeaferGraphWidgetThemeContext } from "@leafergraph/core/theme";
import { LeaferGraphWidgetRegistry } from "./widget_registry";

const MISSING_WIDGET_FILL = "rgba(220, 38, 38, 0.92)";
const MISSING_WIDGET_STROKE = "rgba(127, 29, 29, 0.78)";
const MISSING_WIDGET_TEXT_FILL = "#FFF1F2";

/** Widget 在节点内部的最小布局描述。 */
export interface LeaferGraphWidgetLayoutItem {
  /** 当前 Widget 可用的布局边界。 */
  bounds: {
    /** 边界宽度。 */
    width: number;
    /** 边界高度。 */
    height: number;
  };
}

/**
 * Widget 宿主实例化时需要的回调能力。
 *
 * @remarks
 * Widget 宿主本身不持有图状态和主题状态，
 * 这些能力全部由外部宿主在构造时注入，避免 Widget 层反向依赖整个图运行时。
 */
interface LeaferGraphWidgetHostOptions {
  registry: LeaferGraphWidgetRegistry;
  getTheme(): LeaferGraphWidgetThemeContext;
  getEditing(): LeaferGraphWidgetEditingContext;
  setNodeWidgetValue(nodeId: string, widgetIndex: number, newValue: unknown): void;
  commitNodeWidgetValue(
    nodeId: string,
    widgetIndex: number,
    commit: {
      newValue?: unknown;
      beforeValue: unknown;
      beforeWidgets: NodeRuntimeState["widgets"];
    }
  ): void;
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
  private readonly widgetCommitBaselines = new Map<
    string,
    {
      beforeValue: unknown;
      beforeWidgets: NodeRuntimeState["widgets"];
    }
  >();

  /**
   * 初始化 LeaferGraphWidgetHost 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(options: LeaferGraphWidgetHostOptions) {
    this.options = options;
  }

  /**
   * 渲染一个节点的全部 widgets。
   *
   * @remarks
   * 这里会为每个 Widget 创建一个独立的 `Box` 作为挂载容器，
   * 然后从正式 Widget 注册表中解析 renderer 并执行首次 mount。
   *
   * @param node - 当前节点运行时状态。
   * @param widgetLayer - 节点内部承载 Widget 的图层。
   * @param layoutItems - 节点布局模块计算出的 Widget 布局信息。
   * @returns 与节点 Widget 顺序对齐的 renderer 实例列表。
   */
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
        id: `widget-${node.id}-${index}`,
        name: `widget-${node.id}-${index}`,
        width,
        height,
        resizeChildren: false
      });
      // renderer 会在注册时统一归一化；这里直接拿正式 renderer 即可。
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
          const commitKey = this.createWidgetCommitKey(node.id, index);
          if (!this.widgetCommitBaselines.has(commitKey)) {
            this.widgetCommitBaselines.set(commitKey, {
              beforeValue: structuredClone(node.widgets[index]?.value),
              beforeWidgets: structuredClone(node.widgets)
            });
          }

          // Widget 不能直接写 graphNodes，而是统一走场景运行时的值回写入口。
          this.options.setNodeWidgetValue(node.id, index, newValue);
        },
        commitValue: (newValue) => {
          const commitKey = this.createWidgetCommitKey(node.id, index);
          const baseline =
            this.widgetCommitBaselines.get(commitKey) ?? {
              beforeValue: structuredClone(node.widgets[index]?.value),
              beforeWidgets: structuredClone(node.widgets)
            };

          this.widgetCommitBaselines.delete(commitKey);
          this.options.commitNodeWidgetValue(node.id, index, {
            newValue,
            beforeValue: structuredClone(baseline.beforeValue),
            beforeWidgets: structuredClone(baseline.beforeWidgets)
          });
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
      // 每个 Widget 各自维护独立 group，方便局部销毁和后续 update。
      widgetLayer.add(group);
    }

    return instances;
  }

  /**
   * 更新某个节点 widget 的值，并触发对应 renderer 的增量更新。
   *
   * @param node - 目标节点。
   * @param widgetIndex - Widget 索引。
   * @param newValue - 待写回的新值。
   * @param widgetInstances - 当前节点的 Widget renderer 实例列表。
   * @returns 是否成功更新。
   */
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

  /**
   * 销毁一个节点上已经挂载的全部 widget 实例。
   *
   * @remarks
   * destroy 顺序先走 renderer 生命周期，再清空 Widget 图层，
   * 避免某些 renderer 在 destroy 时还需要访问自己创建过的图元。
   *
   * @param widgetInstances - 当前节点的 Widget renderer 实例。
   * @param widgetLayer - 当前节点的 Widget 图层。
   *
   * @returns 无返回值。
   */
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

  /**
   * 提交 widget 值变更，触发正式交互提交。
   *
   * @remarks
   * 这个方法是场景桥接层要求的入口，它会转发给构造时注入的回调。
   *
   * @param nodeId - 目标节点 ID。
   * @param widgetIndex - Widget 索引。
   * @param commit - 提交信息，包含变更前后的值。
   *
   * @returns 无返回值。
   */
  commitNodeWidgetValue(
    nodeId: string,
    widgetIndex: number,
    commit: {
      newValue?: unknown;
      beforeValue: unknown;
      beforeWidgets: NodeRuntimeState["widgets"];
    }
  ): void {
    this.options.commitNodeWidgetValue(nodeId, widgetIndex, commit);
  }

  /**
   *  为节点 Widget 生成稳定提交键。
   *
   * @param nodeId - 目标节点 ID。
   * @param widgetIndex - Widget `Index`。
   * @returns 创建后的结果对象。
   */
  private createWidgetCommitKey(nodeId: string, widgetIndex: number): string {
    return `${nodeId}:${widgetIndex}`;
  }

  /**
   * 清理 Widget 宿主资源。
   *
   * @returns 无返回值。
   */
  dispose(): void {
    this.widgetCommitBaselines.clear();
  }
}

/**
 * 缺失 Widget 类型时的统一占位渲染。
 * 当前直接使用红色块级提示，避免未知类型静默消失导致用户误判数据已丢失。
 *
 * @returns 创建后的结果对象。
 */
export function createMissingWidgetRenderer(): LeaferGraphWidgetRenderer {
  return (context) => {
    // 缺失 Widget 时保留明确可见的红色占位，帮助调试“图数据存在但类型未注册”的场景。
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
