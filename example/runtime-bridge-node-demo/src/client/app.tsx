import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Debug } from "leafergraph";
import { leaferGraphBasicKitPlugin } from "@leafergraph/basic-kit";
import {
  createLeaferGraphContextMenuClipboardStore
} from "@leafergraph/context-menu-builtins";
import {
  bindLeaferGraphShortcuts,
  type BoundLeaferGraphShortcuts
} from "@leafergraph/shortcuts/graph";
import {
  createLeaferGraph,
  createLeaferGraphRuntimeBridgeEditingAdapter,
  RuntimeBridgeBrowserExtensionManager,
  type LeaferGraph,
  type RuntimeBridgeBlueprintCatalogEntry,
  type RuntimeBridgeCatalogEntry,
  type RuntimeBridgeComponentCatalogEntry,
  type RuntimeBridgeExtensionsSync,
  type RuntimeBridgeNodeCatalogEntry
} from "@leafergraph/runtime-bridge";
import {
  createDemoContextMenu,
  type DemoContextMenuHandle,
  type DemoTrackedLinkEntry
} from "./demo_context_menu";
import {
  LeaferGraphRuntimeBridgeClient,
  type LeaferGraphRuntimeBridgeEditingAdapter
} from "@leafergraph/runtime-bridge/client";
import type { RuntimeBridgeDiffMode } from "@leafergraph/runtime-bridge/transport";
import {
  type LeaferGraphHistoryEvent,
  type LeaferGraphInteractionCommitEvent,
  type RuntimeFeedbackEvent
} from "@leafergraph/runtime-bridge/portable";
import {
  createRuntimeBridgeNodeDemoDocument,
  RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS
} from "../shared/document";
import {
  DEMO_FREQUENCY_EXTREME_BLUEPRINT_ENTRY_ID,
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
  analyzeLocalBlueprintDocumentFile,
  analyzeLocalComponentArtifactFile,
  analyzeLocalNodeArtifactFile
} from "./registration_analysis";
import {
  createRuntimeBridgeNodeDemoStreamStore,
  installRuntimeBridgeNodeDemoBrowserStreamStore
} from "./stream_store";
import {
  resolveRuntimeBridgeDemoWebSocketUrl,
  WebSocketRuntimeBridgeTransport,
  type WebSocketRuntimeBridgeTransportStatus
} from "./websocket_transport";
import { DiffEngine } from "../shared/diff";
import {
  bootstrapRuntimeBridgeDemoModuleDependencies
} from "../shared/runtime_bridge_dependency_bootstrap";
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

/** fitView 默认留白。 */
const DEFAULT_FIT_VIEW_PADDING = 120;

type DemoClientRuntime = {
  graph: LeaferGraph;
  bridgeClient: LeaferGraphRuntimeBridgeClient;
  editingAdapter: LeaferGraphRuntimeBridgeEditingAdapter;
  transport: WebSocketRuntimeBridgeTransport;
  artifactClient: DemoHttpArtifactClient;
  extensionManager: RuntimeBridgeBrowserExtensionManager;
  streamStore: ReturnType<typeof createRuntimeBridgeNodeDemoStreamStore>;
  contextMenu?: DemoContextMenuHandle;
  shortcuts?: BoundLeaferGraphShortcuts;
  trackedLinks: Map<string, DemoTrackedLinkEntry>;
  nodeIds: Set<string>;
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
  detectedWidgetTypes: [],
  browserFile: null,
  analysisError: null
};

const INITIAL_NODE_FORM: DemoNodeEntryForm = {
  entryId: "custom/node/demo-node",
  name: "自定义节点",
  detectedAuthorityNodeTypes: [],
  detectedBrowserNodeTypes: [],
  requiredWidgetTypes: [],
  exportedWidgetTypes: [],
  selectedComponentEntryIds: [],
  authorityFile: null,
  browserFile: null,
  analysisError: null
};

const INITIAL_BLUEPRINT_FORM: DemoBlueprintEntryForm = {
  entryId: "custom/blueprint/demo-scene",
  name: "自定义蓝图",
  detectedNodeTypes: [],
  detectedWidgetTypes: [],
  selectedNodeEntryIds: [],
  selectedComponentEntryIds: [],
  documentFile: null,
  analysisError: null
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
  return (
    entryId === DEMO_FREQUENCY_STRESS_BLUEPRINT_ENTRY_ID ||
    entryId === DEMO_FREQUENCY_EXTREME_BLUEPRINT_ENTRY_ID
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function createTrackedLinkEntry(link: {
  id: string;
  source: {
    nodeId: string;
    slot?: string | number | null;
  };
  target: {
    nodeId: string;
    slot?: string | number | null;
  };
}): DemoTrackedLinkEntry {
  return {
    id: link.id,
    sourceNodeId: link.source.nodeId,
    sourceSlot: String(link.source.slot ?? ""),
    targetNodeId: link.target.nodeId,
    targetSlot: String(link.target.slot ?? "")
  };
}

function syncContextMenuTargets(
  graph: LeaferGraph,
  contextMenu: DemoContextMenuHandle | null,
  nodeIds: Set<string>,
  trackedLinks: Map<string, DemoTrackedLinkEntry>
): void {
  if (!contextMenu) {
    return;
  }

  const document = graph.getGraphDocument();
  const nextNodeIds = new Set(document.nodes.map((node) => node.id));
  const nextTrackedLinks = new Map(
    document.links.map((link) => [link.id, createTrackedLinkEntry(link)])
  );

  for (const nodeId of [...nodeIds]) {
    if (!nextNodeIds.has(nodeId)) {
      nodeIds.delete(nodeId);
      contextMenu.unbindNodeTarget(nodeId);
    }
  }

  for (const linkId of [...trackedLinks.keys()]) {
    if (!nextTrackedLinks.has(linkId)) {
      trackedLinks.delete(linkId);
      contextMenu.unbindLinkTarget(linkId);
    }
  }

  for (const nodeId of nextNodeIds) {
    nodeIds.add(nodeId);
    contextMenu.bindNodeTarget(nodeId);
  }

  for (const trackedLink of nextTrackedLinks.values()) {
    trackedLinks.set(trackedLink.id, trackedLink);
    contextMenu.bindLinkTarget(trackedLink);
  }
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

async function readFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

function normalizeTypeList(types: readonly string[]): string[] {
  return [...new Set(types.map((type) => type.trim()).filter(Boolean))].sort();
}

function resolveMatchingComponentEntryIds(
  componentEntries: readonly RuntimeBridgeComponentCatalogEntry[],
  widgetTypes: readonly string[]
): string[] {
  const remaining = new Set(normalizeTypeList(widgetTypes));
  const selected: string[] = [];

  if (remaining.size === 0) {
    return selected;
  }

  for (const entry of componentEntries) {
    const covered = entry.widgetTypes.filter((type) => remaining.has(type));
    if (covered.length === 0) {
      continue;
    }

    selected.push(entry.entryId);
    for (const widgetType of covered) {
      remaining.delete(widgetType);
    }

    if (remaining.size === 0) {
      break;
    }
  }

  return selected;
}

function resolveMatchingNodeEntryIds(
  nodeEntries: readonly RuntimeBridgeNodeCatalogEntry[],
  nodeTypes: readonly string[]
): string[] {
  const remaining = new Set(normalizeTypeList(nodeTypes));
  const selected: string[] = [];

  if (remaining.size === 0) {
    return selected;
  }

  for (const entry of nodeEntries) {
    const covered = entry.nodeTypes.filter((type) => remaining.has(type));
    if (covered.length === 0) {
      continue;
    }

    selected.push(entry.entryId);
    for (const nodeType of covered) {
      remaining.delete(nodeType);
    }

    if (remaining.size === 0) {
      break;
    }
  }

  return selected;
}

function ensureSelectedComponentsCoverWidgetTypes(
  componentEntries: readonly RuntimeBridgeComponentCatalogEntry[],
  selectedEntryIds: readonly string[],
  requiredWidgetTypes: readonly string[],
  label: string,
  hostWidgetTypes: readonly string[] = []
): void {
  const selectedIds = new Set(selectedEntryIds);
  const coveredTypes = new Set<string>();

  for (const entry of componentEntries) {
    if (!selectedIds.has(entry.entryId)) {
      continue;
    }

    for (const widgetType of entry.widgetTypes) {
      coveredTypes.add(widgetType);
    }
  }

  for (const widgetType of hostWidgetTypes) {
    coveredTypes.add(widgetType);
  }

  const missing = normalizeTypeList(requiredWidgetTypes).filter(
    (widgetType) => !coveredTypes.has(widgetType)
  );
  if (missing.length > 0) {
    throw new Error(`${label} 缺少组件依赖: ${missing.join(", ")}`);
  }
}

function ensureSelectedNodesCoverNodeTypes(
  nodeEntries: readonly RuntimeBridgeNodeCatalogEntry[],
  selectedEntryIds: readonly string[],
  requiredNodeTypes: readonly string[],
  label: string,
  hostNodeTypes: readonly string[] = []
): void {
  const selectedIds = new Set(selectedEntryIds);
  const coveredTypes = new Set<string>();

  for (const entry of nodeEntries) {
    if (!selectedIds.has(entry.entryId)) {
      continue;
    }

    for (const nodeType of entry.nodeTypes) {
      coveredTypes.add(nodeType);
    }
  }

  for (const nodeType of hostNodeTypes) {
    coveredTypes.add(nodeType);
  }

  const missing = normalizeTypeList(requiredNodeTypes).filter(
    (nodeType) => !coveredTypes.has(nodeType)
  );
  if (missing.length > 0) {
    throw new Error(`${label} 缺少节点依赖: ${missing.join(", ")}`);
  }
}

function assertExactTypeList(
  label: string,
  expectedTypes: readonly string[],
  actualTypes: readonly string[]
): void {
  const expected = normalizeTypeList(expectedTypes);
  const actual = normalizeTypeList(actualTypes);

  if (expected.length !== actual.length || expected.some((type, index) => type !== actual[index])) {
    throw new Error(
      `${label} 的导出类型不一致。expected=${expected.join(", ")} actual=${actual.join(", ")}`
    );
  }
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
  const [showDialog, setShowDialog] = useState(false);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [bridgeDiffMode, setBridgeDiffMode] = useState<RuntimeBridgeDiffMode>("diff");
  const nodeEntries = extensionsSync.entries.filter(isNodeEntry);
  const componentEntries = extensionsSync.entries.filter(isComponentEntry);
  const blueprintEntries = extensionsSync.entries.filter(isBlueprintEntry);

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
    bootstrapRuntimeBridgeDemoModuleDependencies();
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
        const editingAdapter = createLeaferGraphRuntimeBridgeEditingAdapter({
          graph,
          bridgeClient
        });
        const trackedLinks = new Map<string, DemoTrackedLinkEntry>();
        const nodeIds = new Set<string>();
        let contextMenu: DemoContextMenuHandle | null = null;

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

            if (event.type === "document.snapshot" || event.type === "document.diff") {
              void bridgeClient.waitForIdle().then(() => {
                if (!disposed) {
                  syncContextMenuTargets(graph, contextMenu, nodeIds, trackedLinks);
                }
              });
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
            if (contextMenu) {
              (
                contextMenu as DemoContextMenuHandle & {
                  refresh?: () => void;
                }
              ).refresh?.();
              syncContextMenuTargets(graph, contextMenu, nodeIds, trackedLinks);
            }
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

            void editingAdapter
              .submitInteractionCommit(event)
              .then((results) => {
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
              });
          })
        );

        // ========== 右键菜单集成 ==========
        const clipboardStore = createLeaferGraphContextMenuClipboardStore();
        contextMenu = createDemoContextMenu({
          graph,
          bridgeClient,
          editingAdapter,
          container,
          fit: () => {
            requestAnimationFrame(() => {
              graph.fitView(DEFAULT_FIT_VIEW_PADDING);
            });
          },
          resolveThemeMode: () => "light",
          appendLog: (msg) => appendLog("system", "context-menu", msg),
          clipboard: clipboardStore,
          listNodeIds: () => Array.from(nodeIds),
        });
        syncContextMenuTargets(graph, contextMenu, nodeIds, trackedLinks);

        // ========== 快捷键集成 ==========
        const shortcuts = bindLeaferGraphShortcuts({
          target: document,
          scopeElement: container,
          host: {
            listNodeIds: () => Array.from(nodeIds),
            listSelectedNodeIds: () => graph.listSelectedNodeIds(),
            setSelectedNodeIds: (ids) => graph.setSelectedNodeIds(ids, "replace"),
            clearSelectedNodes: () => graph.clearSelectedNodes(),
            removeNode: (nodeId) => editingAdapter.removeNode(nodeId),
            fitView: () => {
              requestAnimationFrame(() => {
                graph.fitView(DEFAULT_FIT_VIEW_PADDING);
                appendLog("system", "shortcut", "已执行适配视图 (F)");
              });
            },
            play: async () => {
              if (bridgeClient.isConnected()) {
                await bridgeClient.play();
                appendLog("system", "shortcut", "已触发运行");
              }
            },
            step: async () => {
              if (bridgeClient.isConnected()) {
                await bridgeClient.step();
                appendLog("system", "shortcut", "已触发单步");
              }
            },
            stop: async () => {
              if (bridgeClient.isConnected()) {
                await bridgeClient.stop();
                appendLog("system", "shortcut", "已触发停止");
              }
            },
            isContextMenuOpen: () => contextMenu.isOpen()
          },
          clipboard: {
            copySelection: () => {
              const fragment = editingAdapter.copySelection();
              if (!fragment) {
                return false;
              }

              clipboardStore.setFragment({
                nodes: [...fragment.nodes],
                links: [...fragment.links]
              });
              appendLog(
                "system",
                "shortcut",
                fragment.nodes.length > 1
                  ? `已复制 ${fragment.nodes.length} 个节点到剪贴板`
                  : `已复制节点：${fragment.nodes[0]?.title?.trim() || fragment.nodes[0]?.id}`
              );
              return true;
            },
            cutSelection: async () => {
              const fragment = await editingAdapter.cutSelection();
              if (!fragment) {
                return false;
              }

              clipboardStore.setFragment({
                nodes: [...fragment.nodes],
                links: [...fragment.links]
              });
              appendLog(
                "system",
                "shortcut",
                fragment.nodes.length > 1
                  ? `已剪切 ${fragment.nodes.length} 个节点`
                  : `已剪切节点：${fragment.nodes[0]?.title?.trim() || fragment.nodes[0]?.id}`
              );
              return true;
            },
            pasteClipboard: async () => {
              const fragment = clipboardStore.getFragment();
              if (!fragment?.nodes.length) {
                return false;
              }

              const createdNodeIds = await editingAdapter.pasteFragment(fragment);
              appendLog(
                "system",
                "shortcut",
                createdNodeIds.length > 1
                  ? `已粘贴 ${createdNodeIds.length} 个节点`
                  : "已粘贴节点"
              );
              return Boolean(createdNodeIds.length);
            },
            duplicateSelection: async () => {
              const createdNodeIds = await editingAdapter.duplicateSelection();
              appendLog(
                "system",
                "shortcut",
                createdNodeIds.length > 1
                  ? `已创建 ${createdNodeIds.length} 个节点副本`
                  : "已创建节点副本"
              );
              return Boolean(createdNodeIds.length);
            },
            canPasteClipboard: () => clipboardStore.hasFragment()
          }
        });

        cleanup.push(() => shortcuts.destroy());
        cleanup.push(() => contextMenu.destroy());

        runtimeRef.current = {
          graph,
          bridgeClient,
          editingAdapter,
          transport,
          artifactClient,
          extensionManager,
          streamStore,
          contextMenu,
          shortcuts,
          trackedLinks,
          nodeIds,
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

  useEffect(() => {
    const file = componentForm.browserFile;
    let cancelled = false;

    if (!file) {
      setComponentForm((current) => ({
        ...current,
        detectedWidgetTypes: [],
        analysisError: null
      }));
      return;
    }

    void analyzeLocalComponentArtifactFile(file)
      .then((analysis) => {
        if (cancelled) {
          return;
        }

        setComponentForm((current) =>
          current.browserFile === file
            ? {
                ...current,
                detectedWidgetTypes: normalizeTypeList(analysis.widgetTypes),
                analysisError: null
              }
            : current
        );
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        void analyzeLocalNodeArtifactFile(file)
          .then((nodeAnalysis) => {
            if (cancelled) {
              return;
            }

            const detectedNodeTypes = normalizeTypeList(nodeAnalysis.nodeTypes);
            if (detectedNodeTypes.length === 0) {
              throw error;
            }

            const requiredWidgetTypes = normalizeTypeList(nodeAnalysis.widgetTypes);
            const exportedWidgetTypes = normalizeTypeList(
              nodeAnalysis.exportedWidgetTypes
            );

            setNodeForm((current) => ({
              ...current,
              authorityFile: current.authorityFile ?? file,
              browserFile: current.browserFile ?? file,
              detectedAuthorityNodeTypes:
                current.detectedAuthorityNodeTypes.length > 0
                  ? current.detectedAuthorityNodeTypes
                  : detectedNodeTypes,
              detectedBrowserNodeTypes:
                current.detectedBrowserNodeTypes.length > 0
                  ? current.detectedBrowserNodeTypes
                  : detectedNodeTypes,
              requiredWidgetTypes:
                current.requiredWidgetTypes.length > 0
                  ? current.requiredWidgetTypes
                  : requiredWidgetTypes,
              exportedWidgetTypes:
                current.exportedWidgetTypes.length > 0
                  ? current.exportedWidgetTypes
                  : exportedWidgetTypes,
              selectedComponentEntryIds:
                current.selectedComponentEntryIds.length > 0
                  ? current.selectedComponentEntryIds
                  : resolveMatchingComponentEntryIds(
                      componentEntries,
                      requiredWidgetTypes
                    ),
              analysisError: null
            }));

            setComponentForm((current) =>
              current.browserFile === file
                ? {
                    ...current,
                    detectedWidgetTypes: [],
                    analysisError:
                      "这份 JS 更像节点 artifact，不是独立 widget bundle。已自动同步到“注册节点”表单。",
                    browserFile: null
                  }
                : current
            );
          })
          .catch(() => {
            setComponentForm((current) =>
              current.browserFile === file
                ? {
                    ...current,
                    detectedWidgetTypes: [],
                    analysisError: `组件 artifact 解析失败：${toErrorMessage(error)}`
                  }
                : current
            );
          });
      });

    return () => {
      cancelled = true;
    };
  }, [componentForm.browserFile, componentEntries]);

  useEffect(() => {
    const authorityFile = nodeForm.authorityFile;
    const browserFile = nodeForm.browserFile;
    let cancelled = false;

    if (!authorityFile && !browserFile) {
      setNodeForm((current) => ({
        ...current,
        detectedAuthorityNodeTypes: [],
        detectedBrowserNodeTypes: [],
        requiredWidgetTypes: [],
        exportedWidgetTypes: [],
        selectedComponentEntryIds: [],
        analysisError: null
      }));
      return;
    }

    void Promise.all([
      authorityFile
        ? analyzeLocalNodeArtifactFile(authorityFile)
        : Promise.resolve({ nodeTypes: [], widgetTypes: [], exportedWidgetTypes: [] }),
      browserFile
        ? analyzeLocalNodeArtifactFile(browserFile)
        : Promise.resolve({ nodeTypes: [], widgetTypes: [], exportedWidgetTypes: [] })
    ])
      .then(([authorityAnalysis, browserAnalysis]) => {
        if (cancelled) {
          return;
        }

        const authorityNodeTypes = normalizeTypeList(authorityAnalysis.nodeTypes);
        const browserNodeTypes = normalizeTypeList(browserAnalysis.nodeTypes);
        const requiredWidgetTypes = normalizeTypeList(browserAnalysis.widgetTypes);
        const exportedWidgetTypes = normalizeTypeList(browserAnalysis.exportedWidgetTypes);

        if (authorityNodeTypes.length > 0 && browserNodeTypes.length > 0) {
          assertExactTypeList(
            "节点 authority/browser artifact",
            authorityNodeTypes,
            browserNodeTypes
          );
        }

        setNodeForm((current) =>
          current.authorityFile === authorityFile && current.browserFile === browserFile
            ? {
                ...current,
                detectedAuthorityNodeTypes: authorityNodeTypes,
                detectedBrowserNodeTypes: browserNodeTypes,
                requiredWidgetTypes,
                exportedWidgetTypes,
                selectedComponentEntryIds: resolveMatchingComponentEntryIds(
                  componentEntries,
                  requiredWidgetTypes
                ),
                analysisError: null
              }
            : current
        );
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setNodeForm((current) =>
          current.authorityFile === authorityFile && current.browserFile === browserFile
            ? {
                ...current,
                detectedAuthorityNodeTypes: [],
                detectedBrowserNodeTypes: [],
                requiredWidgetTypes: [],
                exportedWidgetTypes: [],
                selectedComponentEntryIds: [],
                analysisError: `节点 artifact 解析失败：${toErrorMessage(error)}`
              }
            : current
        );
      });

    return () => {
      cancelled = true;
    };
  }, [nodeForm.authorityFile, nodeForm.browserFile, componentEntries]);

  useEffect(() => {
    const file = blueprintForm.documentFile;
    let cancelled = false;

    if (!file) {
      setBlueprintForm((current) => ({
        ...current,
        detectedNodeTypes: [],
        detectedWidgetTypes: [],
        selectedNodeEntryIds: [],
        selectedComponentEntryIds: [],
        analysisError: null
      }));
      return;
    }

    void analyzeLocalBlueprintDocumentFile(file)
      .then((analysis) => {
        if (cancelled) {
          return;
        }

        const nodeTypes = normalizeTypeList(analysis.nodeTypes);
        const widgetTypes = normalizeTypeList(analysis.widgetTypes);

        setBlueprintForm((current) =>
          current.documentFile === file
            ? {
                ...current,
                detectedNodeTypes: nodeTypes,
                detectedWidgetTypes: widgetTypes,
                selectedNodeEntryIds: resolveMatchingNodeEntryIds(nodeEntries, nodeTypes),
                selectedComponentEntryIds: resolveMatchingComponentEntryIds(
                  componentEntries,
                  widgetTypes
                ),
                analysisError: null
              }
            : current
        );
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setBlueprintForm((current) =>
          current.documentFile === file
            ? {
                ...current,
                detectedNodeTypes: [],
                detectedWidgetTypes: [],
                selectedNodeEntryIds: [],
                selectedComponentEntryIds: [],
                analysisError: `蓝图解析失败：${toErrorMessage(error)}`
              }
            : current
        );
      });

    return () => {
      cancelled = true;
    };
  }, [blueprintForm.documentFile, nodeEntries, componentEntries]);

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
      syncContextMenuTargets(
        runtime.graph,
        runtime.contextMenu ?? null,
        runtime.nodeIds,
        runtime.trackedLinks
      );
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
      syncContextMenuTargets(
        runtime.graph,
        runtime.contextMenu ?? null,
        runtime.nodeIds,
        runtime.trackedLinks
      );
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
      if (componentForm.analysisError) {
        throw new Error(componentForm.analysisError);
      }
      if (componentForm.detectedWidgetTypes.length === 0) {
        throw new Error("组件 artifact 未解析出任何 widget types。");
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
          widgetTypes: [...componentForm.detectedWidgetTypes],
          browserArtifactRef
        }
      });
      await runtime.bridgeClient.requestCommand({
        type: "entry.load",
        entryId: componentForm.entryId.trim()
      });
      await runtime.bridgeClient.waitForIdle();

      setComponentForm(INITIAL_COMPONENT_FORM);
    });
  };

  const registerNodeEntry = () => {
    void runAction("注册节点条目", async () => {
      const runtime = await ensureConnectedRuntime();
      const authorityFile = nodeForm.authorityFile ?? nodeForm.browserFile;
      const browserFile = nodeForm.browserFile ?? nodeForm.authorityFile;

      if (!authorityFile || !browserFile) {
        throw new Error("请至少选择一份节点 JS artifact。");
      }
      if (nodeForm.analysisError) {
        throw new Error(nodeForm.analysisError);
      }

      const nodeTypes =
        nodeForm.detectedAuthorityNodeTypes.length > 0
          ? nodeForm.detectedAuthorityNodeTypes
          : nodeForm.detectedBrowserNodeTypes;
      const pureWidgetTypes = normalizeTypeList(nodeForm.exportedWidgetTypes);
      const componentEntryIds = [...nodeForm.selectedComponentEntryIds];
      const autoExportedWidgetTypes = normalizeTypeList(
        nodeForm.exportedWidgetTypes.filter((widgetType) =>
          nodeForm.requiredWidgetTypes.includes(widgetType)
        )
      );

      const authorityArtifactRef = await runtime.artifactClient.writeArtifact({
        bytes: await readFileBytes(authorityFile),
        contentType: authorityFile.type || "text/javascript",
        suggestedName: authorityFile.name
      });
      const browserArtifactRef = await runtime.artifactClient.writeArtifact({
        bytes: await readFileBytes(browserFile),
        contentType: browserFile.type || "text/javascript",
        suggestedName: browserFile.name
      });

      if (nodeTypes.length === 0) {
        if (pureWidgetTypes.length === 0) {
          throw new Error("扩展 artifact 未解析出任何 node types 或 widget entries。");
        }

        await runtime.bridgeClient.requestCommand({
          type: "entry.register",
          entry: {
            entryId: nodeForm.entryId.trim(),
            entryKind: "component-entry",
            name: nodeForm.name.trim(),
            widgetTypes: pureWidgetTypes,
            browserArtifactRef
          }
        });
        await runtime.bridgeClient.requestCommand({
          type: "entry.load",
          entryId: nodeForm.entryId.trim()
        });
        await runtime.bridgeClient.waitForIdle();

        setNodeForm(INITIAL_NODE_FORM);
        return;
      }

      const coveredWidgetTypes = new Set<string>();
      const hostWidgetTypes = runtime.graph.listWidgets().map((widget) => widget.type);
      for (const entry of componentEntries) {
        if (!componentEntryIds.includes(entry.entryId)) {
          continue;
        }

        for (const widgetType of entry.widgetTypes) {
          coveredWidgetTypes.add(widgetType);
        }
      }

      const missingWidgetTypes = normalizeTypeList(nodeForm.requiredWidgetTypes).filter(
        (widgetType) => !coveredWidgetTypes.has(widgetType)
      );

      if (missingWidgetTypes.length > 0) {
        const exportedCoverage = missingWidgetTypes.filter((widgetType) =>
          autoExportedWidgetTypes.includes(widgetType)
        );

        if (exportedCoverage.length > 0) {
          const componentEntryId = `${nodeForm.entryId.trim()}/components`;
          await runtime.bridgeClient.requestCommand({
            type: "entry.register",
            entry: {
              entryId: componentEntryId,
              entryKind: "component-entry",
              name: `${nodeForm.name.trim() || nodeTypes[0] || "Node"} Components`,
              widgetTypes: [...autoExportedWidgetTypes],
              browserArtifactRef
            }
          });
          componentEntryIds.push(componentEntryId);
        }
      }

      ensureSelectedComponentsCoverWidgetTypes(
        [
          ...componentEntries,
          ...(componentEntryIds.includes(`${nodeForm.entryId.trim()}/components`)
            ? [
                {
                  entryId: `${nodeForm.entryId.trim()}/components`,
                  entryKind: "component-entry" as const,
                  name: `${nodeForm.name.trim() || nodeTypes[0] || "Node"} Components`,
                  widgetTypes: [...autoExportedWidgetTypes],
                  browserArtifactRef
                }
              ]
            : [])
        ],
        componentEntryIds,
        nodeForm.requiredWidgetTypes,
        "节点条目",
        hostWidgetTypes
      );

      await runtime.bridgeClient.requestCommand({
        type: "entry.register",
        entry: {
          entryId: nodeForm.entryId.trim(),
          entryKind: "node-entry",
          name: nodeForm.name.trim(),
          nodeTypes: [...nodeTypes],
          componentEntryIds: [...componentEntryIds],
          authorityArtifactRef,
          browserArtifactRef
        }
      });
      await runtime.bridgeClient.requestCommand({
        type: "entry.load",
        entryId: nodeForm.entryId.trim()
      });
      await runtime.bridgeClient.waitForIdle();

      setNodeForm(INITIAL_NODE_FORM);
    });
  };

  const registerBlueprintEntry = () => {
    void runAction("注册蓝图条目", async () => {
      const runtime = await ensureConnectedRuntime();
      if (!blueprintForm.documentFile) {
        throw new Error("请先选择 blueprint JSON 文件。");
      }
      if (blueprintForm.analysisError) {
        throw new Error(blueprintForm.analysisError);
      }
      ensureSelectedNodesCoverNodeTypes(
        nodeEntries,
        blueprintForm.selectedNodeEntryIds,
        blueprintForm.detectedNodeTypes,
        "蓝图条目",
        runtime.graph.listNodes().map((node) => node.type)
      );
      ensureSelectedComponentsCoverWidgetTypes(
        componentEntries,
        blueprintForm.selectedComponentEntryIds,
        blueprintForm.detectedWidgetTypes,
        "蓝图条目",
        runtime.graph.listWidgets().map((widget) => widget.type)
      );

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
          nodeEntryIds: [...blueprintForm.selectedNodeEntryIds],
          componentEntryIds: [...blueprintForm.selectedComponentEntryIds],
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
        new DiffEngine();
        appendLog("system", "diff.enabled", "Diff功能已启用");
        return () => {
          appendLog("system", "diff.disabled", "Diff功能已禁用");
        };
      } catch (error) {
        const message = toErrorMessage(error);
        setLastError(message);
        appendLog("system", "diff.init.error", message);
        setDiffEnabled(false);
      }
    }
  }, [diffEnabled]);

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
                    <button
                      disabled={
                        !ready || transportStatus.state !== "connected" || busyAction !== null
                      }
                      onClick={() =>
                        launchExperiment(
                          DEMO_FREQUENCY_EXTREME_BLUEPRINT_ENTRY_ID,
                          "启动频谱极限压测"
                        )
                      }
                    >
                      极限压测
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
