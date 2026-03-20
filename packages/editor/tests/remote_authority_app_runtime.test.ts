import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "leafergraph";
import { resolveEditorAppBootstrap } from "../src/app/editor_app_bootstrap";
import type { EditorRemoteAuthorityHostAdapter } from "../src/backend/authority/remote_authority_host_adapter";
import {
  createEditorRemoteAuthorityAppRuntime,
  createEditorRemoteAuthorityMessagePortSource,
  createEditorRemoteAuthorityWindowSource,
  createEditorRemoteAuthorityWorkerSource,
  type EditorRemoteAuthorityAppSource
} from "../src/backend/authority/remote_authority_app_runtime";
import { createEditorRemoteAuthorityDemoWorkerSource } from "../src/demo/remote_authority_demo_source";
import { attachMessagePortRemoteAuthorityBridgeHost } from "../src/session/message_port_remote_authority_bridge_host";
import { createMessagePortRemoteAuthorityHost } from "../src/session/message_port_remote_authority_host";
import { attachMessagePortRemoteAuthorityWorkerHost } from "../src/session/message_port_remote_authority_worker_host";
import type {
  EditorRemoteAuthorityDocumentClient,
  EditorRemoteAuthorityTransport,
  EditorRemoteAuthorityTransportEvent,
  EditorRemoteAuthorityTransportRequest,
  EditorRemoteAuthorityTransportResponse
} from "../src/session/graph_document_authority_transport";
import type { EditorRemoteAuthorityConnectionStatus } from "../src/session/graph_document_authority_client";

function createDocument(revision: string): GraphDocument {
  return {
    documentId: "remote-app-doc",
    revision,
    appKind: "test-app",
    nodes: [],
    links: [],
    meta: {}
  };
}

function createFakeWorkerHarness() {
  const listeners = new Set<(event: MessageEvent<unknown>) => void>();
  let terminated = false;

  return {
    receiver: {
      addEventListener(
        type: "message",
        listener: (event: MessageEvent<unknown>) => void
      ) {
        if (type === "message") {
          listeners.add(listener);
        }
      },
      removeEventListener(
        type: "message",
        listener: (event: MessageEvent<unknown>) => void
      ) {
        if (type === "message") {
          listeners.delete(listener);
        }
      }
    },
    worker: {
      postMessage(message: unknown, transfer: Transferable[]) {
        const ports = transfer.filter(
          (value): value is MessagePort => value instanceof MessagePort
        );
        const event = {
          data: message,
          ports
        } as MessageEvent<unknown>;

        for (const listener of listeners) {
          listener(event);
        }
      },
      terminate() {
        terminated = true;
      }
    },
    wasTerminated(): boolean {
      return terminated;
    }
  };
}

function createFakeWindowHarness(options?: {
  origin?: string;
  targetOriginMustMatch?: boolean;
}) {
  const listeners = new Set<(event: MessageEvent<unknown>) => void>();
  const bridgeWindow = {
    id: "bridge-window"
  };
  const origin = options?.origin ?? "https://bridge.test";

  return {
    receiver: {
      addEventListener(
        type: "message",
        listener: (event: MessageEvent<unknown>) => void
      ) {
        if (type === "message") {
          listeners.add(listener);
        }
      },
      removeEventListener(
        type: "message",
        listener: (event: MessageEvent<unknown>) => void
      ) {
        if (type === "message") {
          listeners.delete(listener);
        }
      }
    },
    target: {
      postMessage(
        message: unknown,
        targetOrigin: string,
        transfer: Transferable[]
      ) {
        if (
          options?.targetOriginMustMatch &&
          targetOrigin !== origin &&
          targetOrigin !== "*"
        ) {
          return;
        }

        const ports = transfer.filter(
          (value): value is MessagePort => value instanceof MessagePort
        );
        const event = {
          data: message,
          ports,
          origin,
          source: bridgeWindow
        } as MessageEvent<unknown>;

        for (const listener of listeners) {
          listener(event);
        }
      }
    },
    bridgeWindow,
    origin
  };
}

function createClientStub(options?: {
  document?: GraphDocument;
  shouldFailLoad?: boolean;
  onDispose?(): void;
}): EditorRemoteAuthorityDocumentClient {
  return {
    async getDocument(): Promise<GraphDocument> {
      if (options?.shouldFailLoad) {
        throw new Error("authority load failed");
      }

      return structuredClone(options?.document ?? createDocument("1"));
    },
    async submitOperation(): Promise<{
      accepted: boolean;
      changed: boolean;
      revision: GraphDocument["revision"];
    }> {
      return {
        accepted: true,
        changed: false,
        revision: "1"
      };
    },
    async replaceDocument(document: GraphDocument): Promise<GraphDocument> {
      return structuredClone(document);
    },
    subscribe(): () => void {
      return () => {};
    },
    dispose(): void {
      options?.onDispose?.();
    }
  };
}

function createTransportStub(options?: {
  document?: GraphDocument;
  onDispose?(): void;
}): EditorRemoteAuthorityTransport {
  const listeners = new Set<
    (event: EditorRemoteAuthorityTransportEvent) => void
  >();
  const document = structuredClone(options?.document ?? createDocument("3"));

  return {
    async request<TResponse extends EditorRemoteAuthorityTransportResponse>(
      request: EditorRemoteAuthorityTransportRequest
    ): Promise<TResponse> {
      switch (request.action) {
        case "getDocument":
          return {
            action: "getDocument",
            document: structuredClone(document)
          } as TResponse;
        case "submitOperation":
          return {
            action: "submitOperation",
            result: {
              accepted: true,
              changed: false,
              revision: document.revision
            }
          } as TResponse;
        case "replaceDocument":
          return {
            action: "replaceDocument",
            document: structuredClone(request.document)
          } as TResponse;
      }
    },
    subscribe(listener: (event: EditorRemoteAuthorityTransportEvent) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose(): void {
      listeners.clear();
      options?.onDispose?.();
    }
  };
}

function createConnectionStatusClientStub(options?: {
  document?: GraphDocument;
}) {
  let currentStatus: EditorRemoteAuthorityConnectionStatus = "connecting";
  const listeners = new Set<
    (status: EditorRemoteAuthorityConnectionStatus) => void
  >();
  const client: EditorRemoteAuthorityDocumentClient = {
    async getDocument(): Promise<GraphDocument> {
      currentStatus = "connected";
      return structuredClone(options?.document ?? createDocument("21"));
    },
    async submitOperation() {
      return {
        accepted: true,
        changed: false,
        revision: "21"
      };
    },
    async replaceDocument(document: GraphDocument): Promise<GraphDocument> {
      return structuredClone(document);
    },
    getConnectionStatus() {
      return currentStatus;
    },
    subscribeConnectionStatus(listener) {
      listeners.add(listener);
      listener(currentStatus);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {},
    subscribe() {
      return () => {};
    }
  };

  return {
    client,
    emitConnectionStatus(status: EditorRemoteAuthorityConnectionStatus): void {
      currentStatus = status;
      for (const listener of listeners) {
        listener(status);
      }
    }
  };
}

describe("createEditorRemoteAuthorityAppRuntime", () => {
  test("应装配 authority client、document、binding 和 feedback inlet", async () => {
    const source: EditorRemoteAuthorityAppSource = {
      label: "Test Authority",
      description: "浏览器侧 authority 装配测试",
      createClient() {
        return createClientStub({
          document: createDocument("7")
        });
      }
    };

    const runtime = await createEditorRemoteAuthorityAppRuntime(source);

    expect(runtime.sourceLabel).toBe("Test Authority");
    expect(runtime.sourceDescription).toBe("浏览器侧 authority 装配测试");
    expect(runtime.document.revision).toBe("7");
    expect(typeof runtime.createDocumentSessionBinding).toBe("function");
    expect(runtime.runtimeFeedbackInlet).toBe(runtime.client);

    runtime.dispose();
  });

  test("authority 文档加载失败时应释放 client", async () => {
    let disposed = false;
    const source: EditorRemoteAuthorityAppSource = {
      label: "Broken Authority",
      createClient() {
        return createClientStub({
          shouldFailLoad: true,
          onDispose() {
            disposed = true;
          }
        });
      }
    };

    await expect(createEditorRemoteAuthorityAppRuntime(source)).rejects.toThrow(
      "authority load failed"
    );
    expect(disposed).toBe(true);
  });

  test("应支持通过 transport source 装配 authority runtime", async () => {
    let disposed = false;
    const source: EditorRemoteAuthorityAppSource = {
      label: "Transport Authority",
      description: "通过 transport 直连 authority runtime",
      createTransport() {
        return createTransportStub({
          document: createDocument("11"),
          onDispose() {
            disposed = true;
          }
        });
      }
    };

    const runtime = await createEditorRemoteAuthorityAppRuntime(source);

    expect(runtime.sourceLabel).toBe("Transport Authority");
    expect(runtime.document.revision).toBe("11");
    expect(typeof runtime.client.getDocument).toBe("function");
    expect(runtime.runtimeFeedbackInlet).toBe(runtime.client);
    expect(runtime.getConnectionStatus()).toBe("disconnected");

    const connectionStates: EditorRemoteAuthorityConnectionStatus[] = [];
    const disposeConnectionStatusSubscription =
      runtime.subscribeConnectionStatus((status) => {
        connectionStates.push(status);
      });
    expect(connectionStates).toEqual(["disconnected"]);
    disposeConnectionStatusSubscription();

    runtime.dispose();
    expect(disposed).toBe(true);
  });

  test("authority 支持运行控制时应暴露 runtimeController", async () => {
    const source: EditorRemoteAuthorityAppSource = {
      label: "Runtime Control Authority",
      createClient() {
        return {
          ...createClientStub({
            document: createDocument("31")
          }),
          async controlRuntime(request) {
            return {
              accepted: true,
              changed: true,
              state: {
                status: "idle",
                queueSize: 0,
                stepCount: request.type === "graph.step" ? 1 : 0,
                lastSource:
                  request.type === "graph.step" ? "graph-step" : "graph-play"
              }
            };
          }
        };
      }
    };

    const runtime = await createEditorRemoteAuthorityAppRuntime(source);
    const result = await runtime.runtimeController?.controlRuntime({
      type: "graph.step"
    });

    expect(runtime.runtimeController).toBeDefined();
    expect(result).toMatchObject({
      accepted: true,
      changed: true,
      state: {
        status: "idle",
        queueSize: 0,
        stepCount: 1,
        lastSource: "graph-step"
      }
    });

    runtime.dispose();
  });

  test("应透传 authority 连接状态给 App runtime", async () => {
    const authority = createConnectionStatusClientStub({
      document: createDocument("21")
    });
    const source: EditorRemoteAuthorityAppSource = {
      label: "Connected Authority",
      createClient() {
        return authority.client;
      }
    };

    const runtime = await createEditorRemoteAuthorityAppRuntime(source);
    const connectionStates: EditorRemoteAuthorityConnectionStatus[] = [];
    const disposeConnectionStatusSubscription =
      runtime.subscribeConnectionStatus((status) => {
        connectionStates.push(status);
      });

    expect(runtime.getConnectionStatus()).toBe("connected");

    authority.emitConnectionStatus("reconnecting");
    authority.emitConnectionStatus("connected");

    expect(connectionStates).toEqual([
      "connected",
      "reconnecting",
      "connected"
    ]);

    disposeConnectionStatusSubscription();
    runtime.dispose();
  });

  test("应支持通过 MessagePort source 装配 authority runtime", async () => {
    const channel = new MessageChannel();
    let currentDocument = createDocument("13");
    const host = createMessagePortRemoteAuthorityHost({
      port: channel.port2,
      service: {
        getDocument(): GraphDocument {
          return structuredClone(currentDocument);
        },
        submitOperation() {
          return {
            accepted: true,
            changed: false,
            revision: currentDocument.revision
          };
        },
        replaceDocument(document: GraphDocument): GraphDocument {
          currentDocument = structuredClone(document);
          return structuredClone(currentDocument);
        }
      }
    });

    const source = createEditorRemoteAuthorityMessagePortSource({
      label: "MessagePort Authority",
      description: "通过 bootstrap 传入 MessagePort",
      port: channel.port1
    });

    const runtime = await createEditorRemoteAuthorityAppRuntime(source);

    expect(runtime.sourceLabel).toBe("MessagePort Authority");
    expect(runtime.document.revision).toBe("13");
    expect(typeof runtime.client.getDocument).toBe("function");

    runtime.dispose();
    host.dispose();
  });

  test("应支持通过 worker source 装配 authority runtime", async () => {
    const workerHarness = createFakeWorkerHarness();
    const workerHost = attachMessagePortRemoteAuthorityWorkerHost({
      receiver: workerHarness.receiver,
      service: {
        getDocument(): GraphDocument {
          return createDocument("15");
        },
        submitOperation() {
          return {
            accepted: true,
            changed: false,
            revision: "15"
          };
        },
        replaceDocument(document: GraphDocument): GraphDocument {
          return structuredClone(document);
        }
      },
      disposeServiceOnDispose: false
    });
    const source = createEditorRemoteAuthorityWorkerSource({
      label: "Worker Authority",
      description: "通过 worker 握手创建 MessagePort authority",
      worker: workerHarness.worker,
      terminateWorkerOnDispose: true
    });

    const runtime = await createEditorRemoteAuthorityAppRuntime(source);

    expect(runtime.sourceLabel).toBe("Worker Authority");
    expect(runtime.document.revision).toBe("15");

    runtime.dispose();
    expect(workerHarness.wasTerminated()).toBe(true);

    workerHost.dispose();
  });

  test("应支持通过 window source 装配 authority runtime", async () => {
    const windowHarness = createFakeWindowHarness({
      targetOriginMustMatch: true
    });
    const bridgeHost = attachMessagePortRemoteAuthorityBridgeHost({
      receiver: windowHarness.receiver,
      service: {
        getDocument(): GraphDocument {
          return createDocument("17");
        },
        submitOperation() {
          return {
            accepted: true,
            changed: false,
            revision: "17"
          };
        },
        replaceDocument(document: GraphDocument): GraphDocument {
          return structuredClone(document);
        }
      },
      acceptConnection(event) {
        return event.origin === windowHarness.origin;
      },
      disposeServiceOnDispose: false
    });
    const source = createEditorRemoteAuthorityWindowSource({
      label: "Window Authority",
      description: "通过 window.postMessage 握手创建 MessagePort authority",
      target: windowHarness.target,
      targetOrigin: windowHarness.origin
    });

    const runtime = await createEditorRemoteAuthorityAppRuntime(source);

    expect(runtime.sourceLabel).toBe("Window Authority");
    expect(runtime.document.revision).toBe("17");

    runtime.dispose();
    bridgeHost.dispose();
  });

  test("应支持通过 demo worker source 装配 authority runtime", async () => {
    const workerHarness = createFakeWorkerHarness();
    const workerHost = attachMessagePortRemoteAuthorityWorkerHost({
      receiver: workerHarness.receiver,
      service: {
        getDocument(): GraphDocument {
          return createDocument("19");
        },
        submitOperation() {
          return {
            accepted: true,
            changed: false,
            revision: "19"
          };
        },
        replaceDocument(document: GraphDocument): GraphDocument {
          return structuredClone(document);
        }
      },
      disposeServiceOnDispose: false
    });
    const source = createEditorRemoteAuthorityDemoWorkerSource({
      label: "Demo Worker Authority",
      createWorker() {
        return workerHarness.worker;
      }
    });

    const runtime = await createEditorRemoteAuthorityAppRuntime(source);

    expect(runtime.sourceLabel).toBe("Demo Worker Authority");
    expect(runtime.document.revision).toBe("19");

    runtime.dispose();
    expect(workerHarness.wasTerminated()).toBe(true);

    workerHost.dispose();
  });
});

describe("resolveEditorAppBootstrap", () => {
  test("应从全局 bootstrap 读取 remote authority source", () => {
    const source: EditorRemoteAuthorityAppSource = {
      label: "Bootstrap Authority",
      createClient() {
        return createClientStub();
      }
    };
    const bridgeListener = () => {};

    const bootstrap = resolveEditorAppBootstrap({
      LeaferGraphEditorAppBootstrap: {
        remoteAuthoritySource: source,
        onViewportHostBridgeChange: bridgeListener
      }
    });

    expect(bootstrap.remoteAuthoritySource).toBe(source);
    expect(bootstrap.onViewportHostBridgeChange).toBe(bridgeListener);
  });

  test("缺少合法 bootstrap 时应回退为空对象", () => {
    expect(
      resolveEditorAppBootstrap({
        LeaferGraphEditorAppBootstrap: undefined
      })
    ).toEqual({});
  });

  test("应接受 transport 形式的 authority source", () => {
    const source: EditorRemoteAuthorityAppSource = {
      label: "Bootstrap Transport Authority",
      createTransport() {
        return createTransportStub();
      }
    };

    const bootstrap = resolveEditorAppBootstrap({
      LeaferGraphEditorAppBootstrap: {
        remoteAuthoritySource: source
      }
    });

    expect(bootstrap.remoteAuthoritySource).toBe(source);
  });

  test("应支持通过 bootstrap 直接传入 MessagePort authority", async () => {
    const channel = new MessageChannel();
    const bootstrap = resolveEditorAppBootstrap({
      LeaferGraphEditorAppBootstrap: {
        remoteAuthorityMessagePort: {
          port: channel.port1,
          label: "Bootstrap MessagePort"
        }
      }
    });

    expect(bootstrap.remoteAuthoritySource?.label).toBe("Bootstrap MessagePort");

    channel.port1.close();
    channel.port2.close();
  });

  test("应支持通过 bootstrap 直接传入 worker authority", () => {
    const workerHarness = createFakeWorkerHarness();
    const bootstrap = resolveEditorAppBootstrap({
      LeaferGraphEditorAppBootstrap: {
        remoteAuthorityWorker: {
          worker: workerHarness.worker,
          label: "Bootstrap Worker Authority"
        }
      }
    });

    expect(bootstrap.remoteAuthoritySource?.label).toBe(
      "Bootstrap Worker Authority"
    );
  });

  test("应支持通过 bootstrap 直接传入 window authority", () => {
    const windowHarness = createFakeWindowHarness();
    const bootstrap = resolveEditorAppBootstrap({
      LeaferGraphEditorAppBootstrap: {
        remoteAuthorityWindow: {
          target: windowHarness.target,
          targetOrigin: windowHarness.origin,
          label: "Bootstrap Window Authority"
        }
      }
    });

    expect(bootstrap.remoteAuthoritySource?.label).toBe(
      "Bootstrap Window Authority"
    );
  });

  test("应支持通过 bootstrap 直接传入 demo worker authority", () => {
    const bootstrap = resolveEditorAppBootstrap({
      LeaferGraphEditorAppBootstrap: {
        remoteAuthorityDemoWorker: {
          label: "Bootstrap Demo Worker Authority"
        }
      }
    });

    expect(bootstrap.remoteAuthoritySource?.label).toBe(
      "Bootstrap Demo Worker Authority"
    );
  });

  test("应支持通过 bootstrap 的 remoteAuthorityAdapter 使用内置 host adapter", () => {
    const channel = new MessageChannel();
    const bootstrap = resolveEditorAppBootstrap({
      LeaferGraphEditorAppBootstrap: {
        remoteAuthorityAdapter: {
          adapterId: "message-port",
          options: {
            port: channel.port1,
            label: "Bootstrap Adapter MessagePort"
          }
        }
      }
    });

    expect(bootstrap.remoteAuthoritySource?.label).toBe(
      "Bootstrap Adapter MessagePort"
    );

    channel.port1.close();
    channel.port2.close();
  });

  test("应支持通过 bootstrap 注入自定义 authority host adapter", () => {
    const customAdapter: EditorRemoteAuthorityHostAdapter = {
      adapterId: "custom-bridge",
      resolveSource(options) {
        const label =
          typeof (options as { label?: unknown } | undefined)?.label === "string"
            ? (options as { label: string }).label
            : "Custom Bridge Authority";

        return {
          label,
          description: "通过自定义 host adapter 注入 authority source",
          createClient() {
            return createClientStub({
              document: createDocument("27")
            });
          }
        };
      }
    };

    const bootstrap = resolveEditorAppBootstrap({
      LeaferGraphEditorAppBootstrap: {
        remoteAuthorityAdapter: {
          adapterId: "custom-bridge",
          options: {
            label: "Bootstrap Custom Bridge"
          }
        },
        remoteAuthorityHostAdapters: [customAdapter]
      }
    });

    expect(bootstrap.remoteAuthoritySource?.label).toBe(
      "Bootstrap Custom Bridge"
    );
    expect(bootstrap.remoteAuthoritySource?.description).toBe(
      "通过自定义 host adapter 注入 authority source"
    );
  });
});
