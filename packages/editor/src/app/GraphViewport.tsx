import { useEffect, useRef, useState } from "preact/hooks";

import {
  createLeaferGraph,
  createLeaferGraphContextMenu,
  type GraphDocument,
  type GraphLink,
  type GraphOperation,
  type LeaferGraphConnectionPortState,
  type LeaferGraphGraphExecutionState,
  type LeaferGraph,
  type LeaferGraphContextMenuManager,
  type LeaferGraphNodeExecutionEvent,
  type LeaferGraphNodeInspectorState,
  type LeaferGraphNodeStateChangeEvent,
  type LeaferGraphOptions,
  type RuntimeFeedbackEvent
} from "leafergraph";
import {
  createEditorCommandBus,
  type EditorCommandBus,
  type EditorCommandRequest,
  type EditorCommandExecution
} from "../commands/command_bus";
import {
  createEditorCommandHistory,
  type EditorCommandHistory
} from "../commands/command_history";
import {
  createLoopbackGraphDocumentSessionBinding,
  type EditorGraphDocumentSessionBindingFactory
} from "../session/graph_document_session_binding";
import type { EditorGraphOperationSubmission } from "../session/graph_document_session";
import { createEditorNodeSelection } from "../state/selection";
import {
  GRAPH_VIEWPORT_BACKGROUND_SIZE,
  resolveGraphViewportBackground,
  type EditorTheme
} from "../theme";
import {
  bindLinkContextMenu,
  bindNodeContextMenu,
  createLinkMenuBindingKey,
  createNodeMenuBindingKey,
  type EditorNodePointerDownEvent
} from "../menu/context_menu_bindings";
import {
  createEditorContextMenuBeforeOpenHandler,
  createEditorContextMenuResolver
} from "../menu/context_menu_resolver";
import type { EditorRuntimeFeedbackInlet } from "../runtime/runtime_feedback_inlet";
import { createGraphInteractionCommitBridge } from "../interaction/graph_interaction_commit_bridge";

interface GraphViewportProps {
  document: GraphDocument;
  modules?: LeaferGraphOptions["modules"];
  plugins?: LeaferGraphOptions["plugins"];
  createDocumentSessionBinding?: EditorGraphDocumentSessionBindingFactory;
  runtimeFeedbackInlet?: EditorRuntimeFeedbackInlet;
  onHostBridgeChange?(bridge: GraphViewportHostBridge | null): void;
  quickCreateNodeType?: string;
  theme: EditorTheme;
  onEditorToolbarControlsChange?(
    controls: GraphViewportToolbarControlsState | null
  ): void;
  onGraphRuntimeControlsChange?(
    controls: GraphViewportRuntimeControlsState | null
  ): void;
}

type GraphViewportNodeExecutionSnapshot = NonNullable<
  ReturnType<LeaferGraph["getNodeExecutionState"]>
>;
type GraphViewportGraphExecutionSnapshot = LeaferGraphGraphExecutionState;

type GraphViewportRuntimeHistoryStatus =
  | GraphViewportNodeExecutionSnapshot["status"]
  | "skipped";

export interface GraphViewportRuntimeControlsState {
  available: boolean;
  executionState: GraphViewportGraphExecutionSnapshot;
  play(): void;
  step(): void;
  stop(): void;
}

/** 外部宿主可选接入的最小视口桥。 */
export interface GraphViewportHostBridge {
  readonly graph: LeaferGraph;
  executeCommand(request: EditorCommandRequest): EditorCommandExecution;
  submitOperationWithAuthority(
    operation: GraphOperation
  ): EditorGraphOperationSubmission;
  replaceDocument(document: GraphDocument): void;
  getCurrentDocument(): GraphDocument;
  subscribeDocument(listener: (document: GraphDocument) => void): () => void;
  getPendingOperationIds(): readonly string[];
  getSelectedNodeIds(): readonly string[];
  getNodeSnapshot(nodeId: string): ReturnType<LeaferGraph["getNodeSnapshot"]>;
  getLink(linkId: string): GraphLink | undefined;
}

/** editor 顶栏工具栏当前支持的动作 ID。 */
export type GraphViewportToolbarActionId =
  | "undo"
  | "redo"
  | "fit-view"
  | "select-all"
  | "paste"
  | "copy"
  | "cut"
  | "duplicate"
  | "delete";

/** editor 顶栏工具栏动作分组。 */
export type GraphViewportToolbarActionGroup =
  | "history"
  | "canvas"
  | "selection";

/** 单个工具栏按钮的可见状态。 */
export interface GraphViewportToolbarActionState {
  id: GraphViewportToolbarActionId;
  group: GraphViewportToolbarActionGroup;
  label: string;
  disabled: boolean;
  description: string;
  shortcut?: string;
  danger?: boolean;
}

/**
 * 顶栏工具栏控制态。
 *
 * @remarks
 * GraphViewport 继续持有命令总线和历史记录；
 * App 只消费这里暴露出来的展示态和执行入口，不直接触碰底层图命令实现。
 */
export interface GraphViewportToolbarControlsState {
  available: boolean;
  actions: readonly GraphViewportToolbarActionState[];
  execute(actionId: GraphViewportToolbarActionId): void;
}

interface GraphViewportRuntimeInspectorState {
  focusMode: "idle" | "selection" | "recent-execution";
  focusNodeId: string | null;
  focusNodeTitle: string | null;
  focusNodeType: string | null;
  selectionCount: number;
  executionState: GraphViewportNodeExecutionSnapshot | null;
  lastCommandSummary: string | null;
  lastCommandTimestamp: number | null;
}

interface GraphViewportRuntimeHistoryEntry {
  id: string;
  chainId: string;
  rootNodeId: string;
  rootNodeTitle: string;
  rootNodeType: string | null;
  nodeId: string;
  nodeTitle: string;
  nodeType: string | null;
  depth: number;
  sequence: number;
  status: GraphViewportRuntimeHistoryStatus;
  source: LeaferGraphNodeExecutionEvent["source"];
  trigger: LeaferGraphNodeExecutionEvent["trigger"];
  summary: string;
  timestamp: number;
  runCount: number;
  errorMessage: string | null;
}

interface GraphViewportRuntimeChainGroup {
  chainId: string;
  rootNodeId: string;
  rootNodeTitle: string;
  rootNodeType: string | null;
  source: LeaferGraphNodeExecutionEvent["source"];
  status: GraphViewportRuntimeHistoryStatus;
  startedAt: number;
  finishedAt: number;
  stepCount: number;
  maxDepth: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  directCount: number;
  propagatedCount: number;
  latestEntry: GraphViewportRuntimeHistoryEntry | null;
  entries: GraphViewportRuntimeHistoryEntry[];
}

interface GraphViewportRuntimeFailureGroup {
  nodeId: string;
  nodeTitle: string;
  nodeType: string | null;
  failureCount: number;
  latestTimestamp: number;
  latestErrorMessage: string | null;
  latestSource: LeaferGraphNodeExecutionEvent["source"];
  latestTrigger: LeaferGraphNodeExecutionEvent["trigger"];
}

const MAX_RUNTIME_HISTORY_ENTRIES = 8;
const MAX_RUNTIME_CHAIN_GROUPS = 4;
const MAX_RUNTIME_FAILURE_ENTRIES = 4;

function createIdleGraphExecutionState(): GraphViewportGraphExecutionSnapshot {
  return {
    status: "idle",
    queueSize: 0,
    stepCount: 0
  };
}

function resolveInspectorFocusState(
  graph: LeaferGraph,
  selection: ReturnType<typeof createEditorNodeSelection>,
  lastRuntimeExecution: LeaferGraphNodeExecutionEvent | null,
  lastExecution: EditorCommandExecution | null
): Pick<
  GraphViewportRuntimeInspectorState,
  "focusMode" | "focusNodeId" | "selectionCount"
> {
  const resolveExistingNodeId = (nodeId: string | null): string | null =>
    nodeId && graph.getNodeSnapshot(nodeId) ? nodeId : null;

  const selectedNodeId = resolveExistingNodeId(selection.primarySelectedNodeId);
  const recentRuntimeExecutedNodeId = resolveExistingNodeId(
    lastRuntimeExecution?.nodeId ?? null
  );
  const recentExecutedNodeId = resolveExistingNodeId(
    lastExecution?.request.type === "node.play"
      ? lastExecution.request.nodeId
      : null
  );
  const focusNodeId =
    selectedNodeId ?? recentRuntimeExecutedNodeId ?? recentExecutedNodeId ?? null;

  return {
    focusMode: selectedNodeId
      ? "selection"
      : recentRuntimeExecutedNodeId || recentExecutedNodeId
        ? "recent-execution"
        : "idle",
    focusNodeId,
    selectionCount: selection.selectedNodeIds.length
  };
}

function createIdleRuntimeInspectorState(): GraphViewportRuntimeInspectorState {
  return {
    focusMode: "idle",
    focusNodeId: null,
    focusNodeTitle: null,
    focusNodeType: null,
    selectionCount: 0,
    executionState: null,
    lastCommandSummary: null,
    lastCommandTimestamp: null
  };
}

function resolveRuntimeInspectorState(
  graph: LeaferGraph,
  selection: ReturnType<typeof createEditorNodeSelection>,
  lastRuntimeExecution: LeaferGraphNodeExecutionEvent | null,
  lastExecution: EditorCommandExecution | null
): GraphViewportRuntimeInspectorState {
  const { focusNodeId, focusMode, selectionCount } = resolveInspectorFocusState(
    graph,
    selection,
    lastRuntimeExecution,
    lastExecution
  );

  if (!focusNodeId) {
    return {
      ...createIdleRuntimeInspectorState(),
      lastCommandSummary: lastExecution?.summary ?? null,
      lastCommandTimestamp: lastExecution?.timestamp ?? null
    };
  }

  const snapshot = graph.getNodeSnapshot(focusNodeId);
  const executionState = graph.getNodeExecutionState(focusNodeId);

  return {
    focusMode,
    focusNodeId,
    focusNodeTitle: snapshot?.title ?? focusNodeId,
    focusNodeType: snapshot?.type ?? null,
    selectionCount,
    executionState: executionState ?? null,
    lastCommandSummary: lastExecution?.summary ?? null,
    lastCommandTimestamp: lastExecution?.timestamp ?? null
  };
}

function resolveNodeInspectorState(
  graph: LeaferGraph,
  selection: ReturnType<typeof createEditorNodeSelection>,
  lastRuntimeExecution: LeaferGraphNodeExecutionEvent | null,
  lastExecution: EditorCommandExecution | null
): LeaferGraphNodeInspectorState | null {
  const { focusNodeId } = resolveInspectorFocusState(
    graph,
    selection,
    lastRuntimeExecution,
    lastExecution
  );

  return focusNodeId ? graph.getNodeInspectorState(focusNodeId) ?? null : null;
}

function shouldSyncInspectorForNodeState(
  graph: LeaferGraph,
  event: LeaferGraphNodeStateChangeEvent,
  selection: ReturnType<typeof createEditorNodeSelection>,
  lastRuntimeExecution: LeaferGraphNodeExecutionEvent | null,
  lastExecution: EditorCommandExecution | null
): boolean {
  if (!event.exists) {
    return true;
  }

  return (
    resolveInspectorFocusState(
      graph,
      selection,
      lastRuntimeExecution,
      lastExecution
    ).focusNodeId === event.nodeId
  );
}

function formatExecutionTimestamp(timestamp: number | null): string {
  if (!timestamp) {
    return "无";
  }

  return new Date(timestamp).toLocaleTimeString();
}

function formatExecutionDuration(
  startedAt: number | null,
  finishedAt: number | null
): string {
  if (!startedAt || !finishedAt) {
    return "0 ms";
  }

  return `${Math.max(0, finishedAt - startedAt)} ms`;
}

function formatRuntimeStatusLabel(
  status: GraphViewportRuntimeHistoryStatus | null | undefined
): string {
  switch (status) {
    case "running":
      return "运行中";
    case "success":
      return "成功";
    case "error":
      return "失败";
    case "skipped":
      return "未执行";
    default:
      return "空闲";
  }
}

function formatGraphExecutionStatusLabel(
  status: GraphViewportGraphExecutionSnapshot["status"] | null | undefined
): string {
  switch (status) {
    case "running":
      return "图运行中";
    case "stepping":
      return "图单步中";
    default:
      return "图空闲";
  }
}

function formatRuntimeTriggerLabel(
  trigger: LeaferGraphNodeExecutionEvent["trigger"]
): string {
  return trigger === "propagated" ? "链路传播" : "主动执行";
}

function formatRuntimeSourceLabel(
  source: LeaferGraphNodeExecutionEvent["source"] | null | undefined
): string {
  switch (source) {
    case "graph-play":
      return "图级 Play";
    case "graph-step":
      return "图级 Step";
    case "node-play":
      return "节点起跑";
    default:
      return "未知来源";
  }
}

function formatRuntimeFocusModeLabel(
  focusMode: GraphViewportRuntimeInspectorState["focusMode"]
): string {
  switch (focusMode) {
    case "selection":
      return "主选中节点";
    case "recent-execution":
      return "最近执行节点";
    default:
      return "未锁定节点";
  }
}

function formatInspectorValue(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function hasOwnEntries(record: Record<string, unknown> | undefined): boolean {
  return Boolean(record && Object.keys(record).length);
}

function formatSlotTypeLabel(type: unknown): string {
  if (type === undefined) {
    return "any";
  }

  return String(type);
}

function resolveRuntimeHistorySummary(
  source: LeaferGraphNodeExecutionEvent["source"],
  status: GraphViewportRuntimeHistoryStatus,
  trigger: LeaferGraphNodeExecutionEvent["trigger"],
  errorMessage: string | null
): string {
  const sourceLabel = formatRuntimeSourceLabel(source);
  const triggerLabel = formatRuntimeTriggerLabel(trigger);

  switch (status) {
    case "running":
      return `${sourceLabel}触发，${triggerLabel}已进入执行中。`;
    case "success":
      return `${sourceLabel}触发成功，${triggerLabel}结果已经写回运行时。`;
    case "error":
      return errorMessage
        ? `${sourceLabel}触发失败：${errorMessage}`
        : `${sourceLabel}触发失败，请查看控制台日志。`;
    case "skipped":
      return "这次执行没有命中可用的 onExecute(...)。";
    default:
      return "当前节点还没有执行记录。";
  }
}

function createRuntimeHistoryEntryFromEvent(
  event: LeaferGraphNodeExecutionEvent
): GraphViewportRuntimeHistoryEntry {
  return {
    id: `${event.chainId}:${event.sequence}:${event.nodeId}:${event.state.status}`,
    chainId: event.chainId,
    rootNodeId: event.rootNodeId,
    rootNodeTitle: event.rootNodeTitle,
    rootNodeType: event.rootNodeType,
    nodeId: event.nodeId,
    nodeTitle: event.nodeTitle,
    nodeType: event.nodeType,
    depth: event.depth,
    sequence: event.sequence,
    status: event.state.status,
    source: event.source,
    trigger: event.trigger,
    summary: resolveRuntimeHistorySummary(
      event.source,
      event.state.status,
      event.trigger,
      event.state.lastErrorMessage ?? null
    ),
    timestamp: event.timestamp,
    runCount: event.state.runCount,
    errorMessage: event.state.lastErrorMessage ?? null
  };
}

function appendRuntimeHistoryEntry(
  entries: readonly GraphViewportRuntimeHistoryEntry[],
  entry: GraphViewportRuntimeHistoryEntry
): GraphViewportRuntimeHistoryEntry[] {
  return [entry, ...entries].slice(0, MAX_RUNTIME_HISTORY_ENTRIES);
}

function resolveRuntimeChainStatus(
  entries: readonly GraphViewportRuntimeHistoryEntry[]
): GraphViewportRuntimeHistoryStatus {
  if (entries.some((entry) => entry.status === "error")) {
    return "error";
  }

  if (entries.some((entry) => entry.status === "running")) {
    return "running";
  }

  if (entries.some((entry) => entry.status === "success")) {
    return "success";
  }

  return "skipped";
}

function groupRuntimeHistoryEntries(
  entries: readonly GraphViewportRuntimeHistoryEntry[]
): GraphViewportRuntimeChainGroup[] {
  const chainMap = new Map<string, GraphViewportRuntimeChainGroup>();
  const orderedChains: GraphViewportRuntimeChainGroup[] = [];

  for (const entry of entries) {
    let chain = chainMap.get(entry.chainId);

    if (!chain) {
      chain = {
        chainId: entry.chainId,
        rootNodeId: entry.rootNodeId,
        rootNodeTitle: entry.rootNodeTitle,
        rootNodeType: entry.rootNodeType,
        source: entry.source,
        status: entry.status,
        startedAt: entry.timestamp,
        finishedAt: entry.timestamp,
        stepCount: 0,
        maxDepth: entry.depth,
        successCount: 0,
        errorCount: 0,
        skippedCount: 0,
        directCount: 0,
        propagatedCount: 0,
        latestEntry: null,
        entries: []
      };
      chainMap.set(entry.chainId, chain);
      orderedChains.push(chain);
    }

    chain.startedAt = Math.min(chain.startedAt, entry.timestamp);
    chain.finishedAt = Math.max(chain.finishedAt, entry.timestamp);
    chain.stepCount += 1;
    chain.maxDepth = Math.max(chain.maxDepth, entry.depth);
    chain.entries.push(entry);
    chain.source = entry.source;

    if (entry.status === "success") {
      chain.successCount += 1;
    } else if (entry.status === "error") {
      chain.errorCount += 1;
    } else if (entry.status === "skipped") {
      chain.skippedCount += 1;
    }

    if (entry.trigger === "direct") {
      chain.directCount += 1;
    } else {
      chain.propagatedCount += 1;
    }
  }

  for (const chain of orderedChains) {
    chain.entries.sort(
      (left, right) =>
        left.sequence - right.sequence || left.timestamp - right.timestamp
    );
    chain.status = resolveRuntimeChainStatus(chain.entries);
    chain.latestEntry = chain.entries[chain.entries.length - 1] ?? null;
  }

  return orderedChains.slice(0, MAX_RUNTIME_CHAIN_GROUPS);
}

function groupRuntimeFailureEntries(
  entries: readonly GraphViewportRuntimeHistoryEntry[]
): GraphViewportRuntimeFailureGroup[] {
  const groups = new Map<string, GraphViewportRuntimeFailureGroup>();

  for (const entry of entries) {
    if (entry.status !== "error") {
      continue;
    }

    const group = groups.get(entry.nodeId);
    if (!group) {
      groups.set(entry.nodeId, {
        nodeId: entry.nodeId,
        nodeTitle: entry.nodeTitle,
        nodeType: entry.nodeType,
        failureCount: 1,
        latestTimestamp: entry.timestamp,
        latestErrorMessage: entry.errorMessage,
        latestSource: entry.source,
        latestTrigger: entry.trigger
      });
      continue;
    }

    group.failureCount += 1;

    if (entry.timestamp >= group.latestTimestamp) {
      group.nodeTitle = entry.nodeTitle;
      group.nodeType = entry.nodeType;
      group.latestTimestamp = entry.timestamp;
      group.latestErrorMessage = entry.errorMessage;
      group.latestSource = entry.source;
      group.latestTrigger = entry.trigger;
    }
  }

  return [...groups.values()]
    .sort((left, right) => right.latestTimestamp - left.latestTimestamp)
    .slice(0, MAX_RUNTIME_FAILURE_ENTRIES);
}

/**
 * editor 只需要 Leafer 的最小坐标换算能力，
 * 用来把宿主 DOM 指针位置转换成画布世界坐标。
 */
interface GraphViewportCoordinateHost {
  getWorldPointByClient(
    clientPoint: { clientX: number; clientY: number },
    updateClient?: boolean
  ): { x: number; y: number };
  getPagePointByClient(
    clientPoint: { clientX: number; clientY: number },
    updateClient?: boolean
  ): { x: number; y: number };
}

/**
 * editor 只需要树层最小事件订阅能力，
 * 用来监听视口缩放和平移后的坐标系变化。
 */
interface GraphViewportViewEventHost {
  on(type: string, listener: () => void): void;
  off(type: string, listener: () => void): void;
}

/** 左键框选在 DOM overlay 中使用的本地矩形。 */
interface GraphViewportSelectionBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 左键框选运行时状态。
 * `baseSelectedNodeIds` 用来支持 `Ctrl / Shift` 加选模式。
 */
interface GraphViewportMarqueeState {
  sequence: number;
  pointerId: number;
  append: boolean;
  startClientX: number;
  startClientY: number;
  startWorldX: number;
  startWorldY: number;
  baseSelectedNodeIds: readonly string[];
}

/**
 * editor 侧最小连线重连会话。
 *
 * @remarks
 * 这一层只维护“当前正在重连哪条线、源端口是谁、当前预览指向哪里”，
 * 正式图变更仍然统一走 `link.reconnect` 命令链。
 */
interface GraphViewportReconnectState {
  linkId: string;
  sourcePort: LeaferGraphConnectionPortState;
  previewPoint: {
    x: number;
    y: number;
  };
  hoveredTarget: LeaferGraphConnectionPortState | null;
}

/** 判断当前激活元素是否处于文本编辑场景，避免快捷键误删。 */
function isTextEditingElement(element: EventTarget | null): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const tagName = element.tagName;
  return (
    element.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}

/** 判断是否按下了当前平台的主命令修饰键。 */
function hasPrimaryCommandModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey;
}

/** 判断节点点击是否应该走“切换选区”路径。 */
function shouldToggleSelectionByPointerEvent(
  event?: EditorNodePointerDownEvent
): boolean {
  return Boolean(event?.ctrlKey || event?.metaKey || event?.shiftKey);
}

/** 统一判断一次节点按下是否来自右键。 */
function isSecondaryPointerDownEvent(
  event?: EditorNodePointerDownEvent
): boolean {
  return Boolean(
    event?.right || event?.button === 2 || event?.origin?.button === 2
  );
}

/** 由两个 client 点生成标准化的本地框选矩形。 */
function resolveSelectionBox(
  startClientX: number,
  startClientY: number,
  currentClientX: number,
  currentClientY: number,
  hostRect: DOMRect
): GraphViewportSelectionBox {
  const left = Math.min(startClientX, currentClientX) - hostRect.left;
  const top = Math.min(startClientY, currentClientY) - hostRect.top;
  const right = Math.max(startClientX, currentClientX) - hostRect.left;
  const bottom = Math.max(startClientY, currentClientY) - hostRect.top;

  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  };
}

/** 判断两个世界坐标包围盒是否发生相交。 */
function intersectsWorldBounds(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * 把 editor 壳层和 LeaferGraph 实例连接起来。
 * 除了负责图初始化，这里也承担画布背景与 editor 主题同步的职责。
 */
export function GraphViewport({
  document: documentData,
  modules,
  plugins,
  createDocumentSessionBinding,
  runtimeFeedbackInlet,
  onHostBridgeChange,
  quickCreateNodeType,
  theme,
  onEditorToolbarControlsChange,
  onGraphRuntimeControlsChange
}: GraphViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const selectionBoxRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<LeaferGraph | null>(null);
  const [runtimeInspectorState, setRuntimeInspectorState] =
    useState<GraphViewportRuntimeInspectorState>(() =>
      createIdleRuntimeInspectorState()
    );
  const [nodeInspectorState, setNodeInspectorState] =
    useState<LeaferGraphNodeInspectorState | null>(null);
  const [runtimeHistoryEntries, setRuntimeHistoryEntries] = useState<
    GraphViewportRuntimeHistoryEntry[]
  >([]);
  const [graphExecutionState, setGraphExecutionState] =
    useState<GraphViewportGraphExecutionSnapshot>(() =>
      createIdleGraphExecutionState()
    );
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    host.style.background = resolveGraphViewportBackground(theme);
    host.style.backgroundSize = GRAPH_VIEWPORT_BACKGROUND_SIZE;
    graphRef.current?.setThemeMode(theme);
  }, [theme]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    setRuntimeInspectorState(createIdleRuntimeInspectorState());
    setNodeInspectorState(null);
    setRuntimeHistoryEntries([]);
    setGraphExecutionState(createIdleGraphExecutionState());

    const graph = createLeaferGraph(host, {
      document: documentData,
      modules,
      plugins,
      fill: resolveGraphViewportBackground(themeRef.current),
      themeMode: themeRef.current,
      widgetEditing: {
        enabled: true,
        useOfficialTextEditor: true,
        allowOptionsMenu: true
      }
    });
    graphRef.current = graph;
    const documentSessionBinding = (
      createDocumentSessionBinding ??
      createLoopbackGraphDocumentSessionBinding
    )({
      graph,
      document: documentData
    });
    const documentSession = documentSessionBinding.session;
    documentSessionBinding.replaceDocument(documentData);
    const activeDocument = documentSession.currentDocument;
    let projectedDocument = activeDocument;
    onGraphRuntimeControlsChange?.({
      available: false,
      executionState: graph.getGraphExecutionState(),
      play: () => {
        graph.play();
      },
      step: () => {
        graph.step();
      },
      stop: () => {
        graph.stop();
      }
    });
    const selection = createEditorNodeSelection(graph);
    const ownerWindow = host.ownerDocument.defaultView ?? window;
    let latestExecution: EditorCommandExecution | null = null;
    let latestRuntimeExecution: LeaferGraphNodeExecutionEvent | null = null;
    let graphReady = false;
    let pointerDownSequence = 0;
    let hitNodePointerDownSequence = -1;
    let pendingCanvasSelectionFrame = 0;
    let pendingPointerWorldSyncFrame = 0;
    let pendingReconnectStartFrame = 0;
    let spaceKeyPressed = false;
    let lastPointerClientPoint: { clientX: number; clientY: number } | null = null;
    let lastPointerWorldPoint: { x: number; y: number } | null = null;
    let lastPointerPagePoint: { x: number; y: number } | null = null;
    let pendingMarqueeSelection: GraphViewportMarqueeState | null = null;
    let activeMarqueeSelection: GraphViewportMarqueeState | null = null;
    let reconnectState: GraphViewportReconnectState | null = null;
    const boundNodeIds = new Set<string>();
    const boundLinkIds = new Set<string>();
    let pendingLinkMenuSyncFrame = 0;
    let menu!: LeaferGraphContextMenuManager;
    let commandBus!: EditorCommandBus;
    let commandHistory!: EditorCommandHistory;
    let disposed = false;
    let syncEditorToolbarControls = (): void => {};
    const syncGraphRuntimeControls = (
      nextGraphExecutionState: GraphViewportGraphExecutionSnapshot = graph.getGraphExecutionState()
    ): void => {
      if (disposed) {
        return;
      }

      setGraphExecutionState(nextGraphExecutionState);
      onGraphRuntimeControlsChange?.({
        available: graphReady,
        executionState: nextGraphExecutionState,
        play: () => {
          graph.play();
        },
        step: () => {
          graph.step();
        },
        stop: () => {
          graph.stop();
        }
      });
    };
    const syncInfoPanelState = (): void => {
      if (disposed) {
        return;
      }

      setRuntimeInspectorState(
        resolveRuntimeInspectorState(
          graph,
          selection,
          latestRuntimeExecution,
          latestExecution
        )
      );
      setNodeInspectorState(
        resolveNodeInspectorState(
          graph,
          selection,
          latestRuntimeExecution,
          latestExecution
        )
      );
    };
    const disposeSelectionSubscription = selection.subscribe(() => {
      syncInfoPanelState();
      syncEditorToolbarControls();
    });
    const handleRuntimeFeedback = (feedback: RuntimeFeedbackEvent): void => {
      documentSessionBinding.handleRuntimeFeedback(feedback);

      switch (feedback.type) {
        case "node.execution": {
          const event = feedback.event;
          latestRuntimeExecution = event;
          setRuntimeHistoryEntries((entries) =>
            appendRuntimeHistoryEntry(entries, createRuntimeHistoryEntryFromEvent(event))
          );
          syncInfoPanelState();
          syncEditorToolbarControls();
          return;
        }
        case "graph.execution": {
          syncGraphRuntimeControls(feedback.event.state);
          return;
        }
        case "node.state": {
          const event = feedback.event;
          if (!event.exists) {
            selection.clearIfContains(event.nodeId);
          }

          if (
            shouldSyncInspectorForNodeState(
              graph,
              event,
              selection,
              latestRuntimeExecution,
              latestExecution
            )
          ) {
            syncInfoPanelState();
          }

          syncEditorToolbarControls();
          return;
        }
        case "link.propagation":
          return;
      }
    };
    const disposeLocalRuntimeFeedbackSubscription = graph.subscribeRuntimeFeedback(
      handleRuntimeFeedback
    );
    const disposeExternalRuntimeFeedbackSubscription =
      runtimeFeedbackInlet?.subscribe(handleRuntimeFeedback) ?? (() => {});
    const hideSelectionBox = (): void => {
      const selectionBox = selectionBoxRef.current;
      if (!selectionBox) {
        return;
      }

      selectionBox.dataset.visible = "false";
      selectionBox.style.opacity = "0";
      selectionBox.style.width = "0px";
      selectionBox.style.height = "0px";
    };
    const showSelectionBox = (box: GraphViewportSelectionBox): void => {
      const selectionBox = selectionBoxRef.current;
      if (!selectionBox) {
        return;
      }

      selectionBox.dataset.visible = "true";
      selectionBox.style.opacity = "1";
      selectionBox.style.left = `${box.left}px`;
      selectionBox.style.top = `${box.top}px`;
      selectionBox.style.width = `${box.width}px`;
      selectionBox.style.height = `${box.height}px`;
    };
    const resolveWorldPointByClient = (
      clientX: number,
      clientY: number
    ): { x: number; y: number } =>
      (
        graph.app as typeof graph.app & GraphViewportCoordinateHost
      ).getWorldPointByClient(
        {
          clientX,
          clientY
        },
        true
      );
    const resolvePagePointByClient = (
      clientX: number,
      clientY: number
    ): { x: number; y: number } =>
      (
        graph.app as typeof graph.app & GraphViewportCoordinateHost
      ).getPagePointByClient(
        {
          clientX,
          clientY
        },
        true
      );
    /** 用当前记住的 client 坐标，同时刷新 world / page 两套坐标。 */
    const refreshPointerPoints = (): void => {
      if (!lastPointerClientPoint) {
        return;
      }

      lastPointerWorldPoint = resolveWorldPointByClient(
        lastPointerClientPoint.clientX,
        lastPointerClientPoint.clientY
      );
      lastPointerPagePoint = resolvePagePointByClient(
        lastPointerClientPoint.clientX,
        lastPointerClientPoint.clientY
      );
    };
    /**
     * 统一记录“鼠标最后一次停留的 client 坐标”，
     * 并立即解析成当前视口下的 world / page 坐标，供命中与粘贴复用。
     */
    const syncPointerPointsByClient = (
      clientX: number,
      clientY: number
    ): void => {
      lastPointerClientPoint = { clientX, clientY };
      lastPointerWorldPoint = resolveWorldPointByClient(clientX, clientY);
      lastPointerPagePoint = resolvePagePointByClient(clientX, clientY);
    };
    /**
     * 视口缩放 / 平移后，同一组 client 坐标对应的世界坐标会变化。
     * 这里延后一帧重算，确保粘贴仍然落在鼠标当前位置。
     */
    const schedulePointerWorldPointRefresh = (): void => {
      if (!lastPointerClientPoint) {
        return;
      }

      if (pendingPointerWorldSyncFrame) {
        ownerWindow.cancelAnimationFrame(pendingPointerWorldSyncFrame);
      }

      pendingPointerWorldSyncFrame = ownerWindow.requestAnimationFrame(() => {
        pendingPointerWorldSyncFrame = 0;

        if (disposed) {
          return;
        }

        refreshPointerPoints();
        if (reconnectState && lastPointerPagePoint) {
          updateReconnectPreview(lastPointerPagePoint);
        }
      });
    };
    /**
     * 把依赖“当前视口矩阵”的动作延后一帧执行。
     * 这样在滚轮缩放、平移或 `fitView()` 紧接着触发粘贴时，
     * 可以尽量避免拿到尚未稳定的新旧混合坐标。
     */
    const runAfterViewportSettle = (callback: () => void): void => {
      ownerWindow.requestAnimationFrame(() => {
        if (disposed) {
          return;
        }

        refreshPointerPoints();
        callback();
      });
    };
    /**
     * 直接监听 Leafer 视口变换事件。
     * 只要画布缩放、滚动或 `fitView()` 发生，都会把同一鼠标 client 坐标重新换算成新的世界坐标。
     */
    const handleTreeTransform = (): void => {
      schedulePointerWorldPointRefresh();
    };
    const resolveMarqueeHitNodeIds = (
      marqueeState: GraphViewportMarqueeState,
      currentWorldPoint: { x: number; y: number }
    ): string[] => {
      const selectionBounds = {
        x: Math.min(marqueeState.startWorldX, currentWorldPoint.x),
        y: Math.min(marqueeState.startWorldY, currentWorldPoint.y),
        width: Math.abs(currentWorldPoint.x - marqueeState.startWorldX),
        height: Math.abs(currentWorldPoint.y - marqueeState.startWorldY)
      };
      const hitNodeIds: string[] = [];

      for (const nodeId of boundNodeIds) {
        const view = graph.getNodeView(nodeId);
        if (!view) {
          continue;
        }

        const nodeBounds = view.worldBoxBounds;
        if (
          intersectsWorldBounds(selectionBounds, {
            x: nodeBounds.x,
            y: nodeBounds.y,
            width: nodeBounds.width,
            height: nodeBounds.height
          })
        ) {
          hitNodeIds.push(nodeId);
        }
      }

      return hitNodeIds;
    };
    /**
     * 判断当前世界坐标是否命中了任意节点。
     * 框选只能从空白画布开始，因此这里需要在宿主原生 pointerdown 阶段先做一次几何过滤。
     */
    const hitNodeAtWorldPoint = (point: {
      x: number;
      y: number;
    }): boolean => {
      for (const nodeId of boundNodeIds) {
        const view = graph.getNodeView(nodeId);
        if (!view) {
          continue;
        }

        const nodeBounds = view.worldBoxBounds;
        if (
          point.x >= nodeBounds.x &&
          point.x <= nodeBounds.x + nodeBounds.width &&
          point.y >= nodeBounds.y &&
          point.y <= nodeBounds.y + nodeBounds.height
        ) {
          return true;
        }
      }

      return false;
    };
    /** 读取“当前鼠标应对应的 page 坐标”，用于节点创建和键盘粘贴。 */
    const resolveLatestPointerPagePoint = (): { x: number; y: number } | null => {
      if (lastPointerClientPoint) {
        lastPointerPagePoint = resolvePagePointByClient(
          lastPointerClientPoint.clientX,
          lastPointerClientPoint.clientY
        );
      }

      return lastPointerPagePoint;
    };
    /** 清理当前重连会话的预览线、高亮与鼠标样式。 */
    const clearReconnectSession = (): void => {
      reconnectState = null;
      graph.setConnectionSourcePort(null);
      graph.setConnectionCandidatePort(null);
      graph.clearConnectionPreview();

      if (!activeMarqueeSelection && !pendingMarqueeSelection) {
        host.style.cursor = "";
      }
    };
    /** 在每次刷新预览前重新解析一次源端口，避免节点移动后仍引用旧几何。 */
    const resolveActiveReconnectSourcePort =
      (): LeaferGraphConnectionPortState | null => {
        if (!reconnectState) {
          return null;
        }

        const nextSourcePort = graph.resolveConnectionPort(
          reconnectState.sourcePort.nodeId,
          reconnectState.sourcePort.direction,
          reconnectState.sourcePort.slot
        );
        if (!nextSourcePort) {
          clearReconnectSession();
          return null;
        }

        reconnectState.sourcePort = nextSourcePort;
        return nextSourcePort;
      };
    /** 根据当前鼠标位置刷新重连预览和候选输入端口高亮。 */
    const updateReconnectPreview = (point: { x: number; y: number }): void => {
      const sourcePort = resolveActiveReconnectSourcePort();
      if (!sourcePort || !reconnectState) {
        return;
      }

      const rawTarget = graph.resolveConnectionPortAtPoint(point, "input");
      const validation = rawTarget
        ? graph.canCreateConnection(sourcePort, rawTarget)
        : { valid: false as const };
      const hoveredTarget = rawTarget && validation.valid ? rawTarget : null;

      reconnectState.previewPoint = point;
      reconnectState.hoveredTarget = hoveredTarget;
      graph.setConnectionSourcePort(sourcePort);
      graph.setConnectionCandidatePort(hoveredTarget);
      graph.setConnectionPreview(sourcePort, point, hoveredTarget ?? undefined);
      host.style.cursor =
        rawTarget && !validation.valid ? "not-allowed" : "crosshair";
    };
    /** 提交一次重连；命中不到合法输入端口时回退为取消。 */
    const commitReconnectSession = (point: { x: number; y: number }): void => {
      const sourcePort = resolveActiveReconnectSourcePort();
      if (!sourcePort || !reconnectState) {
        return;
      }

      const rawTarget = graph.resolveConnectionPortAtPoint(point, "input");
      const validation = rawTarget
        ? graph.canCreateConnection(sourcePort, rawTarget)
        : { valid: false as const };

      if (rawTarget && validation.valid) {
        commandBus.execute({
          type: "link.reconnect",
          linkId: reconnectState.linkId,
          input: {
            target: {
              nodeId: rawTarget.nodeId,
              slot: rawTarget.slot
            }
          }
        });
      }

      clearReconnectSession();
    };
    /** 从连线菜单启动一次“重选目标输入端口”的重连会话。 */
    const startReconnectSession = (linkId: string): void => {
      if (!graphReady) {
        return;
      }

      const link = graph.getLink(linkId);
      if (!link) {
        return;
      }

      const sourcePort = graph.resolveConnectionPort(
        link.source.nodeId,
        "output",
        link.source.slot ?? 0
      );
      if (!sourcePort) {
        return;
      }

      const originalTargetPort = graph.resolveConnectionPort(
        link.target.nodeId,
        "input",
        link.target.slot ?? 0
      );

      if (pendingReconnectStartFrame) {
        ownerWindow.cancelAnimationFrame(pendingReconnectStartFrame);
      }

      clearReconnectSession();
      pendingReconnectStartFrame = ownerWindow.requestAnimationFrame(() => {
        pendingReconnectStartFrame = 0;

        if (disposed || !graphReady) {
          return;
        }

        const activeSourcePort = graph.resolveConnectionPort(
          sourcePort.nodeId,
          sourcePort.direction,
          sourcePort.slot
        );
        if (!activeSourcePort) {
          return;
        }

        const previewPoint =
          resolveLatestPointerPagePoint() ??
          originalTargetPort?.center ??
          activeSourcePort.center;

        reconnectState = {
          linkId,
          sourcePort: activeSourcePort,
          previewPoint,
          hoveredTarget: null
        };
        graph.setConnectionSourcePort(activeSourcePort);
        graph.setConnectionCandidatePort(null);
        graph.setConnectionPreview(activeSourcePort, previewPoint);
        host.style.cursor = "crosshair";
      });
    };
    /**
     * 统一收敛节点按下时的选中逻辑。
     * 这里除了更新选中态，还会记录“命中的是哪一次 pointerdown”。
     *
     * 之所以不再使用单个布尔值，是因为 Leafer 的 `pointer.down`
     * 可能晚于宿主原生 `pointerdown` 的微任务收尾触发，
     * 从而把上一次点击残留成脏状态，导致空白画布需要点两下才能取消选中。
     */
    const handleNodePointerDown = (
      nodeId: string,
      event?: EditorNodePointerDownEvent
    ): void => {
      if (reconnectState) {
        return;
      }

      hitNodePointerDownSequence = pointerDownSequence;

      /**
       * 右键命中已选中节点时，保留当前整组选区，
       * 这样节点菜单才能继续对多选态执行批量动作。
       */
      if (isSecondaryPointerDownEvent(event)) {
        if (!selection.isSelected(nodeId)) {
          selection.select(nodeId);
        }
        return;
      }

      if (shouldToggleSelectionByPointerEvent(event)) {
        selection.toggle(nodeId);
        return;
      }

      /**
       * 左键按在当前多选集合中的任一节点上时，保留整组选区，
       * 这样拖拽开始前不会先把多选误收缩成单选。
       */
      if (selection.hasMultipleSelected() && selection.isSelected(nodeId)) {
        return;
      }

      selection.select(nodeId);
    };
    const pasteCopiedNodeAtLatestPointer = (): void => {
      const pointerPagePoint = resolveLatestPointerPagePoint();
      commandBus.execute({
        type: "clipboard.paste",
        point: pointerPagePoint
      });
    };
    /** 统一从命令状态读取快捷键是否可触发，避免 GraphViewport 自己维护第二套禁用判断。 */
    const isCommandShortcutEnabled = (request: EditorCommandRequest): boolean =>
      !commandBus.resolveCommandState(request).disabled;
    const pasteCopiedNodeByKeyboard = (): void => {
      if (!isCommandShortcutEnabled({ type: "clipboard.paste", point: null })) {
        return;
      }

      runAfterViewportSettle(() => {
        if (
          !isCommandShortcutEnabled({ type: "clipboard.paste", point: null })
        ) {
          return;
        }

        pasteCopiedNodeAtLatestPointer();
      });
    };
    /**
     * 使用主包已经接入的 `@leafer-in/view` 能力执行适配视图。
     * 当前 editor 继续只透传最小命令，不在这一层重复计算包围盒。
     */
    const fitGraphView = (): void => {
      const request: EditorCommandRequest = { type: "canvas.fit-view" };
      if (!isCommandShortcutEnabled(request)) {
        return;
      }

      commandBus.execute(request);
    };
    menu = createLeaferGraphContextMenu({
      app: graph.app,
      container: graph.container,
      resolveItems: createEditorContextMenuResolver({
        graph,
        selection,
        resolveCommandBus: () => commandBus,
        onRemoveLink(linkId) {
          commandBus.execute({ type: "link.remove", linkId });
          scheduleLinkContextMenuSync();
        },
        onStartReconnect(linkId) {
          startReconnectSession(linkId);
        }
      }),
      onBeforeOpen: createEditorContextMenuBeforeOpenHandler({
        selection,
        resolveCommandBus: () => commandBus
      })
    });
    const bindEditorNode = (node: {
      id: string;
      title: string;
      type?: string;
    }): void => {
      boundNodeIds.add(node.id);
      bindNodeContextMenu(graph, menu, handleNodePointerDown, node);
    };
    const unbindEditorNode = (nodeId: string): void => {
      boundNodeIds.delete(nodeId);
      menu.unbindTarget(createNodeMenuBindingKey(nodeId));
    };
    const bindEditorLink = (link: GraphLink): void => {
      boundLinkIds.add(link.id);
      bindLinkContextMenu(graph, menu, link);
    };
    const unbindEditorLink = (linkId: string): void => {
      boundLinkIds.delete(linkId);
      menu.unbindTarget(createLinkMenuBindingKey(linkId));
    };
    const syncNodeBindingsFromDocument = (document: GraphDocument): void => {
      const nextNodeIds = new Set(document.nodes.map((node) => node.id));

      for (const nodeId of [...boundNodeIds]) {
        if (!nextNodeIds.has(nodeId)) {
          unbindEditorNode(nodeId);
        }
      }

      for (const node of document.nodes) {
        bindEditorNode({
          id: node.id,
          title: node.title ?? node.id,
          type: node.type
        });
      }
    };
    const syncLinkBindingsFromDocument = (document: GraphDocument): void => {
      const nextLinkIds = new Set(document.links.map((link) => link.id));

      for (const linkId of [...boundLinkIds]) {
        if (!nextLinkIds.has(linkId)) {
          unbindEditorLink(linkId);
        }
      }

      for (const link of document.links) {
        bindEditorLink(link);
      }
    };
    const syncAuthoritativeDocumentProjection = (
      document: GraphDocument
    ): void => {
      projectedDocument = document;
      if (!graphReady || disposed) {
        return;
      }

      graph.replaceGraphDocument(document);
      syncNodeBindingsFromDocument(document);
      syncLinkBindingsFromDocument(document);

      const nextSelectedNodeIds = selection.selectedNodeIds.filter((nodeId) =>
        document.nodes.some((node) => node.id === nodeId)
      );
      if (nextSelectedNodeIds.length !== selection.selectedNodeIds.length) {
        selection.setMany(nextSelectedNodeIds);
      }

      syncInfoPanelState();
      syncEditorToolbarControls();
    };
    const collectCurrentLinks = (): GraphLink[] => {
      const linkMap = new Map<string, GraphLink>();

      for (const nodeId of boundNodeIds) {
        for (const link of graph.findLinksByNode(nodeId)) {
          if (!linkMap.has(link.id)) {
            linkMap.set(link.id, link);
          }
        }
      }

      return [...linkMap.values()];
    };
    const syncLinkContextMenus = (): void => {
      if (disposed || !graphReady) {
        return;
      }

      const links = collectCurrentLinks();
      const nextLinkIds = new Set(links.map((link) => link.id));

      for (const linkId of [...boundLinkIds]) {
        if (!nextLinkIds.has(linkId)) {
          unbindEditorLink(linkId);
        }
      }

      for (const link of links) {
        bindEditorLink(link);
      }
    };
    const scheduleLinkContextMenuSync = (): void => {
      if (pendingLinkMenuSyncFrame) {
        ownerWindow.cancelAnimationFrame(pendingLinkMenuSyncFrame);
      }

      pendingLinkMenuSyncFrame = ownerWindow.requestAnimationFrame(() => {
        pendingLinkMenuSyncFrame = 0;
        syncLinkContextMenus();
      });
    };
    const disposeDocumentProjectionSubscription =
      documentSessionBinding.projectsSessionDocument
        ? documentSession.subscribe((document) => {
            syncAuthoritativeDocumentProjection(document);
          })
        : () => {};
    const handleRecordedExecution = (execution: EditorCommandExecution): void => {
      documentSessionBinding.handleCommandExecution(execution);
      latestExecution = execution;
      commandHistory.record(execution);
      scheduleLinkContextMenuSync();
      syncInfoPanelState();
      syncEditorToolbarControls();
    };
    commandHistory = createEditorCommandHistory({
      graph,
      session: documentSession,
      selection,
      bindNode: bindEditorNode,
      unbindNode: unbindEditorNode,
      onDidChange: () => {
        syncEditorToolbarControls();
      }
    });
    commandBus = createEditorCommandBus({
      graph,
      session: documentSession,
      selection,
      bindNode: bindEditorNode,
      unbindNode: unbindEditorNode,
      quickCreateNodeType,
      isRuntimeReady: () => graphReady,
      onAfterFitView: schedulePointerWorldPointRefresh,
      onDidExecute(execution) {
        handleRecordedExecution(execution);
      }
    });
    const interactionCommitBridge = createGraphInteractionCommitBridge({
      session: documentSession,
      rollbackToAuthorityDocument: () => {
        syncAuthoritativeDocumentProjection(documentSession.currentDocument);
      }
    });
    const disposeInteractionCommitSubscription = graph.subscribeInteractionCommit(
      (event) => {
        const execution = interactionCommitBridge.submit(event);
        if (!execution) {
          return;
        }

        handleRecordedExecution(execution);
      }
    );
    onHostBridgeChange?.({
      graph,
      executeCommand(request: EditorCommandRequest): EditorCommandExecution {
        return commandBus.execute(request);
      },
      submitOperationWithAuthority(
        operation: GraphOperation
      ): EditorGraphOperationSubmission {
        return documentSession.submitOperationWithAuthority(operation);
      },
      replaceDocument(document: GraphDocument): void {
        documentSessionBinding.replaceDocument(document);
      },
      getCurrentDocument(): GraphDocument {
        return documentSession.currentDocument;
      },
      subscribeDocument(listener: (document: GraphDocument) => void): () => void {
        return documentSession.subscribe(listener);
      },
      getPendingOperationIds(): readonly string[] {
        return documentSession.pendingOperationIds;
      },
      getSelectedNodeIds(): readonly string[] {
        return [...selection.selectedNodeIds];
      },
      getNodeSnapshot(nodeId: string) {
        return graph.getNodeSnapshot(nodeId);
      },
      getLink(linkId: string): GraphLink | undefined {
        return graph.getLink(linkId);
      }
    });
    const executeEditorToolbarAction = (
      actionId: GraphViewportToolbarActionId
    ): void => {
      switch (actionId) {
        case "undo":
          if (!commandHistory.canUndo) {
            return;
          }
          commandHistory.undo();
          scheduleLinkContextMenuSync();
          syncInfoPanelState();
          syncEditorToolbarControls();
          return;
        case "redo":
          if (!commandHistory.canRedo) {
            return;
          }
          commandHistory.redo();
          scheduleLinkContextMenuSync();
          syncInfoPanelState();
          syncEditorToolbarControls();
          return;
        case "fit-view":
          fitGraphView();
          return;
        case "select-all":
          commandBus.execute({
            type: "selection.select-all",
            nodeIds: [...boundNodeIds]
          });
          return;
        case "paste":
          pasteCopiedNodeByKeyboard();
          return;
        case "copy":
          commandBus.execute({ type: "selection.copy" });
          return;
        case "cut":
          commandBus.execute({ type: "clipboard.cut-selection" });
          return;
        case "duplicate":
          commandBus.execute({ type: "selection.duplicate" });
          return;
        case "delete":
          commandBus.execute({ type: "selection.remove" });
          return;
      }
    };
    syncEditorToolbarControls = (): void => {
      if (disposed) {
        return;
      }

      const fitViewRequest: EditorCommandRequest = { type: "canvas.fit-view" };
      const selectAllRequest: EditorCommandRequest = {
        type: "selection.select-all",
        nodeIds: [...boundNodeIds]
      };
      const pasteRequest: EditorCommandRequest = {
        type: "clipboard.paste",
        point: null
      };
      const copyRequest: EditorCommandRequest = { type: "selection.copy" };
      const cutRequest: EditorCommandRequest = {
        type: "clipboard.cut-selection"
      };
      const duplicateRequest: EditorCommandRequest = {
        type: "selection.duplicate"
      };
      const deleteRequest: EditorCommandRequest = { type: "selection.remove" };
      const fitViewState = commandBus.resolveCommandState(fitViewRequest);
      const selectAllState = commandBus.resolveCommandState(selectAllRequest);
      const pasteState = commandBus.resolveCommandState(pasteRequest);
      const copyState = commandBus.resolveCommandState(copyRequest);
      const cutState = commandBus.resolveCommandState(cutRequest);
      const duplicateState = commandBus.resolveCommandState(duplicateRequest);
      const deleteState = commandBus.resolveCommandState(deleteRequest);

      onEditorToolbarControlsChange?.({
        available: graphReady,
        actions: [
          {
            id: "undo",
            group: "history",
            label: "撤销",
            disabled: !commandHistory.canUndo,
            description: commandHistory.undoEntry?.undoSummary ?? "当前没有可撤销操作",
            shortcut: "Ctrl+Z"
          },
          {
            id: "redo",
            group: "history",
            label: "重做",
            disabled: !commandHistory.canRedo,
            description: commandHistory.redoEntry?.redoSummary ?? "当前没有可重做操作",
            shortcut: "Ctrl+Shift+Z / Ctrl+Y"
          },
          {
            id: "fit-view",
            group: "canvas",
            label: "适配",
            disabled: fitViewState.disabled,
            description: fitViewState.description,
            shortcut: fitViewState.shortcut,
            danger: fitViewState.danger
          },
          {
            id: "select-all",
            group: "selection",
            label: "全选",
            disabled: selectAllState.disabled,
            description: selectAllState.description,
            shortcut: selectAllState.shortcut,
            danger: selectAllState.danger
          },
          {
            id: "paste",
            group: "selection",
            label: "粘贴",
            disabled: pasteState.disabled,
            description: pasteState.description,
            shortcut: pasteState.shortcut,
            danger: pasteState.danger
          },
          {
            id: "copy",
            group: "selection",
            label: "复制",
            disabled: copyState.disabled,
            description: copyState.description,
            shortcut: copyState.shortcut,
            danger: copyState.danger
          },
          {
            id: "cut",
            group: "selection",
            label: "剪切",
            disabled: cutState.disabled,
            description: cutState.description,
            shortcut: cutState.shortcut,
            danger: cutState.danger
          },
          {
            id: "duplicate",
            group: "selection",
            label: "副本",
            disabled: duplicateState.disabled,
            description: duplicateState.description,
            shortcut: duplicateState.shortcut,
            danger: duplicateState.danger
          },
          {
            id: "delete",
            group: "selection",
            label: "删除",
            disabled: deleteState.disabled,
            description: deleteState.description,
            shortcut: deleteState.shortcut,
            danger: deleteState.danger
          }
        ],
        execute: executeEditorToolbarAction
      });
    };
    syncEditorToolbarControls();
    (graph.app.tree as typeof graph.app.tree & GraphViewportViewEventHost).on(
      "leafer.transform",
      handleTreeTransform
    );

    graph.ready.then(() => {
      if (disposed) {
        return;
      }

      graphReady = true;
      syncGraphRuntimeControls();
      syncNodeBindingsFromDocument(projectedDocument);
      syncLinkBindingsFromDocument(projectedDocument);
      syncInfoPanelState();
      syncEditorToolbarControls();
    });

    /**
     * 监听宿主元素的原生 pointerdown，用来识别“点击了画布空白区域”。
     *
     * 不直接依赖 Leafer 事件 target 的原因是：
     * 1. editor 这里更关心是否命中了节点，而不是完整命中树
     * 2. 使用“按下序号 + 下一帧确认”比单个布尔标记更抗事件时序抖动
     * 3. 可以避免和现有节点拖拽、右键菜单实现互相耦合
     */
    const handleHostPointerDown = (event: PointerEvent): void => {
      syncPointerPointsByClient(event.clientX, event.clientY);
      if (reconnectState) {
        if (event.button !== 0 && event.button !== 2) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        if (event.button === 2) {
          clearReconnectSession();
        } else if (lastPointerPagePoint) {
          commitReconnectSession(lastPointerPagePoint);
        } else {
          clearReconnectSession();
        }
        return;
      }

      const pointerWorldPoint = lastPointerWorldPoint;
      if (!pointerWorldPoint) {
        return;
      }

      if (event.button !== 0 && event.pointerType !== "touch") {
        return;
      }

      /**
       * 按住空格时，左键应该优先交给 Leafer 视口平移逻辑，
       * 不再启动 editor 自己的框选会话。
       */
      if (spaceKeyPressed && event.button === 0) {
        return;
      }

      if (hitNodeAtWorldPoint(pointerWorldPoint)) {
        return;
      }

      pointerDownSequence += 1;
      const currentPointerDownSequence = pointerDownSequence;
      const appendSelection = shouldToggleSelectionByPointerEvent(event);
      pendingMarqueeSelection = {
        sequence: currentPointerDownSequence,
        pointerId: event.pointerId,
        append: appendSelection,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startWorldX: pointerWorldPoint.x,
        startWorldY: pointerWorldPoint.y,
        baseSelectedNodeIds: [...selection.selectedNodeIds]
      };
      activeMarqueeSelection = null;
      hideSelectionBox();

      if (pendingCanvasSelectionFrame) {
        ownerWindow.cancelAnimationFrame(pendingCanvasSelectionFrame);
      }

      pendingCanvasSelectionFrame = ownerWindow.requestAnimationFrame(() => {
        pendingCanvasSelectionFrame = 0;

        if (disposed) {
          return;
        }

        if (
          hitNodePointerDownSequence !== currentPointerDownSequence &&
          !appendSelection &&
          !activeMarqueeSelection
        ) {
          selection.clear();
        }
      });
    };

    /**
     * 持续记录鼠标在画布中的世界坐标。
     * 键盘粘贴会优先使用这个点，并把它作为新节点左上角。
     */
    const handleHostPointerMove = (event: PointerEvent): void => {
      syncPointerPointsByClient(event.clientX, event.clientY);
      if (reconnectState && lastPointerPagePoint) {
        updateReconnectPreview(lastPointerPagePoint);
      }
    };

    /**
     * 缩放或滚动画布后，同一鼠标 client 坐标对应的世界坐标会立刻变化。
     * 这里在视口交互结束后的下一帧重算，避免键盘粘贴仍落在旧世界坐标上。
     */
    const handleHostWheel = (event: WheelEvent): void => {
      syncPointerPointsByClient(event.clientX, event.clientY);
      schedulePointerWorldPointRefresh();
    };

    /**
     * 在窗口级持续跟踪框选拖拽。
     * 这样即使鼠标临时离开画布，也不会把框选过程截断。
     *
     * 同时这里也兜底同步“拖拽态下的鼠标坐标”：
     * 当用户按住空格 / 中键平移画布时，Leafer 会自己消费拖拽交互，
     * host 层未必还能稳定收到连续 `pointermove`。窗口级监听可以把这段
     * client 坐标补齐，避免平移结束后键盘粘贴仍然沿用旧落点。
     */
    const handleWindowPointerMove = (event: PointerEvent): void => {
      if (reconnectState) {
        syncPointerPointsByClient(event.clientX, event.clientY);
        if (lastPointerPagePoint) {
          updateReconnectPreview(lastPointerPagePoint);
        }
        return;
      }

      if (event.buttons !== 0) {
        syncPointerPointsByClient(event.clientX, event.clientY);
      }

      if (pendingMarqueeSelection) {
        if (event.pointerId !== pendingMarqueeSelection.pointerId) {
          return;
        }

        if (hitNodePointerDownSequence === pendingMarqueeSelection.sequence) {
          pendingMarqueeSelection = null;
          hideSelectionBox();
          return;
        }

        const offsetX = event.clientX - pendingMarqueeSelection.startClientX;
        const offsetY = event.clientY - pendingMarqueeSelection.startClientY;
        const movedEnough = Math.hypot(offsetX, offsetY) >= 4;

        if (movedEnough) {
          activeMarqueeSelection = pendingMarqueeSelection;
          pendingMarqueeSelection = null;
        }
      }

      if (!activeMarqueeSelection || event.pointerId !== activeMarqueeSelection.pointerId) {
        return;
      }

      syncPointerPointsByClient(event.clientX, event.clientY);
      const pointerWorldPoint = lastPointerWorldPoint;
      if (!pointerWorldPoint) {
        return;
      }

      const hostRect = host.getBoundingClientRect();
      showSelectionBox(
        resolveSelectionBox(
          activeMarqueeSelection.startClientX,
          activeMarqueeSelection.startClientY,
          event.clientX,
          event.clientY,
          hostRect
        )
      );

      const hitNodeIds = resolveMarqueeHitNodeIds(
        activeMarqueeSelection,
        pointerWorldPoint
      );
      selection.setMany(
        activeMarqueeSelection.append
          ? [...activeMarqueeSelection.baseSelectedNodeIds, ...hitNodeIds]
          : hitNodeIds
      );
    };

    /** 结束一次框选会话，并清理 overlay。 */
    const handleWindowPointerUp = (event: PointerEvent): void => {
      if (
        pendingMarqueeSelection &&
        event.pointerId === pendingMarqueeSelection.pointerId
      ) {
        pendingMarqueeSelection = null;
      }

      if (
        activeMarqueeSelection &&
        event.pointerId === activeMarqueeSelection.pointerId
      ) {
        activeMarqueeSelection = null;
        hideSelectionBox();
      }

      scheduleLinkContextMenuSync();
    };

    const handleWindowKeyDown = (event: KeyboardEvent): void => {
      if (reconnectState) {
        if (event.key === "Escape") {
          event.preventDefault();
          clearReconnectSession();
        }
        return;
      }

      if (isTextEditingElement(event.target)) {
        return;
      }

      if (event.code === "Space") {
        spaceKeyPressed = true;
      }

      if (event.altKey) {
        return;
      }

      if (
        event.code === "Digit1" &&
        event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        if (!isCommandShortcutEnabled({ type: "canvas.fit-view" })) {
          return;
        }

        event.preventDefault();
        fitGraphView();
        return;
      }

      if (event.key === "Delete") {
        if (event.ctrlKey || event.metaKey || event.shiftKey) {
          return;
        }

        const request: EditorCommandRequest = { type: "selection.remove" };
        if (!isCommandShortcutEnabled(request)) {
          return;
        }

        event.preventDefault();
        commandBus.execute(request);
        return;
      }

      if (!hasPrimaryCommandModifier(event) || event.repeat) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "z") {
        if (event.shiftKey) {
          if (!commandHistory.canRedo) {
            return;
          }

          event.preventDefault();
          commandHistory.redo();
          scheduleLinkContextMenuSync();
          syncEditorToolbarControls();
          return;
        }

        if (!commandHistory.canUndo) {
          return;
        }

        event.preventDefault();
        commandHistory.undo();
        scheduleLinkContextMenuSync();
        syncEditorToolbarControls();
        return;
      }

      if (key === "y") {
        if (event.shiftKey || !commandHistory.canRedo) {
          return;
        }

        event.preventDefault();
        commandHistory.redo();
        scheduleLinkContextMenuSync();
        syncEditorToolbarControls();
        return;
      }

      if (key === "c") {
        if (event.shiftKey) {
          return;
        }

        const request: EditorCommandRequest = { type: "selection.copy" };
        if (!isCommandShortcutEnabled(request)) {
          return;
        }

        event.preventDefault();
        commandBus.execute(request);
        return;
      }

      if (key === "a") {
        if (event.shiftKey) {
          return;
        }

        const request: EditorCommandRequest = {
          type: "selection.select-all",
          nodeIds: [...boundNodeIds]
        };
        if (!isCommandShortcutEnabled(request)) {
          return;
        }

        event.preventDefault();
        commandBus.execute(request);
        return;
      }

      if (key === "x") {
        if (event.shiftKey) {
          return;
        }

        const request: EditorCommandRequest = {
          type: "clipboard.cut-selection"
        };
        if (!isCommandShortcutEnabled(request)) {
          return;
        }

        event.preventDefault();
        commandBus.execute(request);
        return;
      }

      if (key === "d") {
        if (event.shiftKey) {
          return;
        }

        const request: EditorCommandRequest = { type: "selection.duplicate" };
        if (!isCommandShortcutEnabled(request)) {
          return;
        }

        event.preventDefault();
        commandBus.execute(request);
        return;
      }

      if (key === "v") {
        if (event.shiftKey) {
          return;
        }

        if (!isCommandShortcutEnabled({ type: "clipboard.paste", point: null })) {
          return;
        }

        event.preventDefault();
        pasteCopiedNodeByKeyboard();
      }
    };
    const handleWindowKeyUp = (event: KeyboardEvent): void => {
      if (event.code === "Space") {
        spaceKeyPressed = false;
      }
    };
    const handleWindowBlur = (): void => {
      spaceKeyPressed = false;
      if (reconnectState) {
        clearReconnectSession();
      }
    };

    host.addEventListener("pointerdown", handleHostPointerDown, true);
    host.addEventListener("pointermove", handleHostPointerMove, true);
    host.addEventListener("wheel", handleHostWheel, true);
    ownerWindow.addEventListener("pointermove", handleWindowPointerMove);
    ownerWindow.addEventListener("pointerup", handleWindowPointerUp);
    ownerWindow.addEventListener("pointercancel", handleWindowPointerUp);
    ownerWindow.addEventListener("keydown", handleWindowKeyDown);
    ownerWindow.addEventListener("keyup", handleWindowKeyUp);
    ownerWindow.addEventListener("blur", handleWindowBlur);

    return () => {
      disposed = true;
      if (pendingCanvasSelectionFrame) {
        ownerWindow.cancelAnimationFrame(pendingCanvasSelectionFrame);
      }
      if (pendingPointerWorldSyncFrame) {
        ownerWindow.cancelAnimationFrame(pendingPointerWorldSyncFrame);
      }
      if (pendingReconnectStartFrame) {
        ownerWindow.cancelAnimationFrame(pendingReconnectStartFrame);
      }
      if (pendingLinkMenuSyncFrame) {
        ownerWindow.cancelAnimationFrame(pendingLinkMenuSyncFrame);
      }
      host.removeEventListener("pointerdown", handleHostPointerDown, true);
      host.removeEventListener("pointermove", handleHostPointerMove, true);
      host.removeEventListener("wheel", handleHostWheel, true);
      (
        graph.app.tree as typeof graph.app.tree & GraphViewportViewEventHost
      ).off("leafer.transform", handleTreeTransform);
      ownerWindow.removeEventListener("pointermove", handleWindowPointerMove);
      ownerWindow.removeEventListener("pointerup", handleWindowPointerUp);
      ownerWindow.removeEventListener("pointercancel", handleWindowPointerUp);
      ownerWindow.removeEventListener("keydown", handleWindowKeyDown);
      ownerWindow.removeEventListener("keyup", handleWindowKeyUp);
      ownerWindow.removeEventListener("blur", handleWindowBlur);
      for (const linkId of [...boundLinkIds]) {
        unbindEditorLink(linkId);
      }
      clearReconnectSession();
      commandHistory.clear();
      disposeLocalRuntimeFeedbackSubscription();
      disposeExternalRuntimeFeedbackSubscription();
      disposeDocumentProjectionSubscription();
      disposeInteractionCommitSubscription();
      disposeSelectionSubscription();
      documentSessionBinding.dispose();
      hideSelectionBox();
      menu.destroy();
      onHostBridgeChange?.(null);
      onEditorToolbarControlsChange?.(null);
      onGraphRuntimeControlsChange?.(null);
      graphRef.current = null;
      graph.destroy();
    };
  }, [
    createDocumentSessionBinding,
    documentData,
    modules,
    onEditorToolbarControlsChange,
    onGraphRuntimeControlsChange,
    onHostBridgeChange,
    plugins,
    quickCreateNodeType,
    runtimeFeedbackInlet
  ]);

  const runtimeChainGroups = groupRuntimeHistoryEntries(runtimeHistoryEntries);
  const runtimeFailureGroups = groupRuntimeFailureEntries(runtimeHistoryEntries);
  const activeRuntimeChainGroup = runtimeChainGroups[0] ?? null;
  const activeRuntimeChainLatestEntry = activeRuntimeChainGroup?.latestEntry ?? null;
  const primaryInspectorStatus =
    graphExecutionState.status !== "idle"
      ? graphExecutionState.status
      : activeRuntimeChainGroup?.status ??
        runtimeInspectorState.executionState?.status ??
        "idle";
  const primaryInspectorStatusLabel =
    graphExecutionState.status !== "idle"
      ? formatGraphExecutionStatusLabel(graphExecutionState.status)
      : formatRuntimeStatusLabel(
          activeRuntimeChainGroup?.status ??
            runtimeInspectorState.executionState?.status ??
            "idle"
        );
  const runtimePanelLead =
    graphExecutionState.status !== "idle"
      ? "当前正在跟随图级运行状态，可同时检查最新执行链和焦点节点快照。"
      : activeRuntimeChainGroup
        ? "当前默认展开最近一次执行链，右侧已按“运行概览 / 执行链 / 失败聚合 / 节点快照”收敛。"
        : runtimeInspectorState.focusNodeId
          ? "当前没有活动运行，面板会继续保留焦点节点快照与最近命令信息。"
          : "当前还没有执行记录，先点击顶栏 Play / Step，或从节点菜单里直接起跑一个节点。";
  const runtimeOverviewLatestRoot =
    activeRuntimeChainGroup?.rootNodeTitle ?? "无";
  const runtimeOverviewLatestDuration = activeRuntimeChainGroup
    ? formatExecutionDuration(
        activeRuntimeChainGroup.startedAt,
        activeRuntimeChainGroup.finishedAt
      )
    : "0 ms";
  const runtimePanelErrorMessage =
    activeRuntimeChainLatestEntry?.errorMessage ??
    runtimeInspectorState.executionState?.lastErrorMessage ??
    null;
  const nodeLayout = nodeInspectorState?.layout;
  const nodeFlags = nodeInspectorState?.flags;
  const nodeProperties = nodeInspectorState?.properties;
  const nodeData = nodeInspectorState?.data;

  return (
    <div class="graph-viewport">
      <div class="graph-viewport__stage">
        <div ref={hostRef} class="graph-root" />
        <div
          ref={selectionBoxRef}
          class="graph-selection-box"
          data-visible="false"
          aria-hidden="true"
        />
      </div>
      <aside
        class="graph-runtime-panel"
        data-status={primaryInspectorStatus}
        aria-live="polite"
      >
        <p class="graph-runtime-panel__eyebrow">Execution Inspector</p>
        <div class="graph-runtime-panel__header">
          <div>
            <h3>执行检查面板</h3>
            <p>{runtimePanelLead}</p>
          </div>
          <span class="graph-runtime-panel__status" data-status={primaryInspectorStatus}>
            {primaryInspectorStatusLabel}
          </span>
        </div>

        <section class="graph-runtime-panel__section">
          <div class="graph-runtime-panel__section-header">
            <h4>运行概览</h4>
            <span>图级与焦点摘要</span>
          </div>
          <div class="graph-runtime-panel__summary-grid">
            <article class="graph-runtime-panel__summary-card">
              <p class="graph-runtime-panel__summary-label">图级状态</p>
              <strong class="graph-runtime-panel__summary-value">
                {formatGraphExecutionStatusLabel(graphExecutionState.status)}
              </strong>
              <p class="graph-runtime-panel__summary-meta">
                {graphExecutionState.runId
                  ? `Run ${graphExecutionState.runId}`
                  : "等待新的图级运行"}
              </p>
            </article>
            <article class="graph-runtime-panel__summary-card">
              <p class="graph-runtime-panel__summary-label">焦点节点</p>
              <strong class="graph-runtime-panel__summary-value">
                {runtimeInspectorState.focusNodeTitle ?? "未命中"}
              </strong>
              <p class="graph-runtime-panel__summary-meta">
                {formatRuntimeFocusModeLabel(runtimeInspectorState.focusMode)} ·{" "}
                {runtimeInspectorState.selectionCount || 0} 个节点
              </p>
            </article>
            <article class="graph-runtime-panel__summary-card">
              <p class="graph-runtime-panel__summary-label">最近检查链</p>
              <strong class="graph-runtime-panel__summary-value">
                {runtimeOverviewLatestRoot}
              </strong>
              <p class="graph-runtime-panel__summary-meta">
                {activeRuntimeChainGroup
                  ? `${runtimeOverviewLatestDuration} · ${activeRuntimeChainGroup.stepCount} 步`
                  : "当前还没有执行批次"}
              </p>
            </article>
            <article class="graph-runtime-panel__summary-card">
              <p class="graph-runtime-panel__summary-label">失败聚合</p>
              <strong class="graph-runtime-panel__summary-value">
                {runtimeFailureGroups.length} 个节点
              </strong>
              <p class="graph-runtime-panel__summary-meta">
                保留最近 {MAX_RUNTIME_FAILURE_ENTRIES} 个失败节点聚合
              </p>
            </article>
          </div>
          <dl class="graph-runtime-panel__info">
            <div>
              <dt>当前 Run ID</dt>
              <dd>{graphExecutionState.runId ?? "无"}</dd>
            </div>
            <div>
              <dt>队列长度</dt>
              <dd>{graphExecutionState.queueSize}</dd>
            </div>
            <div>
              <dt>已推进步数</dt>
              <dd>{graphExecutionState.stepCount}</dd>
            </div>
            <div>
              <dt>最近启动来源</dt>
              <dd>
                {graphExecutionState.lastSource
                  ? formatRuntimeSourceLabel(graphExecutionState.lastSource)
                  : "无"}
              </dd>
            </div>
            <div>
              <dt>最近命令</dt>
              <dd>{runtimeInspectorState.lastCommandSummary ?? "无"}</dd>
            </div>
            <div>
              <dt>命令时间</dt>
              <dd>{formatExecutionTimestamp(runtimeInspectorState.lastCommandTimestamp)}</dd>
            </div>
            <div>
              <dt>最近成功</dt>
              <dd>
                {formatExecutionTimestamp(
                  runtimeInspectorState.executionState?.lastSucceededAt ?? null
                )}
              </dd>
            </div>
            <div>
              <dt>最近失败</dt>
              <dd>
                {formatExecutionTimestamp(
                  runtimeInspectorState.executionState?.lastFailedAt ?? null
                )}
              </dd>
            </div>
          </dl>
        </section>

        {runtimePanelErrorMessage ? (
          <p class="graph-runtime-panel__error">{runtimePanelErrorMessage}</p>
        ) : (
          <p class="graph-runtime-panel__hint">
            右侧已经按“运行概览 / 当前检查链 / 失败聚合 / 节点快照”收敛，选中节点后会继续显示 properties、内部数据和 IO 值。
          </p>
        )}

        <section class="graph-runtime-panel__section">
          <div class="graph-runtime-panel__section-header">
            <h4>当前检查链</h4>
            <span>{activeRuntimeChainGroup ? activeRuntimeChainGroup.chainId : "未命中"}</span>
          </div>
          {activeRuntimeChainGroup ? (
            <>
              <dl class="graph-runtime-panel__info">
                <div>
                  <dt>根节点</dt>
                  <dd>{activeRuntimeChainGroup.rootNodeTitle}</dd>
                </div>
                <div>
                  <dt>根类型</dt>
                  <dd>{activeRuntimeChainGroup.rootNodeType ?? "未知类型"}</dd>
                </div>
                <div>
                  <dt>来源</dt>
                  <dd>{formatRuntimeSourceLabel(activeRuntimeChainGroup.source)}</dd>
                </div>
                <div>
                  <dt>状态</dt>
                  <dd>{formatRuntimeStatusLabel(activeRuntimeChainGroup.status)}</dd>
                </div>
                <div>
                  <dt>最深层级</dt>
                  <dd>{activeRuntimeChainGroup.maxDepth}</dd>
                </div>
                <div>
                  <dt>命中步数</dt>
                  <dd>{activeRuntimeChainGroup.stepCount}</dd>
                </div>
                <div>
                  <dt>持续时间</dt>
                  <dd>
                    {formatExecutionDuration(
                      activeRuntimeChainGroup.startedAt,
                      activeRuntimeChainGroup.finishedAt
                    )}
                  </dd>
                </div>
                <div>
                  <dt>最近时间</dt>
                  <dd>{formatExecutionTimestamp(activeRuntimeChainGroup.finishedAt)}</dd>
                </div>
                <div>
                  <dt>主动执行</dt>
                  <dd>{activeRuntimeChainGroup.directCount} 次</dd>
                </div>
                <div>
                  <dt>传播命中</dt>
                  <dd>{activeRuntimeChainGroup.propagatedCount} 次</dd>
                </div>
                <div>
                  <dt>成功 / 失败</dt>
                  <dd>
                    {activeRuntimeChainGroup.successCount} / {activeRuntimeChainGroup.errorCount}
                  </dd>
                </div>
                <div>
                  <dt>最新节点</dt>
                  <dd>{activeRuntimeChainLatestEntry?.nodeTitle ?? "无"}</dd>
                </div>
              </dl>
              {activeRuntimeChainLatestEntry ? (
                activeRuntimeChainLatestEntry.errorMessage ? (
                  <p class="graph-runtime-panel__timeline-error">
                    {activeRuntimeChainLatestEntry.errorMessage}
                  </p>
                ) : (
                  <p class="graph-runtime-panel__timeline-summary">
                    {activeRuntimeChainLatestEntry.summary}
                  </p>
                )
              ) : null}
              <ul class="graph-runtime-panel__chain-steps">
                {activeRuntimeChainGroup.entries.map((entry) => (
                  <li
                    class="graph-runtime-panel__chain-step"
                    key={`${activeRuntimeChainGroup.chainId}:${entry.sequence}:${entry.nodeId}`}
                  >
                    <div class="graph-runtime-panel__timeline-row">
                      <strong class="graph-runtime-panel__timeline-node">
                        {entry.sequence + 1}. {entry.nodeTitle}
                      </strong>
                      <span
                        class="graph-runtime-panel__status graph-runtime-panel__status--small"
                        data-status={entry.status}
                      >
                        {formatRuntimeStatusLabel(entry.status)}
                      </span>
                    </div>
                    <p class="graph-runtime-panel__timeline-meta">
                      depth {entry.depth} · {formatRuntimeSourceLabel(entry.source)} ·{" "}
                      {formatRuntimeTriggerLabel(entry.trigger)} ·{" "}
                      {formatExecutionTimestamp(entry.timestamp)} · 第 {entry.runCount} 次
                    </p>
                    {entry.errorMessage ? (
                      <p class="graph-runtime-panel__timeline-error">
                        {entry.errorMessage}
                      </p>
                    ) : (
                      <p class="graph-runtime-panel__timeline-summary">
                        {entry.summary}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p class="graph-runtime-panel__hint">
              当前还没有执行链，先点击顶栏 Play / Step，或从节点菜单里直接起跑一个节点。
            </p>
          )}
        </section>

        <section class="graph-runtime-panel__section">
          <div class="graph-runtime-panel__section-header">
            <h4>最近执行批次</h4>
            <span>保留最近 {MAX_RUNTIME_CHAIN_GROUPS} 组</span>
          </div>
          {runtimeChainGroups.length ? (
            <ul class="graph-runtime-panel__chain-list">
              {runtimeChainGroups.map((chain) => (
                <li class="graph-runtime-panel__chain-item" key={chain.chainId}>
                  <div class="graph-runtime-panel__chain-header">
                    <div>
                      <strong class="graph-runtime-panel__timeline-node">
                        {chain.rootNodeTitle}
                      </strong>
                      <p class="graph-runtime-panel__timeline-meta">
                        {chain.rootNodeType ?? "未知类型"} ·{" "}
                        {formatExecutionTimestamp(chain.finishedAt)}
                      </p>
                    </div>
                    <span
                      class="graph-runtime-panel__status graph-runtime-panel__status--small"
                      data-status={chain.status}
                    >
                      {formatRuntimeStatusLabel(chain.status)}
                    </span>
                  </div>
                  <p class="graph-runtime-panel__chain-summary">
                    {formatRuntimeSourceLabel(chain.source)} · {chain.stepCount} 步 · 最深{" "}
                    {chain.maxDepth} 层 · 主动 {chain.directCount} 次 · 传播{" "}
                    {chain.propagatedCount} 次 ·{" "}
                    {formatExecutionDuration(chain.startedAt, chain.finishedAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p class="graph-runtime-panel__hint">
              当前还没有执行批次，先用图级 Play / Step，或从某个节点开始运行一条链。
            </p>
          )}
        </section>

        <section class="graph-runtime-panel__section">
          <div class="graph-runtime-panel__section-header">
            <h4>失败聚合</h4>
            <span>{runtimeFailureGroups.length} 个节点</span>
          </div>
          {runtimeFailureGroups.length ? (
            <ul class="graph-runtime-panel__timeline">
              {runtimeFailureGroups.map((entry) => (
                <li
                  class="graph-runtime-panel__timeline-item"
                  key={`${entry.nodeId}:failure-group`}
                >
                  <div class="graph-runtime-panel__timeline-row">
                    <strong class="graph-runtime-panel__timeline-node">
                      {entry.nodeTitle}
                    </strong>
                    <span
                      class="graph-runtime-panel__status graph-runtime-panel__status--small"
                      data-status="error"
                    >
                      失败
                    </span>
                  </div>
                  <p class="graph-runtime-panel__timeline-meta">
                    {entry.nodeType ?? "未知类型"} ·{" "}
                    {formatRuntimeSourceLabel(entry.latestSource)} ·{" "}
                    {formatRuntimeTriggerLabel(entry.latestTrigger)} ·{" "}
                    {formatExecutionTimestamp(entry.latestTimestamp)}
                  </p>
                  <p class="graph-runtime-panel__timeline-summary">
                    累计失败 {entry.failureCount} 次
                  </p>
                  {entry.latestErrorMessage ? (
                    <p class="graph-runtime-panel__timeline-error">
                      {entry.latestErrorMessage}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p class="graph-runtime-panel__hint">当前没有失败聚合记录。</p>
          )}
        </section>

        <section class="graph-runtime-panel__section">
          <div class="graph-runtime-panel__section-header">
            <h4>焦点节点快照</h4>
            <span>{formatRuntimeFocusModeLabel(runtimeInspectorState.focusMode)}</span>
          </div>
          {nodeInspectorState ? (
            <dl class="graph-runtime-panel__info">
              <div>
                <dt>ID</dt>
                <dd>{nodeInspectorState.id}</dd>
              </div>
              <div>
                <dt>标题</dt>
                <dd>{nodeInspectorState.title}</dd>
              </div>
              <div>
                <dt>类型</dt>
                <dd>{nodeInspectorState.type}</dd>
              </div>
              <div>
                <dt>选区</dt>
                <dd>{runtimeInspectorState.selectionCount || 0} 个节点</dd>
              </div>
              <div>
                <dt>焦点来源</dt>
                <dd>{formatRuntimeFocusModeLabel(runtimeInspectorState.focusMode)}</dd>
              </div>
              <div>
                <dt>位置</dt>
                <dd>
                  {nodeLayout ? `${nodeLayout.x}, ${nodeLayout.y}` : "无"}
                </dd>
              </div>
              <div>
                <dt>尺寸</dt>
                <dd>
                  {nodeLayout
                    ? `${nodeLayout.width ?? "auto"} × ${nodeLayout.height ?? "auto"}`
                    : "无"}
                </dd>
              </div>
              <div>
                <dt>Flags</dt>
                <dd>{nodeFlags ? formatInspectorValue(nodeFlags) : "{}"}</dd>
              </div>
              <div>
                <dt>执行次数</dt>
                <dd>{nodeInspectorState.executionState.runCount}</dd>
              </div>
              <div>
                <dt>最近成功</dt>
                <dd>
                  {formatExecutionTimestamp(
                    nodeInspectorState.executionState.lastSucceededAt ?? null
                  )}
                </dd>
              </div>
              <div>
                <dt>最近失败</dt>
                <dd>
                  {formatExecutionTimestamp(
                    nodeInspectorState.executionState.lastFailedAt ?? null
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p class="graph-runtime-panel__hint">
              当前还没有焦点节点，先选中一个节点，或用顶栏 Play / Step，或从节点菜单里直接起跑。
            </p>
          )}
        </section>

        <section class="graph-runtime-panel__section">
          <div class="graph-runtime-panel__section-header">
            <h4>Properties</h4>
            <span>
              {nodeProperties ? Object.keys(nodeProperties).length : 0} 项
            </span>
          </div>
          {nodeInspectorState && hasOwnEntries(nodeProperties) ? (
            <dl class="graph-runtime-panel__kv">
              {Object.entries(nodeProperties ?? {}).map(([key, value]) => (
                <div class="graph-runtime-panel__kv-item" key={key}>
                  <dt>{key}</dt>
                  <dd>
                    <pre class="graph-runtime-panel__value-block">
                      {formatInspectorValue(value)}
                    </pre>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p class="graph-runtime-panel__hint">当前节点没有 properties。</p>
          )}
        </section>

        <section class="graph-runtime-panel__section">
          <div class="graph-runtime-panel__section-header">
            <h4>内部数据</h4>
            <span>{nodeData ? Object.keys(nodeData).length : 0} 项</span>
          </div>
          {nodeInspectorState && hasOwnEntries(nodeData) ? (
            <dl class="graph-runtime-panel__kv">
              {Object.entries(nodeData ?? {}).map(([key, value]) => (
                <div class="graph-runtime-panel__kv-item" key={key}>
                  <dt>{key}</dt>
                  <dd>
                    <pre class="graph-runtime-panel__value-block">
                      {formatInspectorValue(value)}
                    </pre>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p class="graph-runtime-panel__hint">当前节点没有内部 data。</p>
          )}
        </section>

        <section class="graph-runtime-panel__section">
          <div class="graph-runtime-panel__section-header">
            <h4>输入值</h4>
            <span>{nodeInspectorState?.inputs.length ?? 0} 个槽位</span>
          </div>
          {nodeInspectorState?.inputs.length ? (
            <ul class="graph-runtime-panel__io-list">
              {nodeInspectorState.inputs.map((entry) => (
                <li class="graph-runtime-panel__io-item" key={`input:${entry.slot}`}>
                  <div class="graph-runtime-panel__timeline-row">
                    <strong class="graph-runtime-panel__timeline-node">
                      {entry.label ?? entry.name}
                    </strong>
                    <span class="graph-runtime-panel__io-badge">
                      in #{entry.slot} · {formatSlotTypeLabel(entry.type)}
                    </span>
                  </div>
                  <pre class="graph-runtime-panel__value-block">
                    {formatInspectorValue(entry.value)}
                  </pre>
                </li>
              ))}
            </ul>
          ) : (
            <p class="graph-runtime-panel__hint">当前节点没有输入槽位。</p>
          )}
        </section>

        <section class="graph-runtime-panel__section">
          <div class="graph-runtime-panel__section-header">
            <h4>输出值</h4>
            <span>{nodeInspectorState?.outputs.length ?? 0} 个槽位</span>
          </div>
          {nodeInspectorState?.outputs.length ? (
            <ul class="graph-runtime-panel__io-list">
              {nodeInspectorState.outputs.map((entry) => (
                <li class="graph-runtime-panel__io-item" key={`output:${entry.slot}`}>
                  <div class="graph-runtime-panel__timeline-row">
                    <strong class="graph-runtime-panel__timeline-node">
                      {entry.label ?? entry.name}
                    </strong>
                    <span class="graph-runtime-panel__io-badge">
                      out #{entry.slot} · {formatSlotTypeLabel(entry.type)}
                    </span>
                  </div>
                  <pre class="graph-runtime-panel__value-block">
                    {formatInspectorValue(entry.value)}
                  </pre>
                </li>
              ))}
            </ul>
          ) : (
            <p class="graph-runtime-panel__hint">当前节点没有输出槽位。</p>
          )}
        </section>
      </aside>
    </div>
  );
}
