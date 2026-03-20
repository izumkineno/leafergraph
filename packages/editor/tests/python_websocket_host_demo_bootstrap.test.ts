import { afterEach, describe, expect, test } from "bun:test";
import { createServer } from "node:net";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import type { GraphDocument } from "leafergraph";
import { resolveEditorAppBootstrap } from "../src/app/editor_app_bootstrap";
import type { GraphViewportHostBridge } from "../src/ui/viewport";
import { createEditorRemoteAuthorityAppRuntime } from "../src/backend/authority/remote_authority_app_runtime";
import {
  DEFAULT_PYTHON_WEBSOCKET_AUTHORITY_URL,
  PYTHON_WEBSOCKET_HOST_DEMO_ADAPTER_ID,
  PYTHON_WEBSOCKET_HOST_DEMO_TEST_BUNDLES,
  installPythonWebSocketHostDemoBootstrap,
  resolvePythonWebSocketHealthUrl
} from "../src/demo/python_websocket_host_demo_bootstrap";

interface PythonHostDemoBootstrapHost {
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
  LeaferGraphEditorPythonHostDemo?: {
    mode: "python-host-demo";
    bridge: GraphViewportHostBridge | null;
    authorityUrl: string;
    authorityLabel: string;
    authorityName: string;
    preloadTestBundles: boolean;
    debugViewportBridgeLog: boolean;
  };
}

interface StartedPythonAuthorityServer {
  authorityOrigin: string;
  child: ChildProcessWithoutNullStreams;
  stdoutChunks: string[];
  stderrChunks: string[];
}

const pythonAuthorityChildren = new Set<ChildProcessWithoutNullStreams>();

function createDocument(revision: string): GraphDocument {
  return {
    documentId: "python-host-demo-doc",
    revision,
    appKind: "python-host-demo-test",
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

async function resolveFreePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("无法解析空闲端口");
  }
  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  return port;
}

function waitForChildExit(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    child.once("exit", () => {
      resolve();
    });
  });
}

async function waitForHealth(
  authorityOrigin: string,
  child: ChildProcessWithoutNullStreams,
  stdoutChunks: readonly string[],
  stderrChunks: readonly string[],
  timeoutMs = 60000
): Promise<void> {
  const startedAt = Date.now();
  const healthUrl = resolvePythonWebSocketHealthUrl(authorityOrigin);
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(
        `Python authority server 提前退出：exit=${child.exitCode}\nstdout:\n${stdoutChunks.join("")}\nstderr:\n${stderrChunks.join("")}`
      );
    }

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        cache: "no-store"
      });
      if (response.ok) {
        return;
      }
      lastError = new Error(`health ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    lastError instanceof Error
      ? `Python authority server 未在预期时间内就绪：${lastError.message}\nstdout:\n${stdoutChunks.join("")}\nstderr:\n${stderrChunks.join("")}`
      : "Python authority server 未在预期时间内就绪"
  );
}

async function startPythonAuthorityServer(): Promise<StartedPythonAuthorityServer> {
  const port = await resolveFreePort();
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const child = spawn(
    "uv",
    [
      "run",
      "--project",
      "templates/python-backend-control-template",
      "python",
      "-m",
      "leafergraph_python_backend_control_template.server"
    ],
    {
      cwd: "E:\\Code\\Node_editor\\leafergraph",
      env: {
        ...process.env,
        LEAFERGRAPH_PYTHON_AUTHORITY_HOST: "127.0.0.1",
        LEAFERGRAPH_PYTHON_AUTHORITY_PORT: String(port)
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  pythonAuthorityChildren.add(child);
  child.stdout.on("data", (chunk) => {
    stdoutChunks.push(String(chunk));
  });
  child.stderr.on("data", (chunk) => {
    stderrChunks.push(String(chunk));
  });

  const authorityOrigin = `http://localhost:${port}`;
  await waitForHealth(authorityOrigin, child, stdoutChunks, stderrChunks);
  return {
    authorityOrigin,
    child,
    stdoutChunks,
    stderrChunks
  };
}

afterEach(async () => {
  for (const child of pythonAuthorityChildren) {
    if (child.exitCode === null) {
      child.kill();
    }
    await waitForChildExit(child);
    pythonAuthorityChildren.delete(child);
  }
});

describe("installPythonWebSocketHostDemoBootstrap", () => {
  test("应预注入 Python WebSocket authority adapter，并可创建 runtime", async () => {
    const server = await startPythonAuthorityServer();
    const infoLogs: unknown[][] = [];
    const host: PythonHostDemoBootstrapHost = {
      location: {
        search:
          `?authorityUrl=${encodeURIComponent(server.authorityOrigin)}` +
          "&authorityLabel=Python%20Host%20Demo&authorityName=python-host-demo"
      },
      console: {
        info(...args: unknown[]) {
          infoLogs.push(args);
        }
      }
    };

    installPythonWebSocketHostDemoBootstrap(host);

    expect(host.LeaferGraphEditorAppBootstrap?.remoteAuthorityAdapter).toEqual({
      adapterId: PYTHON_WEBSOCKET_HOST_DEMO_ADAPTER_ID,
      options: {
        authorityUrl: server.authorityOrigin,
        authorityLabel: "Python Host Demo",
        authorityName: "python-host-demo",
        preloadTestBundles: false,
        debugViewportBridgeLog: false
      }
    });
    expect(
      host.LeaferGraphEditorAppBootstrap?.remoteAuthorityHostAdapters?.map(
        (adapter) => adapter.adapterId
      )
    ).toEqual([PYTHON_WEBSOCKET_HOST_DEMO_ADAPTER_ID]);

    const bootstrap = resolveEditorAppBootstrap(host);
    const source = bootstrap.remoteAuthoritySource;
    if (!source) {
      throw new Error("未解析到 Python host demo authority source");
    }

    const runtime = await createEditorRemoteAuthorityAppRuntime(source);
    expect(runtime.sourceLabel).toBe("Python Host Demo");
    expect(runtime.bundleProjectionMode).toBe("skip");
    expect(runtime.document.documentId).toBe("node-authority-doc");
    expect(runtime.getConnectionStatus()).toBe("connected");
    expect(
      await fetch(resolvePythonWebSocketHealthUrl(server.authorityOrigin)).then(
        (response) => response.json()
      )
    ).toEqual({
      ok: true,
      documentId: "node-authority-doc",
      revision: "1",
      connectionCount: 1
    });
    expect(host.LeaferGraphEditorPythonHostDemo).toEqual({
      mode: "python-host-demo",
      bridge: null,
      authorityUrl: server.authorityOrigin,
      authorityLabel: "Python Host Demo",
      authorityName: "python-host-demo",
      preloadTestBundles: false,
      debugViewportBridgeLog: false
    });

    const bridge = createHostBridge();
    host.LeaferGraphEditorAppBootstrap?.onViewportHostBridgeChange?.(bridge);

    expect(host.LeaferGraphEditorPythonHostDemo?.bridge).toBe(bridge);
    expect(infoLogs).toEqual([]);

    runtime.dispose();

    const disconnectStartedAt = Date.now();
    while (Date.now() - disconnectStartedAt < 5000) {
      const health = await fetch(
        resolvePythonWebSocketHealthUrl(server.authorityOrigin)
      ).then((response) => response.json());
      if (health.connectionCount === 0) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(
      await fetch(resolvePythonWebSocketHealthUrl(server.authorityOrigin)).then(
        (response) => response.json()
      )
    ).toEqual({
      ok: true,
      documentId: "node-authority-doc",
      revision: "1",
      connectionCount: 0
    });
  });

  test("未提供 query 时应使用与 Python server 默认监听一致的 authority 地址", () => {
    const host: PythonHostDemoBootstrapHost = {};

    installPythonWebSocketHostDemoBootstrap(host);

    expect(DEFAULT_PYTHON_WEBSOCKET_AUTHORITY_URL).toBe(
      "http://localhost:5503"
    );
    expect(
      host.LeaferGraphEditorAppBootstrap?.remoteAuthorityAdapter?.options
    ).toEqual({
      authorityUrl: DEFAULT_PYTHON_WEBSOCKET_AUTHORITY_URL,
      authorityLabel: "Python FastAPI Authority",
      authorityName: "python-websocket-host-demo",
      preloadTestBundles: false,
      debugViewportBridgeLog: false
    });
  });

  test("query 启用 preloadTestBundles 时应注入 test bundle 预装列表", () => {
    const host: PythonHostDemoBootstrapHost = {
      location: {
        search: "?preloadTestBundles=1"
      }
    };

    installPythonWebSocketHostDemoBootstrap(host);

    expect(host.LeaferGraphEditorAppBootstrap?.preloadedBundles).toEqual(
      PYTHON_WEBSOCKET_HOST_DEMO_TEST_BUNDLES
    );
    expect(host.LeaferGraphEditorPythonHostDemo?.preloadTestBundles).toBe(true);

    const bootstrap = resolveEditorAppBootstrap(host);
    expect(bootstrap.preloadedBundles).toEqual(
      PYTHON_WEBSOCKET_HOST_DEMO_TEST_BUNDLES
    );
  });

  test("应把 Python authority health 地址收敛到稳定的 loopback /health", () => {
    expect(resolvePythonWebSocketHealthUrl("http://localhost:5503")).toBe(
      "http://127.0.0.1:5503/health"
    );
    expect(
      resolvePythonWebSocketHealthUrl("ws://localhost:5503/authority")
    ).toBe("http://127.0.0.1:5503/health");
  });
});
