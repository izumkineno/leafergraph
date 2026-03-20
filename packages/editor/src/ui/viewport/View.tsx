import { useEffect, useMemo, useRef, useState } from "preact/hooks";

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
} from "../../commands/command_bus";
import {
  parseLeaferGraphClipboardPayload,
  serializeLeaferGraphClipboardPayload
} from "../../commands/clipboard_payload";
import {
  readBrowserClipboardText,
  writeBrowserClipboardText
} from "../../commands/browser_clipboard_bridge";
import {
  createEditorCommandHistory,
  type EditorCommandHistory
} from "../../commands/command_history";
import {
  createLoopbackGraphDocumentSessionBinding,
  type EditorGraphDocumentSessionBindingFactory
} from "../../session/graph_document_session_binding";
import type {
  EditorGraphDocumentResyncOptions,
  EditorGraphOperationAuthorityConfirmation,
  EditorGraphOperationSubmission
} from "../../session/graph_document_session";
import { createEditorNodeSelection } from "../../state/selection";
import {
  GRAPH_VIEWPORT_BACKGROUND_SIZE,
  resolveGraphViewportBackground,
  type EditorTheme
} from "../../theme";
import {
  bindLinkContextMenu,
  bindNodeContextMenu,
  createLinkMenuBindingKey,
  createNodeMenuBindingKey,
  type EditorNodePointerDownEvent
} from "../../menu/context_menu_bindings";
import {
  createEditorContextMenuBeforeOpenHandler,
  createEditorContextMenuResolver
} from "../../menu/context_menu_resolver";
import type { EditorRuntimeFeedbackInlet } from "../../runtime/runtime_feedback_inlet";
import type {
  EditorRemoteAuthorityRuntimeControlRequest,
  EditorRemoteAuthorityRuntimeController
} from "../../session/graph_document_authority_client";
import { createGraphInteractionCommitBridge } from "../../interaction/graph_interaction_commit_bridge";
import {
  appendRuntimeHistoryEntry,
  createGraphViewportRuntimeCollectionsProjector,
  createRuntimeHistoryEntryFromEvent,
  type GraphViewportRuntimeChainGroup,
  type GraphViewportRuntimeFailureGroup,
  type GraphViewportRuntimeHistoryEntry
} from "./runtime_collections";
import { resolveGraphViewportRuntimeDetailLabel } from "./runtime_status";
import {
  resolveRemoteRuntimeControlNotice,
  type GraphViewportRemoteRuntimeControlNotice
} from "./runtime_control_notice";

export interface GraphViewportProps {
  document: GraphDocument;
  modules?: LeaferGraphOptions["modules"];
  plugins?: LeaferGraphOptions["plugins"];
  createDocumentSessionBinding?: EditorGraphDocumentSessionBindingFactory;
  runtimeFeedbackInlet?: EditorRuntimeFeedbackInlet;
  runtimeController?: EditorRemoteAuthorityRuntimeController;
  runtimeControlMode?: "local" | "remote";
  onHostBridgeChange?(bridge: GraphViewportHostBridge | null): void;
  quickCreateNodeType?: string;
  theme: EditorTheme;
  onEditorToolbarControlsChange?(
    controls: GraphViewportToolbarControlsState | null
  ): void;
  onGraphRuntimeControlsChange?(
    controls: GraphViewportRuntimeControlsState | null
  ): void;
  onRemoteRuntimeControlNoticeChange?(
    notice: GraphViewportRemoteRuntimeControlNotice | null
  ): void;
  onWorkspaceStateChange?(state: GraphViewportWorkspaceState | null): void;
}

type GraphViewportNodeExecutionSnapshot = NonNullable<
  ReturnType<LeaferGraph["getNodeExecutionState"]>
>;
type GraphViewportGraphExecutionSnapshot = LeaferGraphGraphExecutionState;

export interface GraphViewportRuntimeControlsState {
  available: boolean;
  executionState: GraphViewportGraphExecutionSnapshot;
  play(): void;
  step(): void;
  stop(): void;
}

export interface GraphViewportWorkspaceState {
  selection: {
    count: number;
    nodeIds: readonly string[];
    primaryNodeId: string | null;
  };
  document: {
    documentId: string;
    revision: string | number;
    appKind: string;
    nodeCount: number;
    linkCount: number;
  };
  inspector: {
    mode: "document" | "node" | "multi";
    focusNodeId: string | null;
    focusNodeTitle: string | null;
    focusNodeType: string | null;
    node: LeaferGraphNodeInspectorState | null;
    selectionCount: number;
  };
  runtime: {
    graphExecutionState: GraphViewportGraphExecutionSnapshot;
    focus: GraphViewportRuntimeInspectorState;
    focusNode: LeaferGraphNodeInspectorState | null;
    recentEntries: readonly GraphViewportRuntimeHistoryEntry[];
    recentChains: readonly GraphViewportRuntimeChainGroup[];
    latestChain: GraphViewportRuntimeChainGroup | null;
    failures: readonly GraphViewportRuntimeFailureGroup[];
    latestErrorMessage: string | null;
  };
  status: {
    documentLabel: string;
    runtimeLabel: string;
    runtimeDetailLabel: string | null;
    selectionLabel: string;
    focusLabel: string;
    lastCommandSummary: string | null;
  };
}

/** 外部宿主可选接入的最小视口桥。 */
export interface GraphViewportHostBridge {
  readonly graph: LeaferGraph;
  executeCommand(request: EditorCommandRequest): EditorCommandExecution;
  submitOperationWithAuthority(
    operation: GraphOperation
  ): EditorGraphOperationSubmission;
  resyncAuthorityDocument(
    options?: EditorGraphDocumentResyncOptions
  ): Promise<GraphDocument>;
  replaceDocument(document: GraphDocument): void;
  getCurrentDocument(): GraphDocument;
  subscribeDocument(listener: (document: GraphDocument) => void): () => void;
  getPendingOperationIds(): readonly string[];
  subscribePending?(
    listener: (pendingOperationIds: readonly string[]) => void
  ): () => void;
  subscribeOperationConfirmation?(
    listener: (confirmation: EditorGraphOperationAuthorityConfirmation) => void
  ): () => void;
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

export interface GraphViewportRuntimeInspectorState {
  focusMode: "idle" | "selection" | "recent-execution";
  focusNodeId: string | null;
  focusNodeTitle: string | null;
  focusNodeType: string | null;
  selectionCount: number;
  executionState: GraphViewportNodeExecutionSnapshot | null;
  lastCommandSummary: string | null;
  lastCommandTimestamp: number | null;
}

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
  lastRuntimeExecution: LeaferGraphNodeExecutionEvent | null
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
  const focusNodeId = selectedNodeId ?? recentRuntimeExecutedNodeId ?? null;

  return {
    focusMode: selectedNodeId
      ? "selection"
      : recentRuntimeExecutedNodeId
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
    lastRuntimeExecution
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
  lastRuntimeExecution: LeaferGraphNodeExecutionEvent | null
): LeaferGraphNodeInspectorState | null {
  const { focusNodeId } = resolveInspectorFocusState(
    graph,
    selection,
    lastRuntimeExecution
  );

  return focusNodeId ? graph.getNodeInspectorState(focusNodeId) ?? null : null;
}

function shouldSyncInspectorForNodeState(
  graph: LeaferGraph,
  event: LeaferGraphNodeStateChangeEvent,
  selection: ReturnType<typeof createEditorNodeSelection>,
  lastRuntimeExecution: LeaferGraphNodeExecutionEvent | null
): boolean {
  if (!event.exists) {
    return true;
  }

  return (
    resolveInspectorFocusState(
      graph,
      selection,
      lastRuntimeExecution
    ).focusNodeId === event.nodeId
  );
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
  runtimeController,
  runtimeControlMode = "local",
  onHostBridgeChange,
  quickCreateNodeType,
  theme,
  onEditorToolbarControlsChange,
  onGraphRuntimeControlsChange,
  onRemoteRuntimeControlNoticeChange,
  onWorkspaceStateChange
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
  const [selectionSnapshot, setSelectionSnapshot] = useState<{
    nodeIds: string[];
    primaryNodeId: string | null;
  }>({
    nodeIds: [],
    primaryNodeId: null
  });
  const [runtimeHistoryEntries, setRuntimeHistoryEntries] = useState<
    GraphViewportRuntimeHistoryEntry[]
  >([]);
  const [graphExecutionState, setGraphExecutionState] =
    useState<GraphViewportGraphExecutionSnapshot>(() =>
      createIdleGraphExecutionState()
    );
  const [workspaceDocument, setWorkspaceDocument] = useState<GraphDocument>(
    () => documentData
  );
  const runtimeCollectionsProjectorRef = useRef(
    createGraphViewportRuntimeCollectionsProjector()
  );
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    setWorkspaceDocument(documentData);
  }, [documentData]);

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
    const activeDocument = documentSession.currentDocument;
    let projectedDocument = activeDocument;
    let latestGraphExecutionState = graph.getGraphExecutionState();
    setWorkspaceDocument(activeDocument);
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
    const isRuntimeControlAvailable = (): boolean =>
      graphReady && (runtimeControlMode === "local" || Boolean(runtimeController));
    const resolveLocalNodePlayState = (
      nodeId: string
    ): {
      disabled: boolean;
      description: string;
    } => {
      if (!graphReady) {
        return {
          disabled: true,
          description: "图初始化完成后可用"
        };
      }

      if (!graph.getNodeSnapshot(nodeId)) {
        return {
          disabled: true,
          description: "节点不存在"
        };
      }

      const executionState = graph.getNodeExecutionState(nodeId);
      if (!executionState || executionState.status === "idle") {
        return {
          disabled: false,
          description:
            "从当前节点开始运行正式执行链；若节点未实现 onExecute(...) 则不会产生运行结果"
        };
      }

      if (executionState.status === "running") {
        return {
          disabled: false,
          description: `节点正在执行中，当前累计执行 ${executionState.runCount} 次`
        };
      }

      if (executionState.status === "success") {
        return {
          disabled: false,
          description: `最近一次执行成功，当前累计执行 ${executionState.runCount} 次`
        };
      }

      return {
        disabled: false,
        description: executionState.lastErrorMessage
          ? `最近一次执行失败：${executionState.lastErrorMessage}`
          : "最近一次执行失败，请查看节点信号灯或控制台日志"
      };
    };
    const resolveNodePlayState = (
      nodeId: string
    ): {
      disabled: boolean;
      description: string;
    } => {
      if (runtimeControlMode === "remote") {
        if (!graphReady) {
          return {
            disabled: true,
            description: "图初始化完成后可用"
          };
        }

        if (!graph.getNodeSnapshot(nodeId)) {
          return {
            disabled: true,
            description: "节点不存在"
          };
        }

        if (!runtimeController) {
          return {
            disabled: true,
            description: "当前 authority 不支持远端运行控制"
          };
        }

        return {
          disabled: false,
          description: "通过 authority 从当前节点开始运行一条执行链"
        };
      }

      return resolveLocalNodePlayState(nodeId);
    };
    const syncGraphRuntimeControls = (
      nextGraphExecutionState: GraphViewportGraphExecutionSnapshot = latestGraphExecutionState
    ): void => {
      if (disposed) {
        return;
      }

      latestGraphExecutionState = nextGraphExecutionState;
      setGraphExecutionState(nextGraphExecutionState);
      onGraphRuntimeControlsChange?.({
        available: isRuntimeControlAvailable(),
        executionState: nextGraphExecutionState,
        play: playGraph,
        step: stepGraph,
        stop: stopGraph
      });
    };
    const requestRemoteRuntimeControl = (
      request: EditorRemoteAuthorityRuntimeControlRequest
    ): void => {
      if (!runtimeController) {
        return;
      }

      void runtimeController
        .controlRuntime(request)
        .then((result) => {
          if (disposed) {
            return;
          }

          if (result.state) {
            syncGraphRuntimeControls(result.state);
          }

          onRemoteRuntimeControlNoticeChange?.(
            resolveRemoteRuntimeControlNotice({
              request,
              result
            })
          );
        })
        .catch((error: unknown) => {
          if (disposed) {
            return;
          }

          onRemoteRuntimeControlNoticeChange?.(
            resolveRemoteRuntimeControlNotice({
              request,
              error
            })
          );
        });
    };
    const playGraph = (): void => {
      if (runtimeControlMode === "remote") {
        requestRemoteRuntimeControl({ type: "graph.play" });
        return;
      }

      graph.play();
    };
    const stepGraph = (): void => {
      if (runtimeControlMode === "remote") {
        requestRemoteRuntimeControl({ type: "graph.step" });
        return;
      }

      graph.step();
    };
    const stopGraph = (): void => {
      if (runtimeControlMode === "remote") {
        requestRemoteRuntimeControl({ type: "graph.stop" });
        return;
      }

      graph.stop();
    };
    const playNode = (nodeId: string): void => {
      if (runtimeControlMode === "remote") {
        requestRemoteRuntimeControl({ type: "node.play", nodeId });
        return;
      }

      graph.playFromNode(nodeId);
    };
    onGraphRuntimeControlsChange?.({
      available: false,
      executionState: latestGraphExecutionState,
      play: playGraph,
      step: stepGraph,
      stop: stopGraph
    });
    const syncInfoPanelState = (): void => {
      if (disposed) {
        return;
      }

      setSelectionSnapshot({
        nodeIds: [...selection.selectedNodeIds],
        primaryNodeId: selection.primarySelectedNodeId
      });
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
          latestRuntimeExecution
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
          onRemoteRuntimeControlNoticeChange?.(null);
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
          onRemoteRuntimeControlNoticeChange?.(null);
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
              latestRuntimeExecution
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
      runtimeFeedbackInlet?.subscribe((feedback) => {
        if (disposed) {
          return;
        }

        graph.projectRuntimeFeedback(feedback);
      }) ?? (() => {});
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
    /** 读取当前画布可视区中心对应的 page 坐标。 */
    const resolveViewportCenterPagePoint = (): { x: number; y: number } | null => {
      const hostRect = host.getBoundingClientRect();
      if (hostRect.width <= 0 || hostRect.height <= 0) {
        return null;
      }

      return resolvePagePointByClient(
        hostRect.left + hostRect.width / 2,
        hostRect.top + hostRect.height / 2
      );
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
    /** 统一从命令状态读取快捷键是否可触发，避免 GraphViewport 自己维护第二套禁用判断。 */
    const isCommandShortcutEnabled = (request: EditorCommandRequest): boolean =>
      !commandBus.resolveCommandState(request).disabled;
    const serializeCommandClipboardPayload = (): string | null => {
      const payload = commandBus.clipboard?.payload;
      return payload ? serializeLeaferGraphClipboardPayload(payload) : null;
    };
    const prepareClipboardWriteText = (
      request: Extract<
        EditorCommandRequest,
        | { type: "clipboard.copy-node" }
        | { type: "clipboard.copy-selection" }
        | { type: "clipboard.cut-selection" }
        | { type: "selection.copy" }
      >
    ): string | null => {
      const execution = commandBus.execute(request);
      if (!execution.success) {
        return null;
      }

      const text = serializeCommandClipboardPayload();
      if (!text) {
        return null;
      }

      return text;
    };
    const executeClipboardWriteRequest = (
      request: Extract<
        EditorCommandRequest,
        | { type: "clipboard.copy-node" }
        | { type: "clipboard.copy-selection" }
        | { type: "clipboard.cut-selection" }
        | { type: "selection.copy" }
      >
    ): string | null => {
      const text = prepareClipboardWriteText(request);
      if (!text) {
        return null;
      }

      void writeBrowserClipboardText(ownerWindow, text);
      return text;
    };
    /**
     * 键盘复制/剪切优先显式写系统剪贴板，
     * 避免跨工作区切换时继续依赖浏览器对原生 clipboard 事件的隐式提交时机。
     */
    const executeKeyboardClipboardWriteRequest = async (
      request: Extract<
        EditorCommandRequest,
        | { type: "clipboard.copy-node" }
        | { type: "clipboard.copy-selection" }
        | { type: "clipboard.cut-selection" }
        | { type: "selection.copy" }
      >
    ): Promise<void> => {
      const text = prepareClipboardWriteText(request);
      if (!text) {
        return;
      }

      await writeBrowserClipboardText(ownerWindow, text);
    };
    const resolveClipboardPayloadFromText = (
      text: string | null | undefined
    ) => (text ? parseLeaferGraphClipboardPayload(text) : null);
    const executeClipboardPasteRequest = async (
      point: { x: number; y: number } | null,
      preferredText?: string | null
    ): Promise<void> => {
      const payloadFromEvent = resolveClipboardPayloadFromText(preferredText);
      const payload =
        payloadFromEvent ??
        resolveClipboardPayloadFromText(
          await readBrowserClipboardText(ownerWindow)
        );

      if (disposed) {
        return;
      }

      if (payload) {
        commandBus.setClipboardPayload(payload);
      }

      commandBus.execute({
        type: "clipboard.paste",
        point
      });
    };
    const executeUiCommand = (request: EditorCommandRequest): void => {
      switch (request.type) {
        case "clipboard.copy-node":
        case "clipboard.copy-selection":
        case "clipboard.cut-selection":
        case "selection.copy":
          executeClipboardWriteRequest(request);
          return;
        case "clipboard.paste":
          void executeClipboardPasteRequest(request.point);
          return;
        default:
          commandBus.execute(request);
      }
    };
    const pasteCopiedNodeAtLatestPointer = (): void => {
      void executeClipboardPasteRequest(resolveLatestPointerPagePoint());
    };
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

      executeUiCommand(request);
    };
    menu = createLeaferGraphContextMenu({
      app: graph.app,
      container: graph.container,
      resolveItems: createEditorContextMenuResolver({
        graph,
        selection,
        resolveCommandBus: () => commandBus,
        executeUiCommand,
        resolveNodePlayState,
        onPlayNode(nodeId) {
          playNode(nodeId);
        },
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
    const disposeDocumentProjectionSubscription = documentSession.subscribe(
      (document) => {
        if (disposed) {
          return;
        }

        setWorkspaceDocument(document);
        if (documentSessionBinding.projectsSessionDocument) {
          syncAuthoritativeDocumentProjection(document);
        }
      }
    );
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
      resolveLastPointerPagePoint: resolveLatestPointerPagePoint,
      resolveViewportCenterPagePoint,
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
      resyncAuthorityDocument(
        options?: EditorGraphDocumentResyncOptions
      ): Promise<GraphDocument> {
        return documentSession.resyncAuthorityDocument
          ? documentSession.resyncAuthorityDocument(options)
          : Promise.resolve(documentSession.currentDocument);
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
      subscribePending(
        listener: (pendingOperationIds: readonly string[]) => void
      ): () => void {
        return documentSession.subscribePending(listener);
      },
      subscribeOperationConfirmation(
        listener: (confirmation: EditorGraphOperationAuthorityConfirmation) => void
      ): () => void {
        return documentSession.subscribeOperationConfirmation(listener);
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
          executeUiCommand({
            type: "selection.select-all",
            nodeIds: [...boundNodeIds]
          });
          return;
        case "paste":
          pasteCopiedNodeByKeyboard();
          return;
        case "copy":
          executeUiCommand({ type: "selection.copy" });
          return;
        case "cut":
          executeUiCommand({ type: "clipboard.cut-selection" });
          return;
        case "duplicate":
          executeUiCommand({ type: "selection.duplicate" });
          return;
        case "delete":
          executeUiCommand({ type: "selection.remove" });
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
      if (runtimeControlMode !== "remote") {
        onRemoteRuntimeControlNoticeChange?.(null);
      }
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
        executeUiCommand(request);
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
        void executeKeyboardClipboardWriteRequest(request);
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
        void executeKeyboardClipboardWriteRequest(request);
        return;
      }

      if (key === "v") {
        if (event.shiftKey) {
          return;
        }

        const request: EditorCommandRequest = {
          type: "clipboard.paste",
          point: null
        };
        if (!isCommandShortcutEnabled(request)) {
          return;
        }

        event.preventDefault();
        pasteCopiedNodeByKeyboard();
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
        executeUiCommand(request);
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
        executeUiCommand(request);
      }
    };
    const handleNativeCopy = (event: ClipboardEvent): void => {
      if (isTextEditingElement(event.target)) {
        return;
      }

      const request: EditorCommandRequest = { type: "selection.copy" };
      if (!isCommandShortcutEnabled(request)) {
        return;
      }

      event.preventDefault();
      const text = executeClipboardWriteRequest(request);
      if (text) {
        event.clipboardData?.setData("text/plain", text);
      }
    };
    const handleNativeCut = (event: ClipboardEvent): void => {
      if (isTextEditingElement(event.target)) {
        return;
      }

      const request: EditorCommandRequest = {
        type: "clipboard.cut-selection"
      };
      if (!isCommandShortcutEnabled(request)) {
        return;
      }

      event.preventDefault();
      const text = executeClipboardWriteRequest(request);
      if (text) {
        event.clipboardData?.setData("text/plain", text);
      }
    };
    const handleNativePaste = (event: ClipboardEvent): void => {
      if (isTextEditingElement(event.target)) {
        return;
      }

      const request: EditorCommandRequest = {
        type: "clipboard.paste",
        point: null
      };
      if (!isCommandShortcutEnabled(request)) {
        return;
      }

      event.preventDefault();
      const preferredText = event.clipboardData?.getData("text/plain") ?? null;
      runAfterViewportSettle(() => {
        if (!isCommandShortcutEnabled(request)) {
          return;
        }

        void executeClipboardPasteRequest(
          resolveLatestPointerPagePoint(),
          preferredText
        );
      });
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
    ownerWindow.document.addEventListener("copy", handleNativeCopy);
    ownerWindow.document.addEventListener("cut", handleNativeCut);
    ownerWindow.document.addEventListener("paste", handleNativePaste);

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
      ownerWindow.document.removeEventListener("copy", handleNativeCopy);
      ownerWindow.document.removeEventListener("cut", handleNativeCut);
      ownerWindow.document.removeEventListener("paste", handleNativePaste);
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
      onRemoteRuntimeControlNoticeChange?.(null);
      onWorkspaceStateChange?.(null);
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
    onRemoteRuntimeControlNoticeChange,
    onWorkspaceStateChange,
    plugins,
    quickCreateNodeType,
    runtimeControlMode,
    runtimeController,
    runtimeFeedbackInlet
  ]);

  const runtimeCollections = useMemo(
    () =>
      runtimeCollectionsProjectorRef.current(
        runtimeHistoryEntries,
        runtimeInspectorState.executionState?.lastErrorMessage ?? null
      ),
    [runtimeHistoryEntries, runtimeInspectorState.executionState?.lastErrorMessage]
  );
  const runtimeChainGroups = runtimeCollections.recentChains;
  const runtimeFailureGroups = runtimeCollections.failures;
  const activeRuntimeChainGroup = runtimeCollections.latestChain;
  const latestRuntimeErrorMessage = runtimeCollections.latestErrorMessage;

  const workspaceState = useMemo<GraphViewportWorkspaceState>(() => {
    const selectionCount = selectionSnapshot.nodeIds.length;
    const inspectorMode =
      selectionCount === 0 ? "document" : selectionCount === 1 ? "node" : "multi";

    return {
      selection: {
        count: selectionCount,
        nodeIds: selectionSnapshot.nodeIds,
        primaryNodeId: selectionSnapshot.primaryNodeId
      },
      document: {
        documentId: workspaceDocument.documentId,
        revision: workspaceDocument.revision,
        appKind: workspaceDocument.appKind,
        nodeCount: workspaceDocument.nodes.length,
        linkCount: workspaceDocument.links.length
      },
      inspector: {
        mode: inspectorMode,
        focusNodeId: runtimeInspectorState.focusNodeId,
        focusNodeTitle: runtimeInspectorState.focusNodeTitle,
        focusNodeType: runtimeInspectorState.focusNodeType,
        node: inspectorMode === "node" ? nodeInspectorState : null,
        selectionCount
      },
      runtime: {
        graphExecutionState,
        focus: runtimeInspectorState,
        focusNode: nodeInspectorState,
        recentEntries: runtimeHistoryEntries,
        recentChains: runtimeChainGroups,
        latestChain: activeRuntimeChainGroup,
        failures: runtimeFailureGroups,
        latestErrorMessage: latestRuntimeErrorMessage
      },
      status: {
        documentLabel: `${workspaceDocument.documentId} @ ${workspaceDocument.revision}`,
        runtimeLabel: formatGraphExecutionStatusLabel(graphExecutionState.status),
        runtimeDetailLabel: resolveGraphViewportRuntimeDetailLabel(
          graphExecutionState,
          activeRuntimeChainGroup
        ),
        selectionLabel:
          selectionCount > 0 ? `已选 ${selectionCount} 个节点` : "未选择节点",
        focusLabel: runtimeInspectorState.focusNodeTitle ?? "未命中焦点节点",
        lastCommandSummary: runtimeInspectorState.lastCommandSummary
      }
    };
  }, [
    activeRuntimeChainGroup,
    graphExecutionState,
    latestRuntimeErrorMessage,
    nodeInspectorState,
    runtimeChainGroups,
    runtimeHistoryEntries,
    runtimeInspectorState,
    runtimeFailureGroups,
    selectionSnapshot.nodeIds,
    selectionSnapshot.primaryNodeId,
    workspaceDocument
  ]);

  useEffect(() => {
    onWorkspaceStateChange?.(workspaceState);
  }, [onWorkspaceStateChange, workspaceState]);

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
    </div>
  );
}

