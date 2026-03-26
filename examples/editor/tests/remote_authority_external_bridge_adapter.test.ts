import { afterEach, describe, expect, test } from "bun:test";
import path from "node:path";

import type {
  GraphDocument,
  GraphOperation,
  RuntimeFeedbackEvent
} from "leafergraph";
import { resolveEditorAppBootstrap } from "../src/app/editor_app_bootstrap";
import {
  createEditorRemoteAuthorityAppRuntime,
  createEditorRemoteAuthorityServiceSource
} from "../src/backend/authority/remote_authority_app_runtime";
import type { EditorRemoteAuthorityHostAdapter } from "../src/backend/authority/remote_authority_host_adapter";
import {
  createClientBackedRemoteAuthorityService
} from "../src/session/graph_document_authority_service_bridge";
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

function createNodeRemoveOperation(): GraphOperation {
  return {
    type: "node.remove",
    nodeId: "node-1",
    operationId: "external-bridge-remove-node-1",
    timestamp: Date.now(),
    source: "editor.external-bridge.test"
  };
}

function createDemoBackendHostAdapter(): EditorRemoteAuthorityHostAdapter {
  return {
    adapterId: "node-demo-backend-bridge",
    resolveSource(options) {
      const label =
        typeof (options as { label?: unknown } | undefined)?.label === "string"
          ? (options as { label: string }).label
          : "Node Demo Backend Bridge";

      return createEditorRemoteAuthorityServiceSource({
        label,
        description: "通过外部 demo backend client 桥接为浏览器 authority source",
        createService() {
          const backend = createDemoBackendClient();
          return createClientBackedRemoteAuthorityService({
            client: backend.client,
            disposeClientOnDispose: true
          });
        }
      });
    }
  };
}

afterEach(() => {
  for (const handle of demoBackendHandles) {
    handle.dispose();
    demoBackendHandles.delete(handle);
  }
});

describe("external authority bridge host adapter", () => {
  test("应通过自定义 host adapter 把外部 demo backend 接到浏览器 authority runtime", async () => {
    const bootstrap = resolveEditorAppBootstrap({
      LeaferGraphEditorAppBootstrap: {
        remoteAuthorityAdapter: {
          adapterId: "node-demo-backend-bridge",
          options: {
            label: "Bootstrap Node Demo Backend Bridge"
          }
        },
        remoteAuthorityHostAdapters: [createDemoBackendHostAdapter()]
      }
    });
    const source = bootstrap.remoteAuthoritySource;
    if (!source) {
      throw new Error("未能解析 node demo backend bridge source");
    }

    const runtime = await createEditorRemoteAuthorityAppRuntime(source);
    const runtimeFeedbackEvents: RuntimeFeedbackEvent[] = [];
    const disposeRuntimeFeedbackSubscription = runtime.client.subscribe((event) => {
      runtimeFeedbackEvents.push(event);
    });

    expect(runtime.sourceLabel).toBe("Bootstrap Node Demo Backend Bridge");
    expect(runtime.document.documentId).toBe("demo-backend-doc");
    expect(runtime.document.revision).toBe("1");

    const submitResult = await runtime.client.submitOperation(
      createNodeRemoveOperation(),
      {
        currentDocument: runtime.document,
        pendingOperationIds: []
      }
    );
    expect(submitResult.accepted).toBe(true);
    expect(submitResult.changed).toBe(true);
    expect(submitResult.revision).toBe("2");

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(
      runtimeFeedbackEvents.some(
        (event) =>
          event.type === "node.state" &&
          event.event.nodeId === "node-1" &&
          event.event.exists === false
      )
    ).toBe(true);

    const currentDocument = await runtime.client.getDocument();
    expect((currentDocument as GraphDocument).revision).toBe("2");
    expect(
      (currentDocument as GraphDocument).nodes.map((node) => node.id)
    ).toEqual(["node-2"]);

    disposeRuntimeFeedbackSubscription();
    runtime.dispose();
  });
});
