import { describe, expect, test } from "bun:test";

import type {
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraph
} from "leafergraph";
import { createEditorCommandBus } from "../src/commands/command_bus";
import type { EditorGraphDocumentSession } from "../src/session/graph_document_session";
import type { EditorNodeSelectionController } from "../src/state/selection";

function createSelectionStub(): EditorNodeSelectionController {
  return {
    primarySelectedNodeId: null,
    selectedNodeId: null,
    selectedNodeIds: [],
    isSelected() {
      return false;
    },
    hasMultipleSelected() {
      return false;
    },
    setMany(): void {},
    select(): void {},
    add(): void {},
    remove(): void {},
    toggle(): void {},
    clear(): void {},
    clearIfContains(): void {},
    subscribe(): () => void {
      return () => {};
    }
  };
}

function createGraphStub(): LeaferGraph {
  return {
    listNodes() {
      return [];
    },
    fitView() {
      return true;
    }
  } as unknown as LeaferGraph;
}

function createSessionStub(): EditorGraphDocumentSession {
  return {
    currentDocument: {
      documentId: "doc-empty",
      revision: 1,
      appKind: "demo",
      nodes: [],
      links: []
    },
    pendingOperationIds: [],
    submitOperation(operation: GraphOperation): GraphOperationApplyResult {
      return {
        accepted: false,
        changed: false,
        operation,
        affectedNodeIds: [],
        affectedLinkIds: []
      };
    }
  } as unknown as EditorGraphDocumentSession;
}

describe("editor command bus clipboard state", () => {
  test("clipboard.paste 在 runtime ready 且内存剪贴板为空时仍可触发，并返回明确失败原因", () => {
    const commandBus = createEditorCommandBus({
      graph: createGraphStub(),
      session: createSessionStub(),
      selection: createSelectionStub(),
      bindNode: () => {},
      unbindNode: () => {},
      isRuntimeReady: () => true,
      resolveLastPointerPagePoint: () => null,
      resolveViewportCenterPagePoint: () => null
    });

    const state = commandBus.resolveCommandState({
      type: "clipboard.paste",
      point: null
    });
    expect(state.disabled).toBe(false);

    const execution = commandBus.execute({
      type: "clipboard.paste",
      point: null
    });
    expect(execution.success).toBe(false);
    expect(execution.changed).toBe(false);
    expect(execution.summary).toBe("粘贴失败：剪贴板中没有 LeaferGraph JSON");
  });
});
