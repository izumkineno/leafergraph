import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  GraphOperation,
  RuntimeFeedbackEvent
} from "leafergraph";
import { createDemoRemoteAuthorityService } from "../src/demo/remote_authority_demo_service";

function createResizeOperation(): GraphOperation {
  return {
    type: "node.resize",
    nodeId: "node-1",
    input: {
      width: 360,
      height: 180
    },
    operationId: "demo-worker-resize-node-1",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

describe("createDemoRemoteAuthorityService", () => {
  test("应处理文档、操作确认与运行反馈", async () => {
    const service = createDemoRemoteAuthorityService();
    const pushedDocumentRevisions: string[] = [];
    const disposeDocumentSubscription = service.subscribeDocument?.((document) => {
      pushedDocumentRevisions.push(String(document.revision));
    });
    const runtimeFeedbackEvents: RuntimeFeedbackEvent[] = [];
    const disposeRuntimeFeedbackSubscription = service.subscribe?.((event) => {
      runtimeFeedbackEvents.push(event);
    });

    const initialDocument = await service.getDocument();
    expect(initialDocument.documentId).toBe("demo-worker-doc");
    expect(initialDocument.revision).toBe("1");

    const submitResult = await service.submitOperation(createResizeOperation(), {
      currentDocument: initialDocument,
      pendingOperationIds: []
    });
    expect(submitResult.accepted).toBe(true);
    expect(submitResult.changed).toBe(true);
    expect(submitResult.revision).toBe("2");
    expect(
      (
        submitResult.document as GraphDocument
      ).nodes.find((node) => node.id === "node-1")?.layout.width
    ).toBe(360);
    expect(
      runtimeFeedbackEvents.some(
        (event) =>
          event.type === "node.state" &&
          event.event.nodeId === "node-1" &&
          event.event.reason === "resized"
      )
    ).toBe(true);
    expect(
      runtimeFeedbackEvents.some(
        (event) =>
          event.type === "node.execution" &&
          event.event.nodeId === "node-1" &&
          event.event.state.status === "success"
      )
    ).toBe(true);
    expect(pushedDocumentRevisions).toEqual(["2"]);

    const replacedDocument = await service.replaceDocument(
      {
        documentId: "demo-worker-doc-2",
        revision: "10",
        appKind: "demo-worker",
        nodes: [],
        links: [],
        meta: {
          replaced: true
        }
      },
      {
        currentDocument: submitResult.document as GraphDocument
      }
    );
    expect(replacedDocument?.documentId).toBe("demo-worker-doc-2");
    expect(replacedDocument?.revision).toBe("10");
    expect(pushedDocumentRevisions).toEqual(["2", "10"]);

    disposeDocumentSubscription?.();
    disposeRuntimeFeedbackSubscription?.();
  });
});
