import { afterEach, describe, expect, test } from "bun:test";

import type { GraphDocument } from "leafergraph";
import { startNodeAuthorityServer } from "../../../templates/node-backend-control-template/src/index.js";
import { resolveEditorAppBootstrap } from "../src/app/editor_app_bootstrap";
import type { GraphViewportHostBridge } from "../src/ui/viewport";
import { createEditorRemoteAuthorityAppRuntime } from "../src/backend/authority/remote_authority_app_runtime";
import {
  DEFAULT_NODE_WEBSOCKET_AUTHORITY_URL,
  NODE_WEBSOCKET_HOST_DEMO_TEST_BUNDLES,
  NODE_WEBSOCKET_HOST_DEMO_ADAPTER_ID,
  installNodeWebSocketHostDemoBootstrap,
  resolveNodeWebSocketHealthUrl
} from "../src/demo/node_websocket_host_demo_bootstrap";

interface NodeHostDemoBootstrapHost {
  location?: {
    search?: string;
  };
  console?: {
    info(...args: unknown[]): void;
  };
  LeaferGraphEditorAppBootstrap?: {
    remoteAuthorityAdapter?: {
      adapterId: string;
      options?: unknown;
    };
    remoteAuthorityHostAdapters?: readonly {
      adapterId: string;
    }[];
    preloadedBundles?: readonly {
      slot: string;
      url: string;
      fileName?: string;
      enabled?: boolean;
    }[];
    onViewportHostBridgeChange?(bridge: GraphViewportHostBridge | null): void;
  };
  LeaferGraphEditorNodeHostDemo?: {
    mode: "node-host-demo";
    bridge: GraphViewportHostBridge | null;
    authorityUrl: string;
    authorityLabel: string;
    authorityName: string;
    preloadTestBundles: boolean;
    debugViewportBridgeLog: boolean;
  };
}

const authorityServers = new Set<Awaited<ReturnType<typeof startNodeAuthorityServer>>>();

function createDocument(revision: string): GraphDocument {
  return {
    documentId: "node-host-demo-doc",
    revision,
    appKind: "node-host-demo-test",
    nodes: [],
    links: [],
    meta: {}
  };
}

function createHostBridge(): GraphViewportHostBridge {
  const document = createDocument("3");

  return {
    graph: {} as never,
    executeCommand() {
      throw new Error("not implemented");
    },
    submitOperationWithAuthority() {
      throw new Error("not implemented");
    },
    async resyncAuthorityDocument() {
      return document;
    },
    replaceDocument() {},
    getCurrentDocument() {
      return document;
    },
    subscribeDocument() {
      return () => {};
    },
    getPendingOperationIds() {
      return [];
    },
    getSelectedNodeIds() {
      return [];
    },
    getNodeSnapshot() {
      return undefined;
    },
    getLink() {
      return undefined;
    }
  };
}

afterEach(async () => {
  for (const server of authorityServers) {
    await server.close();
    authorityServers.delete(server);
  }
});

describe("installNodeWebSocketHostDemoBootstrap", () => {
  test("应预注入 Node WebSocket authority adapter，并可创建 runtime", async () => {
    const server = await startNodeAuthorityServer({
      port: 0,
      authorityName: "node-host-demo-test"
    });
    authorityServers.add(server);
    const authorityOrigin = `http://localhost:${server.port}`;
    const infoLogs: unknown[][] = [];
    const host: NodeHostDemoBootstrapHost = {
      location: {
        search:
          `?authorityUrl=${encodeURIComponent(authorityOrigin)}` +
          "&authorityLabel=Node%20Host%20Demo&authorityName=node-host-demo"
      },
      console: {
        info(...args: unknown[]) {
          infoLogs.push(args);
        }
      }
    };

    installNodeWebSocketHostDemoBootstrap(host);

    expect(host.LeaferGraphEditorAppBootstrap?.remoteAuthorityAdapter).toEqual({
      adapterId: NODE_WEBSOCKET_HOST_DEMO_ADAPTER_ID,
      options: {
        authorityUrl: authorityOrigin,
        authorityLabel: "Node Host Demo",
        authorityName: "node-host-demo",
        preloadTestBundles: false,
        debugViewportBridgeLog: false
      }
    });
    expect(
      host.LeaferGraphEditorAppBootstrap?.remoteAuthorityHostAdapters?.map(
        (adapter) => adapter.adapterId
      )
    ).toEqual([NODE_WEBSOCKET_HOST_DEMO_ADAPTER_ID]);

    const bootstrap = resolveEditorAppBootstrap(host);
    const source = bootstrap.remoteAuthoritySource;
    if (!source) {
      throw new Error("未解析到 Node host demo authority source");
    }

    const runtime = await createEditorRemoteAuthorityAppRuntime(source);
    expect(runtime.sourceLabel).toBe("Node Host Demo");
    expect(runtime.bundleProjectionMode).toBe("skip");
    expect(runtime.document.documentId).toBe("node-authority-doc");
    expect(runtime.getConnectionStatus()).toBe("connected");
    expect(
      await fetch(server.healthUrl).then((response) => response.json())
    ).toEqual({
      ok: true,
      documentId: "node-authority-doc",
      revision: "1",
      connectionCount: 1
    });
    expect(host.LeaferGraphEditorNodeHostDemo).toEqual({
      mode: "node-host-demo",
      bridge: null,
      authorityUrl: authorityOrigin,
      authorityLabel: "Node Host Demo",
      authorityName: "node-host-demo",
      preloadTestBundles: false,
      debugViewportBridgeLog: false
    });

    const bridge = createHostBridge();
    host.LeaferGraphEditorAppBootstrap?.onViewportHostBridgeChange?.(bridge);

    expect(host.LeaferGraphEditorNodeHostDemo?.bridge).toBe(bridge);
    expect(infoLogs).toEqual([]);

    runtime.dispose();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      await fetch(server.healthUrl).then((response) => response.json())
    ).toEqual({
      ok: true,
      documentId: "node-authority-doc",
      revision: "1",
      connectionCount: 0
    });
  });

  test("未提供 query 时应使用与 Node server 默认监听一致的 authority 地址", () => {
    const host: NodeHostDemoBootstrapHost = {};

    installNodeWebSocketHostDemoBootstrap(host);

    expect(DEFAULT_NODE_WEBSOCKET_AUTHORITY_URL).toBe(
      "http://localhost:5502"
    );
    expect(
      host.LeaferGraphEditorAppBootstrap?.remoteAuthorityAdapter?.options
    ).toEqual({
      authorityUrl: DEFAULT_NODE_WEBSOCKET_AUTHORITY_URL,
      authorityLabel: "Node WebSocket Authority",
      authorityName: "node-websocket-host-demo",
      preloadTestBundles: false,
      debugViewportBridgeLog: false
    });
  });

  test("query 启用 preloadTestBundles 时应注入 test bundle 预装列表", () => {
    const host: NodeHostDemoBootstrapHost = {
      location: {
        search: "?preloadTestBundles=1"
      }
    };

    installNodeWebSocketHostDemoBootstrap(host);

    expect(host.LeaferGraphEditorAppBootstrap?.preloadedBundles).toEqual(
      NODE_WEBSOCKET_HOST_DEMO_TEST_BUNDLES
    );
    expect(host.LeaferGraphEditorNodeHostDemo?.preloadTestBundles).toBe(true);

    const bootstrap = resolveEditorAppBootstrap(host);
    expect(bootstrap.preloadedBundles).toEqual(
      NODE_WEBSOCKET_HOST_DEMO_TEST_BUNDLES
    );
    expect(
      NODE_WEBSOCKET_HOST_DEMO_TEST_BUNDLES.filter(
        (bundle) => bundle.slot === "demo"
      ).map((bundle) => bundle.fileName)
    ).toEqual(["demo.iife.js", "demo-alt.iife.js"]);
  });

  test("应把 authority health 地址收敛到稳定的 loopback /health", () => {
    expect(resolveNodeWebSocketHealthUrl("http://localhost:5502")).toBe(
      "http://127.0.0.1:5502/health"
    );
    expect(resolveNodeWebSocketHealthUrl("ws://localhost:5502/authority")).toBe(
      "http://127.0.0.1:5502/health"
    );
  });

  test("首连失败时应把 health 检查结果翻译成更明确的错误", async () => {
    const originalFetch = globalThis.fetch;
    const originalWebSocket = globalThis.WebSocket;
    const host: NodeHostDemoBootstrapHost = {
      location: {
        search: "?authorityUrl=http%3A%2F%2Flocalhost%3A5502"
      }
    };

    class FailingWebSocket extends EventTarget {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readonly readyState = FailingWebSocket.CONNECTING;

      constructor() {
        super();
        queueMicrotask(() => {
          this.dispatchEvent(new Event("error"));
        });
      }

      send(): void {}
      close(): void {}
    }

    globalThis.fetch = (async () =>
      new Response(null, {
        status: 502,
        statusText: "Bad Gateway"
      })) as typeof fetch;
    globalThis.WebSocket = FailingWebSocket as unknown as typeof WebSocket;

    try {
      installNodeWebSocketHostDemoBootstrap(host);
      const bootstrap = resolveEditorAppBootstrap(host);
      const source = bootstrap.remoteAuthoritySource;
      if (!source) {
        throw new Error("未解析到 Node host demo authority source");
      }

      await expect(createEditorRemoteAuthorityAppRuntime(source)).rejects.toThrow(
        "authority 健康检查失败：502 Bad Gateway"
      );
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.WebSocket = originalWebSocket;
    }
  });
});
