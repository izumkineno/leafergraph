import type { NodeSerializeResult } from "./types";

/**
 * 图连线端点描述。
 * 当前阶段只要求提供节点 ID 和可选槽位序号，后续可继续扩展更多元信息。
 */
export interface LeaferGraphLinkEndpoint {
  /**
   * 端点所属节点 ID。
   */
  nodeId: string;
  /**
   * 端点槽位序号。
   * 未提供时由宿主回退到 `0`，也就是第一条输入或输出槽位。
   */
  slot?: number;
}

/**
 * 图连线数据。
 * 这是当前阶段图模型里最小但正式的连线结构。
 */
export interface LeaferGraphLinkData {
  /**
   * 连线唯一 ID。
   */
  id: string;
  /**
   * 连线起点。
   */
  source: LeaferGraphLinkEndpoint;
  /**
   * 连线终点。
   */
  target: LeaferGraphLinkEndpoint;
  /**
   * 可选展示文案。
   * 当前宿主还未消费，但先保留在数据层，便于后续扩展。
   */
  label?: string;
  /**
   * 给宿主或插件保留的扩展元数据。
   */
  data?: Record<string, unknown>;
}

/**
 * 图模型输入结构。
 * 节点集合直接使用正式可恢复的 `NodeSerializeResult`，
 * 避免再把 demo 输入类型暴露成长期图协议。
 */
export interface LeaferGraphData {
  /**
   * 图内节点集合。
   */
  nodes: NodeSerializeResult[];
  /**
   * 图内连线集合。
   */
  links?: LeaferGraphLinkData[];
  /**
   * 图级扩展元数据。
   */
  meta?: Record<string, unknown>;
}
