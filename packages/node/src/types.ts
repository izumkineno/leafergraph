export type SlotDirection = "input" | "output";

// 0 表示通用类型，沿用旧版 LiteGraph 语义
export type SlotType = string | 0;

export type NodeSlotShape = "circle" | "box" | "arrow" | "grid";

export type NodeWidgetType =
  | "number"
  | "string"
  | "combo"
  | "toggle"
  | "slider"
  | "custom"
  | (string & {});

export type NodePropertyType =
  | "number"
  | "string"
  | "boolean"
  | "enum"
  | "object"
  | (string & {});

export interface NodeSlotSpec {
  name: string;
  type?: SlotType;
  label?: string;
  optional?: boolean;
  // UI/渲染提示，不要求宿主必须照做
  color?: string;
  shape?: NodeSlotShape;
  data?: Record<string, unknown>;
}

export interface NodeWidgetSpec {
  type: NodeWidgetType;
  name: string;
  value?: unknown;
  options?: Record<string, unknown>;
}

export interface NodePropertySpec {
  name: string;
  type?: NodePropertyType;
  default?: unknown;
  options?: Record<string, unknown>;
  widget?: NodeWidgetSpec;
}

export interface NodeFlags {
  collapsed?: boolean;
  pinned?: boolean;
  disabled?: boolean;
  selected?: boolean;
}

export interface NodeLayout {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

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
  // 输入输出值属于运行时态，不参与序列化
  inputValues: unknown[];
  outputValues: unknown[];
  data?: Record<string, unknown>;
}

export type NodeState = NodeRuntimeState;
