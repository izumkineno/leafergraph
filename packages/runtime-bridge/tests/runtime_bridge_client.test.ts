import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "@leafergraph/node";
import type {
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphHistoryEvent,
  RuntimeFeedbackEvent
} from "@leafergraph/contracts";
import type {
  ApplyGraphDocumentDiffResult,
  GraphDocumentDiff
} from "@leafergraph/contracts/graph-document-diff";
import type {
  LeaferGraphRuntimeBridgeTransport,
  RuntimeBridgeCommand,
  RuntimeBridgeCommandResult,
  RuntimeBridgeControlCommand,
  RuntimeBridgeInboundEvent
} from "../src/transport/index.js";
import { LeaferGraphRuntimeBridgeClient } from "../src/client/index.js";
import { RuntimeBridgeBrowserExtensionManager } from "../src/extensions/index.js";

function createDocument(revision: string): GraphDocument {
  return {
    documentId: "bridge-doc",
    revision,
    appKind: "bridge-test",
    nodes: [
      {
        id: "node-1",
        type: "demo/node",
        title: "Node 1",
        layout: {
          x: 0,
          y: 0,
          width: 120,
          height: 80
        },
        widgets: [
          {
            type: "number",
            name: "value",
            value: 100
          }
        ]
      }
    ],
    links: []
  };
}

function createDiff(revision: string): GraphDocumentDiff {
  return {
    documentId: "bridge-doc",
    baseRevision: "1",
    revision,
    emittedAt: 2,
    operations: [
      {
        type: "node.collapse",
        nodeId: "node-1",
        collapsed: true,
        operationId: "collapse-1",
        timestamp: 2,
        source: "authority.diff"
      }
    ],
    fieldChanges: []
  };
}

function flushQueue(): Promise<void> {
  return Promise.resolve()
    .then(() => undefined)
    .then(() => undefined)
    .then(() => undefined)
    .then(() => undefined);
}

class MockTransport implements LeaferGraphRuntimeBridgeTransport {
  snapshot = createDocument("1");
  snapshotRequests = 0;
  submittedOperations: readonly GraphOperation[] = [];
  controlCommands: RuntimeBridgeControlCommand[] = [];
  commands: RuntimeBridgeCommand[] = [];
  private readonly listeners = new Set<
    (event: RuntimeBridgeInboundEvent) => void
  >();

  async requestSnapshot(): Promise<GraphDocument> {
    this.snapshotRequests += 1;
    return structuredClone(this.snapshot);
  }

  async submitOperations(
    operations: readonly GraphOperation[]
  ): Promise<readonly GraphOperationApplyResult[]> {
    this.submittedOperations = operations;
    return operations.map((operation) => ({
      accepted: true,
      changed: true,
      operation,
      affectedNodeIds: [],
      affectedLinkIds: []
    }));
  }

  async sendControl(command: RuntimeBridgeControlCommand): Promise<void> {
    this.controlCommands.push(command);
  }

  async requestCommand(
    command: RuntimeBridgeCommand
  ): Promise<RuntimeBridgeCommandResult> {
    this.commands.push(command);
    if (command.type === "catalog.list") {
      return {
        type: "catalog.list.result",
        sync: {
          entries: [],
          activeNodeEntryIds: [],
          activeComponentEntryIds: [],
          currentBlueprintId: null,
          emittedAt: Date.now()
        }
      };
    }

    return {
      type: "control.ok"
    };
  }

  subscribe(listener: (event: RuntimeBridgeInboundEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: RuntimeBridgeInboundEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

function createFakeGraph(document: GraphDocument) {
  const state = {
    document: structuredClone(document),
    replacedDocuments: [] as GraphDocument[],
    appliedDiffs: [] as Array<{
      diff: GraphDocumentDiff;
      nextDocument: GraphDocument;
    }>,
    projectedFeedbacks: [] as RuntimeFeedbackEvent[],
    applyGraphDocumentDiffResult: null as ApplyGraphDocumentDiffResult | null
  };

  const graph = {
    getGraphDocument() {
      return structuredClone(state.document);
    },
    replaceGraphDocument(nextDocument: GraphDocument) {
      state.document = structuredClone(nextDocument);
      state.replacedDocuments.push(structuredClone(nextDocument));
    },
    applyGraphDocumentDiff(diff: GraphDocumentDiff, nextDocument: GraphDocument) {
      state.appliedDiffs.push({
        diff: structuredClone(diff),
        nextDocument: structuredClone(nextDocument)
      });
      if (state.applyGraphDocumentDiffResult) {
        return state.applyGraphDocumentDiffResult;
      }

      state.document = structuredClone(nextDocument);
      return {
        success: true,
        requiresFullReplace: false,
        document: structuredClone(nextDocument),
        affectedNodeIds: ["node-1"],
        affectedLinkIds: []
      } satisfies ApplyGraphDocumentDiffResult;
    },
    projectRuntimeFeedback(feedback: RuntimeFeedbackEvent) {
      state.projectedFeedbacks.push(feedback);
    }
  };

  return { graph, state };
}

describe("runtime bridge client", () => {
  test("connect 应先请求 snapshot 并恢复当前图", async () => {
    const transport = new MockTransport();
    const { graph, state } = createFakeGraph(createDocument("0"));
    const client = new LeaferGraphRuntimeBridgeClient({
      graph,
      transport
    });

    await client.connect();

    expect(client.isConnected()).toBe(true);
    expect(transport.snapshotRequests).toBe(1);
    expect(state.replacedDocuments).toEqual([createDocument("1")]);
  });

  test("document.diff 成功时应走增量投影", async () => {
    const transport = new MockTransport();
    const { graph, state } = createFakeGraph(createDocument("1"));
    const client = new LeaferGraphRuntimeBridgeClient({
      graph,
      transport
    });
    const diff = createDiff("2");

    await client.connect();
    state.replacedDocuments.length = 0;

    transport.emit({
      type: "document.diff",
      diff
    });
    await flushQueue();

    expect(state.appliedDiffs).toHaveLength(1);
    expect(state.appliedDiffs[0]?.nextDocument.nodes[0]?.flags?.collapsed).toBe(true);
    expect(state.replacedDocuments).toEqual([]);
  });

  test("document.diff 合并失败时应回退到 snapshot", async () => {
    const transport = new MockTransport();
    transport.snapshot = createDocument("fallback");
    const { graph, state } = createFakeGraph(createDocument("1"));
    const client = new LeaferGraphRuntimeBridgeClient({
      graph,
      transport
    });

    await client.connect();
    state.replacedDocuments.length = 0;

    transport.emit({
      type: "document.diff",
      diff: {
        documentId: "bridge-doc",
        baseRevision: "1",
        revision: "2",
        emittedAt: 2,
        operations: [
          {
            type: "node.collapse",
            nodeId: "missing-node",
            collapsed: true,
            operationId: "collapse-missing",
            timestamp: 2,
            source: "authority.diff"
          }
        ],
        fieldChanges: []
      }
    });
    await flushQueue();
    await flushQueue();

    expect(transport.snapshotRequests).toBe(2);
    expect(state.replacedDocuments).toEqual([createDocument("fallback")]);
  });

  test("runtime.feedback 与 history.event 应分别投影和分发", async () => {
    const transport = new MockTransport();
    const { graph, state } = createFakeGraph(createDocument("1"));
    const client = new LeaferGraphRuntimeBridgeClient({
      graph,
      transport
    });
    const feedback: RuntimeFeedbackEvent = {
      type: "node.state",
      event: {
        nodeId: "node-1",
        exists: true,
        reason: "execution",
        timestamp: 3
      }
    };
    const historyEvent: LeaferGraphHistoryEvent = {
      type: "history.reset",
      timestamp: 4,
      reason: "replace-document"
    };
    const receivedHistoryEvents: LeaferGraphHistoryEvent[] = [];

    client.subscribeHistory((event) => {
      receivedHistoryEvents.push(event);
    });
    await client.connect();

    transport.emit({
      type: "runtime.feedback",
      feedback
    });
    transport.emit({
      type: "history.event",
      event: historyEvent
    });
    await flushQueue();
    await flushQueue();
    await flushQueue();

    expect(state.projectedFeedbacks).toEqual([feedback]);
    expect(receivedHistoryEvents).toEqual([historyEvent]);
  });

  test("play / step / stop / playFromNode / submitOperations 应走 transport 薄封装", async () => {
    const transport = new MockTransport();
    const { graph } = createFakeGraph(createDocument("1"));
    const client = new LeaferGraphRuntimeBridgeClient({
      graph,
      transport
    });
    const operation: GraphOperation = {
      type: "node.collapse",
      nodeId: "node-1",
      collapsed: true,
      operationId: "submit-1",
      timestamp: 5,
      source: "test.submit"
    };

    await client.play();
    await client.step();
    await client.stop();
    await client.playFromNode("node-1");
    const result = await client.submitOperation(operation);

    expect(transport.commands).toEqual([
      { type: "play" },
      { type: "step" },
      { type: "stop" },
      { type: "play-from-node", nodeId: "node-1" }
    ]);
    expect(transport.submittedOperations).toEqual([operation]);
    expect(result).toMatchObject({
      accepted: true,
      changed: true,
      operation
    });
  });

  test("extension manager 存在时应先同步 extensions 再请求 snapshot", async () => {
    const transport = new MockTransport();
    const { graph, state } = createFakeGraph(createDocument("0"));
    const extensionSyncs: string[] = [];
    const extensionManager = {
      async sync(sync: {
        entries: Array<{ entryId: string }>;
      }) {
        extensionSyncs.push(`entries:${sync.entries.length}`);
      }
    } as RuntimeBridgeBrowserExtensionManager;
    const client = new LeaferGraphRuntimeBridgeClient({
      graph,
      transport,
      extensionManager
    });

    await client.connect();

    expect(transport.commands[0]).toEqual({ type: "catalog.list" });
    expect(transport.snapshotRequests).toBe(1);
    expect(extensionSyncs).toEqual(["entries:0"]);
    expect(state.replacedDocuments).toEqual([createDocument("1")]);
  });
});
