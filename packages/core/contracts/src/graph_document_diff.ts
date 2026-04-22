/**
 * 图文档 diff 与增量投影契约模块。
 *
 * @remarks
 * 负责定义正式图文档的增量差异结构，以及把 diff 应用到完整文档上的纯函数 helper。
 */

import type {
  GraphDocument,
  GraphLink,
  NodeFlags,
  NodeSerializeResult,
  NodeSlotSpec,
  NodeWidgetSpec
} from "@leafergraph/core/node";
import type {
  GraphOperation,
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphNodeSlotInput,
  LeaferGraphUpdateDocumentInput,
  LeaferGraphUpdateNodeInput
} from "./graph_api_types";

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
  key: keyof NodeFlags;
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
  widget: NodeWidgetSpec;
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

interface DocumentApplyStepResult {
  success: boolean;
  affectedNodeIds: string[];
  affectedLinkIds: string[];
  reason?: string;
}

interface WorkingDocumentState {
  document: GraphDocument;
  nodeIndexById: Map<string, number>;
  linkIndexById: Map<string, number>;
}

type PatchNodeWidgetValueResult =
  | { node: NodeSerializeResult }
  | { reason: string };

function createWorkingDocumentState(
  currentDocument: GraphDocument
): WorkingDocumentState {
  const document: GraphDocument = {
    ...currentDocument,
    nodes: currentDocument.nodes.slice(),
    links: currentDocument.links.slice()
  };

  return {
    document,
    nodeIndexById: createIndexMap(document.nodes, (node) => node.id),
    linkIndexById: createIndexMap(document.links, (link) => link.id)
  };
}

function createIndexMap<T>(
  items: readonly T[],
  getId: (item: T) => string
): Map<string, number> {
  const indexById = new Map<string, number>();
  items.forEach((item, index) => {
    indexById.set(getId(item), index);
  });
  return indexById;
}

function reindexFrom<T>(
  indexById: Map<string, number>,
  items: readonly T[],
  getId: (item: T) => string,
  startIndex: number
): void {
  for (let index = startIndex; index < items.length; index += 1) {
    indexById.set(getId(items[index]), index);
  }
}

function rebuildIndexMap<T>(
  indexById: Map<string, number>,
  items: readonly T[],
  getId: (item: T) => string
): void {
  indexById.clear();
  items.forEach((item, index) => {
    indexById.set(getId(item), index);
  });
}

export function createUpdateNodeInputFromNodeSnapshot(
  node: NodeSerializeResult
): LeaferGraphUpdateNodeInput {
  return {
    ...(node.title !== undefined ? { title: node.title } : {}),
    x: node.layout.x,
    y: node.layout.y,
    ...(node.layout.width !== undefined ? { width: node.layout.width } : {}),
    ...(node.layout.height !== undefined ? { height: node.layout.height } : {}),
    ...(node.properties !== undefined
      ? { properties: structuredClone(node.properties) }
      : {}),
    ...(node.propertySpecs !== undefined
      ? { propertySpecs: structuredClone(node.propertySpecs) }
      : {}),
    ...(node.inputs !== undefined ? { inputs: structuredClone(node.inputs) } : {}),
    ...(node.outputs !== undefined
      ? { outputs: structuredClone(node.outputs) }
      : {}),
    ...(node.widgets !== undefined ? { widgets: structuredClone(node.widgets) } : {}),
    ...(node.data !== undefined ? { data: structuredClone(node.data) } : {}),
    ...(node.flags !== undefined ? { flags: structuredClone(node.flags) } : {})
  };
}

/**
 * 把正式节点快照恢复为 `createNode(...)` 可直接消费的输入。
 *
 * @remarks
 * 这条 helper 专门服务复制 / 粘贴、模板恢复和未来 editor 的局部反序列化。
 * 默认会保留原始 `id`，调用方如果希望粘贴成新节点，应在外层显式移除或覆写。
 *
 * @param node - 节点。
 * @returns 创建后的结果对象。
 */
export function createCreateNodeInputFromNodeSnapshot(
  node: NodeSerializeResult
): LeaferGraphCreateNodeInput {
  return {
    id: node.id,
    type: node.type,
    ...(node.title !== undefined ? { title: node.title } : {}),
    x: node.layout.x,
    y: node.layout.y,
    ...(node.layout.width !== undefined ? { width: node.layout.width } : {}),
    ...(node.layout.height !== undefined ? { height: node.layout.height } : {}),
    ...(node.properties !== undefined
      ? { properties: structuredClone(node.properties) }
      : {}),
    ...(node.propertySpecs !== undefined
      ? { propertySpecs: structuredClone(node.propertySpecs) }
      : {}),
    ...(node.inputs !== undefined ? { inputs: structuredClone(node.inputs) } : {}),
    ...(node.outputs !== undefined
      ? { outputs: structuredClone(node.outputs) }
      : {}),
    ...(node.widgets !== undefined ? { widgets: structuredClone(node.widgets) } : {}),
    ...(node.data !== undefined ? { data: structuredClone(node.data) } : {}),
    ...(node.flags !== undefined ? { flags: structuredClone(node.flags) } : {})
  };
}

/**
 * 应用图文档差异到文档。
 *
 * @param currentDocument - `current` 文档。
 * @param diff - 差异。
 * @returns 处理后的结果。
 */
export function applyGraphDocumentDiffToDocument(
  currentDocument: GraphDocument,
  diff: GraphDocumentDiff
): ApplyGraphDocumentDiffResult {
  // 先读取当前目标状态与上下文约束，避免处理中出现不一致的中间态。
  if (currentDocument.documentId !== diff.documentId) {
    return createFailedDiffResult(
      currentDocument,
      "documentId 不匹配，必须回退到整图同步"
    );
  }

  if (currentDocument.revision !== diff.baseRevision) {
    return createFailedDiffResult(
      currentDocument,
      "baseRevision 不匹配，必须回退到整图同步"
    );
  }

  const state = createWorkingDocumentState(currentDocument);
  const affectedNodeIds = new Set<string>();
  const affectedLinkIds = new Set<string>();

  for (const operation of diff.operations) {
    const operationResult = applyOperationToDocument(state, operation);
    if (!operationResult.success) {
      return createFailedDiffResult(currentDocument, operationResult.reason);
    }

    for (const nodeId of operationResult.affectedNodeIds) {
      affectedNodeIds.add(nodeId);
    }
    for (const linkId of operationResult.affectedLinkIds) {
      affectedLinkIds.add(linkId);
    }
  }

  for (const fieldChange of diff.fieldChanges) {
    const fieldChangeResult = applyFieldChangeToDocument(state, fieldChange);
    if (!fieldChangeResult.success) {
      return createFailedDiffResult(currentDocument, fieldChangeResult.reason);
    }

    for (const nodeId of fieldChangeResult.affectedNodeIds) {
      affectedNodeIds.add(nodeId);
    }
  }

  state.document = {
    ...state.document,
    revision: diff.revision
  };

  return {
    success: true,
    requiresFullReplace: false,
    document: state.document,
    affectedNodeIds: [...affectedNodeIds],
    affectedLinkIds: [...affectedLinkIds]
  };
}

function createFailedDiffResult(
  currentDocument: GraphDocument,
  reason: string | undefined
): ApplyGraphDocumentDiffResult {
  return {
    success: false,
    requiresFullReplace: true,
    document: cloneGraphDocument(currentDocument),
    affectedNodeIds: [],
    affectedLinkIds: [],
    reason
  };
}

function createApplyStepResult(
  affectedNodeIds: string[],
  affectedLinkIds: string[]
): DocumentApplyStepResult {
  return {
    success: true,
    affectedNodeIds,
    affectedLinkIds
  };
}

function createRejectedApplyStep(reason: string): DocumentApplyStepResult {
  return {
    success: false,
    affectedNodeIds: [],
    affectedLinkIds: [],
    reason
  };
}

function applyOperationToDocument(
  state: WorkingDocumentState,
  operation: GraphOperation
): DocumentApplyStepResult {
  // 先读取当前目标状态与上下文约束，避免处理中出现不一致的中间态。
  switch (operation.type) {
    case "document.update": {
      state.document = patchGraphDocumentRoot(state.document, operation.input);
      return createApplyStepResult([], []);
    }
    case "node.create": {
      const nodeId = operation.input.id;
      if (!nodeId) {
        return createRejectedApplyStep("node.create missing stable node id");
      }

      upsertNodeSnapshot(state, createNodeSnapshotFromCreateInput(operation.input));
      return createApplyStepResult([nodeId], []);
    }
    case "node.update": {
      const node = findNodeSnapshot(state, operation.nodeId);
      if (!node) {
        return createRejectedApplyStep(
          `node.update target node not found: ${operation.nodeId}`
        );
      }

      upsertNodeSnapshot(state, patchNodeSnapshot(node, operation.input));
      return createApplyStepResult([operation.nodeId], []);
    }
    case "node.move": {
      const node = findNodeSnapshot(state, operation.nodeId);
      if (!node) {
        return createRejectedApplyStep(
          `node.move target node not found: ${operation.nodeId}`
        );
      }

      upsertNodeSnapshot(state, {
        ...node,
        layout: {
          ...node.layout,
          x: operation.input.x,
          y: operation.input.y
        }
      });
      return createApplyStepResult([operation.nodeId], []);
    }
    case "node.resize": {
      const node = findNodeSnapshot(state, operation.nodeId);
      if (!node) {
        return createRejectedApplyStep(
          `node.resize target node not found: ${operation.nodeId}`
        );
      }

      upsertNodeSnapshot(state, {
        ...node,
        layout: {
          ...node.layout,
          width: operation.input.width,
          height: operation.input.height
        }
      });
      return createApplyStepResult([operation.nodeId], []);
    }
    case "node.collapse": {
      const node = findNodeSnapshot(state, operation.nodeId);
      if (!node) {
        return createRejectedApplyStep(
          `node.collapse target node not found: ${operation.nodeId}`
        );
      }

      const nextFlags = { ...(node.flags ?? {}) };
      if (operation.collapsed) {
        nextFlags.collapsed = true;
      } else {
        delete nextFlags.collapsed;
      }

      const nextNode: NodeSerializeResult = { ...node };
      if (Object.keys(nextFlags).length > 0) {
        nextNode.flags = nextFlags;
      } else {
        delete nextNode.flags;
      }

      upsertNodeSnapshot(state, nextNode);
      return createApplyStepResult([operation.nodeId], []);
    }
    case "node.widget.value.set": {
      const node = findNodeSnapshot(state, operation.nodeId);
      if (!node) {
        return createRejectedApplyStep(
          `node.widget.value.set target node not found: ${operation.nodeId}`
        );
      }

      const patchResult = patchNodeWidgetValue(
        node,
        operation.nodeId,
        operation.widgetIndex,
        operation.value,
        "node.widget.value.set"
      );
      if ("reason" in patchResult) {
        return createRejectedApplyStep(patchResult.reason);
      }

      upsertNodeSnapshot(state, patchResult.node);
      return createApplyStepResult([operation.nodeId], []);
    }
    case "node.rename": {
      const node = findNodeSnapshot(state, operation.nodeId);
      if (!node) {
        return createRejectedApplyStep(
          `node.rename 目标节点不存在: ${operation.nodeId}`
        );
      }

      if (node.title === operation.title) {
        return createApplyStepResult([operation.nodeId], []);
      }

      upsertNodeSnapshot(state, {
        ...node,
        title: operation.title
      });
      return createApplyStepResult([operation.nodeId], []);
    }
    case "node.remove": {
      const removedLinkIds = removeNodeSnapshot(state, operation.nodeId);
      return createApplyStepResult([operation.nodeId], removedLinkIds);
    }
    case "link.create": {
      const linkId = operation.input.id;
      if (!linkId) {
        return createRejectedApplyStep("link.create 缺少稳定连线 ID");
      }

      const endpointReason = validateLinkEndpoints(
        state,
        operation.input.source,
        operation.input.target,
        "link.create"
      );
      if (endpointReason) {
        return createRejectedApplyStep(endpointReason);
      }

      upsertLinkSnapshot(state, createLinkSnapshotFromCreateInput(operation.input));
      return createApplyStepResult(
        uniqueNodeIds([operation.input.source.nodeId, operation.input.target.nodeId]),
        [linkId]
      );
    }
    case "link.remove": {
      removeLinkSnapshot(state, operation.linkId);
      return createApplyStepResult([], [operation.linkId]);
    }
    case "link.reconnect": {
      const link = findLinkSnapshot(state, operation.linkId);
      if (!link) {
        return createRejectedApplyStep(
          `link.reconnect 目标连线不存在: ${operation.linkId}`
        );
      }

      const nextLink: GraphLink = {
        ...link,
        source: operation.input.source
          ? structuredClone(operation.input.source)
          : structuredClone(link.source),
        target: operation.input.target
          ? structuredClone(operation.input.target)
          : structuredClone(link.target)
      };

      const endpointReason = validateLinkEndpoints(
        state,
        nextLink.source,
        nextLink.target,
        "link.reconnect"
      );
      if (endpointReason) {
        return createRejectedApplyStep(endpointReason);
      }

      upsertLinkSnapshot(state, nextLink);
      return createApplyStepResult(
        uniqueNodeIds([
          link.source.nodeId,
          link.target.nodeId,
          nextLink.source.nodeId,
          nextLink.target.nodeId
        ]),
        [operation.linkId]
      );
    }
  }
}

function applyFieldChangeToDocument(
  state: WorkingDocumentState,
  fieldChange: GraphDocumentFieldChange
): DocumentApplyStepResult {
  // 先读取当前目标状态与上下文约束，避免处理中出现不一致的中间态。
  const node = findNodeSnapshot(state, fieldChange.nodeId);
  if (!node) {
    return createRejectedApplyStep(
      `fieldChange target node not found: ${fieldChange.nodeId}`
    );
  }

  let nextNode: NodeSerializeResult;

  switch (fieldChange.type) {
    case "node.title.set": {
      nextNode = {
        ...node,
        title: fieldChange.value
      };
      break;
    }
    case "node.property.set": {
      nextNode = {
        ...node,
        properties: {
          ...(node.properties ?? {}),
          [fieldChange.key]: structuredClone(fieldChange.value)
        }
      };
      break;
    }
    case "node.property.unset": {
      if (!node.properties || !(fieldChange.key in node.properties)) {
        return createApplyStepResult([fieldChange.nodeId], []);
      }

      const nextProperties = { ...node.properties };
      delete nextProperties[fieldChange.key];
      nextNode = { ...node };
      if (Object.keys(nextProperties).length > 0) {
        nextNode.properties = nextProperties;
      } else {
        delete nextNode.properties;
      }
      break;
    }
    case "node.data.set": {
      nextNode = {
        ...node,
        data: {
          ...(node.data ?? {}),
          [fieldChange.key]: structuredClone(fieldChange.value)
        }
      };
      break;
    }
    case "node.data.unset": {
      if (!node.data || !(fieldChange.key in node.data)) {
        return createApplyStepResult([fieldChange.nodeId], []);
      }

      const nextData = { ...node.data };
      delete nextData[fieldChange.key];
      nextNode = { ...node };
      if (Object.keys(nextData).length > 0) {
        nextNode.data = nextData;
      } else {
        delete nextNode.data;
      }
      break;
    }
    case "node.flag.set": {
      nextNode = {
        ...node,
        flags: {
          ...(node.flags ?? {}),
          [fieldChange.key]: fieldChange.value
        }
      };
      break;
    }
    case "node.widget.value.set": {
      const patchResult = patchNodeWidgetValue(
        node,
        fieldChange.nodeId,
        fieldChange.widgetIndex,
        fieldChange.value,
        "node.widget.value.set"
      );
      if ("reason" in patchResult) {
        return createRejectedApplyStep(patchResult.reason);
      }

      nextNode = patchResult.node;
      break;
    }
    case "node.widget.replace": {
      if (!node.widgets || fieldChange.widgetIndex < 0) {
        return createRejectedApplyStep(
          `node.widget.replace target widget not found: ${fieldChange.nodeId}#${fieldChange.widgetIndex}`
        );
      }
      if (fieldChange.widgetIndex >= node.widgets.length) {
        return createRejectedApplyStep(
          `node.widget.replace target widget not found: ${fieldChange.nodeId}#${fieldChange.widgetIndex}`
        );
      }

      const nextWidgets = node.widgets.slice();
      nextWidgets[fieldChange.widgetIndex] = structuredClone(fieldChange.widget);
      nextNode = {
        ...node,
        widgets: nextWidgets
      };
      break;
    }
    case "node.widget.remove": {
      if (
        !node.widgets ||
        fieldChange.widgetIndex < 0 ||
        fieldChange.widgetIndex >= node.widgets.length
      ) {
        return createRejectedApplyStep(
          `node.widget.remove target widget not found: ${fieldChange.nodeId}#${fieldChange.widgetIndex}`
        );
      }

      const nextWidgets = node.widgets.slice();
      nextWidgets.splice(fieldChange.widgetIndex, 1);
      nextNode = { ...node };
      if (nextWidgets.length > 0) {
        nextNode.widgets = nextWidgets;
      } else {
        delete nextNode.widgets;
      }
      break;
    }
  }

  upsertNodeSnapshot(state, nextNode);
  return createApplyStepResult([fieldChange.nodeId], []);
}

function patchNodeWidgetValue(
  node: NodeSerializeResult,
  nodeId: string,
  widgetIndex: number,
  value: unknown,
  operationType: "node.widget.value.set"
): PatchNodeWidgetValueResult {
  if (!node.widgets || widgetIndex < 0 || widgetIndex >= node.widgets.length) {
    return {
      reason: `${operationType} target widget not found: ${nodeId}#${widgetIndex}`
    };
  }

  const nextWidgets = node.widgets.slice();
  nextWidgets[widgetIndex] = {
    ...nextWidgets[widgetIndex],
    value: structuredClone(value)
  };

  return {
    node: {
      ...node,
      widgets: nextWidgets
    }
  };
}

function createNodeSnapshotFromCreateInput(
  input: LeaferGraphCreateNodeInput
): NodeSerializeResult {
  return {
    id: input.id!,
    type: input.type,
    ...(input.title !== undefined ? { title: input.title } : {}),
    layout: {
      x: input.x,
      y: input.y,
      ...(input.width !== undefined ? { width: input.width } : {}),
      ...(input.height !== undefined ? { height: input.height } : {})
    },
    ...(input.properties !== undefined
      ? { properties: structuredClone(input.properties) }
      : {}),
    ...(input.propertySpecs !== undefined
      ? { propertySpecs: structuredClone(input.propertySpecs) }
      : {}),
    ...(input.inputs !== undefined ? { inputs: normalizeSlotSpecs(input.inputs) } : {}),
    ...(input.outputs !== undefined
      ? { outputs: normalizeSlotSpecs(input.outputs) }
      : {}),
    ...(input.widgets !== undefined ? { widgets: structuredClone(input.widgets) } : {}),
    ...(input.flags !== undefined ? { flags: structuredClone(input.flags) } : {}),
    ...(input.data !== undefined ? { data: structuredClone(input.data) } : {})
  };
}

function createLinkSnapshotFromCreateInput(
  input: LeaferGraphCreateLinkInput
): GraphLink {
  return {
    id: input.id!,
    source: structuredClone(input.source),
    target: structuredClone(input.target),
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.data !== undefined ? { data: structuredClone(input.data) } : {})
  };
}

function patchNodeSnapshot(
  node: NodeSerializeResult,
  input: LeaferGraphUpdateNodeInput
): NodeSerializeResult {
  const nextNode: NodeSerializeResult = {
    ...node,
    ...(input.title !== undefined ? { title: input.title } : {}),
    layout: {
      ...node.layout,
      ...(input.x !== undefined ? { x: input.x } : {}),
      ...(input.y !== undefined ? { y: input.y } : {}),
      ...(input.width !== undefined ? { width: input.width } : {}),
      ...(input.height !== undefined ? { height: input.height } : {})
    }
  };

  if (input.properties !== undefined) {
    nextNode.properties = structuredClone(input.properties);
  }
  if (input.propertySpecs !== undefined) {
    nextNode.propertySpecs = structuredClone(input.propertySpecs);
  }
  if (input.inputs !== undefined) {
    nextNode.inputs = normalizeSlotSpecs(input.inputs);
  }
  if (input.outputs !== undefined) {
    nextNode.outputs = normalizeSlotSpecs(input.outputs);
  }
  if (input.widgets !== undefined) {
    nextNode.widgets = structuredClone(input.widgets);
  }
  if (input.data !== undefined) {
    nextNode.data = structuredClone(input.data);
  }
  if (input.flags !== undefined) {
    nextNode.flags = structuredClone(input.flags);
  }

  return nextNode;
}

function patchGraphDocumentRoot(
  document: GraphDocument,
  input: LeaferGraphUpdateDocumentInput
): GraphDocument {
  return {
    ...document,
    ...(input.appKind !== undefined ? { appKind: input.appKind } : {}),
    ...(input.meta !== undefined ? { meta: structuredClone(input.meta) } : {}),
    ...(input.capabilityProfile !== undefined
      ? {
          capabilityProfile:
            input.capabilityProfile === null
              ? undefined
              : structuredClone(input.capabilityProfile)
        }
      : {}),
    ...(input.adapterBinding !== undefined
      ? {
          adapterBinding:
            input.adapterBinding === null
              ? undefined
              : structuredClone(input.adapterBinding)
        }
      : {})
  };
}

function cloneGraphDocument(document: GraphDocument): GraphDocument {
  return structuredClone(document);
}

function findNodeSnapshot(
  state: WorkingDocumentState,
  nodeId: string
): NodeSerializeResult | undefined {
  const index = state.nodeIndexById.get(nodeId);
  return index === undefined ? undefined : state.document.nodes[index];
}

function findLinkSnapshot(
  state: WorkingDocumentState,
  linkId: string
): GraphLink | undefined {
  const index = state.linkIndexById.get(linkId);
  return index === undefined ? undefined : state.document.links[index];
}

function upsertNodeSnapshot(
  state: WorkingDocumentState,
  snapshot: NodeSerializeResult
): void {
  const index = state.nodeIndexById.get(snapshot.id);
  if (index !== undefined) {
    state.document.nodes[index] = snapshot;
    return;
  }

  state.nodeIndexById.set(snapshot.id, state.document.nodes.length);
  state.document.nodes.push(snapshot);
}

function upsertLinkSnapshot(
  state: WorkingDocumentState,
  snapshot: GraphLink
): void {
  const index = state.linkIndexById.get(snapshot.id);
  if (index !== undefined) {
    state.document.links[index] = snapshot;
    return;
  }

  state.linkIndexById.set(snapshot.id, state.document.links.length);
  state.document.links.push(snapshot);
}

function removeNodeSnapshot(
  state: WorkingDocumentState,
  nodeId: string
): string[] {
  const nodeIndex = state.nodeIndexById.get(nodeId);
  if (nodeIndex !== undefined) {
    state.document.nodes.splice(nodeIndex, 1);
    state.nodeIndexById.delete(nodeId);
    reindexFrom(state.nodeIndexById, state.document.nodes, (node) => node.id, nodeIndex);
  }

  const removedLinkIds: string[] = [];
  let removedLink = false;
  for (let index = state.document.links.length - 1; index >= 0; index -= 1) {
    const link = state.document.links[index];
    if (link.source.nodeId === nodeId || link.target.nodeId === nodeId) {
      removedLinkIds.push(link.id);
      state.document.links.splice(index, 1);
      state.linkIndexById.delete(link.id);
      removedLink = true;
    }
  }

  if (removedLink) {
    rebuildIndexMap(state.linkIndexById, state.document.links, (link) => link.id);
    removedLinkIds.reverse();
  }

  return removedLinkIds;
}

function removeLinkSnapshot(state: WorkingDocumentState, linkId: string): void {
  const linkIndex = state.linkIndexById.get(linkId);
  if (linkIndex === undefined) {
    return;
  }

  state.document.links.splice(linkIndex, 1);
  state.linkIndexById.delete(linkId);
  reindexFrom(state.linkIndexById, state.document.links, (link) => link.id, linkIndex);
}

/**
 * 处理 `uniqueNodeIds` 相关逻辑。
 *
 * @param nodeIds - 节点 ID 列表。
 * @returns 处理后的结果。
 */
function uniqueNodeIds(nodeIds: readonly string[]): string[] {
  return [...new Set(nodeIds.filter(Boolean))];
}

/**
 * 规范化槽位`Specs`。
 *
 * @param inputs - 输入参数。
 * @returns 处理后的结果。
 */
function normalizeSlotSpecs(
  inputs: readonly LeaferGraphNodeSlotInput[]
): NodeSlotSpec[] {
  return inputs.map((input) =>
    typeof input === "string" ? { name: input } : structuredClone(input)
  );
}

function validateLinkEndpoints(
  state: WorkingDocumentState,
  source: GraphLink["source"],
  target: GraphLink["target"],
  operationType: "link.create" | "link.reconnect"
): string | undefined {
  return (
    validateLinkEndpoint(state, source, "output", operationType) ??
    validateLinkEndpoint(state, target, "input", operationType)
  );
}

function validateLinkEndpoint(
  state: WorkingDocumentState,
  endpoint: GraphLink["source"],
  direction: "input" | "output",
  operationType: "link.create" | "link.reconnect"
): string | undefined {
  const node = findNodeSnapshot(state, endpoint.nodeId);
  if (!node) {
    return `${operationType} ${direction} node not found: ${endpoint.nodeId}`;
  }

  const slotIndex = endpoint.slot ?? 0;
  const slots = direction === "output" ? node.outputs : node.inputs;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || !slots?.[slotIndex]) {
    return `${operationType} ${direction} slot not found: ${endpoint.nodeId}#${slotIndex}`;
  }

  return undefined;
}
