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
  label: string;
  value: string;
  disabled?: boolean;
  description?: string;
}

/**
 * 基础 Widget options 的公共字段。
 * 这些字段不会改变序列化结构，只是给外部节点包补齐标准类型。
 */
export interface NodeBaseWidgetOptions {
  label?: string;
  description?: string;
  disabled?: boolean;
}

/** 只读值 / 输入框类组件使用的 options。 */
export interface NodeTextWidgetOptions extends NodeBaseWidgetOptions {
  placeholder?: string;
  readOnly?: boolean;
  maxLength?: number;
}

/** 多行文本组件的 options。 */
export interface NodeTextareaWidgetOptions extends NodeTextWidgetOptions {
  rows?: number;
}

/** slider 组件的 options。 */
export interface NodeSliderWidgetOptions extends NodeBaseWidgetOptions {
  min?: number;
  max?: number;
  step?: number;
  displayValue?: string;
  formatValue?: string | ((value: number) => string);
}

/** toggle 组件的 options。 */
export interface NodeToggleWidgetOptions extends NodeBaseWidgetOptions {
  onText?: string;
  offText?: string;
}

/** select / radio 组件的 options。 */
export interface NodeOptionWidgetOptions extends NodeBaseWidgetOptions {
  items?: Array<string | NodeWidgetOptionItem>;
}

/** button 组件的 options。 */
export interface NodeButtonWidgetOptions extends NodeBaseWidgetOptions {
  text?: string;
  action?: string;
  variant?: "primary" | "secondary" | "ghost";
}

/** checkbox 组件的 options。 */
export interface NodeCheckboxWidgetOptions extends NodeBaseWidgetOptions {
  onText?: string;
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
  collapsed?: boolean;
  pinned?: boolean;
  disabled?: boolean;
  selected?: boolean;
}

/**
 * 节点布局信息。
 * 这里存的是节点在图坐标中的位置和宿主可选尺寸。
 */
export interface NodeLayout {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/**
 * 创建节点实例时的输入结构。
 * 它允许调用方只覆写局部字段，其余部分从 `NodeDefinition` 回填。
 */
export interface NodeInit {
  id?: string;
  type: string;
  title?: string;
  layout?: Partial<NodeLayout>;
  properties?: Record<string, unknown>;
  propertySpecs?: NodePropertySpec[];
  inputs?: NodeSlotSpec[];
  outputs?: NodeSlotSpec[];
  widgets?: NodeWidgetSpec[];
  flags?: NodeFlags;
  data?: Record<string, unknown>;
}

/**
 * 节点序列化结果。
 * 该结构只包含可恢复的静态状态，不包含运行时输入输出缓存。
 */
export interface NodeSerializeResult {
  id: string;
  type: string;
  title?: string;
  layout: NodeLayout;
  properties?: Record<string, unknown>;
  propertySpecs?: NodePropertySpec[];
  inputs?: NodeSlotSpec[];
  outputs?: NodeSlotSpec[];
  widgets?: NodeWidgetSpec[];
  flags?: NodeFlags;
  data?: Record<string, unknown>;
}

/**
 * 节点运行时实例状态。
 * 这是宿主真正持有并驱动渲染、执行和交互的核心对象。
 */
export interface NodeRuntimeState {
  id: string;
  type: string;
  title: string;
  layout: NodeLayout;
  properties: Record<string, unknown>;
  propertySpecs: NodePropertySpec[];
  inputs: NodeSlotSpec[];
  outputs: NodeSlotSpec[];
  widgets: NodeWidgetSpec[];
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
