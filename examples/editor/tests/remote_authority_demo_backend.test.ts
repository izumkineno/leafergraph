import { afterEach, describe, expect, test } from "bun:test";
import path from "node:path";

import type {
  GraphDocument,
  GraphOperation,
  RuntimeFeedbackEvent
} from "leafergraph";
import {
  createNodeProcessRemoteAuthorityClient,
  type CreateNodeProcessRemoteAuthorityTransportOptions
} from "../src/session/node_process_remote_authority_client";

interface DemoBackendClientHandle {
  client: ReturnType<typeof createNodeProcessRemoteAuthorityClient>;
  dispose(): void;
}

const demoBackendHandles = new Set<DemoBackendClientHandle>();

function createDemoBackendClient(): DemoBackendClientHandle {
  const scriptPath = path.join(
    import.meta.dir,
    "fixtures",
    "remote_authority_demo_backend.mjs"
  );
  const options: CreateNodeProcessRemoteAuthorityTransportOptions = {
    args: [scriptPath]
  };
  const client = createNodeProcessRemoteAuthorityClient(options);
  const handle: DemoBackendClientHandle = {
    client,
    dispose(): void {
      client.dispose();
    }
  };
  demoBackendHandles.add(handle);
  return handle;
}

function createNodeResizeOperation(): GraphOperation {
  return {
    type: "node.resize",
    nodeId: "node-1",
    input: {
      width: 360,
      height: 180
    },
    operationId: "demo-op-node-resize",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

afterEach(() => {
  for (const handle of demoBackendHandles) {
    handle.dispose();
    demoBackendHandles.delete(handle);
  }
});

describe("remote authority demo backend", () => {
  test("应支持通过 node transport client 处理文档、操作与 runtime feedback", async () => {
    const backend = createDemoBackendClient();
    const initialDocument = await backend.client.getDocument();
    const runtimeFeedbackEvents: RuntimeFeedbackEvent[] = [];
    const disposeRuntimeFeedbackSubscription = backend.client.subscribe((event) => {
      runtimeFeedbackEvents.push(event);
    });

    expect(initialDocument.documentId).toBe("demo-backend-doc");
    expect(initialDocument.revision).toBe("1");

    const submitResult = await backend.client.submitOperation(
      createNodeResizeOperation(),
      {
        currentDocument: initialDocument,
        pendingOperationIds: []
      }
    );

    expect(submitResult.accepted).toBe(true);
    expect(submitResult.changed).toBe(true);
    expect(submitResult.revision).toBe("2");
    expect(
      (
        submitResult.document as GraphDocument
      ).nodes.find((node) => node.id === "node-1")?.layout.width
    ).toBe(360);

    await new Promise((resolve) => setTimeout(resolve, 20));

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

    const replacedDocument = await backend.client.replaceDocument(
      {
        documentId: "demo-backend-doc-2",
        revision: "10",
        appKind: "demo-backend",
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

    expect(replacedDocument?.documentId).toBe("demo-backend-doc-2");
    expect(replacedDocument?.revision).toBe("10");

    disposeRuntimeFeedbackSubscription();
  });
});
