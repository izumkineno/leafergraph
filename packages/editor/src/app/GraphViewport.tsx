import { useEffect, useRef, useState } from "preact/hooks";

import {
  createLeaferGraph,
  createLeaferGraphContextMenu,
  type LeaferGraphConnectionPortState,
  type LeaferGraph,
  type LeaferGraphContextMenuBindingTarget,
  type LeaferGraphData,
  type LeaferGraphContextMenuContext,
  type LeaferGraphContextMenuItem,
  type LeaferGraphContextMenuManager,
  type LeaferGraphLinkData,
  type LeaferGraphNodeExecutionEvent,
  type LeaferGraphNodeInspectorState,
  type LeaferGraphNodeStateChangeEvent,
  type LeaferGraphOptions
} from "leafergraph";
import {
  createEditorCommandBus,
  type EditorCommandBus,
  type EditorCommandExecution
} from "../commands/command_bus";
import {
  createEditorCommandHistory,
  type EditorCommandHistory
} from "../commands/command_history";
import { createEditorNodeSelection } from "../state/selection";
import {
  GRAPH_VIEWPORT_BACKGROUND_SIZE,
  resolveGraphViewportBackground,
  type EditorTheme
} from "../theme";

interface GraphViewportProps {
  graph: LeaferGraphData;
  modules?: LeaferGraphOptions["modules"];
  plugins?: LeaferGraphOptions["plugins"];
  quickCreateNodeType?: string;
  theme: EditorTheme;
}

type GraphViewportNodeExecutionSnapshot = NonNullable<
  ReturnType<LeaferGraph["getNodeExecutionState"]>
>;

type GraphViewportRuntimeHistoryStatus =
  | GraphViewportNodeExecutionSnapshot["status"]
  | "skipped";

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
  status: GraphViewportRuntimeHistoryStatus;
  startedAt: number;
  finishedAt: number;
  stepCount: number;
  maxDepth: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  entries: GraphViewportRuntimeHistoryEntry[];
}

const MAX_RUNTIME_HISTORY_ENTRIES = 8;
const MAX_RUNTIME_CHAIN_GROUPS = 4;
const MAX_RUNTIME_FAILURE_ENTRIES = 4;

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
    lastExecution?.request.type === "node.execute"
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

function formatRuntimeTriggerLabel(
  trigger: LeaferGraphNodeExecutionEvent["trigger"]
): string {
  return trigger === "propagated" ? "链路传播" : "主动执行";
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
  status: GraphViewportRuntimeHistoryStatus,
  trigger: LeaferGraphNodeExecutionEvent["trigger"],
  errorMessage: string | null
): string {
  switch (status) {
    case "running":
      return `${formatRuntimeTriggerLabel(trigger)}开始，节点已进入执行中。`;
    case "success":
      return `${formatRuntimeTriggerLabel(trigger)}成功，当前结果已经写回运行时。`;
    case "error":
      return errorMessage
        ? `${formatRuntimeTriggerLabel(trigger)}失败：${errorMessage}`
        : `${formatRuntimeTriggerLabel(trigger)}失败，请查看控制台日志。`;
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
    trigger: event.trigger,
    summary: resolveRuntimeHistorySummary(
      event.state.status,
      event.trigger,
      event.state.lastErrorMessage ?? null
    ),
    timestamp: event.timestamp,
    runCount: event.state.runCount,
    errorMessage: event.state.lastErrorMessage ?? null
  };
}

function createSkippedRuntimeHistoryEntry(
  graph: LeaferGraph,
  nodeId: string,
  timestamp: number
): GraphViewportRuntimeHistoryEntry {
  const snapshot = graph.getNodeSnapshot(nodeId);
  const rootNodeTitle = snapshot?.title ?? nodeId;
  const rootNodeType = snapshot?.type ?? null;

  return {
    id: `${timestamp}:${nodeId}:skipped`,
    chainId: `skipped:${timestamp}:${nodeId}`,
    rootNodeId: nodeId,
    rootNodeTitle,
    rootNodeType,
    nodeId,
    nodeTitle: rootNodeTitle,
    nodeType: rootNodeType,
    depth: 0,
    sequence: 0,
    status: "skipped",
    trigger: "direct",
    summary: resolveRuntimeHistorySummary("skipped", "direct", null),
    timestamp,
    runCount: graph.getNodeExecutionState(nodeId)?.runCount ?? 0,
    errorMessage: null
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
        status: entry.status,
        startedAt: entry.timestamp,
        finishedAt: entry.timestamp,
        stepCount: 0,
        maxDepth: entry.depth,
        successCount: 0,
        errorCount: 0,
        skippedCount: 0,
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

    if (entry.status === "success") {
      chain.successCount += 1;
    } else if (entry.status === "error") {
      chain.errorCount += 1;
    } else if (entry.status === "skipped") {
      chain.skippedCount += 1;
    }
  }

  for (const chain of orderedChains) {
    chain.entries.sort(
      (left, right) =>
        left.sequence - right.sequence || left.timestamp - right.timestamp
    );
    chain.status = resolveRuntimeChainStatus(chain.entries);
  }

  return orderedChains.slice(0, MAX_RUNTIME_CHAIN_GROUPS);
}

/**
 * editor 当前关心的节点按下事件最小子集。
 * 这里只读取修饰键，不直接依赖 Leafer 完整事件类型，避免把 editor 绑死到具体实现细节。
 */
interface EditorNodePointerDownEvent {
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  left?: boolean;
  right?: boolean;
  origin?: {
    button?: number;
  };
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
 * 节点菜单挂载元信息。
 * editor 当前还没有完整选区和命令系统，因此先把节点级菜单真正需要的最小信息集中到这里。
 */
interface GraphViewportNodeMenuBindingMeta extends Record<string, unknown> {
  nodeId: string;
  nodeTitle: string;
  nodeType?: string;
}

/** 连线菜单挂载元信息。 */
interface GraphViewportLinkMenuBindingMeta extends Record<string, unknown> {
  entity: "link";
  linkId: string;
  sourceNodeId: string;
  sourceSlot: number;
  targetNodeId: string;
  targetSlot: number;
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

/**
 * 为节点级菜单生成挂载 key。
 * 统一 key 规则后，新建、删除和未来的重绑逻辑都可以共用一条路径。
 */
function createNodeMenuBindingKey(nodeId: string): string {
  return `node:${nodeId}`;
}

/** 为连线级菜单生成挂载 key。 */
function createLinkMenuBindingKey(linkId: string): string {
  return `link:${linkId}`;
}

/** 规范化节点菜单挂载元信息。 */
function createNodeMenuBindingMeta(node: {
  id: string;
  title: string;
  type?: string;
}): GraphViewportNodeMenuBindingMeta {
  return {
    nodeId: node.id,
    nodeTitle: node.title,
    nodeType: node.type
  };
}

/** 规范化连线菜单挂载元信息。 */
function createLinkMenuBindingMeta(
  link: LeaferGraphLinkData
): GraphViewportLinkMenuBindingMeta {
  return {
    entity: "link",
    linkId: link.id,
    sourceNodeId: link.source.nodeId,
    sourceSlot: link.source.slot ?? 0,
    targetNodeId: link.target.nodeId,
    targetSlot: link.target.slot ?? 0
  };
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

/**
 * 绑定或刷新单个节点的右键菜单。
 * 这里显式先解绑再绑定，避免后续节点视图被替换时菜单仍然挂在旧图元上。
 */
function bindNodeContextMenu(
  graph: LeaferGraph,
  menu: LeaferGraphContextMenuManager,
  onSelectNode: (nodeId: string, event?: EditorNodePointerDownEvent) => void,
  node: {
    id: string;
    title: string;
    type?: string;
  }
): void {
  const key = createNodeMenuBindingKey(node.id);
  const view = graph.getNodeView(node.id);
  if (!view) {
    return;
  }

  view.on("pointer.down", (event: EditorNodePointerDownEvent) => {
    onSelectNode(node.id, event);
  });
  menu.unbindTarget(key);
  menu.bindNode(key, view, createNodeMenuBindingMeta(node));
}

/** 绑定或刷新单条连线的右键菜单。 */
function bindLinkContextMenu(
  graph: LeaferGraph,
  menu: LeaferGraphContextMenuManager,
  link: LeaferGraphLinkData
): void {
  const key = createLinkMenuBindingKey(link.id);
  const view = graph.getLinkView(link.id);
  if (!view) {
    return;
  }

  menu.unbindTarget(key);
  menu.bindTarget({
    key,
    kind: "custom",
    target: view as LeaferGraphContextMenuBindingTarget,
    meta: createLinkMenuBindingMeta(link)
  });
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
  graph: graphData,
  modules,
  plugins,
  quickCreateNodeType,
  theme
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

    const graph = createLeaferGraph(host, {
      graph: graphData,
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
    });
    const disposeNodeExecutionSubscription = graph.subscribeNodeExecution(
      (event) => {
        latestRuntimeExecution = event;
        setRuntimeHistoryEntries((entries) =>
          appendRuntimeHistoryEntry(entries, createRuntimeHistoryEntryFromEvent(event))
        );
        syncInfoPanelState();
      }
    );
    const disposeNodeStateSubscription = graph.subscribeNodeState((event) => {
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
    });
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
    const removeNodeFromMenu = (nodeId: string): void => {
      if (selection.hasMultipleSelected() && selection.isSelected(nodeId)) {
        commandBus.execute({ type: "selection.remove" });
        return;
      }

      commandBus.execute({ type: "node.remove", nodeId });
    };
    const removeLinkFromMenu = (linkId: string): void => {
      if (!graphReady) {
        return;
      }

      commandBus.execute({ type: "link.remove", linkId });
      scheduleLinkContextMenuSync();
    };
    const pasteCopiedNodeAtLatestPointer = (): void => {
      const pointerPagePoint = resolveLatestPointerPagePoint();
      commandBus.execute({
        type: "clipboard.paste",
        point: pointerPagePoint
      });
    };
    const pasteCopiedNodeByKeyboard = (): void => {
      if (
        !graphReady ||
        !commandBus.canExecute({ type: "clipboard.paste", point: null })
      ) {
        return;
      }

      runAfterViewportSettle(() => {
        if (
          !graphReady ||
          !commandBus.canExecute({ type: "clipboard.paste", point: null })
        ) {
          return;
        }

        pasteCopiedNodeAtLatestPointer();
      });
    };
    const createNodeFromMenu = (
      context: LeaferGraphContextMenuContext
    ): void => {
      if (!graphReady) {
        return;
      }

      commandBus.execute({ type: "canvas.create-node", context });
    };
    const copyNodeFromMenu = (nodeId: string): void => {
      if (selection.hasMultipleSelected() && selection.isSelected(nodeId)) {
        commandBus.execute({ type: "selection.copy" });
        return;
      }

      commandBus.execute({ type: "clipboard.copy-node", nodeId });
    };
    const cutNodeFromMenu = (nodeId: string): void => {
      if (selection.hasMultipleSelected() && selection.isSelected(nodeId)) {
        commandBus.execute({ type: "clipboard.cut-selection" });
        return;
      }

      selection.select(nodeId);
      commandBus.execute({ type: "clipboard.cut-selection" });
    };
    const pasteCopiedNodeFromMenu = (
      context: LeaferGraphContextMenuContext
    ): void => {
      if (
        !graphReady ||
        !commandBus.canExecute({ type: "clipboard.paste", point: null })
      ) {
        return;
      }

      commandBus.execute({
        type: "clipboard.paste",
        point: context.pagePoint
      });
    };
    const duplicateNodeFromMenu = (
      nodeId: string,
      _context: LeaferGraphContextMenuContext
    ): void => {
      if (!graphReady) {
        return;
      }

      const snapshot = graph.getNodeSnapshot(nodeId);
      if (!snapshot) {
        return;
      }

      const baseX = snapshot.layout.x;
      const baseY = snapshot.layout.y;
      if (selection.hasMultipleSelected() && selection.isSelected(nodeId)) {
        commandBus.execute({ type: "selection.duplicate" });
        return;
      }

      commandBus.execute({
        type: "node.duplicate",
        nodeId,
        x: baseX + 48,
        y: baseY + 48
      });
    };
    const resetNodeSizeFromMenu = (nodeId: string): void => {
      if (!graphReady) {
        return;
      }

      commandBus.execute({ type: "node.reset-size", nodeId });
    };
    const executeNodeFromMenu = (nodeId: string): void => {
      if (!graphReady) {
        return;
      }

      commandBus.execute({ type: "node.execute", nodeId });
    };
    const resolveExecuteNodeDescription = (nodeId: string): string => {
      const executionState = graph.getNodeExecutionState(nodeId);

      if (!executionState || executionState.status === "idle") {
        return "调用当前节点的 onExecute(...)；若节点未实现执行钩子则不会产生运行结果";
      }

      if (executionState.status === "running") {
        return `节点正在执行中，当前累计执行 ${executionState.runCount} 次`;
      }

      if (executionState.status === "success") {
        return `最近一次执行成功，当前累计执行 ${executionState.runCount} 次`;
      }

      return executionState.lastErrorMessage
        ? `最近一次执行失败：${executionState.lastErrorMessage}`
        : "最近一次执行失败，请查看节点信号灯或控制台日志";
    };
    /**
     * 使用主包已经接入的 `@leafer-in/view` 能力执行适配视图。
     * 当前 editor 先只透传最小命令，不在这一层重复计算包围盒。
     */
    const fitGraphView = (): void => {
      if (!graphReady) {
        return;
      }

      commandBus.execute({ type: "canvas.fit-view" });
    };
    const resolveContextMenuItems = (
      context: LeaferGraphContextMenuContext
    ): LeaferGraphContextMenuItem[] => {
      if (context.bindingKind === "node") {
        const nodeId = String(context.bindingMeta?.nodeId ?? context.bindingKey);
        const nodeTitle = String(context.bindingMeta?.nodeTitle ?? nodeId);
        const isSelected = selection.isSelected(nodeId);
        const isMultipleSelected = selection.hasMultipleSelected();
        const selectedCount = selection.selectedNodeIds.length;
        const isCopiedSource = commandBus.isClipboardSourceNode(nodeId);
        const resizeMenuState = commandBus.resolveResizeState(nodeId);
        const useBatchAction = isSelected && isMultipleSelected;

        return [
          {
            key: "copy-node",
            label: useBatchAction ? `复制所选 ${selectedCount} 个节点` : `复制 ${nodeTitle}`,
            shortcut: "Ctrl+C",
            description: useBatchAction
              ? "把当前多选节点整体写入剪贴板，并保留相对布局"
              : isCopiedSource
              ? "当前节点已经在剪贴板中，再次复制会刷新快照"
              : "保存当前节点快照，供画布菜单粘贴使用",
            onSelect() {
              copyNodeFromMenu(nodeId);
            }
          },
          {
            key: "cut-node",
            label: useBatchAction ? `剪切所选 ${selectedCount} 个节点` : `剪切 ${nodeTitle}`,
            shortcut: "Ctrl+X",
            description: useBatchAction
              ? "把当前多选节点写入剪贴板后，从画布中批量移除"
              : "把当前节点写入剪贴板后，从画布中移除",
            onSelect() {
              cutNodeFromMenu(nodeId);
            }
          },
          {
            key: "duplicate-node",
            label: useBatchAction ? "复制并粘贴选区" : "复制并粘贴",
            shortcut: "Ctrl+D",
            description: useBatchAction
              ? "按当前多选节点的相对布局创建一组偏移副本"
              : "基于当前节点快照创建一个偏移副本",
            onSelect() {
              duplicateNodeFromMenu(nodeId, context);
            }
          },
          {
            key: "execute-node",
            label: "执行节点",
            description: resolveExecuteNodeDescription(nodeId),
            disabled: !graphReady || !commandBus.canExecute({ type: "node.execute", nodeId }),
            onSelect() {
              executeNodeFromMenu(nodeId);
            }
          },
          {
            key: "reset-node-size",
            label: "重置节点尺寸",
            description: resizeMenuState.description,
            disabled: resizeMenuState.disabled,
            onSelect() {
              resetNodeSizeFromMenu(nodeId);
            }
          },
          { kind: "separator", key: "node-divider" },
          {
            key: "remove-node",
            label: useBatchAction ? `删除所选 ${selectedCount} 个节点` : "删除节点",
            shortcut: "Delete",
            description:
              (isSelected && isMultipleSelected) || isCopiedSource
                ? "删除时会同步更新当前多选态和复制态"
                : isSelected
                  ? "删除时会同步清理当前节点的选中态和复制态"
                  : "已接入主包 removeNode(...)",
            danger: true,
            onSelect() {
              removeNodeFromMenu(nodeId);
            }
          }
        ];
      }

      if (
        context.bindingKind === "custom" &&
        context.bindingMeta?.entity === "link"
      ) {
        const linkId = String(context.bindingMeta.linkId ?? context.bindingKey);
        const sourceNodeId = String(context.bindingMeta.sourceNodeId ?? "");
        const sourceSlot = Number(context.bindingMeta.sourceSlot ?? 0);
        const targetNodeId = String(context.bindingMeta.targetNodeId ?? "");
        const targetSlot = Number(context.bindingMeta.targetSlot ?? 0);

        return [
          {
            key: "remove-link",
            label: "删除连线",
            shortcut: "Delete",
            description: `断开 ${sourceNodeId}[${sourceSlot}] -> ${targetNodeId}[${targetSlot}]`,
            disabled:
              !graphReady || !commandBus.canExecute({ type: "link.remove", linkId }),
            danger: true,
            onSelect() {
              removeLinkFromMenu(linkId);
            }
          },
          {
            key: "reconnect-link",
            label: "重新连接",
            description: "从当前输出端口重新选择目标输入端口，按 Esc 可取消",
            disabled: !graphReady || !graph.getLink(linkId),
            onSelect() {
              startReconnectSession(linkId);
            }
          }
        ];
      }

      const createNodeState = commandBus.resolveCreateNodeState();
      const items: LeaferGraphContextMenuItem[] = [
        {
          key: "create-node-here",
          label: "在这里创建节点",
          description: graphReady
            ? createNodeState.description
            : "图初始化完成后可用",
          disabled: !graphReady || createNodeState.disabled,
          onSelect() {
            createNodeFromMenu(context);
          }
        },
        {
          key: "fit-view",
          label: "适配视图",
          shortcut: "Shift+1",
          description: graphReady
            ? "已接入 @leafer-in/view 的 fitView()"
            : "图初始化完成后可用",
          disabled: !graphReady,
          onSelect() {
            fitGraphView();
          }
        }
      ];

      if (commandBus.canExecute({ type: "clipboard.paste", point: null })) {
        const selectedNodeId = selection.primarySelectedNodeId;
        items.splice(1, 0, {
          key: "paste-copied-node",
          label: "粘贴已复制节点",
          shortcut: "Ctrl+V",
          description: graphReady
            ? `把最近复制的节点放到当前画布位置${
                selectedNodeId ? "，并切换选中态" : ""
              }`
            : "图初始化完成后可用",
          disabled: !graphReady,
          onSelect() {
            pasteCopiedNodeFromMenu(context);
          }
        });
      }

      return items;
    };

    menu = createLeaferGraphContextMenu({
      app: graph.app,
      container: graph.container,
      resolveItems: resolveContextMenuItems,
      onBeforeOpen(context) {
        if (context.bindingKind === "node") {
          const nodeId = String(context.bindingMeta?.nodeId ?? context.bindingKey);
          if (!selection.isSelected(nodeId)) {
            selection.select(nodeId);
          }
          return;
        }

        if (context.bindingKind === "canvas") {
          commandBus.execute({ type: "selection.clear" });
        }
      }
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
    const bindEditorLink = (link: LeaferGraphLinkData): void => {
      boundLinkIds.add(link.id);
      bindLinkContextMenu(graph, menu, link);
    };
    const unbindEditorLink = (linkId: string): void => {
      boundLinkIds.delete(linkId);
      menu.unbindTarget(createLinkMenuBindingKey(linkId));
    };
    const collectCurrentLinks = (): LeaferGraphLinkData[] => {
      const linkMap = new Map<string, LeaferGraphLinkData>();

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
    commandHistory = createEditorCommandHistory({
      graph,
      selection,
      bindNode: bindEditorNode,
      unbindNode: unbindEditorNode
    });
    commandBus = createEditorCommandBus({
      graph,
      selection,
      bindNode: bindEditorNode,
      unbindNode: unbindEditorNode,
      quickCreateNodeType,
      onAfterFitView: schedulePointerWorldPointRefresh,
      onDidExecute(execution) {
        latestExecution = execution;
        if (execution.request.type === "node.execute" && !execution.success) {
          const nodeId = execution.request.nodeId;
          setRuntimeHistoryEntries((entries) =>
            appendRuntimeHistoryEntry(
              entries,
              createSkippedRuntimeHistoryEntry(
                graph,
                nodeId,
                execution.timestamp
              )
            )
          );
        }
        commandHistory.record(execution);
        scheduleLinkContextMenuSync();
        syncInfoPanelState();
      }
    });
    (graph.app.tree as typeof graph.app.tree & GraphViewportViewEventHost).on(
      "leafer.transform",
      handleTreeTransform
    );

    graph.ready.then(() => {
      if (disposed) {
        return;
      }

      graphReady = true;

      for (const node of graphData.nodes) {
        bindEditorNode({
          id: node.id,
          title: node.title ?? node.id,
          type: node.type
        });
      }

      syncLinkContextMenus();
      syncInfoPanelState();
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
        event.preventDefault();
        fitGraphView();
        return;
      }

      if (event.key === "Delete") {
        if (
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          !selection.primarySelectedNodeId
        ) {
          return;
        }

        event.preventDefault();
        commandBus.execute({ type: "selection.remove" });
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
          return;
        }

        if (!commandHistory.canUndo) {
          return;
        }

        event.preventDefault();
        commandHistory.undo();
        scheduleLinkContextMenuSync();
        return;
      }

      if (key === "y") {
        if (event.shiftKey || !commandHistory.canRedo) {
          return;
        }

        event.preventDefault();
        commandHistory.redo();
        scheduleLinkContextMenuSync();
        return;
      }

      if (key === "c") {
        if (!selection.primarySelectedNodeId || event.shiftKey) {
          return;
        }

        event.preventDefault();
        commandBus.execute({ type: "selection.copy" });
        return;
      }

      if (key === "a") {
        if (event.shiftKey) {
          return;
        }

        event.preventDefault();
        commandBus.execute({
          type: "selection.select-all",
          nodeIds: [...boundNodeIds]
        });
        return;
      }

      if (key === "x") {
        if (!selection.primarySelectedNodeId || event.shiftKey) {
          return;
        }

        event.preventDefault();
        commandBus.execute({ type: "clipboard.cut-selection" });
        return;
      }

      if (key === "d") {
        if (!selection.primarySelectedNodeId || event.shiftKey) {
          return;
        }

        event.preventDefault();
        commandBus.execute({ type: "selection.duplicate" });
        return;
      }

      if (key === "v") {
        if (
          !commandBus.canExecute({ type: "clipboard.paste", point: null }) ||
          event.shiftKey
        ) {
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
      disposeNodeStateSubscription();
      disposeNodeExecutionSubscription();
      disposeSelectionSubscription();
      hideSelectionBox();
      menu.destroy();
      graphRef.current = null;
      graph.destroy();
    };
  }, [graphData, modules, plugins, quickCreateNodeType]);

  const runtimeFailureEntries = runtimeHistoryEntries
    .filter((entry) => entry.status === "error")
    .slice(0, MAX_RUNTIME_FAILURE_ENTRIES);
  const runtimeChainGroups = groupRuntimeHistoryEntries(runtimeHistoryEntries);
  const latestRuntimeHistoryEntry = runtimeHistoryEntries[0] ?? null;
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
        data-status={runtimeInspectorState.executionState?.status ?? "idle"}
        aria-live="polite"
      >
        <p class="graph-runtime-panel__eyebrow">Inspector</p>
        <div class="graph-runtime-panel__header">
          <div>
            <h3>节点信息面板</h3>
            <p>
              {runtimeInspectorState.focusMode === "selection"
                ? "当前跟随主选中节点"
                : runtimeInspectorState.focusMode === "recent-execution"
                  ? "当前显示最近一次执行节点"
                  : "当前还没有选中节点或执行记录"}
            </p>
          </div>
          <span
            class="graph-runtime-panel__status"
            data-status={runtimeInspectorState.executionState?.status ?? "idle"}
          >
            {formatRuntimeStatusLabel(
              runtimeInspectorState.executionState?.status ?? "idle"
            )}
          </span>
        </div>

        <dl class="graph-runtime-panel__info">
          <div>
            <dt>节点</dt>
            <dd>{runtimeInspectorState.focusNodeTitle ?? "未命中"}</dd>
          </div>
          <div>
            <dt>类型</dt>
            <dd>{runtimeInspectorState.focusNodeType ?? "无"}</dd>
          </div>
          <div>
            <dt>选区</dt>
            <dd>{runtimeInspectorState.selectionCount || 0} 个节点</dd>
          </div>
          <div>
            <dt>执行次数</dt>
            <dd>{runtimeInspectorState.executionState?.runCount ?? 0}</dd>
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
          <div>
            <dt>最近命令</dt>
            <dd>{runtimeInspectorState.lastCommandSummary ?? "无"}</dd>
          </div>
          <div>
            <dt>命令时间</dt>
            <dd>{formatExecutionTimestamp(runtimeInspectorState.lastCommandTimestamp)}</dd>
          </div>
        </dl>

        {runtimeInspectorState.executionState?.lastErrorMessage ? (
          <p class="graph-runtime-panel__error">
            {runtimeInspectorState.executionState.lastErrorMessage}
          </p>
            ) : (
            <p class="graph-runtime-panel__hint">
              选中节点后，右侧会同时显示节点内部数据、属性和 IO 值。
            </p>
          )}

        <section class="graph-runtime-panel__section">
          <div class="graph-runtime-panel__section-header">
            <h4>节点概览</h4>
            <span>
              {runtimeInspectorState.focusMode === "selection"
                ? "当前选中"
                : runtimeInspectorState.focusMode === "recent-execution"
                  ? "最近执行"
                  : "未命中"}
            </span>
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
            </dl>
          ) : (
            <p class="graph-runtime-panel__hint">
              当前还没有焦点节点，先选中一个节点或执行一次节点。
            </p>
          )}
        </section>

        <section class="graph-runtime-panel__section">
          <div class="graph-runtime-panel__section-header">
            <h4>最近一次执行详情</h4>
            <span>{latestRuntimeHistoryEntry ? "已记录" : "暂无"}</span>
          </div>
          {latestRuntimeHistoryEntry ? (
            <>
              <dl class="graph-runtime-panel__info">
                <div>
                  <dt>节点</dt>
                  <dd>{latestRuntimeHistoryEntry.nodeTitle}</dd>
                </div>
                <div>
                  <dt>类型</dt>
                  <dd>{latestRuntimeHistoryEntry.nodeType ?? "未知类型"}</dd>
                </div>
                <div>
                  <dt>状态</dt>
                  <dd>{formatRuntimeStatusLabel(latestRuntimeHistoryEntry.status)}</dd>
                </div>
                <div>
                  <dt>来源</dt>
                  <dd>{formatRuntimeTriggerLabel(latestRuntimeHistoryEntry.trigger)}</dd>
                </div>
                <div>
                  <dt>时间</dt>
                  <dd>{formatExecutionTimestamp(latestRuntimeHistoryEntry.timestamp)}</dd>
                </div>
                <div>
                  <dt>执行次数</dt>
                  <dd>第 {latestRuntimeHistoryEntry.runCount} 次</dd>
                </div>
              </dl>
              <p class="graph-runtime-panel__timeline-summary">
                {latestRuntimeHistoryEntry.summary}
              </p>
              {latestRuntimeHistoryEntry.errorMessage ? (
                <p class="graph-runtime-panel__timeline-error">
                  {latestRuntimeHistoryEntry.errorMessage}
                </p>
              ) : null}
            </>
          ) : (
            <p class="graph-runtime-panel__hint">
              当前还没有执行详情，先从节点菜单里触发一次“执行节点”。
            </p>
          )}
        </section>

        <section class="graph-runtime-panel__section">
          <div class="graph-runtime-panel__section-header">
            <h4>最近执行检查</h4>
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
                        根节点 · {chain.rootNodeType ?? "未知类型"} ·
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
                    {chain.stepCount} 步 · 最深 {chain.maxDepth} 层 ·
                    {chain.successCount} 成功 · {chain.errorCount} 失败 ·
                    {chain.skippedCount} 未执行 ·
                    {formatExecutionDuration(chain.startedAt, chain.finishedAt)}
                  </p>
                  <ul class="graph-runtime-panel__chain-steps">
                    {chain.entries.map((entry) => (
                      <li
                        class="graph-runtime-panel__chain-step"
                        key={`${chain.chainId}:${entry.sequence}:${entry.nodeId}`}
                      >
                        <div class="graph-runtime-panel__timeline-row">
                          <strong class="graph-runtime-panel__timeline-node">
                            {entry.sequence + 1}. {entry.nodeTitle}
                          </strong>
                          <span class="graph-runtime-panel__io-badge">
                            depth {entry.depth} ·
                            {formatRuntimeTriggerLabel(entry.trigger)}
                          </span>
                        </div>
                        <p class="graph-runtime-panel__timeline-meta">
                          {entry.nodeType ?? "未知类型"} ·
                          {formatExecutionTimestamp(entry.timestamp)} ·
                          第 {entry.runCount} 次
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
                </li>
              ))}
            </ul>
          ) : (
            <p class="graph-runtime-panel__hint">
              当前还没有执行链记录，先执行一个可传播的节点。
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

        <section class="graph-runtime-panel__section">
          <div class="graph-runtime-panel__section-header">
            <h4>最近执行链</h4>
            <span>保留最近 {MAX_RUNTIME_HISTORY_ENTRIES} 条</span>
          </div>
          {runtimeHistoryEntries.length ? (
            <ul class="graph-runtime-panel__timeline">
              {runtimeHistoryEntries.map((entry) => (
                <li class="graph-runtime-panel__timeline-item" key={entry.id}>
                  <div class="graph-runtime-panel__timeline-row">
                    <strong class="graph-runtime-panel__timeline-node">
                      {entry.nodeTitle}
                    </strong>
                    <span
                      class="graph-runtime-panel__status graph-runtime-panel__status--small"
                      data-status={entry.status}
                    >
                      {formatRuntimeStatusLabel(entry.status)}
                    </span>
                  </div>
                  <p class="graph-runtime-panel__timeline-summary">{entry.summary}</p>
                  <p class="graph-runtime-panel__timeline-meta">
                    {formatRuntimeTriggerLabel(entry.trigger)} ·
                    {entry.nodeType ?? "未知类型"} ·
                    {formatExecutionTimestamp(entry.timestamp)} ·
                    第 {entry.runCount} 次
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p class="graph-runtime-panel__hint">
              当前还没有执行日志，先从节点菜单里触发一次“执行节点”。
            </p>
          )}
        </section>

        <section class="graph-runtime-panel__section">
          <div class="graph-runtime-panel__section-header">
            <h4>最近失败</h4>
            <span>{runtimeFailureEntries.length} 条</span>
          </div>
          {runtimeFailureEntries.length ? (
            <ul class="graph-runtime-panel__timeline">
              {runtimeFailureEntries.map((entry) => (
                <li class="graph-runtime-panel__timeline-item" key={`${entry.id}:failure`}>
                  <div class="graph-runtime-panel__timeline-row">
                    <strong class="graph-runtime-panel__timeline-node">
                      {entry.nodeTitle}
                    </strong>
                    <span
                      class="graph-runtime-panel__status graph-runtime-panel__status--small"
                      data-status={entry.status}
                    >
                      {formatRuntimeStatusLabel(entry.status)}
                    </span>
                  </div>
                  <p class="graph-runtime-panel__timeline-meta">
                    {formatRuntimeTriggerLabel(entry.trigger)} ·
                    {formatExecutionTimestamp(entry.timestamp)} ·
                    {entry.nodeType ?? "未知类型"}
                  </p>
                  {entry.errorMessage ? (
                    <p class="graph-runtime-panel__timeline-error">
                      {entry.errorMessage}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p class="graph-runtime-panel__hint">当前没有失败记录。</p>
          )}
        </section>
      </aside>
    </div>
  );
}
