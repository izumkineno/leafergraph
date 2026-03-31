import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  NodeSerializeResult
} from "@leafergraph/node";
import type {
  GraphOperation,
  LeaferGraphHistoryEvent,
  LeaferGraphInteractionCommitEvent
} from "@leafergraph/contracts";
import { createLeaferGraph } from "../src";

function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", {
    configurable: true,
    value: 1200
  });
  Object.defineProperty(container, "clientHeight", {
    configurable: true,
    value: 800
  });
  container.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1200,
      bottom: 800,
      width: 1200,
      height: 800,
      toJSON() {
        return this;
      }
    }) as DOMRect;
  document.body.appendChild(container);
  return container;
}

function createEmptyDocument(): GraphDocument {
  return {
    documentId: "history-runtime-doc",
    revision: 1,
    appKind: "history-runtime-test",
    nodes: [],
    links: []
  };
}

function createDocumentWithNodes(
  nodes: NodeSerializeResult[],
  revision: number
): GraphDocument {
  return {
    documentId: "history-runtime-doc",
    revision,
    appKind: "history-runtime-test",
    nodes,
    links: []
  };
}

async function createReadyGraph() {
  const container = createContainer();
  const graph = createLeaferGraph(container, {
    document: createEmptyDocument()
  });

  await graph.ready;
  graph.registerNode(
    {
      type: "test/source",
      title: "Source",
      outputs: [{ name: "out" }]
    },
    { overwrite: true }
  );
  graph.registerNode(
    {
      type: "test/target",
      title: "Target",
      inputs: [{ name: "in" }]
    },
    { overwrite: true }
  );

  return {
    graph,
    container
  };
}

function createReconnectOperation(
  linkId: string,
  targetNodeId: string
): GraphOperation {
  return {
    type: "link.reconnect",
    operationId: `test:link.reconnect:${linkId}:${targetNodeId}`,
    timestamp: Date.now(),
    source: "test",
    linkId,
    input: {
      target: {
        nodeId: targetNodeId,
        slot: 0
      }
    }
  };
}

describe("history_runtime_integration", () => {
  test("subscribeHistory 会按 operation / snapshot 分类正式变更", async () => {
    const { graph, container } = await createReadyGraph();
    const records: Array<{
      kind: string;
      label?: string;
      source: string;
    }> = [];
    const unsubscribe = graph.subscribeHistory((event) => {
      if (event.type === "history.record") {
        records.push({
          kind: event.record.kind,
          label: event.record.label,
          source: event.record.source
        });
      }
    });

    try {
      graph.createNode({ id: "source-node", type: "test/source", x: 0, y: 0 });
      graph.createNode({ id: "target-a", type: "test/target", x: 280, y: 0 });
      graph.createNode({ id: "target-b", type: "test/target", x: 560, y: 0 });
      graph.moveNode("source-node", { x: 40, y: 24 });
      graph.updateNode("source-node", { title: "Source Updated" });
      graph.setNodeCollapsed("target-a", true);
      const link = graph.createLink({
        source: { nodeId: "source-node", slot: 0 },
        target: { nodeId: "target-a", slot: 0 }
      });
      graph.applyGraphOperation(createReconnectOperation(link.id, "target-b"));
      graph.removeLink(link.id);
      graph.removeNode("target-b");

      expect(records).toEqual([
        { kind: "operation", label: "Create Node", source: "api" },
        { kind: "operation", label: "Create Node", source: "api" },
        { kind: "operation", label: "Create Node", source: "api" },
        { kind: "operation", label: "Move Node", source: "api" },
        { kind: "snapshot", label: "Update Node", source: "api" },
        { kind: "snapshot", label: "Collapse Node", source: "api" },
        { kind: "operation", label: "Create Link", source: "api" },
        { kind: "operation", label: "Reconnect Link", source: "test" },
        { kind: "operation", label: "Remove Link", source: "api" },
        { kind: "snapshot", label: "Remove Node", source: "api" }
      ]);
    } finally {
      unsubscribe();
      graph.destroy();
      container.remove();
    }
  });

  test("replaceGraphDocument 和 applyGraphDocumentDiff 会发出 history.reset", async () => {
    const { graph, container } = await createReadyGraph();
    const resetReasons: string[] = [];
    const unsubscribe = graph.subscribeHistory((event) => {
      if (event.type === "history.reset") {
        resetReasons.push(event.reason);
      }
    });

    try {
      const initialDocument = createDocumentWithNodes(
        [
          {
            id: "source-node",
            type: "test/source",
            title: "Source",
            layout: {
              x: 0,
              y: 0,
              width: 160,
              height: 80
            },
            outputs: [{ name: "out" }]
          }
        ],
        2
      );
      graph.replaceGraphDocument(initialDocument);

      const nextDocument = createDocumentWithNodes(
        [
          {
            id: "source-node",
            type: "test/source",
            title: "Source",
            layout: {
              x: 180,
              y: 60,
              width: 160,
              height: 80
            },
            outputs: [{ name: "out" }]
          }
        ],
        3
      );
      const diffResult = graph.applyGraphDocumentDiff(
        {
          documentId: "history-runtime-doc",
          baseRevision: 2,
          revision: 3,
          emittedAt: Date.now(),
          operations: [
            {
              type: "node.move",
              operationId: "diff:node.move:source-node",
              timestamp: Date.now(),
              source: "authority",
              nodeId: "source-node",
              input: {
                x: 180,
                y: 60
              }
            }
          ],
          fieldChanges: []
        },
        nextDocument
      );

      expect(diffResult.success).toBe(true);
      expect(diffResult.requiresFullReplace).toBe(false);
      expect(resetReasons).toEqual([
        "replace-document",
        "apply-document-diff"
      ]);
    } finally {
      unsubscribe();
      graph.destroy();
      container.remove();
    }
  });

  test("link.create.commit 会在本地自动落图并发出 history.record", async () => {
    const { graph, container } = await createReadyGraph();
    const historyEvents: LeaferGraphHistoryEvent[] = [];
    const unsubscribe = graph.subscribeHistory((event) => {
      historyEvents.push(event);
    });

    try {
      graph.createNode({ id: "source-node", type: "test/source", x: 0, y: 0 });
      graph.createNode({ id: "target-node", type: "test/target", x: 320, y: 0 });

      const interactionCommitSource = (
        graph as unknown as {
          apiHost: {
            options: {
              runtime: {
                interactionCommitSource: {
                  emit(event: LeaferGraphInteractionCommitEvent): void;
                };
              };
            };
          };
        }
      ).apiHost.options.runtime.interactionCommitSource;

      interactionCommitSource.emit({
        type: "link.create.commit",
        input: {
          source: { nodeId: "source-node", slot: 0 },
          target: { nodeId: "target-node", slot: 0 }
        }
      });

      const links = graph.findLinksByNode("source-node");
      expect(links).toHaveLength(1);
      expect(
        historyEvents.some(
          (event) =>
            event.type === "history.record" &&
            event.record.kind === "operation" &&
            event.record.source === "interaction.commit" &&
            event.record.label === "Create Link"
        )
      ).toBe(true);
    } finally {
      unsubscribe();
      graph.destroy();
      container.remove();
    }
  });
});
