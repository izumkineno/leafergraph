import type { GraphDocument } from "@leafergraph/node";
import type { GraphOperation } from "@leafergraph/contracts";

/**
 * 字段级节点变更的公共基类。
 */
export interface GraphDocumentFieldChangeBase {
  /** 目标节点 ID。 */
  nodeId: string;
}

/**
 * 节点标题变更。
 */
export interface GraphDocumentNodeTitleSetChange
  extends GraphDocumentFieldChangeBase {
  /** 字段变更类型。 */
  type: "node.title.set";
  /** 待写入的新标题。 */
  value: string;
}

/**
 * 节点属性写入变更。
 */
export interface GraphDocumentNodePropertySetChange
  extends GraphDocumentFieldChangeBase {
  /** 字段变更类型。 */
  type: "node.property.set";
  /** 目标属性 key。 */
  key: string;
  /** 待写入的新值。 */
  value: unknown;
}

/**
 * 节点属性删除变更。
 */
export interface GraphDocumentNodePropertyUnsetChange
  extends GraphDocumentFieldChangeBase {
  /** 字段变更类型。 */
  type: "node.property.unset";
  /** 待删除的属性 key。 */
  key: string;
}

/**
 * 节点附加数据写入变更。
 */
export interface GraphDocumentNodeDataSetChange
  extends GraphDocumentFieldChangeBase {
  /** 字段变更类型。 */
  type: "node.data.set";
  /** 目标数据 key。 */
  key: string;
  /** 待写入的新值。 */
  value: unknown;
}

/**
 * 节点附加数据删除变更。
 */
export interface GraphDocumentNodeDataUnsetChange
  extends GraphDocumentFieldChangeBase {
  /** 字段变更类型。 */
  type: "node.data.unset";
  /** 待删除的数据 key。 */
  key: string;
}

/**
 * 节点 flag 写入变更。
 */
export interface GraphDocumentNodeFlagSetChange
  extends GraphDocumentFieldChangeBase {
  /** 字段变更类型。 */
  type: "node.flag.set";
  /** 目标 flag key。 */
  key: string;
  /** 待写入的布尔值。 */
  value: boolean;
}

/**
 * 节点 Widget 值写入变更。
 */
export interface GraphDocumentNodeWidgetValueSetChange
  extends GraphDocumentFieldChangeBase {
  /** 字段变更类型。 */
  type: "node.widget.value.set";
  /** 目标 Widget 索引。 */
  widgetIndex: number;
  /** 待写入的新值。 */
  value: unknown;
}

/**
 * 节点 Widget 整项替换变更。
 */
export interface GraphDocumentNodeWidgetReplaceChange
  extends GraphDocumentFieldChangeBase {
  /** 字段变更类型。 */
  type: "node.widget.replace";
  /** 目标 Widget 索引。 */
  widgetIndex: number;
  /** 待替换成的新 Widget 声明。 */
  widget: any;
}

/**
 * 节点 Widget 删除变更。
 */
export interface GraphDocumentNodeWidgetRemoveChange
  extends GraphDocumentFieldChangeBase {
  /** 字段变更类型。 */
  type: "node.widget.remove";
  /** 待删除的 Widget 索引。 */
  widgetIndex: number;
}

/**
 * 字段级图文档变更联合类型。
 */
export type GraphDocumentFieldChange =
  | GraphDocumentNodeTitleSetChange
  | GraphDocumentNodePropertySetChange
  | GraphDocumentNodePropertyUnsetChange
  | GraphDocumentNodeDataSetChange
  | GraphDocumentNodeDataUnsetChange
  | GraphDocumentNodeFlagSetChange
  | GraphDocumentNodeWidgetValueSetChange
  | GraphDocumentNodeWidgetReplaceChange
  | GraphDocumentNodeWidgetRemoveChange;

/**
 * 一份正式图文档差异。
 */
export interface GraphDocumentDiff {
  /** 目标文档 ID。 */
  documentId: GraphDocument["documentId"];
  /** diff 生成时对应的基础 revision。 */
  baseRevision: GraphDocument["revision"];
  /** 应用完成后应写入的目标 revision。 */
  revision: GraphDocument["revision"];
  /** diff 生成时间戳。 */
  emittedAt: number;
  /** 需要按顺序应用的正式图操作。 */
  operations: GraphOperation[];
  /** 不适合表达成操作时使用的字段级变更。 */
  fieldChanges: GraphDocumentFieldChange[];
}

/**
 * 应用图文档 diff 的结果。
 */
export interface ApplyGraphDocumentDiffResult {
  /** 当前 diff 是否成功应用。 */
  success: boolean;
  /** 是否必须回退到整图替换。 */
  requiresFullReplace: boolean;
  /** 应用后得到的文档快照。 */
  document: GraphDocument;
  /** 受影响的节点 ID 列表。 */
  affectedNodeIds: string[];
  /** 受影响的连线 ID 列表。 */
  affectedLinkIds: string[];
  /** 失败或回退时的原因。 */
  reason?: string;
}

/**
 * Diff 计算选项。
 */
export interface DiffOptions {
  /** 是否包含详细的变更信息。 */
  detailed?: boolean;
  /** 是否忽略某些字段。 */
  ignoreFields?: string[];
  /** 自定义比较函数。 */
  compareFunction?: (a: any, b: any) => boolean;
}

/**
 * 传输适配器选项。
 */
export interface TransportOptions {
  /** 传输协议类型。 */
  type: "http" | "websocket" | "mq";
  /** 传输配置。 */
  config: any;
}

/**
 * 批处理结果。
 */
export interface BatchResult {
  /** 成功的操作数量。 */
  successCount: number;
  /** 失败的操作数量。 */
  failureCount: number;
  /** 失败的操作详情。 */
  failures: Array<{ id: string; error: string }>;
}
