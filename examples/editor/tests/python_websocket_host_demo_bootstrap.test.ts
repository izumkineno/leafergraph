import "./helpers/install_test_host_polyfills";

import { afterEach, describe, expect, test } from "bun:test";
import { createServer } from "node:net";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import type { GraphDocument } from "leafergraph";
import { resolveEditorAppBootstrap } from "../src/app/editor_app_bootstrap";
import type { GraphViewportHostBridge } from "../src/ui/viewport";
import { createEditorRemoteAuthorityAppRuntime } from "../src/backend/authority/remote_authority_app_runtime";
import type { EditorRemoteAuthorityClient } from "../src/session/graph_document_authority_client";
import { createRemoteGraphDocumentSession } from "../src/session/graph_document_session";
import {
  DEFAULT_PYTHON_WEBSOCKET_AUTHORITY_URL,
  PYTHON_WEBSOCKET_HOST_DEMO_ADAPTER_ID,
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

function createRemoteRuntimeTestDocument(): GraphDocument {
  return {
    documentId: "python-openrpc-runtime-doc",
    revision: "1",
    appKind: "python-openrpc-runtime-test",
    nodes: [
      {
        id: "on-play",
        type: "system/on-play",
        title: "On Play",
        layout: { x: 0, y: 0, width: 220, height: 120 },
        outputs: [{ name: "Event", type: "event" }]
      },
      {
        id: "counter",
        type: "template/execute-counter",
        title: "Counter",
        layout: { x: 280, y: 0, width: 260, height: 160 },
        properties: { count: 0, status: "READY" },
        inputs: [{ name: "Start", type: "event" }],
        outputs: [{ name: "Count", type: "number" }]
      },
      {
        id: "display",
        type: "template/execute-display",
        title: "Display",
        layout: { x: 600, y: 0, width: 260, height: 160 },
        properties: { status: "WAITING" },
        inputs: [{ name: "Value", type: "number" }]
      }
    ],
    links: [
      {
        id: "link:on-play->counter",
        source: { nodeId: "on-play", slot: 0 },
        target: { nodeId: "counter", slot: 0 }
      },
      {
        id: "link:counter->display",
        source: { nodeId: "counter", slot: 0 },
        target: { nodeId: "display", slot: 0 }
      }
    ],
    meta: {}
  };
}

function createRemoteTimerTestDocument(): GraphDocument {
  return {
    documentId: "python-openrpc-timer-doc",
    revision: "1",
    appKind: "python-openrpc-runtime-test",
    nodes: [
      {
        id: "timer-on-play",
        type: "system/on-play",
        title: "On Play",
        layout: { x: 0, y: 0, width: 220, height: 120 },
        outputs: [{ name: "Event", type: "event" }]
      },
      {
        id: "timer-node",
        type: "system/timer",
        title: "Timer",
        layout: { x: 280, y: 0, width: 260, height: 180 },
        properties: {
          intervalMs: 40,
          immediate: true,
          runCount: 0,
          status: "READY"
        },
        widgets: [
          { type: "input", name: "intervalMs", value: 40 },
          { type: "toggle", name: "immediate", value: true }
        ],
        inputs: [{ name: "Start", type: "event" }],
        outputs: [{ name: "Tick", type: "event" }]
      },
      {
        id: "timer-display",
        type: "template/execute-display",
        title: "Display",
        layout: { x: 620, y: 0, width: 260, height: 160 },
        properties: { status: "WAITING" },
        inputs: [{ name: "Value", type: "event" }]
      }
    ],
    links: [
      {
        id: "link:on-play->timer",
        source: { nodeId: "timer-on-play", slot: 0 },
        target: { nodeId: "timer-node", slot: 0 }
      },
      {
        id: "link:timer->display",
        source: { nodeId: "timer-node", slot: 0 },
        target: { nodeId: "timer-display", slot: 0 }
      }
    ],
    meta: {}
  };
}

function createRemoteBatchCommitTestDocument(): GraphDocument {
  return {
    documentId: "python-openrpc-batch-doc",
    revision: "1",
    appKind: "python-openrpc-batch-test",
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
      "templates/backend/python-openrpc-authority-template",
      "python",
      "-m",
      "leafergraph_python_openrpc_authority_template.entry"
    ],
    {
      cwd: "E:\\Code\\Node_editor\\leafergraph",
      env: {
        ...process.env,
        LEAFERGRAPH_PYTHON_OPENRPC_BACKEND_HOST: "127.0.0.1",
        LEAFERGRAPH_PYTHON_OPENRPC_BACKEND_PORT: String(port)
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
    const runtimeFeedbackEvents: unknown[] = [];
    const disposeRuntimeFeedback =
      runtime.runtimeFeedbackInlet?.subscribe((event) => {
        runtimeFeedbackEvents.push(event);
      }) ?? (() => {});

    expect(runtime.sourceLabel).toBe("Python Host Demo");
    expect(runtime.bundleProjectionMode).toBe("skip");
    expect(runtime.document.documentId).toBe("python-openrpc-document");
    expect(runtime.getConnectionStatus()).toBe("connected");
    expect(
      await fetch(resolvePythonWebSocketHealthUrl(server.authorityOrigin)).then(
        (response) => response.json()
      )
    ).toEqual({
      ok: true,
      authorityName: "python-openrpc-authority-template",
      documentId: "python-openrpc-document",
      revision: 0,
      connectionCount: 1
    });
    expect(host.LeaferGraphEditorPythonHostDemo).toEqual({
      mode: "python-host-demo",
      bridge: null,
      authorityUrl: server.authorityOrigin,
      authorityLabel: "Python Host Demo",
      authorityName: "python-host-demo",
      debugViewportBridgeLog: false
    });

    const bridge = createHostBridge();
    host.LeaferGraphEditorAppBootstrap?.onViewportHostBridgeChange?.(bridge);

    expect(host.LeaferGraphEditorPythonHostDemo?.bridge).toBe(bridge);
    expect(infoLogs).toEqual([]);

    if (!runtime.runtimeController) {
      throw new Error("未暴露 remote runtimeController");
    }
    if (typeof runtime.client.replaceDocument !== "function") {
      throw new Error("remote authority client 缺少 replaceDocument");
    }

    await runtime.client.replaceDocument(createRemoteRuntimeTestDocument(), {
      currentDocument: runtime.document
    });
    const stepResult = await runtime.runtimeController.controlRuntime({
      type: "graph.step"
    });
    expect(stepResult).toMatchObject({
      accepted: true,
      changed: true,
      state: {
        status: "idle",
        queueSize: 0,
        stepCount: 1,
        lastSource: "graph-step"
      }
    });

    const waitForStepFeedbackStartedAt = Date.now();
    while (Date.now() - waitForStepFeedbackStartedAt < 5000) {
      if (
        runtimeFeedbackEvents.some(
          (event) =>
            typeof event === "object" &&
            event !== null &&
            "type" in event &&
            (event as { type: string }).type === "node.execution" &&
            (event as { event: { nodeId?: string } }).event?.nodeId === "display"
        )
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(
      runtimeFeedbackEvents.some(
        (event) =>
          typeof event === "object" &&
          event !== null &&
          "type" in event &&
          (event as { type: string }).type === "node.state" &&
          (event as { event: { nodeId?: string } }).event?.nodeId === "counter"
      )
    ).toBe(true);
    expect(
      runtimeFeedbackEvents.some(
        (event) =>
          typeof event === "object" &&
          event !== null &&
          "type" in event &&
          (event as { type: string }).type === "link.propagation" &&
          (event as { event: { linkId?: string } }).event?.linkId === "link:on-play->counter"
      )
    ).toBe(true);

    runtimeFeedbackEvents.length = 0;
    await runtime.client.replaceDocument(createRemoteTimerTestDocument(), {
      currentDocument: await runtime.client.getDocument()
    });
    const playResult = await runtime.runtimeController.controlRuntime({
      type: "graph.play"
    });
    expect(playResult.state?.status).toBe("running");

    const waitForTimerFeedbackStartedAt = Date.now();
    while (Date.now() - waitForTimerFeedbackStartedAt < 5000) {
      if (
        runtimeFeedbackEvents.some(
          (event) =>
            typeof event === "object" &&
            event !== null &&
            "type" in event &&
            (event as { type: string }).type === "graph.execution" &&
            (event as { event: { type?: string; nodeId?: string } }).event?.type === "advanced" &&
            (event as { event: { nodeId?: string } }).event?.nodeId === "timer-node"
        )
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    runtimeFeedbackEvents.length = 0;
    const timerDocumentBeforeUpdate = await runtime.client.getDocument();
    const timerNodeBeforeUpdate = timerDocumentBeforeUpdate.nodes.find(
      (node) => node.id === "timer-node"
    );
    if (!timerNodeBeforeUpdate?.widgets) {
      throw new Error("timer-node 缺少 widgets");
    }

    const widgetUpdateResult = await runtime.client.submitOperation(
      {
        operationId: "python-host-demo-widget-update",
        timestamp: Date.now(),
        source: "editor.test",
        type: "node.update",
        nodeId: "timer-node",
        input: {
          widgets: timerNodeBeforeUpdate.widgets.map((widget) => ({
            ...widget,
            value: widget.name === "intervalMs" ? 5 : false
          })),
          properties: {
            ...(timerNodeBeforeUpdate.properties ?? {}),
            intervalMs: 5,
            immediate: false
          }
        }
      },
      {
        currentDocument: timerDocumentBeforeUpdate,
        pendingOperationIds: []
      }
    );
    expect(widgetUpdateResult).toMatchObject({
      accepted: true,
      changed: true
    });
    expect(widgetUpdateResult.document).toBeUndefined();

    const waitForPostUpdateFeedbackStartedAt = Date.now();
    while (Date.now() - waitForPostUpdateFeedbackStartedAt < 5000) {
      if (
        runtimeFeedbackEvents.some(
          (event) =>
            typeof event === "object" &&
            event !== null &&
            "type" in event &&
            (event as { type: string }).type === "graph.execution" &&
            (event as { event: { type?: string; nodeId?: string } }).event?.type === "advanced" &&
            (event as { event: { nodeId?: string } }).event?.nodeId === "timer-node"
        )
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const stopResult = await runtime.runtimeController.controlRuntime({
      type: "graph.stop"
    });
    expect(stopResult).toMatchObject({
      accepted: true,
      changed: true,
      state: {
        status: "idle"
      }
    });

    const finalDocument = await runtime.client.getDocument();
    const finalTimerNode = finalDocument.nodes.find(
      (node) => node.id === "timer-node"
    );
    expect(finalTimerNode?.properties).toMatchObject({
      intervalMs: 5,
      immediate: false
    });
    expect(
      typeof finalTimerNode?.properties?.runCount === "number" &&
        finalTimerNode.properties.runCount >= 1
    ).toBe(true);

    disposeRuntimeFeedback();
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

    const finalHealth = await fetch(
      resolvePythonWebSocketHealthUrl(server.authorityOrigin)
    ).then((response) => response.json());
    expect(finalHealth).toMatchObject({
      ok: true,
      authorityName: "python-openrpc-authority-template",
      documentId: "python-openrpc-timer-doc",
      connectionCount: 0
    });
    expect(finalHealth.revision).toBeGreaterThanOrEqual(3);
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
      debugViewportBridgeLog: false
    });
  });

  test("批量 submitOperation 不应触发 remote session full resync，且最终后端文档应完整落地", async () => {
    const server = await startPythonAuthorityServer();
    const host: PythonHostDemoBootstrapHost = {
      location: {
        search: `?authorityUrl=${encodeURIComponent(server.authorityOrigin)}`
      }
    };

    installPythonWebSocketHostDemoBootstrap(host);
    const bootstrap = resolveEditorAppBootstrap(host);
    const source = bootstrap.remoteAuthoritySource;
    if (!source) {
      throw new Error("未解析到 Python host demo authority source");
    }

    const runtime = await createEditorRemoteAuthorityAppRuntime(source);
    if (typeof runtime.client.replaceDocument !== "function") {
      throw new Error("remote authority client 缺少 replaceDocument");
    }

    await runtime.client.replaceDocument(createRemoteBatchCommitTestDocument(), {
      currentDocument: runtime.document
    });
    const initialDocument = await runtime.client.getDocument();
    let resyncGetDocumentCount = 0;
    const sessionClient: EditorRemoteAuthorityClient = {
      getDocument: async () => {
        resyncGetDocumentCount += 1;
        return runtime.client.getDocument();
      },
      submitOperation: runtime.client.submitOperation.bind(runtime.client),
      replaceDocument: runtime.client.replaceDocument.bind(runtime.client),
      subscribeDocument:
        typeof runtime.client.subscribeDocument === "function"
          ? runtime.client.subscribeDocument.bind(runtime.client)
          : undefined,
      subscribeDocumentDiff:
        typeof runtime.client.subscribeDocumentDiff === "function"
          ? runtime.client.subscribeDocumentDiff.bind(runtime.client)
          : undefined
    };
    const session = createRemoteGraphDocumentSession({
      document: initialDocument,
      client: sessionClient
    });
    const projectedRevisions: string[] = [];
    const projectedSnapshots: GraphDocument[] = [];
    const disposeProjectionSubscription = session.subscribeProjection?.(
      (projection) => {
        projectedRevisions.push(String(projection.document.revision));
        projectedSnapshots.push(structuredClone(projection.document));
      }
    );

    const submissions = [
      session.submitOperationWithAuthority({
        type: "node.create",
        operationId: "batch-node-a",
        timestamp: Date.now(),
        source: "editor.test",
        input: {
          id: "batch-node-a",
          type: "demo/node",
          title: "Batch Node A",
          x: 80,
          y: 120,
          width: 240,
          height: 140
        }
      }),
      session.submitOperationWithAuthority({
        type: "node.create",
        operationId: "batch-node-b",
        timestamp: Date.now() + 1,
        source: "editor.test",
        input: {
          id: "batch-node-b",
          type: "demo/node",
          title: "Batch Node B",
          x: 360,
          y: 120,
          width: 240,
          height: 140
        }
      }),
      session.submitOperationWithAuthority({
        type: "link.create",
        operationId: "batch-link-a-b",
        timestamp: Date.now() + 2,
        source: "editor.test",
        input: {
          id: "batch-link-a-b",
          source: {
            nodeId: "batch-node-a",
            slot: 0
          },
          target: {
            nodeId: "batch-node-b",
            slot: 0
          }
        }
      })
    ];

    expect(session.pendingOperationIds).toHaveLength(3);

    const confirmations = await Promise.all(
      submissions.map((submission) => submission.confirmation)
    );
    await Promise.resolve();

    expect(confirmations).toEqual([
      expect.objectContaining({
        operationId: "batch-node-a",
        accepted: true,
        changed: true
      }),
      expect.objectContaining({
        operationId: "batch-node-b",
        accepted: true,
        changed: true
      }),
      expect.objectContaining({
        operationId: "batch-link-a-b",
        accepted: true,
        changed: true
      })
    ]);
    expect(session.pendingOperationIds).toHaveLength(0);
    expect(resyncGetDocumentCount).toBe(0);
    expect(session.currentDocument.nodes.map((node) => node.id)).toEqual([
      "batch-node-a",
      "batch-node-b"
    ]);
    expect(session.currentDocument.links.map((link) => link.id)).toEqual([
      "batch-link-a-b"
    ]);
    expect(projectedRevisions).toEqual(["1", "2", "3", "4"]);
    expect(projectedSnapshots.at(-1)?.nodes.map((node) => node.id)).toEqual([
      "batch-node-a",
      "batch-node-b"
    ]);
    expect(projectedSnapshots.at(-1)?.links.map((link) => link.id)).toEqual([
      "batch-link-a-b"
    ]);

    const finalDocument = await runtime.client.getDocument();
    expect(finalDocument.nodes.map((node) => node.id)).toEqual([
      "batch-node-a",
      "batch-node-b"
    ]);
    expect(finalDocument.links.map((link) => link.id)).toEqual([
      "batch-link-a-b"
    ]);

    disposeProjectionSubscription?.();
    session.dispose?.();
    runtime.dispose();
  });

  test("query 包含 preloadTestBundles 时应忽略预装参数，仍以后端推送为准", () => {
    const host: PythonHostDemoBootstrapHost = {
      location: {
        search: "?preloadTestBundles=1"
      }
    };

    installPythonWebSocketHostDemoBootstrap(host);

    expect(host.LeaferGraphEditorAppBootstrap?.preloadedBundles).toBeUndefined();

    const bootstrap = resolveEditorAppBootstrap(host);
    expect(bootstrap.preloadedBundles).toBeUndefined();
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
