import type {
  LeaferGraphLinkData,
  NodePropertySpec,
  NodeRuntimeState,
  NodeSlotSpec
} from "@leafergraph/node";
import type { GraphNodeDisplayProperties } from "../graph/graph_runtime_types";

/**
 * 主包允许的槽位输入结构。
 * 既兼容旧的字符串数组，也兼容正式 `NodeSlotSpec`。
 */
export type LeaferGraphNodeSlotInput = string | NodeSlotSpec;

/**
 * 主包创建节点时使用的输入结构。
 * 这里保留 editor 友好的顶层 `x / y / width / height` 写法，
 * 但不再继承 demo 输入类型。
 */
export interface LeaferGraphCreateNodeInput extends GraphNodeDisplayProperties {
  id?: string;
  type: string;
  title?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  properties?: Record<string, unknown>;
  propertySpecs?: NodePropertySpec[];
  inputs?: LeaferGraphNodeSlotInput[];
  outputs?: LeaferGraphNodeSlotInput[];
  widgets?: NodeRuntimeState["widgets"];
  data?: Record<string, unknown>;
}

/**
 * 主包更新节点时使用的输入结构。
 * 这一轮先聚焦“内容与布局更新”，不支持在 `updateNode(...)` 中直接修改节点 ID。
 */
export interface LeaferGraphUpdateNodeInput
  extends Partial<GraphNodeDisplayProperties> {
  id?: string;
  title?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  properties?: Record<string, unknown>;
  propertySpecs?: NodePropertySpec[];
  inputs?: LeaferGraphNodeSlotInput[];
  outputs?: LeaferGraphNodeSlotInput[];
  widgets?: NodeRuntimeState["widgets"];
  data?: Record<string, unknown>;
}

/**
 * 主包移动节点时使用的位置结构。
 * 之所以单独定义成对象，而不是直接传 `(x, y)`，
 * 是为了给后续扩展吸附、来源信息、批量移动等元数据预留空间。
 */
export interface LeaferGraphMoveNodeInput {
  x: number;
  y: number;
}

/**
 * 主包调整节点尺寸时使用的输入结构。
 * 当前阶段只开放显式宽高，后续如需保留锚点或按比例缩放，再扩展额外元数据。
 */
export interface LeaferGraphResizeNodeInput {
  width: number;
  height: number;
}

/**
 * 主包对外暴露的节点 resize 约束。
 * 它已经把节点定义中的默认值、兼容字段和宿主默认值统一解析完成，
 * 适合 editor、命令层或调试工具直接读取。
 */
export interface LeaferGraphNodeResizeConstraint {
  enabled: boolean;
  lockRatio: boolean;
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  maxHeight?: number;
  snap?: number;
  defaultWidth: number;
  defaultHeight: number;
}

/**
 * 主包创建连线时使用的输入结构。
 * 当前阶段允许省略连线 ID，由宿主生成稳定可读的默认值。
 */
export interface LeaferGraphCreateLinkInput
  extends Omit<LeaferGraphLinkData, "id"> {
  id?: string;
}
