import type { GraphDocument, NodeFlags, NodeSerializeResult } from "@leafergraph/node";
import type { GraphOperation } from "@leafergraph/contracts";
import type {
  GraphDocumentDiff,
  GraphDocumentFieldChange
} from "@leafergraph/contracts/graph-document-diff";

export class DiffEngine {
  computeDiff(
    oldDocument: GraphDocument,
    newDocument: GraphDocument
  ): GraphDocumentDiff {
    const operations: GraphOperation[] = [];
    const fieldChanges: GraphDocumentFieldChange[] = [];

    this.computeNodesDiff(oldDocument, newDocument, operations, fieldChanges);
    this.computeLinksDiff(oldDocument, newDocument, operations);

    return {
      documentId: newDocument.documentId || "",
      baseRevision: oldDocument.revision || 0,
      revision: newDocument.revision || 0,
      emittedAt: Date.now(),
      operations,
      fieldChanges
    };
  }

  private computeNodesDiff(
    oldDocument: GraphDocument,
    newDocument: GraphDocument,
    operations: GraphOperation[],
    fieldChanges: GraphDocumentFieldChange[]
  ): void {
    const oldNodesMap = new Map(oldDocument.nodes.map((node) => [node.id, node]));
    const newNodesMap = new Map(newDocument.nodes.map((node) => [node.id, node]));

    for (const [nodeId, newNode] of newNodesMap) {
      const oldNode = oldNodesMap.get(nodeId);
      if (!oldNode) {
        operations.push({
          operationId: `node.create:${nodeId}:${Date.now()}`,
          timestamp: Date.now(),
          source: "diff.engine",
          type: "node.create",
          input: {
            id: nodeId,
            type: newNode.type,
            title: newNode.title,
            x: newNode.layout.x,
            y: newNode.layout.y,
            width: newNode.layout.width,
            height: newNode.layout.height,
            properties: newNode.properties,
            propertySpecs: newNode.propertySpecs,
            inputs: newNode.inputs,
            outputs: newNode.outputs,
            widgets: newNode.widgets,
            data: newNode.data,
            flags: newNode.flags
          }
        });
        continue;
      }

      this.computeNodeChanges(oldNode, newNode, operations, fieldChanges);
    }

    for (const [nodeId] of oldNodesMap) {
      if (!newNodesMap.has(nodeId)) {
        operations.push({
          operationId: `node.remove:${nodeId}:${Date.now()}`,
          timestamp: Date.now(),
          source: "diff.engine",
          type: "node.remove",
          nodeId
        });
      }
    }
  }

  private computeLinksDiff(
    oldDocument: GraphDocument,
    newDocument: GraphDocument,
    operations: GraphOperation[]
  ): void {
    const oldLinksMap = new Map(oldDocument.links.map((link) => [link.id, link]));
    const newLinksMap = new Map(newDocument.links.map((link) => [link.id, link]));

    for (const [linkId, newLink] of newLinksMap) {
      const oldLink = oldLinksMap.get(linkId);
      if (!oldLink) {
        operations.push({
          operationId: `link.create:${linkId}:${Date.now()}`,
          timestamp: Date.now(),
          source: "diff.engine",
          type: "link.create",
          input: {
            id: linkId,
            source: newLink.source,
            target: newLink.target,
            label: newLink.label,
            data: newLink.data
          }
        });
        continue;
      }

      if (
        JSON.stringify(oldLink.source) !== JSON.stringify(newLink.source) ||
        JSON.stringify(oldLink.target) !== JSON.stringify(newLink.target)
      ) {
        operations.push({
          operationId: `link.reconnect:${linkId}:${Date.now()}`,
          timestamp: Date.now(),
          source: "diff.engine",
          type: "link.reconnect",
          linkId,
          input: {
            source: newLink.source,
            target: newLink.target
          }
        });
      }
    }

    for (const [linkId] of oldLinksMap) {
      if (!newLinksMap.has(linkId)) {
        operations.push({
          operationId: `link.remove:${linkId}:${Date.now()}`,
          timestamp: Date.now(),
          source: "diff.engine",
          type: "link.remove",
          linkId
        });
      }
    }
  }

  private computeNodeChanges(
    oldNode: NodeSerializeResult,
    newNode: NodeSerializeResult,
    operations: GraphOperation[],
    fieldChanges: GraphDocumentFieldChange[]
  ): void {
    if (oldNode.title !== newNode.title) {
      fieldChanges.push({
        type: "node.title.set",
        nodeId: oldNode.id,
        value: newNode.title || ""
      });
    }

    if (oldNode.layout.x !== newNode.layout.x || oldNode.layout.y !== newNode.layout.y) {
      operations.push({
        operationId: `node.move:${oldNode.id}:${Date.now()}`,
        timestamp: Date.now(),
        source: "diff.engine",
        type: "node.move",
        nodeId: oldNode.id,
        input: {
          x: newNode.layout.x,
          y: newNode.layout.y
        }
      });
    }

    if (
      oldNode.layout.width !== newNode.layout.width ||
      oldNode.layout.height !== newNode.layout.height
    ) {
      operations.push({
        operationId: `node.resize:${oldNode.id}:${Date.now()}`,
        timestamp: Date.now(),
        source: "diff.engine",
        type: "node.resize",
        nodeId: oldNode.id,
        input: {
          width: Number(newNode.layout.width) || 0,
          height: Number(newNode.layout.height) || 0
        }
      });
    }

    this.computePropertyChanges(oldNode, newNode, fieldChanges);
    this.computeDataChanges(oldNode, newNode, fieldChanges);
    this.computeFlagChanges(oldNode, newNode, operations, fieldChanges);
    this.computeWidgetChanges(oldNode, newNode, operations, fieldChanges);
  }

  private computePropertyChanges(
    oldNode: NodeSerializeResult,
    newNode: NodeSerializeResult,
    fieldChanges: GraphDocumentFieldChange[]
  ): void {
    const oldProps = oldNode.properties || {};
    const newProps = newNode.properties || {};

    for (const [key, value] of Object.entries(newProps)) {
      if (oldProps[key] !== value) {
        fieldChanges.push({
          type: "node.property.set",
          nodeId: oldNode.id,
          key,
          value
        });
      }
    }

    for (const key of Object.keys(oldProps)) {
      if (!(key in newProps)) {
        fieldChanges.push({
          type: "node.property.unset",
          nodeId: oldNode.id,
          key
        });
      }
    }
  }

  private computeDataChanges(
    oldNode: NodeSerializeResult,
    newNode: NodeSerializeResult,
    fieldChanges: GraphDocumentFieldChange[]
  ): void {
    const oldData = oldNode.data || {};
    const newData = newNode.data || {};

    for (const [key, value] of Object.entries(newData)) {
      if (oldData[key] !== value) {
        fieldChanges.push({
          type: "node.data.set",
          nodeId: oldNode.id,
          key,
          value
        });
      }
    }

    for (const key of Object.keys(oldData)) {
      if (!(key in newData)) {
        fieldChanges.push({
          type: "node.data.unset",
          nodeId: oldNode.id,
          key
        });
      }
    }
  }

  private computeFlagChanges(
    oldNode: NodeSerializeResult,
    newNode: NodeSerializeResult,
    operations: GraphOperation[],
    fieldChanges: GraphDocumentFieldChange[]
  ): void {
    const oldFlags = oldNode.flags || {};
    const newFlags = newNode.flags || {};
    const oldCollapsed = Boolean((oldFlags as Record<string, unknown>).collapsed);
    const nextCollapsed = Boolean((newFlags as Record<string, unknown>).collapsed);

    if (oldCollapsed !== nextCollapsed) {
      operations.push({
        operationId: `node.collapse:${oldNode.id}:${Date.now()}`,
        timestamp: Date.now(),
        source: "diff.engine",
        type: "node.collapse",
        nodeId: oldNode.id,
        collapsed: nextCollapsed
      });
    }

    for (const [key, value] of Object.entries(newFlags)) {
      if (key === "collapsed") {
        continue;
      }
      if ((oldFlags as Record<string, unknown>)[key] !== value) {
        fieldChanges.push({
          type: "node.flag.set",
          nodeId: oldNode.id,
          key: key as keyof NodeFlags,
          value: Boolean(value)
        });
      }
    }
  }

  private computeWidgetChanges(
    oldNode: NodeSerializeResult,
    newNode: NodeSerializeResult,
    operations: GraphOperation[],
    fieldChanges: GraphDocumentFieldChange[]
  ): void {
    const oldWidgets = oldNode.widgets || [];
    const newWidgets = newNode.widgets || [];

    for (let index = 0; index < Math.max(oldWidgets.length, newWidgets.length); index += 1) {
      const oldWidget = oldWidgets[index];
      const newWidget = newWidgets[index];

      if (!oldWidget && newWidget) {
        continue;
      }

      if (oldWidget && !newWidget) {
        fieldChanges.push({
          type: "node.widget.remove",
          nodeId: oldNode.id,
          widgetIndex: index
        });
        continue;
      }

      if (!oldWidget || !newWidget) {
        continue;
      }

      if (oldWidget.value !== newWidget.value) {
        operations.push({
          operationId: `node.widget.value.set:${oldNode.id}:${index}:${Date.now()}`,
          timestamp: Date.now(),
          source: "diff.engine",
          type: "node.widget.value.set",
          nodeId: oldNode.id,
          widgetIndex: index,
          value: newWidget.value
        });
      }

      const oldWidgetWithoutValue = { ...oldWidget };
      const newWidgetWithoutValue = { ...newWidget };
      delete (oldWidgetWithoutValue as Record<string, unknown>).value;
      delete (newWidgetWithoutValue as Record<string, unknown>).value;

      if (
        JSON.stringify(oldWidgetWithoutValue) !==
        JSON.stringify(newWidgetWithoutValue)
      ) {
        fieldChanges.push({
          type: "node.widget.replace",
          nodeId: oldNode.id,
          widgetIndex: index,
          widget: newWidget
        });
      }
    }
  }
}
