// 节点 SDK：类型与最小工具（参考旧版 LiteGraph 思路）

export type SlotDirection = "input" | "output";

// 0 表示通用类型，沿用旧版语义
export type SlotType = string | 0;

export interface NodeSlotSpec {
  name: string;
  type?: SlotType;
  label?: string;
  optional?: boolean;
  // UI/渲染提示（不要求强制使用）
  color?: string;
  shape?: "circle" | "box" | "arrow" | "grid";
  data?: Record<string, unknown>;
}

export interface NodeWidgetSpec {
  type: "number" | "string" | "combo" | "toggle" | "slider" | "custom";
  name: string;
  value?: unknown;
  options?: Record<string, unknown>;
}

export interface NodePropertySpec {
  name: string;
  type?: "number" | "string" | "boolean" | "enum" | "object";
  default?: unknown;
  options?: Record<string, unknown>;
  widget?: NodeWidgetSpec;
}

export interface NodeFlags {
  collapsed?: boolean;
  pinned?: boolean;
  disabled?: boolean;
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
  inputs?: NodeSlotSpec[];
  outputs?: NodeSlotSpec[];
  widgets?: NodeWidgetSpec[];
  flags?: NodeFlags;
}

export interface NodeSerializeResult {
  id: string;
  type: string;
  title?: string;
  layout: NodeLayout;
  properties?: Record<string, unknown>;
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
  inputs: NodeSlotSpec[];
  outputs: NodeSlotSpec[];
  widgets: NodeWidgetSpec[];
  flags: NodeFlags;
}

export interface NodeLifecycle {
  onCreate?(node: NodeRuntimeState): void;
  onConfigure?(node: NodeRuntimeState, data: NodeSerializeResult): void;
  onSerialize?(node: NodeRuntimeState, data: NodeSerializeResult): void;
  onExecute?(node: NodeRuntimeState, context?: unknown): void;
  onPropertyChanged?(
    node: NodeRuntimeState,
    name: string,
    value: unknown,
    prevValue: unknown
  ): boolean | void;
  onInputAdded?(node: NodeRuntimeState, input: NodeSlotSpec): void;
  onOutputAdded?(node: NodeRuntimeState, output: NodeSlotSpec): void;
  onConnectionsChange?(
    node: NodeRuntimeState,
    type: SlotDirection,
    slot: number,
    connected: boolean
  ): void;
  onAction?(
    node: NodeRuntimeState,
    action: string,
    param?: unknown,
    options?: Record<string, unknown>
  ): void;
  onTrigger?(
    node: NodeRuntimeState,
    action: string,
    param?: unknown,
    options?: Record<string, unknown>
  ): void;
}

export interface NodeDefinition extends NodeLifecycle {
  type: string;
  title?: string;
  category?: string;
  description?: string;
  inputs?: NodeSlotSpec[];
  outputs?: NodeSlotSpec[];
  properties?: NodePropertySpec[];
  widgets?: NodeWidgetSpec[];
  size?: [number, number];
  minWidth?: number;
  minHeight?: number;
}

export interface NodeApi {
  addInput(name: string, type?: SlotType, extra?: Partial<NodeSlotSpec>): NodeSlotSpec;
  addOutput(
    name: string,
    type?: SlotType,
    extra?: Partial<NodeSlotSpec>
  ): NodeSlotSpec;
  removeInput(index: number): void;
  removeOutput(index: number): void;
  addProperty(spec: NodePropertySpec): void;
  addWidget(spec: NodeWidgetSpec): void;
  getInputData(slot: number, forceUpdate?: boolean): unknown;
  setOutputData(slot: number, data: unknown): void;
  findInputSlot(name: string): number;
  findOutputSlot(name: string): number;
}

// 与 demo 保持一致的基础节点数据（可被主包直接复用）
export interface LeaferGraphNodeData {
  id: string;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  accent?: string;
  category?: string;
  status?: string;
  inputs?: string[];
  outputs?: string[];
  controlLabel?: string;
  controlValue?: string;
  controlProgress?: number;
}

export interface LeaferGraphOptions {
  fill?: string;
  nodes?: LeaferGraphNodeData[];
}
