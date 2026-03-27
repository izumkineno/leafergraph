/**
 * Tauri authority demo 图生命周期 hook。
 *
 * @remarks
 * 负责统一管理：
 * - `LeaferGraph` 实例创建与销毁
 * - 自定义节点注册
 * - `SyncSession` 与 Tauri outlet 建立
 * - 文档快照和运行反馈投影
 * - 页面动作按钮对应的后端命令与禁用态
 */
import { useEffect, useRef, useState } from "preact/hooks";

import {
  createLeaferGraph,
  type GraphOperation,
  type LeaferGraph,
  type LeaferGraphGraphExecutionState
} from "leafergraph";
import {
  createSyncSession,
  type ConnectionStatus,
  type DocumentRevision,
  type SyncAck,
  type SyncCommand,
  type SyncRuntimeControlRequest,
  type SyncSession
} from "@leafergraph/sync";

import {
  cloneDemoSeedDocument,
  createEmptyDemoDocument,
  DEMO_DOCUMENT_ID,
  EXAMPLE_COUNTER_NODE_TYPE,
  EXAMPLE_WATCH_NODE_TYPE
} from "./demo_seed_document";
import {
  createCounterNodeDefinition,
  createWatchNodeDefinition
} from "./example_nodes";
import { createOperationsFromInteractionCommit } from "./interaction_commit_to_operation";
import { formatRuntimeFeedback } from "./runtime_feedback_format";
import { createTauriSyncOutlet } from "../tauri/tauri_sync_outlet";

const MAX_LOG_ENTRIES = 80;
const DEFAULT_FIT_VIEW_PADDING = 120;
const DEFAULT_RUNTIME_STATE: LeaferGraphGraphExecutionState = {
  status: "idle",
  queueSize: 0,
  stepCount: 0
};

let commandSeed = 1;

/** UI 日志中的一条最小记录。 */
export interface DemoLogEntry {
  /** 日志产生时间戳。 */
  timestamp: number;
  /** 当前日志的短文案。 */
  message: string;
}

/** 右侧画布卡片 badge 的最小结构。 */
export interface DemoStageBadge {
  /** badge 稳定标识。 */
  id: string;
  /** badge 展示文案。 */
  label: string;
}

/** 左侧状态摘要项。 */
export interface DemoStatusItem {
  /** 当前摘要的稳定标识。 */
  id: string;
  /** 摘要标签。 */
  label: string;
  /** 摘要当前值。 */
  value: string;
}

/** 当前最小 authority 链中的一个阅读步骤。 */
export interface DemoChainStep {
  /** 步骤稳定标识。 */
  id: string;
  /** 步骤标题。 */
  title: string;
  /** 步骤说明。 */
  description: string;
}

/** 页面可直接消费的最小动作集合。 */
export interface DemoGraphActions {
  /** 触发图级 play。 */
  play(): void;
  /** 触发图级 step。 */
  step(): void;
  /** 触发图级 stop。 */
  stop(): void;
  /** 让当前画布执行 fitView。 */
  fit(): void;
  /** 通过 `document.replace` 恢复共享 seed。 */
  reset(): void;
  /** 清空当前日志。 */
  clearLog(): void;
}

/** 当前动作按钮的最小可用性状态。 */
export interface DemoActionState {
  /** 当前按钮是否禁用。 */
  disabled: boolean;
  /** 当前按钮的简短提示。 */
  hint?: string;
}

/** 页面层可直接消费的动作可用性集合。 */
export interface DemoGraphActionStates {
  /** 图级 play 动作的可用性。 */
  play: DemoActionState;
  /** 图级 step 动作的可用性。 */
  step: DemoActionState;
  /** 图级 stop 动作的可用性。 */
  stop: DemoActionState;
  /** 视图适配动作的可用性。 */
  fit: DemoActionState;
  /** 恢复示例图动作的可用性。 */
  reset: DemoActionState;
  /** 清空日志动作的可用性。 */
  clearLog: DemoActionState;
}

/** `useTauriSyncGraph()` 对页面层暴露的最小结果。 */
export interface UseTauriSyncGraphResult {
  /** 右侧画布挂载点。 */
  stageRef: { current: HTMLDivElement | null };
  /** 当前运行日志。 */
  logs: readonly DemoLogEntry[];
  /** 页面层可直接绑定的图动作。 */
  actions: DemoGraphActions;
  /** 页面层可直接绑定的按钮禁用态。 */
  actionStates: DemoGraphActionStates;
  /** 当前控制区的一行提示。 */
  actionHint: string;
  /** 右侧画布 badge。 */
  stageBadges: readonly DemoStageBadge[];
  /** 左侧链路说明。 */
  chainSteps: readonly DemoChainStep[];
  /** 左侧状态摘要。 */
  statusItems: readonly DemoStatusItem[];
}

const DEMO_CHAIN_STEPS: readonly DemoChainStep[] = [
  {
    id: "tauri-command",
    title: "Tauri invoke",
    description: "前端把按钮动作提交给 Rust authority。"
  },
  {
    id: "authority-sync",
    title: "authority snapshot",
    description: "后端确认文档真相、自增 revision，并通过事件回推 snapshot。"
  },
  {
    id: "runtime-feedback",
    title: "runtime feedback",
    description: "后端模拟最小运行链，把反馈投影回前端画布和日志。"
  }
];

function nextCommandId(prefix: string): string {
  const currentSeed = commandSeed;
  commandSeed += 1;
  return `${prefix}:${Date.now()}:${currentSeed}`;
}

function createRuntimeControlCommand(
  request: SyncRuntimeControlRequest
): SyncCommand {
  return {
    type: "runtime.control",
    commandId: nextCommandId(request.type),
    issuedAt: Date.now(),
    request
  };
}

function createResetCommand(): SyncCommand {
  return {
    type: "document.replace",
    commandId: nextCommandId("document.replace"),
    issuedAt: Date.now(),
    snapshot: cloneDemoSeedDocument()
  };
}

function createApplyOperationCommand(operation: GraphOperation): SyncCommand {
  return {
    type: "document.apply-operation",
    commandId: nextCommandId(`document.apply-operation:${operation.type}`),
    issuedAt: Date.now(),
    operation
  };
}

function mergeRuntimeState(
  nextState: LeaferGraphGraphExecutionState
): LeaferGraphGraphExecutionState {
  return {
    ...DEFAULT_RUNTIME_STATE,
    ...nextState
  };
}

function formatAckMessage(actionLabel: string, ack: SyncAck): string {
  const base = `${actionLabel} 返回 ${ack.status}`;
  const details: string[] = [];

  if (ack.type === "runtime.control" && ack.runtimeState) {
    details.push(`运行状态=${ack.runtimeState.status}`);
  }

  if (
    (ack.type === "document.apply-operation" ||
      ack.type === "document.replace") &&
    ack.documentRevision !== undefined
  ) {
    details.push(`revision=${String(ack.documentRevision)}`);
  }

  if (ack.reason) {
    details.push(`说明=${ack.reason}`);
  }

  return details.length ? `${base}，${details.join("，")}` : base;
}

function formatConnectionStatus(status: ConnectionStatus): string {
  switch (status) {
    case "idle":
      return "idle";
    case "connecting":
      return "connecting";
    case "connected":
      return "connected";
    case "disconnected":
      return "disconnected";
    case "reconnecting":
      return "reconnecting";
    default:
      return "unknown";
  }
}

function formatRuntimeStatus(
  status: LeaferGraphGraphExecutionState["status"]
): string {
  switch (status) {
    case "idle":
      return "idle / 空闲";
    case "running":
      return "running / 持续执行";
    case "stepping":
      return "stepping / 单步执行";
    default:
      return "unknown";
  }
}

function formatRuntimeSource(
  runtimeState: LeaferGraphGraphExecutionState
): string {
  return runtimeState.lastSource ?? "尚未触发";
}

/**
 * 最小图 + Sync + Tauri authority 主 hook。
 *
 * @returns 当前页面所需的图挂载 ref、状态摘要、动作与日志数据。
 */
export function useTauriSyncGraph(): UseTauriSyncGraphResult {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<LeaferGraph | null>(null);
  const sessionRef = useRef<SyncSession | null>(null);
  const didInitialFitRef = useRef(false);
  const [logs, setLogs] = useState<DemoLogEntry[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [graphReady, setGraphReady] = useState(false);
  const [documentRevision, setDocumentRevision] =
    useState<DocumentRevision | undefined>(undefined);
  const [runtimeState, setRuntimeState] =
    useState<LeaferGraphGraphExecutionState>(DEFAULT_RUNTIME_STATE);
  const [pendingCommandLabel, setPendingCommandLabel] =
    useState<string | null>(null);

  const appendLog = (message: string): void => {
    setLogs((currentLogs) =>
      [
        {
          timestamp: Date.now(),
          message
        },
        ...currentLogs
      ].slice(0, MAX_LOG_ENTRIES)
    );
  };

  const clearLogs = (): void => {
    setLogs([]);
  };

  const scheduleFitView = (): void => {
    requestAnimationFrame(() => {
      graphRef.current?.fitView(DEFAULT_FIT_VIEW_PADDING);
    });
  };

  const submitSyncCommand = async (
    command: SyncCommand,
    actionLabel: string
  ): Promise<SyncAck | null> => {
    const session = sessionRef.current;
    if (!session) {
      appendLog(`${actionLabel} 失败：同步会话尚未就绪`);
      return null;
    }

    setPendingCommandLabel(actionLabel);

    try {
      const ack = await session.submitCommand(command);
      if (ack.type === "runtime.control" && ack.runtimeState) {
        setRuntimeState(mergeRuntimeState(ack.runtimeState));
      }
      appendLog(formatAckMessage(actionLabel, ack));
      return ack;
    } catch (error) {
      appendLog(
        `${actionLabel} 异常：${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    } finally {
      setPendingCommandLabel(null);
    }
  };

  const actions: DemoGraphActions = {
    play(): void {
      void submitSyncCommand(
        createRuntimeControlCommand({ type: "graph.play" }),
        "graph.play"
      );
    },
    step(): void {
      void submitSyncCommand(
        createRuntimeControlCommand({ type: "graph.step" }),
        "graph.step"
      );
    },
    stop(): void {
      void submitSyncCommand(
        createRuntimeControlCommand({ type: "graph.stop" }),
        "graph.stop"
      );
    },
    fit(): void {
      if (!graphRef.current) {
        appendLog("graph.fitView 失败：图实例尚未就绪");
        return;
      }

      scheduleFitView();
      appendLog("已执行 graph.fitView()");
    },
    reset(): void {
      void submitSyncCommand(createResetCommand(), "document.replace");
    },
    clearLog(): void {
      clearLogs();
    }
  };

  useEffect(() => {
    const stageHost = stageRef.current;
    if (!stageHost) {
      return;
    }

    let disposed = false;
    const disposers: Array<() => void> = [];

    const handleWindowResize = (): void => {
      scheduleFitView();
    };

    const cleanup = (): void => {
      if (disposed) {
        return;
      }

      disposed = true;
      for (const dispose of disposers.splice(0)) {
        dispose();
      }
      window.removeEventListener("resize", handleWindowResize);

      const session = sessionRef.current;
      sessionRef.current = null;
      void session?.dispose().catch(() => undefined);

      const graph = graphRef.current;
      graphRef.current = null;
      graph?.destroy();
    };

    /**
     * 图实例创建与 ready 时序统一收口在这里：
     * 1. 用空图创建 LeaferGraph
     * 2. 等待 `graph.ready`
     * 3. 注册自定义节点定义
     * 4. 创建 Tauri outlet 与 SyncSession
     * 5. 建立文档 / 反馈 / 连接状态订阅
     * 6. 发起 authority 首次连接
     */
    const bootstrap = async (): Promise<void> => {
      const graph = createLeaferGraph(stageHost, {
        document: createEmptyDemoDocument()
      });
      graphRef.current = graph;

      await graph.ready;
      if (disposed) {
        graph.destroy();
        return;
      }

      graph.registerNode(createCounterNodeDefinition(), {
        overwrite: true
      });
      graph.registerNode(createWatchNodeDefinition(), {
        overwrite: true
      });
      setGraphReady(true);

      const outlet = createTauriSyncOutlet();
      const session = createSyncSession({
        documentId: DEMO_DOCUMENT_ID,
        outlet,
        storage: false
      });
      sessionRef.current = session;

      /**
       * authority 文档进入页面后，统一走 `replaceGraphDocument(...)`。
       * 这里不做前端乐观投影，画布始终跟随 authority 快照前进。
       */
      disposers.push(
        session.subscribeDocument((snapshot) => {
          graph.replaceGraphDocument(snapshot);
          setDocumentRevision(snapshot.revision);

          if (!didInitialFitRef.current) {
            didInitialFitRef.current = true;
            scheduleFitView();
          }
        })
      );

      /**
       * runtime feedback 先投影到主包运行态，再写入左侧日志。
       * 这样右侧节点的执行态和左侧文本日志会共用同一份后端反馈来源。
       */
      disposers.push(
        session.subscribeRuntimeFeedback((feedback) => {
          graph.projectRuntimeFeedback(feedback);
          if (feedback.type === "graph.execution") {
            setRuntimeState(mergeRuntimeState(feedback.event.state));
          }
          appendLog(formatRuntimeFeedback(feedback));
        })
      );

      /**
       * 连接状态只负责 UI 可见性与用户提示，
       * 不在页面层自行做重连或恢复裁决。
       */
      disposers.push(
        session.subscribeConnectionStatus((status) => {
          setConnectionStatus(status);
        })
      );

      /**
       * 画布本地交互提交结束后，把正式意图转换成 `document.apply-operation`。
       * 这里不做本地乐观快照合成，仍然以 authority 回推的 snapshot 作为最终真相。
       */
      disposers.push(
        graph.subscribeInteractionCommit((event) => {
          const currentSession = sessionRef.current;
          const currentDocument = currentSession?.getDocumentSnapshot();
          if (!currentSession || !currentDocument) {
            appendLog(`忽略 ${event.type}：authority 文档尚未就绪`);
            return;
          }

          const operations = createOperationsFromInteractionCommit(
            currentDocument,
            event
          );
          if (!operations.length) {
            return;
          }

          void (async () => {
            for (const operation of operations) {
              const ack = await submitSyncCommand(
                createApplyOperationCommand(operation),
                `canvas.${operation.type}`
              );
              if (!ack || ack.status !== "accepted") {
                break;
              }
            }
          })();
        })
      );

      window.addEventListener("resize", handleWindowResize);

      await session.connect();
      if (!disposed) {
        setRuntimeState(DEFAULT_RUNTIME_STATE);
        appendLog("已连接到 Tauri authority，并拉取首份文档快照");
      }
    };

    void bootstrap().catch((error) => {
      appendLog(
        `初始化失败：${
          error instanceof Error ? error.message : String(error)
        }`
      );
    });

    if (import.meta.hot) {
      import.meta.hot.dispose(cleanup);
    }

    return cleanup;
  }, []);

  const backendActionBlockedReason = (() => {
    if (pendingCommandLabel) {
      return `正在等待 ${pendingCommandLabel} 的后端确认`;
    }

    switch (connectionStatus) {
      case "idle":
        return "同步会话尚未连接到 Tauri authority";
      case "connecting":
        return "正在连接 Tauri authority";
      case "disconnected":
        return "与 Tauri authority 的连接已断开";
      case "reconnecting":
        return "正在等待同步会话重连";
      default:
        return undefined;
    }
  })();

  const playBlockedReason =
    backendActionBlockedReason ??
    (runtimeState.status === "idle"
      ? undefined
      : "当前 authority 正在执行，需先回到 idle 或手动 Stop");

  const stepBlockedReason =
    backendActionBlockedReason ??
    (runtimeState.status === "idle"
      ? undefined
      : "当前 authority 正在执行，需先回到 idle 或手动 Stop");

  const stopBlockedReason =
    backendActionBlockedReason ??
    (runtimeState.status === "idle"
      ? "当前没有活动运行可停止"
      : undefined);

  const fitBlockedReason = graphReady
    ? undefined
    : "画布尚未完成初始化，暂时无法执行 fitView";

  const actionStates: DemoGraphActionStates = {
    play: {
      disabled: playBlockedReason !== undefined,
      hint:
        playBlockedReason ??
        "启动后端 play 循环，并持续回推 feedback 与 snapshot"
    },
    step: {
      disabled: stepBlockedReason !== undefined,
      hint:
        stepBlockedReason ??
        "让后端 authority 单步推进一次最小执行链"
    },
    stop: {
      disabled: stopBlockedReason !== undefined,
      hint:
        stopBlockedReason ??
        "停止当前后端 play 循环，并回到 idle"
    },
    fit: {
      disabled: fitBlockedReason !== undefined,
      hint: fitBlockedReason ?? "按当前图内容重新适配右侧视图"
    },
    reset: {
      disabled: backendActionBlockedReason !== undefined,
      hint:
        backendActionBlockedReason ??
        "提交 document.replace，用共享 seed 恢复最小示例图"
    },
    clearLog: {
      disabled: false,
      hint: "只清空左侧 UI 日志，不触发后端动作"
    }
  };

  const actionHint =
    pendingCommandLabel !== null
      ? `正在等待 ${pendingCommandLabel} 的 authority 确认。`
      : connectionStatus !== "connected"
        ? backendActionBlockedReason ?? "同步会话尚未准备完成。"
        : runtimeState.status === "running"
          ? "当前 authority 正在持续执行；可以 Stop，或直接 Reset 恢复示例图。"
          : runtimeState.status === "stepping"
            ? "当前 authority 正在处理单步收尾，完成后会回到 idle。"
            : "当前 authority 处于 idle，可执行 Play、Step 或 Reset。";

  const stageBadges: readonly DemoStageBadge[] = [
    { id: "tauri", label: "Tauri backend" },
    { id: "sync", label: "@leafergraph/sync" },
    {
      id: "connection",
      label: `status:${formatConnectionStatus(connectionStatus)}`
    },
    {
      id: "runtime",
      label: `runtime:${runtimeState.status}`
    }
  ];

  const statusItems: readonly DemoStatusItem[] = [
    {
      id: "document-id",
      label: "Document",
      value: DEMO_DOCUMENT_ID
    },
    {
      id: "connection-status",
      label: "Connection",
      value: formatConnectionStatus(connectionStatus)
    },
    {
      id: "runtime-status",
      label: "Runtime",
      value: formatRuntimeStatus(runtimeState.status)
    },
    {
      id: "runtime-step-count",
      label: "Step Count",
      value: String(runtimeState.stepCount)
    },
    {
      id: "document-revision",
      label: "Revision",
      value:
        documentRevision === undefined ? "尚未同步" : String(documentRevision)
    },
    {
      id: "runtime-source",
      label: "Last Source",
      value: formatRuntimeSource(runtimeState)
    },
    {
      id: "owned-nodes",
      label: "Owned Nodes",
      value: `${EXAMPLE_COUNTER_NODE_TYPE}, ${EXAMPLE_WATCH_NODE_TYPE}`
    }
  ];

  return {
    stageRef,
    logs,
    actions,
    actionStates,
    actionHint,
    stageBadges,
    chainSteps: DEMO_CHAIN_STEPS,
    statusItems
  };
}
