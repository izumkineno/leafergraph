import type { NodeSerializeResult } from "./types";

/**
 * 图连线端点描述。
 * 当前阶段只要求提供节点 ID 和可选槽位序号，后续可继续扩展更多元信息。
 */
export interface GraphLinkEndpoint {
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
export interface GraphLink {
  /**
   * 连线唯一 ID。
   */
  id: string;
  /**
   * 连线起点。
   */
  source: GraphLinkEndpoint;
  /**
   * 连线终点。
   */
  target: GraphLinkEndpoint;
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
 * 统一能力画像。
 *
 * @remarks
 * 当前阶段只要求它能挂在文档上被前后端和后续 adapter 读取，
 * 不在这里提前固化 palette、表单或协议细节。
 */
export interface CapabilityProfile {
  /**
   * 画像标识。
   * 适合后端、adapter 或目标应用声明自己的能力集版本。
   */
  id?: string;
  /**
   * 画像描述目标应用或运行时的能力标签。
   */
  features?: string[];
  /**
   * 给 adapter 保留的扩展元数据。
   */
  data?: Record<string, unknown>;
}

/**
 * 文档与外部应用 adapter 的绑定信息。
 *
 * @remarks
 * 当前阶段只要求保留绑定元数据，不在这里展开具体 schema 或 wire format。
 */
export interface AdapterBinding {
  /**
   * 当前文档绑定到的 adapter 标识。
   */
  adapterId: string;
  /**
   * 外部应用类型。
   */
  appKind?: string;
  /**
   * 外部模型版本。
   */
  schemaVersion?: string;
  /**
   * 给 adapter 保留的扩展元数据。
   */
  data?: Record<string, unknown>;
}

/**
 * 图模型输入结构。
 * 节点集合直接使用正式可恢复的 `NodeSerializeResult`，
 * 避免再把 demo 输入类型暴露成长期图协议。
 */
export interface GraphDocument {
  /**
   * 文档唯一 ID。
   */
  documentId: string;
  /**
   * 文档修订号。
   * 当前阶段允许调用方直接给数字或字符串版本标识。
   */
  revision: number | string;
  /**
   * 当前文档所属应用类型。
   * 默认为 LeaferGraph 自己的本地文档语义，后续可由 adapter 覆写。
   */
  appKind: string;
  /**
   * 图内节点集合。
   */
  nodes: NodeSerializeResult[];
  /**
   * 图内连线集合。
   */
  links: GraphLink[];
  /**
   * 图级扩展元数据。
   */
  meta?: Record<string, unknown>;
  /**
   * 当前文档声明的能力画像。
   */
  capabilityProfile?: CapabilityProfile;
  /**
   * 当前文档绑定到的 adapter 元信息。
   */
  adapterBinding?: AdapterBinding;
}
