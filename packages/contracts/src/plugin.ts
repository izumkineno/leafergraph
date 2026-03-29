/**
 * 公共插件与 Widget 契约模块。
 *
 * @remarks
 * 负责定义插件上下文、Widget 渲染协议、主题上下文和宿主初始化选项。
 * 这些类型会被 `leafergraph`、`authoring` 以及未来其他宿主共同消费。
 */

import type {
  InstallNodeModuleOptions,
  GraphDocument,
  NodeDefinition,
  NodeModule,
  NodeRuntimeState,
  NodeWidgetSpec,
  RegisterNodeOptions,
  RegisterWidgetOptions,
  WidgetDefinition,
  NodeWidgetOptionItem
} from "@leafergraph/node";
import type { Group, Text } from "leafer-ui";

/** 主包当前支持的主题模式。 */
export type LeaferGraphThemeMode = "light" | "dark";

/** 连线传播动画预设。 */
export type LeaferGraphLinkPropagationAnimationPreset =
  | "performance"
  | "balanced"
  | "expressive";

/**
 * Widget 视觉 token。
 * 主包与外部自定义 renderer 都可以基于它在亮色 / 暗色模式间切换。
 *
 * @remarks
 * 这里约定的是“编辑器控件层”的视觉 token，而不是节点卡片整体样式。
 * 外部 Widget 如果想保持和内建控件一致的观感，优先复用这组 token。
 */
export interface LeaferGraphWidgetThemeTokens {
  fontFamily: string;
  labelFill: string;
  valueFill: string;
  mutedFill: string;
  disabledFill: string;
  fieldFill: string;
  fieldHoverFill: string;
  fieldFocusFill: string;
  fieldStroke: string;
  fieldHoverStroke: string;
  fieldFocusStroke: string;
  fieldDisabledFill: string;
  fieldDisabledStroke: string;
  fieldRadius: number;
  fieldShadow: string;
  focusRing: string;
  separatorFill: string;
  trackFill: string;
  trackActiveFill: string;
  thumbFill: string;
  thumbStroke: string;
  menuFill: string;
  menuStroke: string;
  menuShadow: string;
  menuTextFill: string;
  menuMutedFill: string;
  menuActiveFill: string;
  menuActiveTextFill: string;
  menuDangerFill: string;
  buttonPrimaryFill: string;
  buttonPrimaryHoverFill: string;
  buttonSecondaryFill: string;
  buttonSecondaryHoverFill: string;
  buttonGhostFill: string;
  buttonGhostHoverFill: string;
  buttonTextFill: string;
  buttonGhostTextFill: string;
  accentFallback: string;
}

/**
 * Widget 渲染时可读取的主题上下文。
 *
 * @remarks
 * `mode` 用来做亮暗分支判断，`tokens` 提供实际颜色、圆角和阴影等视觉值。
 */
export interface LeaferGraphWidgetThemeContext {
  mode: LeaferGraphThemeMode;
  tokens: LeaferGraphWidgetThemeTokens;
}

/**
 * 文本编辑浮层的几何信息。
 *
 * @remarks
 * 这组信息描述的是相对于 Widget 所在文本图元的编辑框尺寸与内边距，
 * 供编辑宿主把真实输入框准确对齐到 Leafer 场景中的字段区域。
 */
export interface LeaferGraphWidgetTextEditFrame {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
}

/**
 * 文本编辑请求。
 *
 * @remarks
 * `input` 和 `textarea` 等真实编辑型控件不会直接在 Widget 内部操作 DOM，
 * 而是通过这份请求对象把目标文本图元、初始值和提交回调交给统一编辑宿主处理。
 */
export interface LeaferGraphWidgetTextEditRequest {
  nodeId: string;
  widgetIndex: number;
  target: Text;
  frame?: LeaferGraphWidgetTextEditFrame;
  value: string;
  multiline?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  maxLength?: number;
  onCommit(value: string): void;
  onCancel?(value: string): void;
}

/**
 * 候选菜单请求。
 *
 * @remarks
 * `select` 一类离散选项控件通过这份请求打开轻量菜单，
 * 菜单的定位、关闭和键盘导航都由统一编辑宿主负责。
 */
export interface LeaferGraphWidgetOptionsMenuRequest {
  nodeId: string;
  widgetIndex: number;
  anchorClientX: number;
  anchorClientY: number;
  value?: string;
  options: NodeWidgetOptionItem[];
  onSelect(value: string): void;
  onClose?(): void;
}

/**
 * Widget 焦点与键盘转发绑定。
 *
 * @remarks
 * 某些控件并不会真的把 DOM focus 落到节点画布内部，
 * 因此需要一层显式的焦点登记，让键盘事件仍能精确分发到当前 Widget。
 */
export interface LeaferGraphWidgetFocusBinding {
  key: string;
  onFocusChange?(focused: boolean): void;
  onKeyDown?(event: KeyboardEvent): boolean;
}

/**
 * Widget 编辑宿主配置。
 *
 * @remarks
 * 这组配置决定主包是否启用真实文本编辑、是否桥接官方文本编辑器，
 * 以及是否允许离散选项控件打开浮层菜单。
 */
export interface LeaferGraphWidgetEditingOptions {
  enabled?: boolean;
  useOfficialTextEditor?: boolean;
  allowOptionsMenu?: boolean;
}

/**
 * Widget renderer 可消费的统一编辑能力入口。
 *
 * @remarks
 * 外部 Widget 不应该直接操作全局 DOM 或维护自己的编辑器单例，
 * 而是通过这套能力向主包请求文本编辑、选项菜单和焦点管理。
 */
export interface LeaferGraphWidgetEditingContext {
  enabled: boolean;
  beginTextEdit(request: LeaferGraphWidgetTextEditRequest): boolean;
  openOptionsMenu(request: LeaferGraphWidgetOptionsMenuRequest): boolean;
  closeActiveEditor(): void;
  registerFocusableWidget(binding: LeaferGraphWidgetFocusBinding): () => void;
  focusWidget(key: string): void;
  clearWidgetFocus(): void;
  isWidgetFocused(key: string): boolean;
}

/**
 * Widget 在节点内部的布局边界。
 * 宿主会把这块矩形区域交给 renderer 自己决定如何使用。
 *
 * @remarks
 * 这块边界已经过节点布局模块计算，renderer 不需要再重复推导节点内坐标系。
 */
export interface LeaferGraphWidgetBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Widget renderer 返回的最小生命周期实例。
 * 由宿主持有并在数值变化、节点销毁时主动调度。
 *
 * @remarks
 * `update` 和 `destroy` 都是可选的，适合只渲染静态图元的简单控件。
 */
export interface LeaferGraphWidgetRenderInstance {
  update?(newValue: unknown): void;
  destroy?(): void;
}

/**
 * 调用 Widget renderer 时传入的上下文。
 *
 * @remarks
 * 这是自定义 Widget 最核心的宿主上下文：
 * 既提供当前节点、当前 Widget、当前值和布局边界，
 * 也提供值回写、动作回抛、主题和编辑能力。
 */
export interface LeaferGraphWidgetRendererContext {
  /** Leafer UI 绘图库入口，供自定义 Widget 创建图元。 */
  ui: typeof import("leafer-ui");
  /** 当前 Widget 专属的挂载容器。 */
  group: Group;
  /** 当前 Widget 所属节点的运行时状态。 */
  node: NodeRuntimeState;
  /** 当前 Widget 的静态声明与运行时配置。 */
  widget: NodeWidgetSpec;
  /** 当前 Widget 的槽位索引。 */
  widgetIndex: number;
  /** Widget 当前值。 */
  value: unknown;
  /** Widget 在节点内部的布局边界。 */
  bounds: LeaferGraphWidgetBounds;
  /** Widget 当前可用的主题上下文。 */
  theme: LeaferGraphWidgetThemeContext;
  /** Widget 当前可用的编辑宿主能力。 */
  editing: LeaferGraphWidgetEditingContext;
  /**
   * 由 Widget 主动回写值到宿主。
   * 当前阶段它会直接更新运行时 `widget.value`，并触发对应 renderer 的 `update(...)`。
   */
  setValue(newValue: unknown): void;
  /**
   * 由 Widget 在“正式提交边界”回写值到宿主。
   *
   * @remarks
   * 这条入口和 `setValue(...)` 的区别是：
   * - `setValue(...)` 只负责本地预览态
   * - `commitValue(...)` 负责把最终值标记为一次正式文档改动
   *
   * 文本输入、离散开关和滑块拖拽结束等场景都应优先走这里，
   * 这样 editor 才能把最终值统一提交到 authority。
   */
  commitValue(newValue?: unknown): void;
  /**
   * 请求宿主刷新当前 Leafer 场景。
   * 适合 Widget 在内部更新了图元但仍希望宿主统一安排下一帧渲染时使用。
   */
  requestRender(): void;
  /**
   * 将动作事件抛回节点生命周期 `onAction(...)`。
   * 当前主要用于让 Widget 把交互语义交给节点定义自己处理。
   */
  emitAction(
    action: string,
    param?: unknown,
    options?: Record<string, unknown>
  ): boolean;
}

/**
 * Widget renderer 协议。
 * 首次执行负责 Mount，返回值负责后续 Update / Destroy。
 *
 * @remarks
 * 这是最直接的写法，适合小型控件或一次性渲染逻辑；
 * 复杂控件更推荐使用下方的生命周期对象协议。
 */
export interface LeaferGraphWidgetRenderer {
  (
    context: LeaferGraphWidgetRendererContext
  ): LeaferGraphWidgetRenderInstance | void;
}

/**
 * Widget 生命周期内部状态的最小约束。
 * 默认用 Record 表达，具体实现可在泛型中自定义。
 */
export type LeaferGraphWidgetLifecycleState = Record<string, unknown>;

/**
 * 通用 Widget 生命周期协议。
 * 用于把 mount / update / destroy 统一成可复用的结构。
 *
 * @remarks
 * 内建基础 Widget 和外部复杂控件都可以优先走这套协议，
 * 这样 mount/update/destroy 的调度语义会更稳定，也更利于模板化复用。
 */
export interface LeaferGraphWidgetLifecycle<
  TState = LeaferGraphWidgetLifecycleState
> {
  mount?(context: LeaferGraphWidgetRendererContext): TState | void;
  update?(
    state: TState | void,
    context: LeaferGraphWidgetRendererContext,
    newValue: unknown
  ): void;
  destroy?(
    state: TState | void,
    context: LeaferGraphWidgetRendererContext
  ): void;
}

/**
 * 允许外部使用“函数 renderer”或“生命周期对象”两种写法。
 * 宿主会在注册时统一转换成可调度的 renderer 形态。
 *
 * @remarks
 * 这是兼顾易用性和结构化的折中设计：
 * 简单控件可以直接给函数，复杂控件可以给生命周期对象。
 */
export type LeaferGraphWidgetRendererLike =
  | LeaferGraphWidgetRenderer
  | LeaferGraphWidgetLifecycle;

/**
 * 宿主正式注册的 Widget 条目。
 * 它把数据定义和 renderer 合并为同一份注册对象，避免定义与绘制分离后出现半注册状态。
 *
 * @remarks
 * 这也是当前 Widget 注册表的唯一正式输入形态。
 */
export interface LeaferGraphWidgetEntry extends WidgetDefinition {
  renderer: LeaferGraphWidgetRendererLike;
}

/**
 * 外部节点插件在安装阶段可使用的宿主上下文。
 *
 * @remarks
 * 插件上下文只暴露“节点模块安装、节点注册、Widget 注册和注册表查询”这几类能力，
 * 不向插件暴露更底层的场景树或交互宿主细节。
 */
export interface LeaferGraphNodePluginContext {
  sdk: typeof import("@leafergraph/node");
  ui: typeof import("leafer-ui");
  installModule: (module: NodeModule, options?: InstallNodeModuleOptions) => void;
  registerNode: (definition: NodeDefinition, options?: RegisterNodeOptions) => void;
  registerWidget: (
    entry: LeaferGraphWidgetEntry,
    options?: RegisterWidgetOptions
  ) => void;
  hasNode: (type: string) => boolean;
  hasWidget: (type: string) => boolean;
  getWidget: (type: string) => LeaferGraphWidgetEntry | undefined;
  listWidgets: () => LeaferGraphWidgetEntry[];
  getNode: (type: string) => NodeDefinition | undefined;
  listNodes: () => NodeDefinition[];
}

/**
 * 外部节点插件对象。
 *
 * @remarks
 * 宿主会在初始化阶段按顺序调用 `install(...)`，
 * 插件可以同步返回，也可以返回 Promise 完成异步安装。
 */
export interface LeaferGraphNodePlugin {
  name: string;
  version?: string;
  install(context: LeaferGraphNodePluginContext): void | Promise<void>;
}

/**
 * 宿主初始化配置。
 * 这里显式只保留正式宿主入口，不再透传 demo 专用 `nodes` 初始化字段。
 *
 * @remarks
 * editor、模板工程和外部调用方都应该通过这份配置进入宿主，
 * 其中 `document` 是正式图输入，`modules/plugins` 负责扩展节点和 Widget 生态。
 */
export interface LeaferGraphOptions {
  fill?: string;
  document?: GraphDocument;
  modules?: NodeModule[];
  plugins?: LeaferGraphNodePlugin[];
  themeMode?: LeaferGraphThemeMode;
  widgetEditing?: LeaferGraphWidgetEditingOptions;
  linkPropagationAnimation?: LeaferGraphLinkPropagationAnimationPreset | false;
}
