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
} from "@leafergraph/core/node";
import type {
  LeaferGraphThemeMode,
  LeaferGraphThemePresetId,
  LeaferGraphWidgetThemeContext
} from "@leafergraph/core/theme";
import type {
  LeaferGraphConfig
} from "@leafergraph/core/config";
import type { Group, Text } from "leafer-ui";

/**
 * 文本编辑浮层的几何信息。
 *
 * @remarks
 * 这组信息描述的是相对于 Widget 所在文本图元的编辑框尺寸与内边距，
 * 供编辑宿主把真实输入框准确对齐到 Leafer 场景中的字段区域。
 */
export interface LeaferGraphWidgetTextEditFrame {
  /** 编辑框相对目标文本图元的横向偏移。 */
  offsetX: number;
  /** 编辑框相对目标文本图元的纵向偏移。 */
  offsetY: number;
  /** 编辑框宽度。 */
  width: number;
  /** 编辑框高度。 */
  height: number;
  /** 编辑框上内边距。 */
  paddingTop?: number;
  /** 编辑框右内边距。 */
  paddingRight?: number;
  /** 编辑框下内边距。 */
  paddingBottom?: number;
  /** 编辑框左内边距。 */
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
  /** 当前请求所属节点 ID。 */
  nodeId: string;
  /** 当前请求所属 Widget 索引。 */
  widgetIndex: number;
  /** 需要对齐的目标文本图元。 */
  target: Text;
  /** 可选的编辑框几何信息。 */
  frame?: LeaferGraphWidgetTextEditFrame;
  /** 打开编辑器时的初始文本值。 */
  value: string;
  /** 是否启用多行编辑。 */
  multiline?: boolean;
  /** 输入为空时的占位文案。 */
  placeholder?: string;
  /** 是否只读。 */
  readOnly?: boolean;
  /** 允许输入的最大字符数。 */
  maxLength?: number;
  /** 用户确认提交时的回调。 */
  onCommit(value: string): void;
  /** 用户取消编辑时的回调。 */
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
  /** 当前请求所属节点 ID。 */
  nodeId: string;
  /** 当前请求所属 Widget 索引。 */
  widgetIndex: number;
  /** 菜单锚点的客户端横坐标。 */
  anchorClientX: number;
  /** 菜单锚点的客户端纵坐标。 */
  anchorClientY: number;
  /** 当前已选值。 */
  value?: string;
  /** 可供选择的离散选项列表。 */
  options: NodeWidgetOptionItem[];
  /** 用户选择某个值时的回调。 */
  onSelect(value: string): void;
  /** 菜单关闭时的回调。 */
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
  /** Widget 焦点注册键。 */
  key: string;
  /** 焦点变化回调。 */
  onFocusChange?(focused: boolean): void;
  /** 键盘按下时的处理回调；返回 `true` 表示已消费。 */
  onKeyDown?(event: KeyboardEvent): boolean;
}

/**
 * Widget renderer 可消费的统一编辑能力入口。
 *
 * @remarks
 * 外部 Widget 不应该直接操作全局 DOM 或维护自己的编辑器单例，
 * 而是通过这套能力向主包请求文本编辑、选项菜单和焦点管理。
 */
export interface LeaferGraphWidgetEditingContext {
  /** 当前宿主是否允许 Widget 进入编辑态。 */
  enabled: boolean;
  /** 请求打开文本编辑器。 */
  beginTextEdit(request: LeaferGraphWidgetTextEditRequest): boolean;
  /** 请求打开离散选项菜单。 */
  openOptionsMenu(request: LeaferGraphWidgetOptionsMenuRequest): boolean;
  /** 关闭当前激活的编辑器。 */
  closeActiveEditor(): void;
  /** 注册一个可聚焦 Widget，并返回解绑函数。 */
  registerFocusableWidget(binding: LeaferGraphWidgetFocusBinding): () => void;
  /** 将焦点切换到指定 Widget。 */
  focusWidget(key: string): void;
  /** 清空当前 Widget 焦点。 */
  clearWidgetFocus(): void;
  /** 判断某个 Widget 当前是否持有焦点。 */
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
  /** 左上角横坐标。 */
  x: number;
  /** 左上角纵坐标。 */
  y: number;
  /** 边界宽度。 */
  width: number;
  /** 边界高度。 */
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
  /** 当宿主希望以新值刷新当前 Widget 时调用。 */
  update?(newValue: unknown): void;
  /** 当宿主销毁当前 Widget 时调用。 */
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
  /** 首次挂载时创建状态或图元。 */
  mount?(context: LeaferGraphWidgetRendererContext): TState | void;
  /** 值变化或宿主强制刷新时更新状态。 */
  update?(
    state: TState | void,
    context: LeaferGraphWidgetRendererContext,
    newValue: unknown
  ): void;
  /** Widget 卸载前做清理。 */
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
  /** Widget 对应的 renderer 或生命周期实现。 */
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
  /** 节点模型层 SDK 入口。 */
  sdk: typeof import("@leafergraph/core/node");
  /** Leafer UI 命名空间入口。 */
  ui: typeof import("leafer-ui");
  /** 安装一个节点模块。 */
  installModule: (module: NodeModule, options?: InstallNodeModuleOptions) => void;
  /** 注册单个节点定义。 */
  registerNode: (definition: NodeDefinition, options?: RegisterNodeOptions) => void;
  /** 注册单个 Widget 条目。 */
  registerWidget: (
    entry: LeaferGraphWidgetEntry,
    options?: RegisterWidgetOptions
  ) => void;
  /** 判断某个节点类型是否已注册。 */
  hasNode: (type: string) => boolean;
  /** 判断某个 Widget 类型是否已注册。 */
  hasWidget: (type: string) => boolean;
  /** 获取某个 Widget 注册条目。 */
  getWidget: (type: string) => LeaferGraphWidgetEntry | undefined;
  /** 列出当前全部 Widget 条目。 */
  listWidgets: () => LeaferGraphWidgetEntry[];
  /** 获取某个节点定义。 */
  getNode: (type: string) => NodeDefinition | undefined;
  /** 列出当前全部节点定义。 */
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
  /** 插件名称。 */
  name: string;
  /** 可选插件版本号。 */
  version?: string;
  /** 宿主安装插件时调用的入口。 */
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
  /** 初始化时加载的正式图文档。 */
  document?: GraphDocument;
  /** 需要先于插件安装的节点模块列表。 */
  modules?: NodeModule[];
  /** 宿主初始化时需要安装的插件列表。 */
  plugins?: LeaferGraphNodePlugin[];
  /** 主题预设 ID。 */
  themePreset?: LeaferGraphThemePresetId;
  /** 初始主题模式。 */
  themeMode?: LeaferGraphThemeMode;
  /** 图编辑器配置集合。 */
  config?: LeaferGraphConfig;
}
