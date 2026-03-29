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

export interface GraphDocumentDiff {
  documentId: GraphDocument["documentId"];
  baseRevision: GraphDocument["revision"];
  revision: GraphDocument["revision"];
  emittedAt: number;
  operations: GraphOperation[];
  fieldChanges: GraphDocumentFieldChange[];
}

export interface GraphDocumentFieldChangeBase {
  nodeId: string;
}

export interface GraphDocumentNodeTitleSetChange
  extends GraphDocumentFieldChangeBase {
  type: "node.title.set";
  value: string;
}

export interface GraphDocumentNodePropertySetChange
  extends GraphDocumentFieldChangeBase {
  type: "node.property.set";
  key: string;
  value: unknown;
}

export interface GraphDocumentNodePropertyUnsetChange
  extends GraphDocumentFieldChangeBase {
  type: "node.property.unset";
  key: string;
}

export interface GraphDocumentNodeDataSetChange
  extends GraphDocumentFieldChangeBase {
  type: "node.data.set";
  key: string;
  value: unknown;
}

export interface GraphDocumentNodeDataUnsetChange
  extends GraphDocumentFieldChangeBase {
  type: "node.data.unset";
  key: string;
}

export interface GraphDocumentNodeFlagSetChange
  extends GraphDocumentFieldChangeBase {
  type: "node.flag.set";
  key: keyof NodeFlags;
  value: boolean;
}

export interface GraphDocumentNodeWidgetValueSetChange
  extends GraphDocumentFieldChangeBase {
  type: "node.widget.value.set";
  widgetIndex: number;
  value: unknown;
}

export interface GraphDocumentNodeWidgetReplaceChange
  extends GraphDocumentFieldChangeBase {
  type: "node.widget.replace";
  widgetIndex: number;
  widget: NodeWidgetSpec;
}

export interface GraphDocumentNodeWidgetRemoveChange
  extends GraphDocumentFieldChangeBase {
  type: "node.widget.remove";
  widgetIndex: number;
}

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

export interface ApplyGraphDocumentDiffResult {
  success: boolean;
  requiresFullReplace: boolean;
  document: GraphDocument;
  affectedNodeIds: string[];
  affectedLinkIds: string[];
  reason?: string;
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

export function applyGraphDocumentDiffToDocument(
  currentDocument: GraphDocument,
  diff: GraphDocumentDiff
): ApplyGraphDocumentDiffResult {
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

interface DocumentApplyStepResult {
  success: boolean;
  document: GraphDocument;
  affectedNodeIds: string[];
  affectedLinkIds: string[];
  reason?: string;
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

function applyOperationToDocument(
  document: GraphDocument,
  operation: GraphOperation
): DocumentApplyStepResult {
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

function applyFieldChangeToDocument(
  document: GraphDocument,
  fieldChange: GraphDocumentFieldChange
): DocumentApplyStepResult {
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
  document: GraphDocument,
  nodeId: string
): NodeSerializeResult | undefined {
  return document.nodes.find((node) => node.id === nodeId);
}

function findLinkSnapshot(
  document: GraphDocument,
  linkId: string
): GraphLink | undefined {
  return document.links.find((link) => link.id === linkId);
}

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

function removeLinkSnapshot(
  document: GraphDocument,
  linkId: string
): GraphDocument {
  return {
    ...document,
    links: document.links.filter((link) => link.id !== linkId)
  };
}

function uniqueNodeIds(nodeIds: readonly string[]): string[] {
  return [...new Set(nodeIds.filter(Boolean))];
}

function normalizeSlotSpecs(
  inputs: readonly LeaferGraphNodeSlotInput[]
): NodeSlotSpec[] {
  return inputs.map((input) =>
    typeof input === "string" ? { name: input } : structuredClone(input)
  );
}
