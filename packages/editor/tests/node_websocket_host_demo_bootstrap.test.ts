import { afterEach, describe, expect, test } from "bun:test";

import type { GraphDocument } from "leafergraph";
import { startNodeAuthorityServer } from "../../node/src/authority";
import { resolveEditorAppBootstrap } from "../src/app/editor_app_bootstrap";
import type { GraphViewportHostBridge } from "../src/app/GraphViewport";
import { createEditorRemoteAuthorityAppRuntime } from "../src/app/remote_authority_app_runtime";
import {
  DEFAULT_NODE_WEBSOCKET_AUTHORITY_URL,
  NODE_WEBSOCKET_HOST_DEMO_TEST_BUNDLES,
  NODE_WEBSOCKET_HOST_DEMO_ADAPTER_ID,
  installNodeWebSocketHostDemoBootstrap
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
    const infoLogs: unknown[][] = [];
    const host: NodeHostDemoBootstrapHost = {
      location: {
        search:
          `?authorityUrl=${encodeURIComponent(server.authorityUrl)}` +
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
        authorityUrl: server.authorityUrl,
        authorityLabel: "Node Host Demo",
        authorityName: "node-host-demo",
        preloadTestBundles: false
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
    expect(runtime.document.documentId).toBe("node-authority-doc");
    expect(host.LeaferGraphEditorNodeHostDemo).toEqual({
      mode: "node-host-demo",
      bridge: null,
      authorityUrl: server.authorityUrl,
      authorityLabel: "Node Host Demo",
      authorityName: "node-host-demo",
      preloadTestBundles: false
    });

    const bridge = createHostBridge();
    host.LeaferGraphEditorAppBootstrap?.onViewportHostBridgeChange?.(bridge);

    expect(host.LeaferGraphEditorNodeHostDemo?.bridge).toBe(bridge);
    expect(infoLogs).toEqual([
      [
        "[authority-node-host-demo]",
        `viewport bridge ready for ${server.authorityUrl}`
      ]
    ]);

    runtime.dispose();
  });

  test("未提供 query 时应使用与 Node server 默认监听一致的 authority 地址", () => {
    const host: NodeHostDemoBootstrapHost = {};

    installNodeWebSocketHostDemoBootstrap(host);

    expect(DEFAULT_NODE_WEBSOCKET_AUTHORITY_URL).toBe(
      "ws://127.0.0.1:5502/authority"
    );
    expect(
      host.LeaferGraphEditorAppBootstrap?.remoteAuthorityAdapter?.options
    ).toEqual({
      authorityUrl: DEFAULT_NODE_WEBSOCKET_AUTHORITY_URL,
      authorityLabel: "Node WebSocket Authority",
      authorityName: "node-websocket-host-demo",
      preloadTestBundles: false
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
  });
});
