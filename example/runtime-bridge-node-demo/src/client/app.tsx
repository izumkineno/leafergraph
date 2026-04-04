import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Debug } from "leafergraph";
import { leaferGraphBasicKitPlugin } from "@leafergraph/basic-kit";
import {
  createLeaferGraph,
  RuntimeBridgeBrowserExtensionManager,
  type LeaferGraph,
  type RuntimeBridgeBlueprintCatalogEntry,
  type RuntimeBridgeCatalogEntry,
  type RuntimeBridgeComponentCatalogEntry,
  type RuntimeBridgeExtensionsSync,
  type RuntimeBridgeNodeCatalogEntry
} from "@leafergraph/runtime-bridge";
import { LeaferGraphRuntimeBridgeClient } from "@leafergraph/runtime-bridge/client";
import type { RuntimeBridgeDiffMode } from "@leafergraph/runtime-bridge/transport";
import {
  createGraphOperationsFromInteractionCommit,
  type GraphOperationApplyResult,
  type LeaferGraphHistoryEvent,
  type LeaferGraphInteractionCommitEvent,
  type RuntimeFeedbackEvent
} from "@leafergraph/runtime-bridge/portable";
import {
  createRuntimeBridgeNodeDemoDocument,
  RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS
} from "../shared/document";
import {
  DEMO_FREQUENCY_LAB_BLUEPRINT_ENTRY_ID,
  DEMO_FREQUENCY_STRESS_BLUEPRINT_ENTRY_ID
} from "../shared/catalog";
import { formatDemoPayload, formatDemoTimestamp } from "../shared/log_format";
import {
  summarizeDemoStreamFrame,
  type DemoBrowserStreamStats,
  type DemoStreamFrame
} from "../shared/stream";
import {
  DemoHttpArtifactClient,
  resolveRuntimeBridgeDemoHttpBaseUrl
} from "./artifact_client";
import {
  RuntimeBridgeCatalogPanel,
  type DemoBlueprintEntryForm,
  type DemoComponentEntryForm,
  type DemoNodeEntryForm
} from "./catalog_panel";
import {
  createRuntimeBridgeNodeDemoStreamStore,
  installRuntimeBridgeNodeDemoBrowserStreamStore
} from "./stream_store";
import {
  resolveRuntimeBridgeDemoWebSocketUrl,
  WebSocketRuntimeBridgeTransport,
  type WebSocketRuntimeBridgeTransportStatus
} from "./websocket_transport";
import { DiffEngine, deepClone } from "../shared/diff";
import "./app.css";

type DemoLogEntry = {
  id: number;
  at: string;
  channel:
    | "system"
    | "transport"
    | "history"
    | "runtime"
    | "interaction"
    | "catalog";
  title: string;
  detail: string;
};

type DemoClientRuntime = {
  graph: LeaferGraph;
  bridgeClient: LeaferGraphRuntimeBridgeClient;
  transport: WebSocketRuntimeBridgeTransport;
  artifactClient: DemoHttpArtifactClient;
  extensionManager: RuntimeBridgeBrowserExtensionManager;
  streamStore: ReturnType<typeof createRuntimeBridgeNodeDemoStreamStore>;
  cleanup: Array<() => void>;
};

type DemoLeaferDebugConfig = {
  enable: boolean;
  showWarn: boolean;
  filter: string | readonly string[];
  exclude: string | readonly string[];
  showRepaint: boolean | string;
  showBounds: boolean | string | "hit";
};

const LEAFER_DEBUG_NAME_OPTIONS = [
  { value: "", label: "无" },
  { value: "RunTime", label: "RunTime" },
  { value: "Renderer", label: "Renderer" },
  { value: "Leafer", label: "Leafer" },
  { value: "Life", label: "Life" },
  { value: "setAttr", label: "setAttr" }
] as const;

const initialTransportStatus: WebSocketRuntimeBridgeTransportStatus = {
  state: "idle",
  url: resolveRuntimeBridgeDemoWebSocketUrl(),
  lastError: null
};

const EMPTY_EXTENSIONS_SYNC: RuntimeBridgeExtensionsSync = {
  entries: [],
  activeNodeEntryIds: [],
  activeComponentEntryIds: [],
  currentBlueprintId: null,
  emittedAt: 0
};

const DEMO_DEFAULT_LEAFER_DEBUG_CONFIG: DemoLeaferDebugConfig = {
  enable: false,
  showWarn: true,
  filter: [],
  exclude: [],
  showRepaint: false,
  showBounds: false
};

const INITIAL_COMPONENT_FORM: DemoComponentEntryForm = {
  entryId: "custom/component/demo-widget",
  name: "自定义组件",
  widgetTypes: "custom/demo-widget",
  browserFile: null
};

const INITIAL_NODE_FORM: DemoNodeEntryForm = {
  entryId: "custom/node/demo-node",
  name: "自定义节点",
  nodeTypes: "custom/demo-node",
  componentEntryIds: "",
  authorityFile: null,
  browserFile: null
};

const INITIAL_BLUEPRINT_FORM: DemoBlueprintEntryForm = {
  entryId: "custom/blueprint/demo-scene",
  name: "自定义蓝图",
  nodeEntryIds: "",
  componentEntryIds: "",
  documentFile: null
};

const EMPTY_STREAM_STATS: DemoBrowserStreamStats = {
  totalFrames: 0,
  framesPerSecond: 0,
  latestNodeCount: 0,
  lastFrameAt: null,
  lastFrameKind: null
};

let logEntrySeed = 1;

function isStressBlueprintEntryId(entryId: string | null | undefined): boolean {
  return entryId === DEMO_FREQUENCY_STRESS_BLUEPRINT_ENTRY_ID;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function cloneDemoLeaferDebugList(
  value: string | readonly string[]
): string | string[] {
  return typeof value === "string" ? value : [...value];
}

function cloneDemoLeaferDebugConfig(
  config: DemoLeaferDebugConfig
): DemoLeaferDebugConfig {
  return {
    ...config,
    filter: cloneDemoLeaferDebugList(config.filter),
    exclude: cloneDemoLeaferDebugList(config.exclude)
  };
}

function resolveBooleanSelectValue(value: boolean): "on" | "off" {
  return value ? "on" : "off";
}

function resolveLeaferDebugNameSelectValue(
  value: DemoLeaferDebugConfig["filter"] | DemoLeaferDebugConfig["exclude"]
): string {
  if (typeof value === "string") {
    return value;
  }

  return value[0] ?? "";
}

function resolveLeaferDebugBoundsSelectValue(
  value: DemoLeaferDebugConfig["showBounds"]
): "off" | "bounds" | "hit" {
  if (value === "hit") {
    return "hit";
  }

  return value ? "bounds" : "off";
}

function resolveTransportStateLabel(
  state: WebSocketRuntimeBridgeTransportStatus["state"]
): string {
  switch (state) {
    case "connected":
      return "已连接";
    case "connecting":
      return "连接中";
    case "disconnecting":
      return "断开中";
    case "idle":
    default:
      return "未连接";
  }
}

function resolveLogChannelLabel(channel: DemoLogEntry["channel"]): string {
  switch (channel) {
    case "system":
      return "系统";
    case "transport":
      return "传输";
    case "history":
      return "历史";
    case "runtime":
      return "运行时";
    case "interaction":
      return "交互";
    case "catalog":
    default:
      return "目录";
  }
}

function resolveStreamKindLabel(kind: DemoStreamFrame["kind"] | null): string {
  switch (kind) {
    case "scope":
      return "波形";
    case "spectrum":
      return "频谱";
    case "perf":
      return "性能";
    default:
      return "无";
  }
}

function captureDemoLeaferDebugConfig(): DemoLeaferDebugConfig {
  return {
    enable: Debug.enable,
    showWarn: Debug.showWarn,
    filter: [...Debug.filterList],
    exclude: [...Debug.excludeList],
    showRepaint: Debug.showRepaint,
    showBounds: Debug.showBounds
  };
}

function applyDemoLeaferDebugConfig(config: DemoLeaferDebugConfig): void {
  Debug.enable = config.enable;
  Debug.showWarn = config.showWarn;
  Debug.filter = cloneDemoLeaferDebugList(config.filter);
  Debug.exclude = cloneDemoLeaferDebugList(config.exclude);
  Debug.showRepaint = config.showRepaint;
  Debug.showBounds = config.showBounds;
}

function parseListInput(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

function isNodeEntry(
  entry: RuntimeBridgeCatalogEntry
): entry is RuntimeBridgeNodeCatalogEntry {
  return entry.entryKind === "node-entry";
}

function isComponentEntry(
  entry: RuntimeBridgeCatalogEntry
): entry is RuntimeBridgeComponentCatalogEntry {
  return entry.entryKind === "component-entry";
}

function isBlueprintEntry(
  entry: RuntimeBridgeCatalogEntry
): entry is RuntimeBridgeBlueprintCatalogEntry {
  return entry.entryKind === "blueprint-entry";
}

/**
 * backend-first demo 调试台。
 *
 * @returns 页面 JSX。
 */
export function App() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<DemoClientRuntime | null>(null);
  const initialDebugConfigRef = useRef<DemoLeaferDebugConfig | null>(null);
  const lastStreamLogAtRef = useRef(0);
  const stressLogsMutedRef = useRef(false);
  const [transportStatus, setTransportStatus] = useState(initialTransportStatus);
  const [logs, setLogs] = useState<DemoLogEntry[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [currentRevision, setCurrentRevision] = useState<string | number>(1);
  const [ready, setReady] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [extensionsSync, setExtensionsSync] =
    useState<RuntimeBridgeExtensionsSync>(EMPTY_EXTENSIONS_SYNC);
  const [componentForm, setComponentForm] =
    useState<DemoComponentEntryForm>(INITIAL_COMPONENT_FORM);
  const [nodeForm, setNodeForm] = useState<DemoNodeEntryForm>(INITIAL_NODE_FORM);
  const [blueprintForm, setBlueprintForm] =
    useState<DemoBlueprintEntryForm>(INITIAL_BLUEPRINT_FORM);
  const [streamStats, setStreamStats] = useState<DemoBrowserStreamStats>(EMPTY_STREAM_STATS);
  const [leaferDebugConfig, setLeaferDebugConfig] = useState<DemoLeaferDebugConfig>(
    cloneDemoLeaferDebugConfig(DEMO_DEFAULT_LEAFER_DEBUG_CONFIG)
  );
  const [diffEnabled, setDiffEnabled] = useState(false);
  const [diffEngine, setDiffEngine] = useState<DiffEngine | null>(null);
  const [lastDiffResult, setLastDiffResult] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [bridgeDiffMode, setBridgeDiffMode] = useState<RuntimeBridgeDiffMode>("diff");

  const applyStressLogMute = (currentBlueprintId: string | null): void => {
    const shouldMute = isStressBlueprintEntryId(currentBlueprintId);
    if (stressLogsMutedRef.current === shouldMute) {
      return;
    }

    stressLogsMutedRef.current = shouldMute;
    lastStreamLogAtRef.current = 0;

    if (shouldMute) {
      setLogs([]);
    }
  };

  const appendLog = (
    channel: DemoLogEntry["channel"],
    title: string,
    detail: unknown
  ) => {
    if (stressLogsMutedRef.current) {
      return;
    }

    const nextEntry: DemoLogEntry = {
      id: logEntrySeed,
      at: formatDemoTimestamp(),
      channel,
      title,
      detail: formatDemoPayload(detail)
    };

    logEntrySeed += 1;
    setLogs((previous) => [nextEntry, ...previous].slice(0, 120));
  };

  useEffect(() => {
    initialDebugConfigRef.current = captureDemoLeaferDebugConfig();
    applyDemoLeaferDebugConfig(DEMO_DEFAULT_LEAFER_DEBUG_CONFIG);
    setLeaferDebugConfig(cloneDemoLeaferDebugConfig(DEMO_DEFAULT_LEAFER_DEBUG_CONFIG));

    const container = canvasRef.current;
    if (!container) {
      return;
    }

    let disposed = false;

    const initialize = async () => {
      try {
        const graph = createLeaferGraph(container, {
          document: createRuntimeBridgeNodeDemoDocument(),
          plugins: [leaferGraphBasicKitPlugin],
          themeMode: "light",
          config: {
            graph: {
              runtime: {
                respectReducedMotion: false
              }
            }
          }
        });

        await graph.ready;

        if (disposed) {
          graph.destroy();
          return;
        }

        const websocketUrl = resolveRuntimeBridgeDemoWebSocketUrl();
        const transport = new WebSocketRuntimeBridgeTransport({
          url: websocketUrl
        });
        const artifactClient = new DemoHttpArtifactClient({
          baseUrl: resolveRuntimeBridgeDemoHttpBaseUrl(websocketUrl)
        });
        const streamStore = createRuntimeBridgeNodeDemoStreamStore();
        installRuntimeBridgeNodeDemoBrowserStreamStore(streamStore);
        const extensionManager = new RuntimeBridgeBrowserExtensionManager({
          graph,
          artifactReader: artifactClient
        });
        const bridgeClient = new LeaferGraphRuntimeBridgeClient({
          graph,
          transport,
          extensionManager
        });

        const syncRevision = () => {
          if (!disposed) {
            setCurrentRevision(graph.getGraphDocument().revision);
          }
        };

        const syncRevisionSoon = () => {
          window.setTimeout(syncRevision, 24);
        };

        const cleanup: Array<() => void> = [];
        cleanup.push(
          transport.subscribeStatus((status) => {
            if (disposed) {
              return;
            }

            setTransportStatus(status);
            setLastError(status.lastError);
            if (status.state === "idle") {
              streamStore.clear();
            }
          })
        );
        cleanup.push(
          streamStore.subscribeStats((stats) => {
            if (!disposed) {
              setStreamStats(stats);
            }
          })
        );
        cleanup.push(
          transport.subscribeStream((frame) => {
            if (!disposed) {
              streamStore.publish(frame);
            }
          })
        );
        cleanup.push(
          transport.subscribeDebug((event) => {
            if (disposed) {
              return;
            }

            if (event.type === "inbound.stream.frame") {
              const now = Date.now();
              if (now - lastStreamLogAtRef.current >= 1000) {
                lastStreamLogAtRef.current = now;
                appendLog(
                  "transport",
                  "stream.frame",
                  summarizeDemoStreamFrame(event.detail as DemoStreamFrame)
                );
              }
              return;
            }

            appendLog("transport", event.type, event.detail ?? event.type);
            if (
              event.type === "inbound.response" ||
              event.type === "inbound.bridge.event"
            ) {
              syncRevisionSoon();
            }
          })
        );
        cleanup.push(
          transport.subscribe((event) => {
            if (disposed) {
              return;
            }

            if (event.type === "document.snapshot") {
              streamStore.clear();
            }
          })
        );
        cleanup.push(
          extensionManager.subscribeSync((sync) => {
            if (disposed) {
              return;
            }

            applyStressLogMute(sync.currentBlueprintId);
            setExtensionsSync(sync);
            appendLog("catalog", "extensions.sync", {
              entries: sync.entries.map((entry) => ({
                entryId: entry.entryId,
                entryKind: entry.entryKind
              })),
              activeNodeEntryIds: sync.activeNodeEntryIds,
              activeComponentEntryIds: sync.activeComponentEntryIds,
              currentBlueprintId: sync.currentBlueprintId
            });
          })
        );
        cleanup.push(
          graph.subscribeRuntimeFeedback((event: RuntimeFeedbackEvent) => {
            appendLog("runtime", event.type, event);
          })
        );
        cleanup.push(
          bridgeClient.subscribeHistory((event: LeaferGraphHistoryEvent) => {
            appendLog("history", event.type, event);
            syncRevisionSoon();
          })
        );
        cleanup.push(
          graph.subscribeInteractionCommit((event: LeaferGraphInteractionCommitEvent) => {
            appendLog("interaction", event.type, event);

            if (!bridgeClient.isConnected()) {
              appendLog(
                "transport",
                "interaction.skipped",
                "桥接未连接，本次只修改了本地图。"
              );
              return;
            }

            const operations = createGraphOperationsFromInteractionCommit(event, {
              source: "bridge.interaction"
            });
            if (operations.length === 0) {
              return;
            }

            void bridgeClient
              .submitOperations(operations)
              .then((results: readonly GraphOperationApplyResult[]) => {
                appendLog("transport", "operations.submitted", results);
                syncRevisionSoon();
              })
              .catch(async (error: unknown) => {
                const message = toErrorMessage(error);
                setLastError(message);
                if (message.includes("authority.diff.validation.failed")) {
                  appendLog("transport", "operations.diff.error", message);
                } else {
                  appendLog("transport", "operations.error", message);
                }

                try {
                  await bridgeClient.requestSnapshot();
                  appendLog("transport", "operations.snapshot.recovered", "已自动拉取 snapshot 对齐。");
                  syncRevisionSoon();
                } catch (snapshotError) {
                  appendLog(
                    "transport",
                    "operations.snapshot.error",
                    toErrorMessage(snapshotError)
                  );
                }
              });
          })
        );

        runtimeRef.current = {
          graph,
          bridgeClient,
          transport,
          artifactClient,
          extensionManager,
          streamStore,
          cleanup
        };
        setReady(true);
        const initialSyncState = extensionManager.getSyncState();
        applyStressLogMute(initialSyncState.currentBlueprintId);
        setExtensionsSync(initialSyncState);
        setCurrentRevision(graph.getGraphDocument().revision);
        appendLog("system", "graph.ready", {
          defaultBridgeUrl: transport.getStatus().url,
          demoNodes: RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS
        });
      } catch (error) {
        const message = toErrorMessage(error);
        setLastError(message);
        appendLog("system", "graph.init.error", message);
      }
    };

    void initialize();

    return () => {
      disposed = true;
      setReady(false);
      stressLogsMutedRef.current = false;
      const runtime = runtimeRef.current;
      runtimeRef.current = null;
      if (!runtime) {
        return;
      }

      for (const dispose of runtime.cleanup) {
        dispose();
      }

      void runtime.transport.disconnect().catch(() => undefined);
      runtime.graph.destroy();

      if (initialDebugConfigRef.current) {
        applyDemoLeaferDebugConfig(initialDebugConfigRef.current);
      }
    };
  }, []);

  const runAction = async (label: string, action: () => Promise<void>) => {
    setBusyAction(label);
    try {
      await action();
      appendLog("system", label, "已完成");
    } catch (error) {
      const message = toErrorMessage(error);
      setLastError(message);
      appendLog("system", `${label}.error`, message);
    } finally {
      setBusyAction(null);
    }
  };

  const ensureConnectedRuntime = async (): Promise<DemoClientRuntime> => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      throw new Error("图运行时尚未初始化。");
    }

    if (!runtime.bridgeClient.isConnected()) {
      await runtime.bridgeClient.connect();
    }

    return runtime;
  };

  const connect = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    void runAction("连接", async () => {
      await runtime.bridgeClient.connect();
      const modeResult = await runtime.bridgeClient.requestCommand({
        type: "diff.mode.get"
      });
      if (modeResult.type !== "diff.mode.result") {
        throw new Error(`Unexpected result: ${modeResult.type}`);
      }
      setBridgeDiffMode(modeResult.mode);
      setCurrentRevision(runtime.graph.getGraphDocument().revision);
    });
  };

  const disconnect = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    void runAction("断开", async () => {
      runtime.streamStore.clear();
      await runtime.bridgeClient.disconnect();
    });
  };

  const play = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    void runAction("运行", async () => {
      await runtime.bridgeClient.play();
    });
  };

  const step = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    void runAction("单步", async () => {
      await runtime.bridgeClient.step();
    });
  };

  const stop = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    void runAction("停止", async () => {
      await runtime.bridgeClient.stop();
    });
  };

  const resyncSnapshot = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    void runAction("重拉快照", async () => {
      runtime.streamStore.clear();
      await runtime.bridgeClient.requestSnapshot();
      setCurrentRevision(runtime.graph.getGraphDocument().revision);
    });
  };

  const refreshCatalog = () => {
    void runAction("刷新目录", async () => {
      const runtime = await ensureConnectedRuntime();
      const result = await runtime.bridgeClient.requestCommand({
        type: "catalog.list"
      });
      if (result.type !== "catalog.list.result") {
        throw new Error(`Unexpected result: ${result.type}`);
      }
      setExtensionsSync(result.sync);
    });
  };

  const loadEntry = (entryId: string) => {
    void runAction(`加载条目 ${entryId}`, async () => {
      const runtime = await ensureConnectedRuntime();
      await runtime.bridgeClient.requestCommand({
        type: "entry.load",
        entryId
      });
    });
  };

  const unloadEntry = (entryId: string) => {
    void runAction(`卸载条目 ${entryId}`, async () => {
      const runtime = await ensureConnectedRuntime();
      await runtime.bridgeClient.requestCommand({
        type: "entry.unload",
        entryId
      });
    });
  };

  const unregisterEntry = (entryId: string) => {
    void runAction(`注销条目 ${entryId}`, async () => {
      const runtime = await ensureConnectedRuntime();
      await runtime.bridgeClient.requestCommand({
        type: "entry.unregister",
        entryId
      });
    });
  };

  const loadBlueprint = (entryId: string) => {
    void runAction(`加载蓝图 ${entryId}`, async () => {
      const runtime = await ensureConnectedRuntime();
      runtime.streamStore.clear();
      await runtime.bridgeClient.requestCommand({
        type: "blueprint.load",
        entryId
      });
      setCurrentRevision(runtime.graph.getGraphDocument().revision);
    });
  };

  const unloadBlueprint = () => {
    void runAction("卸载蓝图", async () => {
      const runtime = await ensureConnectedRuntime();
      runtime.streamStore.clear();
      await runtime.bridgeClient.requestCommand({
        type: "blueprint.unload"
      });
      setCurrentRevision(runtime.graph.getGraphDocument().revision);
    });
  };

  const launchExperiment = (entryId: string, label: string) => {
    void runAction(label, async () => {
      const runtime = await ensureConnectedRuntime();
      runtime.streamStore.clear();
      await runtime.bridgeClient.requestCommand({
        type: "blueprint.load",
        entryId
      });
      await runtime.bridgeClient.play();
      setCurrentRevision(runtime.graph.getGraphDocument().revision);
    });
  };

  const changeBridgeDiffMode = (mode: RuntimeBridgeDiffMode) => {
    void runAction(`切换同步模式 ${mode}`, async () => {
      const runtime = await ensureConnectedRuntime();
      const result = await runtime.bridgeClient.requestCommand({
        type: "diff.mode.set",
        mode
      });
      if (result.type !== "diff.mode.result") {
        throw new Error(`Unexpected result: ${result.type}`);
      }
      setBridgeDiffMode(result.mode);
      appendLog("system", "diff.mode", `当前模式：${result.mode}`);
    });
  };

  const registerComponentEntry = () => {
    void runAction("注册组件条目", async () => {
      const runtime = await ensureConnectedRuntime();
      if (!componentForm.browserFile) {
        throw new Error("请先选择组件 browser artifact。");
      }

      const browserArtifactRef = await runtime.artifactClient.writeArtifact({
        bytes: await readFileBytes(componentForm.browserFile),
        contentType: componentForm.browserFile.type || "text/javascript",
        suggestedName: componentForm.browserFile.name
      });

      await runtime.bridgeClient.requestCommand({
        type: "entry.register",
        entry: {
          entryId: componentForm.entryId.trim(),
          entryKind: "component-entry",
          name: componentForm.name.trim(),
          widgetTypes: parseListInput(componentForm.widgetTypes),
          browserArtifactRef
        }
      });

      setComponentForm(INITIAL_COMPONENT_FORM);
    });
  };

  const registerNodeEntry = () => {
    void runAction("注册节点条目", async () => {
      const runtime = await ensureConnectedRuntime();
      if (!nodeForm.authorityFile || !nodeForm.browserFile) {
        throw new Error("请同时选择 authority 与 browser artifact。");
      }

      const authorityArtifactRef = await runtime.artifactClient.writeArtifact({
        bytes: await readFileBytes(nodeForm.authorityFile),
        contentType: nodeForm.authorityFile.type || "text/javascript",
        suggestedName: nodeForm.authorityFile.name
      });
      const browserArtifactRef = await runtime.artifactClient.writeArtifact({
        bytes: await readFileBytes(nodeForm.browserFile),
        contentType: nodeForm.browserFile.type || "text/javascript",
        suggestedName: nodeForm.browserFile.name
      });

      await runtime.bridgeClient.requestCommand({
        type: "entry.register",
        entry: {
          entryId: nodeForm.entryId.trim(),
          entryKind: "node-entry",
          name: nodeForm.name.trim(),
          nodeTypes: parseListInput(nodeForm.nodeTypes),
          componentEntryIds: parseListInput(nodeForm.componentEntryIds),
          authorityArtifactRef,
          browserArtifactRef
        }
      });

      setNodeForm(INITIAL_NODE_FORM);
    });
  };

  const registerBlueprintEntry = () => {
    void runAction("注册蓝图条目", async () => {
      const runtime = await ensureConnectedRuntime();
      if (!blueprintForm.documentFile) {
        throw new Error("请先选择 blueprint JSON 文件。");
      }

      const documentArtifactRef = await runtime.artifactClient.writeArtifact({
        bytes: await readFileBytes(blueprintForm.documentFile),
        contentType: blueprintForm.documentFile.type || "application/json",
        suggestedName: blueprintForm.documentFile.name
      });

      await runtime.bridgeClient.requestCommand({
        type: "entry.register",
        entry: {
          entryId: blueprintForm.entryId.trim(),
          entryKind: "blueprint-entry",
          name: blueprintForm.name.trim(),
          nodeEntryIds: parseListInput(blueprintForm.nodeEntryIds),
          componentEntryIds: parseListInput(blueprintForm.componentEntryIds),
          documentArtifactRef
        }
      });

      setBlueprintForm(INITIAL_BLUEPRINT_FORM);
    });
  };

  const updateLeaferDebugConfig = (patch: Partial<DemoLeaferDebugConfig>) => {
    setLeaferDebugConfig((currentConfig) => {
      const nextConfig = cloneDemoLeaferDebugConfig({
        ...currentConfig,
        ...patch
      });
      applyDemoLeaferDebugConfig(nextConfig);
      appendLog("system", "leafer.debug.updated", nextConfig);
      return nextConfig;
    });
  };

  useEffect(() => {
    if (diffEnabled) {
      try {
        const engine = new DiffEngine();
        setDiffEngine(engine);
        appendLog("system", "diff.enabled", "Diff功能已启用");
        return () => {
          // 清理资源
          setDiffEngine(null);
          appendLog("system", "diff.disabled", "Diff功能已禁用");
        };
      } catch (error) {
        const message = toErrorMessage(error);
        setLastError(message);
        appendLog("system", "diff.init.error", message);
        setDiffEnabled(false);
      }
    } else {
      setDiffEngine(null);
    }
  }, [diffEnabled]);

  const computeDiff = () => {
    if (!diffEngine || !runtimeRef.current) return;
    
    try {
      const currentDoc = runtimeRef.current.graph.getGraphDocument();
      const clonedDoc = deepClone(currentDoc);
      
      // 模拟文档变更
      if (clonedDoc.nodes.length > 0) {
        clonedDoc.nodes[0].title = `Updated ${Date.now()}`;
      }
      
      const diff = diffEngine.computeDiff(currentDoc, clonedDoc);
      setLastDiffResult(diff);
      appendLog("system", "diff.computed", diff);
    } catch (error) {
      const message = toErrorMessage(error);
      setLastError(message);
      appendLog("system", "diff.compute.error", message);
    }
  };

  const nodeEntries = extensionsSync.entries.filter(isNodeEntry);
  const componentEntries = extensionsSync.entries.filter(isComponentEntry);
  const blueprintEntries = extensionsSync.entries.filter(isBlueprintEntry);

  return (
    <div className="demo-shell">
      <header className="demo-topbar">
        <div className="demo-heading">
          <p className="eyebrow">节点权威端 Demo</p>
          <h1>Runtime Bridge 后端控制台</h1>
          <p className="subtitle">
            图的真源运行在 Node 端。浏览器只负责预览、交互提交与控制命令转发。
          </p>
        </div>
        <div className="demo-toolbar-side">
          <div className="demo-actions">
            <label className="demo-mode-field">
              <span>同步模式</span>
              <select
                value={bridgeDiffMode}
                disabled={
                  !ready || transportStatus.state !== "connected" || busyAction !== null
                }
                onInput={(event) => {
                  const mode = event.currentTarget.value as RuntimeBridgeDiffMode;
                  if (mode !== bridgeDiffMode) {
                    changeBridgeDiffMode(mode);
                  }
                }}
              >
                <option value="diff">diff</option>
                <option value="legacy">legacy</option>
              </select>
            </label>
            <button disabled={!ready || busyAction !== null} onClick={connect}>
              连接
            </button>
            <button
              disabled={
                !ready || transportStatus.state !== "connected" || busyAction !== null
              }
              onClick={disconnect}
            >
              断开
            </button>
            <button
              disabled={
                !ready || transportStatus.state !== "connected" || busyAction !== null
              }
              onClick={play}
            >
              运行
            </button>
            <button
              disabled={
                !ready || transportStatus.state !== "connected" || busyAction !== null
              }
              onClick={step}
            >
              单步
            </button>
            <button
              disabled={
                !ready || transportStatus.state !== "connected" || busyAction !== null
              }
              onClick={stop}
            >
              停止
            </button>
            <button
              disabled={
                !ready || transportStatus.state !== "connected" || busyAction !== null
              }
              onClick={resyncSnapshot}
            >
              重拉快照
            </button>
            <button onClick={() => setShowDialog(!showDialog)}>
              {showDialog ? '隐藏面板' : '显示面板'}
            </button>
            <button onClick={() => setShowLogDialog(!showLogDialog)}>
              {showLogDialog ? '隐藏日志' : '显示日志'}
            </button>
          </div>
        </div>
      </header>

      <section className="demo-status-grid">
        <article className="status-card">
          <span className="status-label">连接状态</span>
          <strong className={`status-value status-${transportStatus.state}`}>
            {resolveTransportStateLabel(transportStatus.state)}
          </strong>
        </article>
        <article className="status-card">
          <span className="status-label">文档版本</span>
          <strong className="status-value">{String(currentRevision)}</strong>
        </article>
        <article className="status-card">
          <span className="status-label">同步模式</span>
          <strong className="status-value">{bridgeDiffMode}</strong>
        </article>
        <article className="status-card">
          <span className="status-label">目录条目</span>
          <strong className="status-value">{extensionsSync.entries.length}</strong>
        </article>
        <article className="status-card">
          <span className="status-label">流帧速率</span>
          <strong className="status-value">
            {streamStats.framesPerSecond.toFixed(1)} fps
          </strong>
        </article>
        <article className="status-card">
          <span className="status-label">最近流类型</span>
          <strong className="status-value">
            {resolveStreamKindLabel(streamStats.lastFrameKind)}
          </strong>
        </article>
        <article className="status-card">
          <span className="status-label">当前蓝图</span>
          <strong className="status-value">
            {extensionsSync.currentBlueprintId ?? "无"}
          </strong>
        </article>
        <article className="status-card">
          <span className="status-label">流节点缓存</span>
          <strong className="status-value">{streamStats.latestNodeCount}</strong>
        </article>
        <article className="status-card">
          <span className="status-label">累计流帧</span>
          <strong className="status-value">{streamStats.totalFrames}</strong>
        </article>
        <article className="status-card">
          <span className="status-label">桥接地址</span>
          <strong className="status-value status-url">{transportStatus.url}</strong>
        </article>
        <article className="status-card">
          <span className="status-label">最近错误</span>
          <strong className="status-value status-error">
            {lastError ?? "无"}
          </strong>
        </article>
        <article className="status-card">
          <span className="status-label">最近流时间</span>
          <strong className="status-value">
            {streamStats.lastFrameAt
              ? formatDemoTimestamp(streamStats.lastFrameAt)
              : "无"}
          </strong>
        </article>
      </section>

      <main className="demo-main">
        <section className="canvas-card maximized">
          <div className="canvas-heading">
            <div>
              <p className="eyebrow">权威端镜像</p>
              <h2>共享图画布</h2>
            </div>
            <span className="canvas-hint">
              拖动节点、折叠节点、修改控件值，都可以触发正式 operation。
            </span>
          </div>
          <div className="canvas-frame" ref={canvasRef} />
        </section>

        {showDialog && (
          <div className="demo-dialog">
            <div className="demo-dialog-content">
              <div className="demo-dialog-header">
                <h3>控制面板</h3>
                <button className="demo-dialog-close" onClick={() => setShowDialog(false)}>×</button>
              </div>
              <div className="demo-dialog-body">
                <div className="demo-quick-panel">
                  <p className="demo-debug-title">频谱实验</p>
                  <div className="demo-quick-actions">
                    <button
                      disabled={
                        !ready || transportStatus.state !== "connected" || busyAction !== null
                      }
                      onClick={() =>
                        launchExperiment(
                          DEMO_FREQUENCY_LAB_BLUEPRINT_ENTRY_ID,
                          "启动频谱实验室"
                        )
                      }
                    >
                      实验室运行
                    </button>
                    <button
                      disabled={
                        !ready || transportStatus.state !== "connected" || busyAction !== null
                      }
                      onClick={() =>
                        launchExperiment(
                          DEMO_FREQUENCY_STRESS_BLUEPRINT_ENTRY_ID,
                          "启动频谱压力实验"
                        )
                      }
                    >
                      压力运行
                    </button>
                  </div>
                  <p className="demo-quick-hint">
                    会自动加载远端蓝图并启动 authority 定时执行链。
                  </p>
                </div>

                <div className="demo-debug-panel">
                  <p className="demo-debug-title">Leafer 调试</p>
                  <div className="demo-debug-grid">
                    <label className="demo-debug-field">
                      <span className="demo-debug-label">启用</span>
                      <select
                        className="demo-debug-select"
                        disabled={!ready || busyAction !== null}
                        value={resolveBooleanSelectValue(leaferDebugConfig.enable)}
                        onInput={(event) => {
                          updateLeaferDebugConfig({
                            enable: event.currentTarget.value === "on"
                          });
                        }}
                      >
                        <option value="off">关</option>
                        <option value="on">开</option>
                      </select>
                    </label>

                    <label className="demo-debug-field">
                      <span className="demo-debug-label">警告</span>
                      <select
                        className="demo-debug-select"
                        disabled={!ready || busyAction !== null}
                        value={resolveBooleanSelectValue(leaferDebugConfig.showWarn)}
                        onInput={(event) => {
                          updateLeaferDebugConfig({
                            showWarn: event.currentTarget.value === "on"
                          });
                        }}
                      >
                        <option value="on">开</option>
                        <option value="off">关</option>
                      </select>
                    </label>

                    <label className="demo-debug-field">
                      <span className="demo-debug-label">过滤</span>
                      <select
                        className="demo-debug-select"
                        disabled={!ready || busyAction !== null}
                        value={resolveLeaferDebugNameSelectValue(leaferDebugConfig.filter)}
                        onInput={(event) => {
                          updateLeaferDebugConfig({
                            filter: event.currentTarget.value
                          });
                        }}
                      >
                        {LEAFER_DEBUG_NAME_OPTIONS.map((option) => (
                          <option key={`filter-${option.value || "none"}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="demo-debug-field">
                      <span className="demo-debug-label">排除</span>
                      <select
                        className="demo-debug-select"
                        disabled={!ready || busyAction !== null}
                        value={resolveLeaferDebugNameSelectValue(leaferDebugConfig.exclude)}
                        onInput={(event) => {
                          updateLeaferDebugConfig({
                            exclude: event.currentTarget.value
                          });
                        }}
                      >
                        {LEAFER_DEBUG_NAME_OPTIONS.map((option) => (
                          <option key={`exclude-${option.value || "none"}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="demo-debug-field">
                      <span className="demo-debug-label">重绘</span>
                      <select
                        className="demo-debug-select"
                        disabled={!ready || busyAction !== null}
                        value={resolveBooleanSelectValue(
                          Boolean(leaferDebugConfig.showRepaint)
                        )}
                        onInput={(event) => {
                          updateLeaferDebugConfig({
                            showRepaint: event.currentTarget.value === "on"
                          });
                        }}
                      >
                        <option value="off">关</option>
                        <option value="on">开</option>
                      </select>
                    </label>

                    <label className="demo-debug-field">
                      <span className="demo-debug-label">包围盒</span>
                      <select
                        className="demo-debug-select"
                        disabled={!ready || busyAction !== null}
                        value={resolveLeaferDebugBoundsSelectValue(
                          leaferDebugConfig.showBounds
                        )}
                        onInput={(event) => {
                          const value = event.currentTarget.value as
                            | "off"
                            | "bounds"
                            | "hit";
                          updateLeaferDebugConfig({
                            showBounds:
                              value === "hit" ? "hit" : value === "bounds"
                          });
                        }}
                      >
                        <option value="off">关</option>
                        <option value="bounds">边界</option>
                        <option value="hit">命中</option>
                      </select>
                    </label>
                  </div>
                </div>

                <RuntimeBridgeCatalogPanel
                  ready={ready}
                  busyAction={busyAction}
                  sync={extensionsSync}
                  componentEntries={componentEntries}
                  nodeEntries={nodeEntries}
                  blueprintEntries={blueprintEntries}
                  componentForm={componentForm}
                  nodeForm={nodeForm}
                  blueprintForm={blueprintForm}
                  onRefreshCatalog={refreshCatalog}
                  onLoadEntry={loadEntry}
                  onUnloadEntry={unloadEntry}
                  onUnregisterEntry={unregisterEntry}
                  onLoadBlueprint={loadBlueprint}
                  onUnloadBlueprint={unloadBlueprint}
                  onComponentFormChange={setComponentForm}
                  onNodeFormChange={setNodeForm}
                  onBlueprintFormChange={setBlueprintForm}
                  onRegisterComponentEntry={registerComponentEntry}
                  onRegisterNodeEntry={registerNodeEntry}
                  onRegisterBlueprintEntry={registerBlueprintEntry}
                />
              </div>
            </div>
          </div>
        )}

        {showLogDialog && (
          <div className="demo-dialog demo-log-dialog">
            <div className="demo-dialog-content">
              <div className="demo-dialog-header">
                <h3>桥接事件日志</h3>
                <button className="demo-dialog-close" onClick={() => setShowLogDialog(false)}>×</button>
              </div>
              <div className="demo-dialog-body">
                <section className="log-card">
                  <div className="log-heading">
                    <div>
                      <p className="eyebrow">运行反馈</p>
                      <h2>桥接事件日志</h2>
                    </div>
                    <span className="log-count">{logs.length} 条</span>
                  </div>
                  <div className="log-list">
                    {logs.map((entry) => (
                      <article className={`log-entry log-${entry.channel}`} key={entry.id}>
                        <div className="log-meta">
                          <span>{entry.at}</span>
                          <span>{resolveLogChannelLabel(entry.channel)}</span>
                        </div>
                        <h3>{entry.title}</h3>
                        <pre>{entry.detail}</pre>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * 挂载 demo 应用。
 *
 * @param target - 根容器。
 * @returns 无返回值。
 */
export function mountRuntimeBridgeNodeDemo(target: HTMLElement): void {
  render(<App />, target);
}
