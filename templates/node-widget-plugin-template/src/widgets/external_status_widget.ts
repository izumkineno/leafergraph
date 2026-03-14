import type { Text } from "leafer-ui";
import type {
  LeaferGraphWidgetEntry,
  LeaferGraphWidgetLifecycle,
  LeaferGraphWidgetLifecycleState,
  LeaferGraphWidgetRendererContext
} from "leafergraph";
import {
  bindPressWidgetInteraction,
  createWidgetHitArea,
  createWidgetLabel,
  createWidgetSurface,
  createWidgetValueText
} from "leafergraph";

import { TEMPLATE_EXTERNAL_STATUS_WIDGET_TYPE } from "../shared";

/**
 * 模板外部 widget 的单个候选项。
 *
 * 这里额外保留颜色字段，是为了告诉插件作者：
 * 外部 widget 完全可以定义属于自己的 options 协议，
 * 不需要被主包内建 widget 的 options 结构限制住。
 */
interface TemplateExternalStatusOption {
  label: string;
  value: string;
  fill: string;
  textFill: string;
}

/**
 * Widget 生命周期运行时状态。
 *
 * 主包在 mount 时会拿到这一份对象，
 * 后续 update / destroy 都会继续把它传回来。
 */
interface TemplateExternalStatusWidgetState
  extends LeaferGraphWidgetLifecycleState {
  label: ReturnType<typeof createWidgetLabel>;
  surface: ReturnType<typeof createWidgetSurface>;
  valueText: ReturnType<typeof createWidgetValueText>;
  hintText: Text;
  hitArea: ReturnType<typeof createWidgetHitArea>;
  options: TemplateExternalStatusOption[];
  cleanup: { destroy(): void } | null;
}

/** 默认状态选项。 */
const DEFAULT_TEMPLATE_EXTERNAL_STATUS_OPTIONS: readonly TemplateExternalStatusOption[] =
  [
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
 * 把 widget.options.items 归一化成统一候选项。
 *
 * 这么做的原因是：
 * - 插件作者可能直接写字符串
 * - 也可能写完整对象
 * - 生命周期内部不应该重复到处处理脏数据
 */
function resolveTemplateExternalStatusOptions(
  widget: Pick<LeaferGraphWidgetRendererContext["widget"], "options">
): TemplateExternalStatusOption[] {
  const items = widget.options?.items;

  if (!Array.isArray(items) || items.length === 0) {
    return [...DEFAULT_TEMPLATE_EXTERNAL_STATUS_OPTIONS];
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
      } satisfies TemplateExternalStatusOption;
    })
    .filter(
      (item): item is TemplateExternalStatusOption => Boolean(item)
    );

  return resolved.length > 0
    ? resolved
    : [...DEFAULT_TEMPLATE_EXTERNAL_STATUS_OPTIONS];
}

/** 根据当前值获取一个有效选项；非法值会自动回退到首项。 */
function resolveTemplateExternalStatusOption(
  value: unknown,
  widget: Pick<LeaferGraphWidgetRendererContext["widget"], "options">
): TemplateExternalStatusOption {
  const options = resolveTemplateExternalStatusOptions(widget);
  const safeValue = typeof value === "string" ? value.trim() : "";
  return options.find((item) => item.value === safeValue) ?? options[0];
}

/** 用于点击后切换到下一个状态。 */
function resolveNextTemplateExternalStatusValue(
  value: unknown,
  options: readonly TemplateExternalStatusOption[]
): string {
  if (options.length === 0) {
    return "";
  }

  const currentValue = typeof value === "string" ? value.trim() : "";
  const currentIndex = options.findIndex((item) => item.value === currentValue);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % options.length : 0;
  return options[nextIndex].value;
}

/** 把最新值同步到现有图元上，避免 update 阶段重复创建 UI。 */
function syncTemplateExternalStatusWidgetState(
  state: TemplateExternalStatusWidgetState,
  context: LeaferGraphWidgetRendererContext,
  value: unknown
): void {
  const option = resolveTemplateExternalStatusOption(value, context.widget);
  const tokens = context.theme.tokens;
  const description =
    typeof context.widget.options?.description === "string"
      ? context.widget.options.description
      : "点击切换状态";

  state.label.text =
    typeof context.widget.options?.label === "string" &&
    context.widget.options.label.trim()
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
 * 这是推荐给外部插件作者的 widget 实现方式：
 * - 用生命周期对象表达 mount / update / destroy
 * - 让主包统一负责调度和清理
 * - 自己只关心图元和交互逻辑
 */
const templateExternalStatusWidgetLifecycle: LeaferGraphWidgetLifecycle<TemplateExternalStatusWidgetState> =
  {
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

      const state: TemplateExternalStatusWidgetState = {
        label,
        surface,
        valueText,
        hintText,
        hitArea,
        options: resolveTemplateExternalStatusOptions(context.widget),
        cleanup: null
      };

      state.cleanup = bindPressWidgetInteraction({
        hitArea,
        onPress() {
          context.setValue(
            resolveNextTemplateExternalStatusValue(context.value, state.options)
          );
        }
      });

      context.group.add([label, surface, valueText, hintText, hitArea]);
      syncTemplateExternalStatusWidgetState(state, context, context.value);
      return state;
    },

    update(state, context, newValue) {
      if (!state) {
        return;
      }

      state.options = resolveTemplateExternalStatusOptions(context.widget);
      syncTemplateExternalStatusWidgetState(state, context, newValue);
    },

    destroy(state) {
      state?.cleanup?.destroy();
    }
  };

/**
 * 模板导出的完整 widget 条目。
 *
 * 它演示的是当前主包推荐路径：
 * - 一个条目里同时包含 normalize / serialize / renderer
 * - 插件安装时只需要 `ctx.registerWidget(entry)`
 */
export const templateExternalStatusWidget: LeaferGraphWidgetEntry = {
  type: TEMPLATE_EXTERNAL_STATUS_WIDGET_TYPE,
  title: "External Status",
  description: "模板工程里的外部 widget 示例",
  normalize(value, spec) {
    return resolveTemplateExternalStatusOption(value, spec ?? {}).value;
  },
  serialize(value, spec) {
    return resolveTemplateExternalStatusOption(value, spec ?? {}).value;
  },
  renderer: templateExternalStatusWidgetLifecycle
};
