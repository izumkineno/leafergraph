/**
 * `@leafergraph/core/node` 的基础类型模型。
 *
 * 这里定义节点、槽位、Widget、属性和运行时状态的最小正式结构，
 * 供模型层、作者层和宿主运行时共同复用。
 */

/**
 * 描述槽位方向。
 * 这组值会被连接事件、端口布局和连接变化回调共同复用。
 */
export type SlotDirection = "input" | "output";

/**
 * 槽位数据类型。
 * `0` 沿用 LiteGraph 的“通用类型”语义，表示宿主不强制做类型校验。
 */
export type SlotType = string | 0;

/**
 * 槽位的视觉形状提示。
 * 这里只是声明意图，不要求宿主一定完全按该提示渲染。
 */
export type NodeSlotShape = "circle" | "box" | "arrow" | "grid";

/**
 * Widget 类型。
 * 内建类型覆盖当前 demo 与宿主默认能力，自定义字符串用于外部插件扩展。
 */
export type NodeWidgetType =
  | "number"
  | "string"
  | "toggle"
  | "slider"
  | "input"
  | "textarea"
  | "select"
  | "button"
  | "checkbox"
  | "radio"
  | "custom"
  | (string & {});

/**
 * 离散候选型 Widget 的标准选项条目。
 * `select / radio` 一类控件都可以直接复用这组结构。
 */
export interface NodeWidgetOptionItem {
  /** 选项显示文本。 */
  label: string;
  /** 选项实际值。 */
  value: string;
  /** 当前选项是否不可选。 */
  disabled?: boolean;
  /** 选项补充说明。 */
  description?: string;
}

/**
 * 基础 Widget options 的公共字段。
 * 这些字段不会改变序列化结构，只是给外部节点包补齐标准类型。
 */
export interface NodeBaseWidgetOptions {
  /** 宿主可用的标签文本。 */
  label?: string;
  /** 宿主可用的补充说明。 */
  description?: string;
  /** 是否禁用。 */
  disabled?: boolean;
}

/** 只读值 / 输入框类组件使用的 options。 */
export interface NodeTextWidgetOptions extends NodeBaseWidgetOptions {
  /** 输入为空时的占位文案。 */
  placeholder?: string;
  /** 是否只读。 */
  readOnly?: boolean;
  /** 可输入的最大字符数。 */
  maxLength?: number;
}

/** 多行文本组件的 options。 */
export interface NodeTextareaWidgetOptions extends NodeTextWidgetOptions {
  /** 建议显示的行数。 */
  rows?: number;
}

/** slider 组件的 options。 */
export interface NodeSliderWidgetOptions extends NodeBaseWidgetOptions {
  /** 最小值。 */
  min?: number;
  /** 最大值。 */
  max?: number;
  /** 步长。 */
  step?: number;
  /** 宿主可直接显示的格式化值。 */
  displayValue?: string;
  /** 值格式化器，可为格式字符串或函数。 */
  formatValue?: string | ((value: number) => string);
}

/** toggle 组件的 options。 */
export interface NodeToggleWidgetOptions extends NodeBaseWidgetOptions {
  /** 打开态文案。 */
  onText?: string;
  /** 关闭态文案。 */
  offText?: string;
}

/** select / radio 组件的 options。 */
export interface NodeOptionWidgetOptions extends NodeBaseWidgetOptions {
  /** 离散选项列表。 */
  items?: Array<string | NodeWidgetOptionItem>;
}

/** button 组件的 options。 */
export interface NodeButtonWidgetOptions extends NodeBaseWidgetOptions {
  /** 按钮文案。 */
  text?: string;
  /** 点击后触发的动作名。 */
  action?: string;
  /** 宿主可选视觉变体。 */
  variant?: "primary" | "secondary" | "ghost";
}

/** checkbox 组件的 options。 */
export interface NodeCheckboxWidgetOptions extends NodeBaseWidgetOptions {
  /** 勾选态文案。 */
  onText?: string;
  /** 未勾选态文案。 */
  offText?: string;
}

/**
 * 节点属性类型。
 * 该字段主要服务配置面板、序列化和编辑器 UI 推断。
 */
export type NodePropertyType =
  | "number"
  | "string"
  | "boolean"
  | "enum"
  | "object"
  | (string & {});

/**
 * 单个输入或输出槽位的声明。
 */
export interface NodeSlotSpec {
  /** 槽位唯一名称，通常同时承担展示标题。 */
  name: string;
  /** 槽位数据类型。 */
  type?: SlotType;
  /** 可选显示文案；未提供时宿主可回退到 `name`。 */
  label?: string;
  /** 是否为可选输入。 */
  optional?: boolean;
  /** UI/渲染提示色。 */
  color?: string;
  /** UI/渲染提示形状。 */
  shape?: NodeSlotShape;
  /** 给宿主或插件保留的扩展元数据。 */
  data?: Record<string, unknown>;
}

/**
 * 单个 Widget 的声明。
 * Widget 既可以来自节点定义默认值，也可以来自实例覆盖值。
 */
export interface NodeWidgetSpec {
  /** Widget 类型，最终会在宿主提供的 Widget 定义表中解析。 */
  type: NodeWidgetType;
  /** Widget 名称，通常用于面板标签或属性映射。 */
  name: string;
  /** Widget 当前值。 */
  value?: unknown;
  /** 传给宿主 renderer 的额外配置。 */
  options?: Record<string, unknown>;
}

/**
 * 节点属性声明。
 * 它描述的是“数据结构”，不直接等同于某个渲染控件。
 */
export interface NodePropertySpec {
  /** 属性名。 */
  name: string;
  /** 属性类型。 */
  type?: NodePropertyType;
  /** 默认值。 */
  default?: unknown;
  /** 属性级扩展配置。 */
  options?: Record<string, unknown>;
  /** 如果需要，可把属性映射到一个 Widget 描述。 */
  widget?: NodeWidgetSpec;
}

/**
 * 节点通用状态位。
 * 宿主可按需消费，也可以扩展自己的选择态与交互态系统。
 */
export interface NodeFlags {
  /** 是否折叠显示。 */
  collapsed?: boolean;
  /** 是否固定在画布上方。 */
  pinned?: boolean;
  /** 是否禁用。 */
  disabled?: boolean;
  /** 是否被宿主视为选中。 */
  selected?: boolean;
}

/**
 * 节点布局信息。
 * 这里存的是节点在图坐标中的位置和宿主可选尺寸。
 */
export interface NodeLayout {
  /** 图坐标系中的横向位置。 */
  x: number;
  /** 图坐标系中的纵向位置。 */
  y: number;
  /** 宿主可选宽度。 */
  width?: number;
  /** 宿主可选高度。 */
  height?: number;
}

/**
 * 创建节点实例时的输入结构。
 * 它允许调用方只覆写局部字段，其余部分从 `NodeDefinition` 回填。
 */
export interface NodeInit {
  /** 实例 ID；未提供时由工厂自动生成。 */
  id?: string;
  /** 自动分配 ID 时需要避开的现有节点 ID 集合。 */
  existingNodeIds?: Iterable<string>;
  /** 节点类型标识。 */
  type: string;
  /** 实例标题覆写。 */
  title?: string;
  /** 布局覆写。 */
  layout?: Partial<NodeLayout>;
  /** 属性值覆写。 */
  properties?: Record<string, unknown>;
  /** 属性声明覆写。 */
  propertySpecs?: NodePropertySpec[];
  /** 输入槽位声明覆写。 */
  inputs?: NodeSlotSpec[];
  /** 输出槽位声明覆写。 */
  outputs?: NodeSlotSpec[];
  /** Widget 声明覆写。 */
  widgets?: NodeWidgetSpec[];
  /** 节点状态位覆写。 */
  flags?: NodeFlags;
  /** 附加运行时数据初值。 */
  data?: Record<string, unknown>;
}

/**
 * 节点序列化结果。
 * 该结构只包含可恢复的静态状态，不包含运行时输入输出缓存。
 */
export interface NodeSerializeResult {
  /** 节点实例 ID。 */
  id: string;
  /** 节点类型标识。 */
  type: string;
  /** 当前持久化标题。 */
  title?: string;
  /** 当前持久化布局。 */
  layout: NodeLayout;
  /** 当前持久化属性值。 */
  properties?: Record<string, unknown>;
  /** 当前持久化属性声明。 */
  propertySpecs?: NodePropertySpec[];
  /** 当前持久化输入槽位声明。 */
  inputs?: NodeSlotSpec[];
  /** 当前持久化输出槽位声明。 */
  outputs?: NodeSlotSpec[];
  /** 当前持久化 Widget 声明。 */
  widgets?: NodeWidgetSpec[];
  /** 当前持久化状态位。 */
  flags?: NodeFlags;
  /** 当前持久化附加数据。 */
  data?: Record<string, unknown>;
}

/**
 * 节点运行时实例状态。
 * 这是宿主真正持有并驱动渲染、执行和交互的核心对象。
 */
export interface NodeRuntimeState {
  /** 节点实例 ID。 */
  id: string;
  /** 节点类型标识。 */
  type: string;
  /** 当前运行时标题。 */
  title: string;
  /** 当前运行时布局。 */
  layout: NodeLayout;
  /** 当前运行时属性值。 */
  properties: Record<string, unknown>;
  /** 当前运行时属性声明。 */
  propertySpecs: NodePropertySpec[];
  /** 当前运行时输入槽位声明。 */
  inputs: NodeSlotSpec[];
  /** 当前运行时输出槽位声明。 */
  outputs: NodeSlotSpec[];
  /** 当前运行时 Widget 声明。 */
  widgets: NodeWidgetSpec[];
  /** 当前运行时状态位。 */
  flags: NodeFlags;
  /** 输入值缓存属于运行时态，不参与序列化。 */
  inputValues: unknown[];
  /** 输出值缓存属于运行时态，不参与序列化。 */
  outputValues: unknown[];
  /** 给宿主或插件预留的运行时附加数据。 */
  data?: Record<string, unknown>;
}

/**
 * 当前阶段 `NodeState` 与 `NodeRuntimeState` 同义。
 * 这个别名主要为了给后续抽象层升级预留空间。
 */
export type NodeState = NodeRuntimeState;
