/**
 * 主包图 API 类型模块。
 *
 * @remarks
 * 负责定义节点创建、更新、移动、缩放和连线操作使用的公共输入类型。
 */

import type {
  LeaferGraphLinkData,
  NodePropertySpec,
  NodeRuntimeState,
  NodeSlotSpec,
  SlotDirection,
  SlotType
} from "@leafergraph/node";
import type { GraphNodeDisplayProperties } from "../graph/graph_runtime_types";

/**
 * 主包允许的槽位输入结构。
 * 既兼容旧的字符串数组，也兼容正式 `NodeSlotSpec`。
 *
 * @remarks
 * 对外 API 仍然允许使用最轻量的字符串声明槽位名称，
 * 但进入运行时前都会被统一转换成正式槽位结构。
 */
export type LeaferGraphNodeSlotInput = string | NodeSlotSpec;

/**
 * 主包创建节点时使用的输入结构。
 * 这里保留 editor 友好的顶层 `x / y / width / height` 写法，
 * 但不再继承 demo 输入类型。
 *
 * @remarks
 * 这份输入专门服务主包对外的交互型 API，
 * 在真正进入 `@leafergraph/node` 之前会被转换为正式节点状态创建参数。
 */
export interface LeaferGraphCreateNodeInput extends GraphNodeDisplayProperties {
  /** 节点 ID；未提供时由底层节点创建链路生成。 */
  id?: string;
  /** 节点类型；必须指向当前注册表里已存在的节点定义。 */
  type: string;
  /** 节点标题；未提供时回退到节点定义默认标题。 */
  title?: string;
  /** 节点左上角的图坐标 X。 */
  x: number;
  /** 节点左上角的图坐标 Y。 */
  y: number;
  /** 显式宽度；未提供时交给节点定义或布局默认值决定。 */
  width?: number;
  /** 显式高度；未提供时交给节点定义或布局默认值决定。 */
  height?: number;
  /** 节点的正式业务属性。 */
  properties?: Record<string, unknown>;
  /** 节点属性面板或序列化可见的属性规格。 */
  propertySpecs?: NodePropertySpec[];
  /** 输入槽位声明。 */
  inputs?: LeaferGraphNodeSlotInput[];
  /** 输出槽位声明。 */
  outputs?: LeaferGraphNodeSlotInput[];
  /** 节点内部 Widget 列表。 */
  widgets?: NodeRuntimeState["widgets"];
  /** 节点的扩展数据载荷。 */
  data?: Record<string, unknown>;
}

/**
 * 主包更新节点时使用的输入结构。
 * 这一轮先聚焦“内容与布局更新”，不支持在 `updateNode(...)` 中直接修改节点 ID。
 *
 * @remarks
 * 这份输入和创建输入一样保留了扁平坐标字段，
 * 方便 editor 命令系统在不构造嵌套 layout 的前提下完成局部补丁更新。
 */
export interface LeaferGraphUpdateNodeInput
  extends Partial<GraphNodeDisplayProperties> {
  /** 预留给一致性校验；当前不支持真正修改节点 ID。 */
  id?: string;
  /** 待更新的标题。 */
  title?: string;
  /** 待更新的图坐标 X。 */
  x?: number;
  /** 待更新的图坐标 Y。 */
  y?: number;
  /** 待更新的宽度。 */
  width?: number;
  /** 待更新的高度。 */
  height?: number;
  /** 待合并进节点的正式属性补丁。 */
  properties?: Record<string, unknown>;
  /** 待替换的属性规格。 */
  propertySpecs?: NodePropertySpec[];
  /** 待替换的输入槽位声明。 */
  inputs?: LeaferGraphNodeSlotInput[];
  /** 待替换的输出槽位声明。 */
  outputs?: LeaferGraphNodeSlotInput[];
  /** 待替换的 Widget 列表。 */
  widgets?: NodeRuntimeState["widgets"];
  /** 待替换的扩展数据。 */
  data?: Record<string, unknown>;
}

/**
 * 主包移动节点时使用的位置结构。
 * 之所以单独定义成对象，而不是直接传 `(x, y)`，
 * 是为了给后续扩展吸附、来源信息、批量移动等元数据预留空间。
 */
export interface LeaferGraphMoveNodeInput {
  /** 节点移动后的目标 X 坐标。 */
  x: number;
  /** 节点移动后的目标 Y 坐标。 */
  y: number;
}

/**
 * 主包调整节点尺寸时使用的输入结构。
 * 当前阶段只开放显式宽高，后续如需保留锚点或按比例缩放，再扩展额外元数据。
 */
export interface LeaferGraphResizeNodeInput {
  /** 节点目标宽度。 */
  width: number;
  /** 节点目标高度。 */
  height: number;
}

/**
 * 主包对外暴露的节点 resize 约束。
 * 它已经把节点定义中的默认值、兼容字段和宿主默认值统一解析完成，
 * 适合 editor、命令层或调试工具直接读取。
 */
export interface LeaferGraphNodeResizeConstraint {
  /** 当前节点是否允许被 resize。 */
  enabled: boolean;
  /** 是否锁定宽高比。 */
  lockRatio: boolean;
  /** 允许的最小宽度。 */
  minWidth: number;
  /** 允许的最小高度。 */
  minHeight: number;
  /** 允许的最大宽度。 */
  maxWidth?: number;
  /** 允许的最大高度。 */
  maxHeight?: number;
  /** 吸附步长。 */
  snap?: number;
  /** 缺省宽度。 */
  defaultWidth: number;
  /** 缺省高度。 */
  defaultHeight: number;
}

/**
 * 主包对外暴露的连接端口几何状态。
 *
 * @remarks
 * 这份结构统一承载端口方向、槽位索引、中心点和命中区域，
 * 供 editor 的最小自由连线、重连预览和未来合法性提示复用。
 */
export interface LeaferGraphConnectionPortState {
  /** 端口所属节点 ID。 */
  nodeId: string;
  /** 端口方向。 */
  direction: SlotDirection;
  /** 端口槽位索引。 */
  slot: number;
  /** 端口中心点，使用主包 page 坐标系。 */
  center: {
    x: number;
    y: number;
  };
  /** 端口命中热区，使用主包 page 坐标系。 */
  hitBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** 端口类型；缺失时视为通配。 */
  slotType?: SlotType;
}

/**
 * 主包对外暴露的最小连接校验结果。
 *
 * @remarks
 * 第一版先只返回 `valid + reason`，
 * 让 editor 可以在不感知内部校验细节的前提下做最小反馈和交互分支。
 */
export interface LeaferGraphConnectionValidationResult {
  /** 当前两个端口是否允许建立正式连线。 */
  valid: boolean;
  /** 不合法时的最小原因说明。 */
  reason?: string;
}

/**
 * 主包创建连线时使用的输入结构。
 * 当前阶段允许省略连线 ID，由宿主生成稳定可读的默认值。
 *
 * @remarks
 * 一旦进入运行时，连线输入会被浅拷贝并规范化，避免外部直接共享内部状态引用。
 */
export interface LeaferGraphCreateLinkInput
  extends Omit<LeaferGraphLinkData, "id"> {
  /** 连线 ID；未提供时由主包自动生成。 */
  id?: string;
}
