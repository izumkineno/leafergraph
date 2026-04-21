/**
 * Widget 作者层桥接。
 *
 * 这个模块负责把 Widget 作者类转换成主包可注册的 `LeaferGraphWidgetEntry`，
 * 并把宿主提供的渲染上下文投影成更稳定的作者层接口。
 */

import type { NodeRuntimeState, NodeWidgetSpec } from "@leafergraph/core/node";
import type {
  LeaferGraphWidgetBounds,
  LeaferGraphWidgetEditingContext,
  LeaferGraphWidgetEntry,
  LeaferGraphWidgetLifecycle,
  LeaferGraphWidgetRendererContext
} from "@leafergraph/core/contracts";
import type { LeaferGraphWidgetThemeContext } from "@leafergraph/theme";
import type { Group } from "leafer-ui";

import {
  assertNonEmptyText,
  type WidgetState
} from "./shared.js";

/**
 * Widget 作者类静态 `meta` 的描述结构。
 * 它描述的是某类 Widget 的静态能力，而不是某次渲染时的运行时值。
 */
export interface DevWidgetMeta {
  /** Widget 类型标识。 */
  type: string;
  /** Widget 标题。 */
  title?: string;
  /** Widget 描述。 */
  description?: string;
  /** 运行时值归一化钩子。 */
  normalize?(value: unknown, spec?: NodeWidgetSpec): unknown;
  /** 持久化前的值序列化钩子。 */
  serialize?(value: unknown, spec?: NodeWidgetSpec): unknown;
}

/**
 * Widget 作者层上下文。
 * 它把宿主原始渲染上下文包装成更适合作者类直接消费的接口。
 */
export interface DevWidgetContext<TValue = unknown> {
  /** 宿主提供的原始渲染上下文。 */
  raw: LeaferGraphWidgetRendererContext;
  /** `leafer-ui` 命名空间，方便作者层按需创建图元。 */
  ui: typeof import("leafer-ui");
  /** 当前 Widget 的宿主容器组。 */
  group: Group;
  /** 当前所属节点实例。 */
  node: NodeRuntimeState;
  /** 当前 Widget 声明。 */
  widget: NodeWidgetSpec;
  /** 当前 Widget 在节点内的索引。 */
  widgetIndex: number;
  /** 当前归一化后的值。 */
  value: TValue;
  /** 当前 Widget 可用布局边界。 */
  bounds: LeaferGraphWidgetBounds;
  /** 当前宿主主题上下文。 */
  theme: LeaferGraphWidgetThemeContext;
  /** 当前编辑态上下文。 */
  editing: LeaferGraphWidgetEditingContext;
  /** 只更新本地值，不立即提交。 */
  setValue(nextValue: TValue): void;
  /** 提交值变更，可选同时传入下一值。 */
  commitValue(nextValue?: TValue): void;
  /** 请求宿主重新渲染当前 Widget。 */
  requestRender(): void;
  /** 向宿主发送动作消息。 */
  emitAction(action: string, param?: unknown, options?: Record<string, unknown>): boolean;
}

/**
 * Widget 作者类基类。
 * 外部开发者通过继承它，声明一个 Widget 在挂载、更新、销毁阶段的行为。
 */
export abstract class BaseWidget<
  TValue = unknown,
  TState extends WidgetState = WidgetState
> {
  /** Widget 静态元信息。 */
  static meta: DevWidgetMeta;

  /**
   *  首次挂载时触发，可返回作者层私有状态。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  mount?(ctx: DevWidgetContext<TValue>): TState | void;
  /**
   *  值变化或宿主刷新时触发。
   *
   * @param state - 当前状态。
   * @param ctx - `ctx`。
   * @param nextValue - 当前值。
   * @returns 无返回值。
   */
  update?(state: TState | void, ctx: DevWidgetContext<TValue>, nextValue: TValue): void;
  /**
   *  Widget 被卸载前触发。
   *
   * @param state - 当前状态。
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  destroy?(state: TState | void, ctx: DevWidgetContext<TValue>): void;
}

/**
 * Widget 作者类构造器类型。
 * 约束作者类必须可实例化，且带静态 `meta`。
 */
export interface DevWidgetClass<
  TValue = unknown,
  TState extends WidgetState = WidgetState
> {
  new (): BaseWidget<TValue, TState>;
  readonly meta: DevWidgetMeta;
}

/**
 * Widget 运行时记录。
 * 它保存作者类实例与作者层私有状态，供 mount / update / destroy 复用。
 */
interface AuthoringWidgetRuntime<
  TValue = unknown,
  TState extends WidgetState = WidgetState
> extends WidgetState {
  instance: BaseWidget<TValue, TState>;
  state: TState | void;
}

/**
 * 把 Widget 作者类转换成正式 `LeaferGraphWidgetEntry`。
 * 转换完成后，宿主只需要按标准 Widget 注册协议消费。
 *
 * @param WidgetCtor - Widget `Ctor`。
 * @returns 定义`Authoring` Widget的结果。
 */
export function defineAuthoringWidget<
  TValue = unknown,
  TState extends WidgetState = WidgetState
>(WidgetCtor: DevWidgetClass<TValue, TState>): LeaferGraphWidgetEntry {
  const meta = normalizeWidgetMeta(WidgetCtor.meta);
  const renderer: LeaferGraphWidgetLifecycle<
    AuthoringWidgetRuntime<TValue, TState>
  > = {
    mount(context: LeaferGraphWidgetRendererContext) {
      const instance = new WidgetCtor();
      const runtime = {
        instance,
        state: instance.mount?.(createWidgetContext<TValue>(context))
      };

      return runtime;
    },
    update(runtime, context: LeaferGraphWidgetRendererContext, newValue: unknown) {
      runtime?.instance.update?.(
        runtime.state,
        createWidgetContext<TValue>(context, newValue),
        newValue as TValue
      );
    },
    destroy(runtime, context: LeaferGraphWidgetRendererContext) {
      runtime?.instance.destroy?.(
        runtime.state,
        createWidgetContext<TValue>(context)
      );
    }
  };

  return {
    type: meta.type,
    title: meta.title,
    description: meta.description,
    normalize: meta.normalize,
    serialize: meta.serialize,
    renderer
  };
}

/**
 *  规范化 Widget 元信息。
 *
 * @param meta - `meta`。
 * @returns 处理后的结果。
 */
function normalizeWidgetMeta(meta: DevWidgetMeta): DevWidgetMeta {
  return {
    type: assertNonEmptyText(meta.type, "Widget 类型"),
    title: meta.title?.trim() || undefined,
    description: meta.description?.trim() || undefined,
    normalize: meta.normalize,
    serialize: meta.serialize
  };
}

/**
 * 把宿主原始渲染上下文转换成作者层上下文。
 * 它的职责是稳定字段命名，并屏蔽宿主原始接口的细节变化。
 *
 * @param raw - `raw`。
 * @param nextValue - 当前值。
 * @returns 创建后的结果对象。
 */
function createWidgetContext<TValue>(
  raw: LeaferGraphWidgetRendererContext,
  nextValue?: unknown
): DevWidgetContext<TValue> {
  const value = (nextValue ?? raw.value) as TValue;

  return {
    raw,
    ui: raw.ui,
    group: raw.group,
    node: raw.node,
    widget: raw.widget,
    widgetIndex: raw.widgetIndex,
    value,
    bounds: raw.bounds,
    theme: raw.theme,
    editing: raw.editing,
    setValue(nextValue) {
      raw.setValue(nextValue);
    },
    commitValue(nextValue) {
      raw.commitValue(nextValue);
    },
    requestRender() {
      raw.requestRender();
    },
    emitAction(action, param, options) {
      return raw.emitAction(action, param, options);
    }
  };
}
