import type {
  InstallNodeModuleOptions,
  LeaferGraphData,
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

/**
 * Widget 视觉 token。
 * 主包与外部自定义 renderer 都可以基于它在亮色 / 暗色模式间切换。
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

/** Widget 渲染时可读取的主题上下文。 */
export interface LeaferGraphWidgetThemeContext {
  mode: LeaferGraphThemeMode;
  tokens: LeaferGraphWidgetThemeTokens;
}

/** 文本编辑请求。 */
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

/** 文本编辑请求。 */
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

/** 候选菜单请求。 */
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

/** Widget 焦点与键盘转发绑定。 */
export interface LeaferGraphWidgetFocusBinding {
  key: string;
  onFocusChange?(focused: boolean): void;
  onKeyDown?(event: KeyboardEvent): boolean;
}

/** Widget 编辑宿主配置。 */
export interface LeaferGraphWidgetEditingOptions {
  enabled?: boolean;
  useOfficialTextEditor?: boolean;
  allowOptionsMenu?: boolean;
}

/** Widget renderer 可消费的统一编辑能力入口。 */
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
 * 主包会把这块矩形区域交给 renderer 自己决定如何使用。
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
 */
export interface LeaferGraphWidgetRenderInstance {
  update?(newValue: unknown): void;
  destroy?(): void;
}

/**
 * 调用 Widget renderer 时传入的上下文。
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
 * 主包会在注册时统一转换成可调度的 renderer 形态。
 */
export type LeaferGraphWidgetRendererLike =
  | LeaferGraphWidgetRenderer
  | LeaferGraphWidgetLifecycle;

/**
 * 主包正式注册的 Widget 条目。
 * 它把数据定义和 renderer 合并为同一份注册对象，避免定义与绘制分离后出现半注册状态。
 */
export interface LeaferGraphWidgetEntry extends WidgetDefinition {
  renderer: LeaferGraphWidgetRendererLike;
}

/**
 * 外部节点插件在安装阶段可使用的宿主上下文。
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
 */
export interface LeaferGraphNodePlugin {
  name: string;
  version?: string;
  install(context: LeaferGraphNodePluginContext): void | Promise<void>;
}

/**
 * 主包初始化配置。
 * 这里显式只保留正式宿主入口，不再透传 demo 专用 `nodes` 初始化字段。
 */
export interface LeaferGraphOptions {
  fill?: string;
  graph?: LeaferGraphData;
  modules?: NodeModule[];
  plugins?: LeaferGraphNodePlugin[];
  themeMode?: LeaferGraphThemeMode;
  widgetEditing?: LeaferGraphWidgetEditingOptions;
}
