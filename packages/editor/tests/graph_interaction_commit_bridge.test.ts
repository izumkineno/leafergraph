import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphInteractionCommitEvent
} from "leafergraph";
import { createGraphInteractionCommitBridge } from "../src/interaction/graph_interaction_commit_bridge";
import type { EditorGraphDocumentSession } from "../src/session/graph_document_session";

function createDocument(): GraphDocument {
  return {
    documentId: "interaction-bridge-doc",
    revision: "1",
    appKind: "test-app",
    nodes: [],
    links: [],
    meta: {}
  };
}

function createPendingSessionStub(): EditorGraphDocumentSession {
  const pendingOperationIds: string[] = [];

  return {
    currentDocument: createDocument(),
    get pendingOperationIds(): readonly string[] {
      return pendingOperationIds;
    },
    submitOperationWithAuthority(operation: GraphOperation) {
      pendingOperationIds.push(operation.operationId);
      const applyResult: GraphOperationApplyResult = {
        accepted: true,
        changed: false,
        operation,
        affectedNodeIds:
          "nodeId" in operation ? [operation.nodeId] : [],
        affectedLinkIds: []
      };

      return {
        applyResult,
        confirmation: Promise.resolve({
          operationId: operation.operationId,
          accepted: false,
          changed: false,
          reason: "authority rejected",
          revision: "1"
        })
      };
    },
    submitOperation(operation: GraphOperation): GraphOperationApplyResult {
      return {
        accepted: true,
        changed: true,
        operation,
        affectedNodeIds: [],
        affectedLinkIds: []
      };
    },
    recordAppliedOperations(): void {},
    reconcileNodeState(): void {},
    replaceDocument(): void {},
    subscribeOperationConfirmation(): () => void {
      return () => {};
    },
    subscribePending(): () => void {
      return () => {};
    },
    subscribe(): () => void {
      return () => {};
    }
  };
}

function createConfirmedSessionStub(): EditorGraphDocumentSession {
  return {
    currentDocument: createDocument(),
    pendingOperationIds: [],
    submitOperationWithAuthority(operation: GraphOperation) {
      const applyResult: GraphOperationApplyResult = {
        accepted: true,
        changed: true,
        operation,
        affectedNodeIds:
          "nodeId" in operation ? [operation.nodeId] : [],
        affectedLinkIds: []
      };

      return {
        applyResult,
        confirmation: Promise.resolve({
          operationId: operation.operationId,
          accepted: true,
          changed: true,
          revision: "2"
        })
      };
    },
    submitOperation(operation: GraphOperation): GraphOperationApplyResult {
      return {
        accepted: true,
        changed: true,
        operation,
        affectedNodeIds: [],
        affectedLinkIds: []
      };
    },
    recordAppliedOperations(): void {},
    reconcileNodeState(): void {},
    replaceDocument(): void {},
    subscribeOperationConfirmation(): () => void {
      return () => {};
    },
    subscribePending(): () => void {
      return () => {};
    },
    subscribe(): () => void {
      return () => {};
    }
  };
}

function createLoopbackPreviewSessionStub(): EditorGraphDocumentSession {
  return {
    currentDocument: createDocument(),
    pendingOperationIds: [],
    submitOperationWithAuthority(operation: GraphOperation) {
      const applyResult: GraphOperationApplyResult = {
        accepted: true,
        changed: false,
        operation,
        affectedNodeIds:
          "nodeId" in operation ? [operation.nodeId] : [],
        affectedLinkIds: []
      };

      return {
        applyResult,
        confirmation: Promise.resolve({
          operationId: operation.operationId,
          accepted: true,
          changed: false,
          revision: "1"
        })
      };
    },
    submitOperation(operation: GraphOperation): GraphOperationApplyResult {
      return {
        accepted: true,
        changed: false,
        operation,
        affectedNodeIds: [],
        affectedLinkIds: []
      };
    },
    recordAppliedOperations(): void {},
    reconcileNodeState(): void {},
    replaceDocument(): void {},
    subscribeOperationConfirmation(): () => void {
      return () => {};
    },
    subscribePending(): () => void {
      return () => {};
    },
    subscribe(): () => void {
      return () => {};
    }
  };
}

describe("graph interaction commit bridge", () => {
  test("多节点移动应转换成多个 node.move，并在 reject 后触发回滚", async () => {
    let rollbackCount = 0;
    const bridge = createGraphInteractionCommitBridge({
      session: createPendingSessionStub(),
      rollbackToAuthorityDocument() {
        rollbackCount += 1;
      }
    });

    const execution = bridge.submit({
      type: "node.move.commit",
      entries: [
        {
          nodeId: "node-a",
          before: { x: 0, y: 0 },
          after: { x: 120, y: 80 }
        },
        {
          nodeId: "node-b",
          before: { x: 200, y: 40 },
          after: { x: 320, y: 120 }
        }
      ]
    } satisfies LeaferGraphInteractionCommitEvent);

    expect(execution).not.toBeNull();
    expect(execution?.request.type).toBe("interaction.move");
    expect(execution?.operations?.map((operation) => operation.type)).toEqual([
      "node.move",
      "node.move"
    ]);
    expect(execution?.historyPayload?.kind).toBe("move-nodes");
    expect(execution?.authority.status).toBe("pending");
    expect(execution?.documentRecorded).toBe(false);

    await execution?.authority.confirmation;
    await Promise.resolve();

    expect(rollbackCount).toBe(1);
  });

  test("link create commit 应生成 link.create 历史负载", async () => {
    const bridge = createGraphInteractionCommitBridge({
      session: createConfirmedSessionStub(),
      rollbackToAuthorityDocument() {
        throw new Error("不应触发回滚");
      }
    });

    const execution = bridge.submit({
      type: "link.create.commit",
      input: {
        source: {
          nodeId: "node-a",
          slot: 0
        },
        target: {
          nodeId: "node-b",
          slot: 1
        }
      }
    } satisfies LeaferGraphInteractionCommitEvent);

    expect(execution?.request.type).toBe("link.create");
    expect(execution?.request.input.id).toMatch(/^editor:link:/);
    expect(execution?.request.input).toEqual({
      id: execution?.request.input.id,
      source: {
        nodeId: "node-a",
        slot: 0
      },
      target: {
        nodeId: "node-b",
        slot: 1
      }
    });
    expect(execution?.operations?.[0]).toEqual({
      type: "link.create",
      operationId: execution?.operations?.[0]?.operationId,
      timestamp: execution?.operations?.[0]?.timestamp,
      source: "editor.interaction",
      input: {
        id: execution?.request.input.id,
        source: {
          nodeId: "node-a",
          slot: 0
        },
        target: {
          nodeId: "node-b",
          slot: 1
        }
      }
    });
    expect(execution?.historyPayload).toEqual({
      kind: "create-links",
      links: [
        {
          id: execution?.request.input.id,
          source: {
            nodeId: "node-a",
            slot: 0
          },
          target: {
            nodeId: "node-b",
            slot: 1
          },
          label: undefined,
          data: undefined
        }
      ]
    });
    expect(execution?.authority.status).toBe("confirmed");
  });

  test("widget commit 应生成 node.update 历史负载", async () => {
    const bridge = createGraphInteractionCommitBridge({
      session: createConfirmedSessionStub(),
      rollbackToAuthorityDocument() {
        throw new Error("不应触发回滚");
      }
    });

    const execution = bridge.submit({
      type: "node.widget.commit",
      nodeId: "node-widget",
      widgetIndex: 0,
      beforeValue: "before",
      afterValue: "after",
      beforeWidgets: [
        {
          type: "text",
          name: "label",
          value: "before"
        }
      ],
      afterWidgets: [
        {
          type: "text",
          name: "label",
          value: "after"
        }
      ]
    } satisfies LeaferGraphInteractionCommitEvent);

    expect(execution?.request.type).toBe("interaction.widget-commit");
    expect(execution?.operations?.[0]?.type).toBe("node.update");
    expect(execution?.authority.status).toBe("confirmed");
    expect(execution?.documentRecorded).toBe(true);
    expect(execution?.historyPayload).toEqual({
      kind: "update-node",
      nodeId: "node-widget",
      beforeInput: {
        widgets: [
          {
            type: "text",
            name: "label",
            value: "before"
          }
        ]
      },
      afterInput: {
        widgets: [
          {
            type: "text",
            name: "label",
            value: "after"
          }
        ]
      }
    });
  });

  test("loopback 预览态应保留 documentRecorded=false，供 session 回填文档", () => {
    const bridge = createGraphInteractionCommitBridge({
      session: createLoopbackPreviewSessionStub(),
      rollbackToAuthorityDocument() {
        throw new Error("不应触发回滚");
      }
    });

    const execution = bridge.submit({
      type: "node.move.commit",
      entries: [
        {
          nodeId: "node-preview",
          before: { x: 0, y: 0 },
          after: { x: 48, y: 96 }
        }
      ]
    } satisfies LeaferGraphInteractionCommitEvent);

    expect(execution?.authority.status).toBe("confirmed");
    expect(execution?.changed).toBe(true);
    expect(execution?.documentRecorded).toBe(false);
  });
});
