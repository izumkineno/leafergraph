import type {
  LeaferGraphNodePlugin,
  LeaferGraphWidgetEntry,
  LeaferGraphWidgetLifecycle,
  LeaferGraphWidgetLifecycleState,
  LeaferGraphWidgetRendererContext,
  LeaferGraphOptions
} from "leafergraph";
import {
  bindPressWidgetInteraction,
  createWidgetHitArea,
  createWidgetLabel,
  createWidgetSurface,
  createWidgetValueText
} from "leafergraph";

/**
 * editor 用来模拟“外部插件包”的 Widget 类型。
 * 命名上显式带上 external，方便和内建基础组件区分。
 */
export const EDITOR_EXTERNAL_WIDGET_TYPE = "demo/external-status";

/**
 * editor 用来模拟“外部插件包”的节点类型。
 * 该节点完全由插件注册，不进入 editor 的本地模块列表。
 */
export const EDITOR_EXTERNAL_WIDGET_NODE_TYPE = "demo/external-widget-node";

/**
 * 外部 Widget 候选项。
 * 这里额外带上颜色字段，强调“外部 Widget 可以有自己的一套 options 协议”。
 */
interface ExternalStatusOption {
  label: string;
  value: string;
  fill: string;
  textFill: string;
}

/**
 * 外部 Widget 生命周期内部状态。
 * 当前只维护最小图元与交互解绑句柄，便于演示完整的挂载与销毁协议。
 */
interface ExternalStatusWidgetState extends LeaferGraphWidgetLifecycleState {
  label: ReturnType<typeof createWidgetLabel>;
  surface: ReturnType<typeof createWidgetSurface>;
  valueText: ReturnType<typeof createWidgetValueText>;
  hintText: InstanceType<typeof import("leafer-ui").Text>;
  hitArea: ReturnType<typeof createWidgetHitArea>;
  options: ExternalStatusOption[];
  cleanup: { destroy(): void } | null;
}

/**
 * 默认候选项。
 * 外部包可以完全自定义自己的视觉语义；这里用三档状态演示即可。
 */
const DEFAULT_EXTERNAL_STATUS_OPTIONS: readonly ExternalStatusOption[] = [
  {
    label: "Idle",
    value: "idle",
    fill: "#64748B",
    textFill: "#F8FAFC"
  },
  {
    label: "Live",
    value: "live",
    fill: "#0F766E",
    textFill: "#ECFDF5"
  },
  {
    label: "Alert",
    value: "alert",
    fill: "#BE123C",
    textFill: "#FFF1F2"
  }
] as const;

/**
 * 解析外部 Widget 的候选项。
 * 如果用户没有提供自定义 items，就回退到内置三档状态。
 */
function resolveExternalStatusOptions(
  widget: Pick<LeaferGraphWidgetRendererContext["widget"], "options">
): ExternalStatusOption[] {
  const items = widget.options?.items;

  if (!Array.isArray(items) || items.length === 0) {
    return [...DEFAULT_EXTERNAL_STATUS_OPTIONS];
  }

  const resolved = items
    .map((item) => {
      if (typeof item !== "object" || !item) {
        return null;
      }

      const value = typeof item.value === "string" ? item.value.trim() : "";
      const label = typeof item.label === "string" ? item.label.trim() : value;
      const fill = typeof item.fill === "string" ? item.fill.trim() : "";
      const textFill =
        typeof item.textFill === "string" ? item.textFill.trim() : "#F8FAFC";

      if (!value || !label || !fill) {
        return null;
      }

      return {
        label,
        value,
        fill,
        textFill
      } satisfies ExternalStatusOption;
    })
    .filter((item): item is ExternalStatusOption => Boolean(item));

  return resolved.length > 0 ? resolved : [...DEFAULT_EXTERNAL_STATUS_OPTIONS];
}

/** 根据当前值解析有效候选项；非法值会回退到第一项。 */
function resolveExternalStatusOption(
  value: unknown,
  widget: Pick<LeaferGraphWidgetRendererContext["widget"], "options">
): ExternalStatusOption {
  const options = resolveExternalStatusOptions(widget);
  const safeValue = typeof value === "string" ? value.trim() : "";
  return options.find((item) => item.value === safeValue) ?? options[0];
}

/** 计算下一个状态值，用于点击后轮换。 */
function resolveNextExternalStatusValue(
  value: unknown,
  options: readonly ExternalStatusOption[]
): string {
  if (options.length === 0) {
    return "";
  }

  const currentValue = typeof value === "string" ? value.trim() : "";
  const currentIndex = options.findIndex((item) => item.value === currentValue);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % options.length : 0;
  return options[nextIndex].value;
}

/** 同步一次外部 Widget 的视觉状态。 */
function syncExternalStatusWidgetState(
  state: ExternalStatusWidgetState,
  context: LeaferGraphWidgetRendererContext,
  value: unknown
): void {
  const option = resolveExternalStatusOption(value, context.widget);
  const tokens = context.theme.tokens;
  const description =
    typeof context.widget.options?.description === "string"
      ? context.widget.options.description
      : "点击切换状态";

  state.label.text =
    typeof context.widget.options?.label === "string" && context.widget.options.label.trim()
      ? context.widget.options.label
      : "External Widget";
  state.label.fill = tokens.labelFill;
  state.label.fontFamily = tokens.fontFamily;

  state.surface.fill = option.fill;
  state.surface.stroke = tokens.fieldStroke;
  state.surface.shadow = tokens.fieldShadow;
  state.surface.hoverStyle = {
    fill: option.fill,
    stroke: tokens.fieldHoverStroke
  };
  state.surface.pressStyle = {
    fill: option.fill,
    stroke: tokens.fieldFocusStroke
  };

  state.valueText.text = option.label;
  state.valueText.fill = option.textFill;
  state.valueText.fontFamily = tokens.fontFamily;

  state.hintText.text = description;
  state.hintText.fill = tokens.mutedFill;
  state.hintText.fontFamily = tokens.fontFamily;
}

/**
 * 外部 Widget 生命周期。
 * 这里刻意使用 lifecycle 对象写法，演示外部包不需要自己管理 renderer 归一化。
 */
const externalStatusWidgetLifecycle: LeaferGraphWidgetLifecycle<ExternalStatusWidgetState> = {
  mount(context) {
    const { ui, bounds } = context;
    const label = createWidgetLabel(ui, {
      x: 0,
      y: 0,
      width: bounds.width,
      text: "External Widget",
      fill: context.theme.tokens.labelFill,
      fontFamily: context.theme.tokens.fontFamily,
      fontSize: 11,
      fontWeight: "600"
    });
    const surface = createWidgetSurface(ui, {
      x: 0,
      y: 18,
      width: bounds.width,
      height: 24,
      fill: context.theme.tokens.fieldFill,
      stroke: context.theme.tokens.fieldStroke,
      strokeWidth: 1,
      cornerRadius: 12,
      cursor: "pointer",
      hittable: false
    });
    const valueText = createWidgetValueText(ui, {
      x: 0,
      y: 23,
      width: bounds.width,
      text: "",
      textAlign: "center",
      fill: context.theme.tokens.valueFill,
      fontFamily: context.theme.tokens.fontFamily,
      fontSize: 12,
      fontWeight: "700"
    });
    const hintText = new ui.Text({
      x: 0,
      y: 46,
      width: bounds.width,
      text: "点击切换状态",
      textAlign: "left",
      fill: context.theme.tokens.mutedFill,
      fontFamily: context.theme.tokens.fontFamily,
      fontSize: 10,
      hittable: false
    });
    const hitArea = createWidgetHitArea(ui, {
      x: 0,
      y: 18,
      width: bounds.width,
      height: 24,
      cursor: "pointer",
      cornerRadius: 12
    });

    const state: ExternalStatusWidgetState = {
      label,
      surface,
      valueText,
      hintText,
      hitArea,
      options: resolveExternalStatusOptions(context.widget),
      cleanup: null
    };

    state.cleanup = bindPressWidgetInteraction({
      hitArea,
      onPress() {
        context.setValue(
          resolveNextExternalStatusValue(context.value, state.options)
        );
      }
    });

    context.group.add([label, surface, valueText, hintText, hitArea]);
    syncExternalStatusWidgetState(state, context, context.value);
    return state;
  },
  update(state, context, newValue) {
    if (!state) {
      return;
    }

    state.options = resolveExternalStatusOptions(context.widget);
    syncExternalStatusWidgetState(state, context, newValue);
  },
  destroy(state) {
    state?.cleanup?.destroy();
  }
};

/**
 * 外部 Widget 条目。
 * 它和未来真正发布的外部包一样，必须一次性带上 normalize / serialize / renderer。
 */
export const editorExternalStatusWidget: LeaferGraphWidgetEntry = {
  type: EDITOR_EXTERNAL_WIDGET_TYPE,
  title: "External Status",
  description: "editor 内置的外部 widget 注册示例",
  normalize(value, spec) {
    return resolveExternalStatusOption(value, spec ?? {}).value;
  },
  serialize(value, spec) {
    return resolveExternalStatusOption(value, spec ?? {}).value;
  },
  renderer: externalStatusWidgetLifecycle
};

/**
 * editor 用来模拟“外部包安装”的插件。
 * 当前同时注册一个外部 Widget 和一个使用该 Widget 的节点类型。
 */
export const editorExternalWidgetDemoPlugin: LeaferGraphNodePlugin = {
  name: "@editor/demo-external-widget",
  version: "0.1.0",
  install(ctx) {
    ctx.registerWidget(editorExternalStatusWidget, { overwrite: true });
    ctx.registerNode(
      {
        type: EDITOR_EXTERNAL_WIDGET_NODE_TYPE,
        title: "External Widget",
        category: "Plugin / External",
        size: [288, 212],
        resize: {
          enabled: true,
          minWidth: 288,
          minHeight: 212,
          snap: 4
        },
        properties: [
          { name: "subtitle", type: "string" },
          { name: "category", type: "string" },
          { name: "status", type: "string", default: "PLUGIN" }
        ],
        inputs: [{ name: "Signal", type: "event" }],
        outputs: [{ name: "State", type: "string" }],
        widgets: [
          {
            type: EDITOR_EXTERNAL_WIDGET_TYPE,
            name: "external-status",
            value: "live",
            options: {
              label: "Package Status",
              description: "来自 editor 模拟外部插件包"
            }
          }
        ]
      },
      { overwrite: true }
    );
  }
};

/** editor 默认注入的“外部插件”列表。 */
export const editorDemoPlugins = [
  editorExternalWidgetDemoPlugin
] satisfies NonNullable<LeaferGraphOptions["plugins"]>;
