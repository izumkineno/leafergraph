/**
 * 节点生命周期与运行时 API 协议。
 *
 * 这个模块只定义模型层与宿主之间共享的调用约定，
 * 不负责具体调度策略、执行器实现或 UI 行为。
 */

import type {
  NodePropertySpec,
  NodeRuntimeState,
  NodeSerializeResult,
  NodeSlotSpec,
  NodeWidgetSpec,
  SlotDirection,
  SlotType
} from "./types.js";

/**
 * 节点实例在运行时可调用的结构性 API。
 * 这些方法主要复刻旧版节点系统里高频使用的实例操作能力。
 */
export interface NodeApi {
  /** 追加一个输入槽位，并返回写入后的槽位声明。 */
  addInput(name: string, type?: SlotType, extra?: Partial<NodeSlotSpec>): NodeSlotSpec;
  /** 追加一个输出槽位，并返回写入后的槽位声明。 */
  addOutput(name: string, type?: SlotType, extra?: Partial<NodeSlotSpec>): NodeSlotSpec;
  /** 按索引移除一个输入槽位。 */
  removeInput(index: number): void;
  /** 按索引移除一个输出槽位。 */
  removeOutput(index: number): void;
  /** 新增或覆写一个属性声明。 */
  addProperty(spec: NodePropertySpec): void;
  /** 追加一个 Widget 声明。 */
  addWidget(spec: NodeWidgetSpec): void;
  /** 读取输入缓存中的值。 */
  getInputData(slot: number, forceUpdate?: boolean): unknown;
  /** 写入输出缓存中的值。 */
  setOutputData(slot: number, data: unknown): void;
  /** 按名称查找输入槽位索引；未命中时返回 `-1`。 */
  findInputSlot(name: string): number;
  /** 按名称查找输出槽位索引；未命中时返回 `-1`。 */
  findOutputSlot(name: string): number;
}

/**
 * 节点生命周期钩子集合。
 * 该接口只描述宿主会在什么阶段调用，具体调度策略由上层图运行时决定。
 */
export interface NodeLifecycle {
  /** 节点实例初次创建完成后触发。 */
  onCreate?(node: NodeRuntimeState, api: NodeApi): void;
  /** 节点被配置或反序列化时触发。 */
  onConfigure?(node: NodeRuntimeState, data: NodeSerializeResult, api: NodeApi): void;
  /** 节点序列化前触发，可覆写最终输出内容。 */
  onSerialize?(node: NodeRuntimeState, data: NodeSerializeResult, api: NodeApi): void;
  /** 节点执行阶段钩子。 */
  onExecute?(node: NodeRuntimeState, context?: unknown, api?: NodeApi): void | Promise<void>;
  /** 节点属性变化后触发，可返回 `false` 拦截后续宿主默认行为。 */
  onPropertyChanged?(
    node: NodeRuntimeState,
    name: string,
    value: unknown,
    prevValue: unknown,
    api: NodeApi
  ): boolean | void;
  /** 新增输入槽位后触发。 */
  onInputAdded?(node: NodeRuntimeState, input: NodeSlotSpec, api: NodeApi): void;
  /** 新增输出槽位后触发。 */
  onOutputAdded?(node: NodeRuntimeState, output: NodeSlotSpec, api: NodeApi): void;
  /**
   * 连接状态变化后触发。
   *
   * @remarks
   * 当前 `connected` 语义是“该槽位在本次变更完成后是否仍有至少一条连接”，
   * 而不是“这次事件本身是连接还是断开”。
   */
  onConnectionsChange?(
    node: NodeRuntimeState,
    type: SlotDirection,
    slot: number,
    connected: boolean,
    api: NodeApi
  ): void;
  /** 动作消息入口，通常由宿主 UI 或快捷命令触发。 */
  onAction?(
    node: NodeRuntimeState,
    action: string,
    param: unknown,
    options: Record<string, unknown> | undefined,
    api: NodeApi
  ): void | Promise<void>;
  /** 触发型消息入口，语义上更偏事件广播。 */
  onTrigger?(
    node: NodeRuntimeState,
    action: string,
    param: unknown,
    options: Record<string, unknown> | undefined,
    api: NodeApi
  ): void | Promise<void>;
}
