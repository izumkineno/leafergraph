import { describe, expect, test } from "bun:test";

import type {
  GraphLink,
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraph
} from "leafergraph";
import type { EditorCommandExecution } from "../src/commands/command_bus";
import { createEditorCommandHistory } from "../src/commands/command_history";
import type { EditorGraphDocumentSession } from "../src/session/graph_document_session";
import type { EditorNodeSelectionController } from "../src/state/selection";

function createLink(operationId: string): GraphLink {
  return {
    id: `link-${operationId}`,
    source: {
      nodeId: "node-a",
      direction: "output",
      slot: 0
    },
    target: {
      nodeId: "node-b",
      direction: "input",
      slot: 0
    }
  };
}

function createLinkCreateOperation(operationId: string): GraphOperation {
  return {
    type: "link.create",
    input: createLink(operationId),
    operationId,
    timestamp: Date.now(),
    source: "editor.test"
  };
}

function createSessionStub(): EditorGraphDocumentSession {
  const applyResult = (operation: GraphOperation): GraphOperationApplyResult => ({
    accepted: true,
    changed: true,
    operation,
    affectedNodeIds: [],
    affectedLinkIds:
      operation.type === "link.create" ? [operation.input.id] : []
  });

  return {
    currentDocument: {
      documentId: "doc-history",
      revision: "1",
      appKind: "test-app",
      nodes: [],
      links: [],
      meta: {}
    },
    pendingOperationIds: [],
    submitOperationWithAuthority(operation: GraphOperation) {
      const result = applyResult(operation);
      return {
        applyResult: result,
        confirmation: Promise.resolve({
          operationId: operation.operationId,
          accepted: result.accepted,
          changed: result.changed,
          revision: "1"
        })
      };
    },
    submitOperation(operation: GraphOperation): GraphOperationApplyResult {
      return applyResult(operation);
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

function createSelectionStub(): EditorNodeSelectionController {
  const selectedNodeIds: string[] = [];

  return {
    get primarySelectedNodeId(): string | null {
      return selectedNodeIds.at(-1) ?? null;
    },
    get selectedNodeId(): string | null {
      return selectedNodeIds.at(-1) ?? null;
    },
    get selectedNodeIds(): readonly string[] {
      return selectedNodeIds;
    },
    isSelected(nodeId: string): boolean {
      return selectedNodeIds.includes(nodeId);
    },
    hasMultipleSelected(): boolean {
      return selectedNodeIds.length > 1;
    },
    setMany(nodeIds: readonly string[]): void {
      selectedNodeIds.length = 0;
      selectedNodeIds.push(...nodeIds);
    },
    select(nodeId: string | null): void {
      this.setMany(nodeId ? [nodeId] : []);
    },
    add(nodeId: string): void {
      if (!selectedNodeIds.includes(nodeId)) {
        selectedNodeIds.push(nodeId);
      }
    },
    remove(nodeId: string): void {
      const index = selectedNodeIds.indexOf(nodeId);
      if (index >= 0) {
        selectedNodeIds.splice(index, 1);
      }
    },
    toggle(nodeId: string): void {
      if (this.isSelected(nodeId)) {
        this.remove(nodeId);
      } else {
        this.add(nodeId);
      }
    },
    clear(): void {
      selectedNodeIds.length = 0;
    },
    clearIfContains(nodeId: string): void {
      this.remove(nodeId);
    },
    subscribe(): () => void {
      return () => {};
    }
  };
}

function createPendingExecution(
  operationId: string,
  accepted: boolean
): EditorCommandExecution {
  const operation = createLinkCreateOperation(operationId);
  const link = createLink(operationId);

  return {
    request: {
      type: "link.create",
      input: structuredClone(link)
    },
    result: structuredClone(link),
    operations: [operation],
    documentRecorded: false,
    historyPayload: {
      kind: "create-links",
      links: [structuredClone(link)]
    },
    authority: {
      status: "pending",
      operationIds: [operationId],
      pendingOperationIds: [operationId],
      confirmation: Promise.resolve([
        {
          operationId,
          accepted,
          changed: accepted,
          reason: accepted ? undefined : "authority rejected",
          revision: "2"
        }
      ])
    },
    success: true,
    changed: true,
    recordable: true,
    summary: `创建连线 ${operationId}`,
    timestamp: Date.now()
  };
}

describe("EditorCommandHistory authority 流转", () => {
  test("pending 在 confirmed 后才进入历史栈", async () => {
    const history = createEditorCommandHistory({
      graph: {} as LeaferGraph,
      session: createSessionStub(),
      selection: createSelectionStub(),
      bindNode: () => {},
      unbindNode: () => {}
    });

    const execution = createPendingExecution("op-confirmed", true);
    const entry = history.record(execution);

    expect(entry).toBeNull();
    expect(history.listEntries()).toHaveLength(0);

    await execution.authority.confirmation;
    await Promise.resolve();

    expect(history.listEntries()).toHaveLength(1);
    expect(history.canUndo).toBe(true);
  });

  test("pending 在 rejected 后不进入历史栈", async () => {
    const history = createEditorCommandHistory({
      graph: {} as LeaferGraph,
      session: createSessionStub(),
      selection: createSelectionStub(),
      bindNode: () => {},
      unbindNode: () => {}
    });

    const execution = createPendingExecution("op-rejected", false);
    const entry = history.record(execution);

    expect(entry).toBeNull();
    await execution.authority.confirmation;
    await Promise.resolve();

    expect(history.listEntries()).toHaveLength(0);
    expect(history.canUndo).toBe(false);
  });
});
