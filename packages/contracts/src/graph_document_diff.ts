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
} from "@leafergraph/node";
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

/**
 * 根据节点快照创建更新节点输入。
 *
 * @param node - 节点。
 * @returns 创建后的结果对象。
 */
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

  let nextDocument = cloneGraphDocument(currentDocument);
  const affectedNodeIds = new Set<string>();
  const affectedLinkIds = new Set<string>();

  for (const operation of diff.operations) {
    const operationResult = applyOperationToDocument(nextDocument, operation);
    if (!operationResult.success) {
      return createFailedDiffResult(currentDocument, operationResult.reason);
    }

    nextDocument = operationResult.document;
    // 再执行核心更新步骤，并同步派生副作用与收尾状态。
    for (const nodeId of operationResult.affectedNodeIds) {
      affectedNodeIds.add(nodeId);
    }
    for (const linkId of operationResult.affectedLinkIds) {
      affectedLinkIds.add(linkId);
    }
  }

  for (const fieldChange of diff.fieldChanges) {
    const fieldChangeResult = applyFieldChangeToDocument(nextDocument, fieldChange);
    if (!fieldChangeResult.success) {
      return createFailedDiffResult(currentDocument, fieldChangeResult.reason);
    }

    nextDocument = fieldChangeResult.document;
    for (const nodeId of fieldChangeResult.affectedNodeIds) {
      affectedNodeIds.add(nodeId);
    }
  }

  nextDocument = {
    ...nextDocument,
    revision: diff.revision
  };

  return {
    success: true,
    requiresFullReplace: false,
    document: nextDocument,
    affectedNodeIds: [...affectedNodeIds],
    affectedLinkIds: [...affectedLinkIds]
  };
}

/**
 * 单步文档应用过程的内部结果。
 */
interface DocumentApplyStepResult {
  /** 当前步骤是否成功。 */
  success: boolean;
  /** 当前步骤处理后的文档快照。 */
  document: GraphDocument;
  /** 当前步骤影响的节点 ID。 */
  affectedNodeIds: string[];
  /** 当前步骤影响的连线 ID。 */
  affectedLinkIds: string[];
  /** 当前步骤失败原因。 */
  reason?: string;
}

/**
 * 创建`Failed` 差异结果。
 *
 * @param currentDocument - `current` 文档。
 * @param reason - `reason`。
 * @returns 创建后的结果对象。
 */
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

/**
 * 应用`Operation`到文档。
 *
 * @param document - 文档。
 * @param operation - `operation`。
 * @returns 处理后的结果。
 */
function applyOperationToDocument(
  document: GraphDocument,
  operation: GraphOperation
): DocumentApplyStepResult {
  // 先读取当前目标状态与上下文约束，避免处理中出现不一致的中间态。
  switch (operation.type) {
    case "document.update":
      return createApplyStepResult(
        patchGraphDocumentRoot(document, operation.input),
        [],
        []
      );
    case "node.create": {
      const nodeId = operation.input.id;
      if (!nodeId) {
        return createRejectedApplyStep(document, "node.create 缺少稳定节点 ID");
      }

      return createApplyStepResult(
        upsertNodeSnapshot(
          document,
          createNodeSnapshotFromCreateInput(operation.input)
        ),
        [nodeId],
        []
      );
    }
    case "node.update": {
      const node = findNodeSnapshot(document, operation.nodeId);
      if (!node) {
        return createRejectedApplyStep(
          document,
          `node.update 目标节点不存在: ${operation.nodeId}`
        );
      }

      const nextNode = patchNodeSnapshot(node, operation.input);
      return createApplyStepResult(
        upsertNodeSnapshot(document, nextNode),
        [operation.nodeId],
        []
      );
    }
    case "node.move": {
      const node = findNodeSnapshot(document, operation.nodeId);
      if (!node) {
        return createRejectedApplyStep(
          document,
          `node.move 目标节点不存在: ${operation.nodeId}`
        );
      }

      return createApplyStepResult(
        upsertNodeSnapshot(document, {
          ...node,
          layout: {
            ...node.layout,
            x: operation.input.x,
            y: operation.input.y
          }
        }),
        [operation.nodeId],
        []
      );
    }
    case "node.resize": {
      // 再执行核心更新步骤，并同步派生副作用与收尾状态。
      const node = findNodeSnapshot(document, operation.nodeId);
      if (!node) {
        return createRejectedApplyStep(
          document,
          `node.resize 目标节点不存在: ${operation.nodeId}`
        );
      }

      return createApplyStepResult(
        upsertNodeSnapshot(document, {
          ...node,
          layout: {
            ...node.layout,
            width: operation.input.width,
            height: operation.input.height
          }
        }),
        [operation.nodeId],
        []
      );
    }
    case "node.collapse": {
      const node = findNodeSnapshot(document, operation.nodeId);
      if (!node) {
        return createRejectedApplyStep(
          document,
          `node.collapse 目标节点不存在: ${operation.nodeId}`
        );
      }

      const nextFlags = structuredClone(node.flags ?? {});
      if (operation.collapsed) {
        nextFlags.collapsed = true;
      } else {
        delete nextFlags.collapsed;
      }

      const nextNode = {
        ...node
      };
      if (Object.keys(nextFlags).length) {
        nextNode.flags = nextFlags;
      } else {
        delete nextNode.flags;
      }

      return createApplyStepResult(
        upsertNodeSnapshot(document, nextNode),
        [operation.nodeId],
        []
      );
    }
    case "node.widget.value.set": {
      const node = findNodeSnapshot(document, operation.nodeId);
      if (!node) {
        return createRejectedApplyStep(
          document,
          `node.widget.value.set 目标节点不存在: ${operation.nodeId}`
        );
      }

      const widget = node.widgets?.[operation.widgetIndex];
      if (!widget) {
        return createRejectedApplyStep(
          document,
          `node.widget.value.set 目标 widget 不存在: ${operation.nodeId}#${operation.widgetIndex}`
        );
      }

      const nextWidgets = structuredClone(node.widgets ?? []);
      nextWidgets[operation.widgetIndex] = {
        ...nextWidgets[operation.widgetIndex],
        value: structuredClone(operation.value)
      };

      return createApplyStepResult(
        upsertNodeSnapshot(document, {
          ...node,
          widgets: nextWidgets
        }),
        [operation.nodeId],
        []
      );
    }
    case "node.rename": {
      const node = findNodeSnapshot(document, operation.nodeId);
      if (!node) {
        return createRejectedApplyStep(
          document,
          `node.rename 目标节点不存在: ${operation.nodeId}`
        );
      }

      if (node.title === operation.title) {
        return createApplyStepResult(document, [operation.nodeId], []);
      }

      const updatedDocument = upsertNodeSnapshot(document, {
        ...node,
        title: operation.title
      });

      return createApplyStepResult(updatedDocument, [operation.nodeId], []);
    }
    case "node.remove":
      return createApplyStepResult(
        removeNodeSnapshot(document, operation.nodeId),
        [operation.nodeId],
        document.links
          .filter(
            (link) =>
              link.source.nodeId === operation.nodeId ||
              link.target.nodeId === operation.nodeId
          )
          .map((link) => link.id)
      );
    case "link.create": {
      const linkId = operation.input.id;
      if (!linkId) {
        return createRejectedApplyStep(document, "link.create 缺少稳定连线 ID");
      }

      return createApplyStepResult(
        upsertLinkSnapshot(
          document,
          createLinkSnapshotFromCreateInput(operation.input)
        ),
        uniqueNodeIds([
          operation.input.source.nodeId,
          operation.input.target.nodeId
        ]),
        [linkId]
      );
    }
    case "link.remove":
      return createApplyStepResult(
        removeLinkSnapshot(document, operation.linkId),
        [],
        [operation.linkId]
      );
    case "link.reconnect": {
      const link = findLinkSnapshot(document, operation.linkId);
      if (!link) {
        return createRejectedApplyStep(
          document,
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

      return createApplyStepResult(
        upsertLinkSnapshot(document, nextLink),
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

/**
 * 应用字段`Change`到文档。
 *
 * @param document - 文档。
 * @param fieldChange - 字段`Change`。
 * @returns 处理后的结果。
 */
function applyFieldChangeToDocument(
  document: GraphDocument,
  fieldChange: GraphDocumentFieldChange
): DocumentApplyStepResult {
  // 先读取当前目标状态与上下文约束，避免处理中出现不一致的中间态。
  const node = findNodeSnapshot(document, fieldChange.nodeId);
  if (!node) {
    return createRejectedApplyStep(
      document,
      `fieldChange 目标节点不存在: ${fieldChange.nodeId}`
    );
  }

  const nextNode = structuredClone(node);

  switch (fieldChange.type) {
    case "node.title.set":
      nextNode.title = fieldChange.value;
      break;
    case "node.property.set":
      nextNode.properties = {
        ...(nextNode.properties ?? {}),
        [fieldChange.key]: structuredClone(fieldChange.value)
      };
      break;
    case "node.property.unset":
      if (!nextNode.properties || !(fieldChange.key in nextNode.properties)) {
        return createApplyStepResult(document, [fieldChange.nodeId], []);
      }
      nextNode.properties = structuredClone(nextNode.properties);
      delete nextNode.properties[fieldChange.key];
      if (!Object.keys(nextNode.properties).length) {
        delete nextNode.properties;
      }
      break;
    case "node.data.set":
      nextNode.data = {
        ...(nextNode.data ?? {}),
        [fieldChange.key]: structuredClone(fieldChange.value)
      };
      break;
    case "node.data.unset":
      if (!nextNode.data || !(fieldChange.key in nextNode.data)) {
        return createApplyStepResult(document, [fieldChange.nodeId], []);
      }
      nextNode.data = structuredClone(nextNode.data);
      delete nextNode.data[fieldChange.key];
      if (!Object.keys(nextNode.data).length) {
        delete nextNode.data;
      }
      break;
    case "node.flag.set":
      // 再执行核心更新步骤，并同步派生副作用与收尾状态。
      nextNode.flags = {
        ...(nextNode.flags ?? {}),
        [fieldChange.key]: fieldChange.value
      };
      break;
    case "node.widget.value.set": {
      const widget = nextNode.widgets?.[fieldChange.widgetIndex];
      if (!widget) {
        return createRejectedApplyStep(
          document,
          `node.widget.value.set 目标 widget 不存在: ${fieldChange.nodeId}#${fieldChange.widgetIndex}`
        );
      }
      const nextWidgets = structuredClone(nextNode.widgets ?? []);
      if (!nextWidgets[fieldChange.widgetIndex]) {
        return createRejectedApplyStep(
          document,
          `node.widget.value.set 目标 widget 不存在: ${fieldChange.nodeId}#${fieldChange.widgetIndex}`
        );
      }
      nextWidgets[fieldChange.widgetIndex] = {
        ...nextWidgets[fieldChange.widgetIndex],
        value: structuredClone(fieldChange.value)
      };
      nextNode.widgets = nextWidgets;
      break;
    }
    case "node.widget.replace":
      if (!nextNode.widgets || fieldChange.widgetIndex < 0) {
        return createRejectedApplyStep(
          document,
          `node.widget.replace 目标 widget 不存在: ${fieldChange.nodeId}#${fieldChange.widgetIndex}`
        );
      }
      nextNode.widgets = structuredClone(nextNode.widgets);
      if (fieldChange.widgetIndex >= nextNode.widgets.length) {
        return createRejectedApplyStep(
          document,
          `node.widget.replace 目标 widget 不存在: ${fieldChange.nodeId}#${fieldChange.widgetIndex}`
        );
      }
      nextNode.widgets[fieldChange.widgetIndex] = structuredClone(fieldChange.widget);
      break;
    case "node.widget.remove":
      if (
        !nextNode.widgets ||
        fieldChange.widgetIndex < 0 ||
        fieldChange.widgetIndex >= nextNode.widgets.length
      ) {
        return createRejectedApplyStep(
          document,
          `node.widget.remove 目标 widget 不存在: ${fieldChange.nodeId}#${fieldChange.widgetIndex}`
        );
      }
      nextNode.widgets = structuredClone(nextNode.widgets);
      nextNode.widgets.splice(fieldChange.widgetIndex, 1);
      if (!nextNode.widgets.length) {
        delete nextNode.widgets;
      }
      break;
  }

  return createApplyStepResult(
    upsertNodeSnapshot(document, nextNode),
    [fieldChange.nodeId],
    []
  );
}

/**
 * 创建`Apply` 步骤结果。
 *
 * @param document - 文档。
 * @param affectedNodeIds - `affected` 节点 ID 列表。
 * @param affectedLinkIds - `affected` 连线 ID 列表。
 * @returns 创建后的结果对象。
 */
function createApplyStepResult(
  document: GraphDocument,
  affectedNodeIds: string[],
  affectedLinkIds: string[]
): DocumentApplyStepResult {
  return {
    success: true,
    document,
    affectedNodeIds,
    affectedLinkIds
  };
}

/**
 * 处理 `createRejectedApplyStep` 相关逻辑。
 *
 * @param document - 文档。
 * @param reason - `reason`。
 * @returns 创建后的结果对象。
 */
function createRejectedApplyStep(
  document: GraphDocument,
  reason: string
): DocumentApplyStepResult {
  return {
    success: false,
    document,
    affectedNodeIds: [],
    affectedLinkIds: [],
    reason
  };
}

/**
 * 根据创建输入创建节点快照。
 *
 * @param input - 输入参数。
 * @returns 创建后的结果对象。
 */
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
    ...(input.inputs !== undefined
      ? { inputs: normalizeSlotSpecs(input.inputs) }
      : {}),
    ...(input.outputs !== undefined
      ? { outputs: normalizeSlotSpecs(input.outputs) }
      : {}),
    ...(input.widgets !== undefined ? { widgets: structuredClone(input.widgets) } : {}),
    ...(input.flags !== undefined ? { flags: structuredClone(input.flags) } : {}),
    ...(input.data !== undefined ? { data: structuredClone(input.data) } : {})
  };
}

/**
 * 根据创建输入创建连线快照。
 *
 * @param input - 输入参数。
 * @returns 创建后的结果对象。
 */
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

/**
 * 修补节点快照。
 *
 * @param node - 节点。
 * @param input - 输入参数。
 * @returns 修补节点快照的结果。
 */
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

/**
 * 修补图文档根节点。
 *
 * @param document - 文档。
 * @param input - 输入参数。
 * @returns 修补图文档根节点的结果。
 */
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

/**
 * 克隆图文档。
 *
 * @param document - 文档。
 * @returns 处理后的结果。
 */
function cloneGraphDocument(document: GraphDocument): GraphDocument {
  return structuredClone(document);
}

/**
 * 查找节点快照。
 *
 * @param document - 文档。
 * @param nodeId - 目标节点 ID。
 * @returns 处理后的结果。
 */
function findNodeSnapshot(
  document: GraphDocument,
  nodeId: string
): NodeSerializeResult | undefined {
  return document.nodes.find((node) => node.id === nodeId);
}

/**
 * 查找连线快照。
 *
 * @param document - 文档。
 * @param linkId - 目标连线 ID。
 * @returns 处理后的结果。
 */
function findLinkSnapshot(
  document: GraphDocument,
  linkId: string
): GraphLink | undefined {
  return document.links.find((link) => link.id === linkId);
}

/**
 * 处理 `upsertNodeSnapshot` 相关逻辑。
 *
 * @param document - 文档。
 * @param snapshot - 快照。
 * @returns 处理后的结果。
 */
function upsertNodeSnapshot(
  document: GraphDocument,
  snapshot: NodeSerializeResult
): GraphDocument {
  const nextNodes = document.nodes.filter((node) => node.id !== snapshot.id);
  nextNodes.push(structuredClone(snapshot));
  return {
    ...document,
    nodes: nextNodes
  };
}

/**
 * 处理 `upsertLinkSnapshot` 相关逻辑。
 *
 * @param document - 文档。
 * @param snapshot - 快照。
 * @returns 处理后的结果。
 */
function upsertLinkSnapshot(
  document: GraphDocument,
  snapshot: GraphLink
): GraphDocument {
  const nextLinks = document.links.filter((link) => link.id !== snapshot.id);
  nextLinks.push(structuredClone(snapshot));
  return {
    ...document,
    links: nextLinks
  };
}

/**
 * 移除节点快照。
 *
 * @param document - 文档。
 * @param nodeId - 目标节点 ID。
 * @returns 移除节点快照的结果。
 */
function removeNodeSnapshot(
  document: GraphDocument,
  nodeId: string
): GraphDocument {
  return {
    ...document,
    nodes: document.nodes.filter((node) => node.id !== nodeId),
    links: document.links.filter(
      (link) => link.source.nodeId !== nodeId && link.target.nodeId !== nodeId
    )
  };
}

/**
 * 移除连线快照。
 *
 * @param document - 文档。
 * @param linkId - 目标连线 ID。
 * @returns 移除连线快照的结果。
 */
function removeLinkSnapshot(
  document: GraphDocument,
  linkId: string
): GraphDocument {
  return {
    ...document,
    links: document.links.filter((link) => link.id !== linkId)
  };
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
