import type {
  NodePropertySpec,
  NodeRuntimeState,
  NodeSerializeResult,
  NodeSlotSpec,
  NodeWidgetSpec,
  SlotDirection,
  SlotType
} from "./types";

export interface NodeApi {
  addInput(name: string, type?: SlotType, extra?: Partial<NodeSlotSpec>): NodeSlotSpec;
  addOutput(name: string, type?: SlotType, extra?: Partial<NodeSlotSpec>): NodeSlotSpec;
  removeInput(index: number): void;
  removeOutput(index: number): void;
  addProperty(spec: NodePropertySpec): void;
  addWidget(spec: NodeWidgetSpec): void;
  getInputData(slot: number, forceUpdate?: boolean): unknown;
  setOutputData(slot: number, data: unknown): void;
  findInputSlot(name: string): number;
  findOutputSlot(name: string): number;
}

export interface NodeLifecycle {
  onCreate?(node: NodeRuntimeState, api: NodeApi): void;
  onConfigure?(node: NodeRuntimeState, data: NodeSerializeResult, api: NodeApi): void;
  onSerialize?(node: NodeRuntimeState, data: NodeSerializeResult, api: NodeApi): void;
  onExecute?(node: NodeRuntimeState, context?: unknown, api?: NodeApi): void;
  onPropertyChanged?(
    node: NodeRuntimeState,
    name: string,
    value: unknown,
    prevValue: unknown,
    api: NodeApi
  ): boolean | void;
  onInputAdded?(node: NodeRuntimeState, input: NodeSlotSpec, api: NodeApi): void;
  onOutputAdded?(node: NodeRuntimeState, output: NodeSlotSpec, api: NodeApi): void;
  onConnectionsChange?(
    node: NodeRuntimeState,
    type: SlotDirection,
    slot: number,
    connected: boolean,
    api: NodeApi
  ): void;
  onAction?(
    node: NodeRuntimeState,
    action: string,
    param: unknown,
    options: Record<string, unknown> | undefined,
    api: NodeApi
  ): void;
  onTrigger?(
    node: NodeRuntimeState,
    action: string,
    param: unknown,
    options: Record<string, unknown> | undefined,
    api: NodeApi
  ): void;
}
