/**
 * 图级执行运行时宿主模块。
 *
 * @remarks
 * 负责图级 `play / step / stop` 状态机和任务队列；
 * 节点真正的执行与传播仍然统一委托给节点运行时宿主。
 */

import type {
  LeaferGraphExecutionSource,
  LeaferGraphGraphExecutionEvent,
  LeaferGraphGraphExecutionState
} from "../api/graph_api_types";
import { LEAFER_GRAPH_ON_PLAY_NODE_TYPE } from "../node/builtin/on_play_node";
import type {
  LeaferGraphNodeExecutionTask,
  LeaferGraphNodeRuntimeHost
} from "../node/node_runtime_host";
import type { LeaferGraphRenderableNodeState } from "./graph_runtime_types";

type LeaferGraphGraphExecutionSource = Extract<
  LeaferGraphExecutionSource,
  "graph-play" | "graph-step"
>;

interface LeaferGraphActiveRun {
  runId: string;
  source: LeaferGraphGraphExecutionSource;
  startedAt: number;
  stepCount: number;
  queue: LeaferGraphNodeExecutionTask[];
}

interface LeaferGraphExecutionRuntimeHostOptions<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  nodeRuntimeHost: Pick<
    LeaferGraphNodeRuntimeHost<TNodeState, { state: TNodeState }>,
    | "listNodeIdsByType"
    | "createEntryExecutionTask"
    | "executeExecutionTask"
  >;
}

let graphExecutionRunSeed = 1;

/**
 * 图级执行运行时宿主。
 * 它只处理运行状态、队列和事件；
 * 不直接感知节点定义和连线传播细节。
 */
export class LeaferGraphExecutionRuntimeHost<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  private readonly listeners = new Set<
    (event: LeaferGraphGraphExecutionEvent) => void
  >();

  private readonly options: LeaferGraphExecutionRuntimeHostOptions<TNodeState>;

  private activeRun: LeaferGraphActiveRun | null = null;

  private state: LeaferGraphGraphExecutionState = {
    status: "idle",
    queueSize: 0,
    stepCount: 0
  };

  constructor(options: LeaferGraphExecutionRuntimeHostOptions<TNodeState>) {
    this.options = options;
  }

  /** 读取当前图级执行状态。 */
  getGraphExecutionState(): LeaferGraphGraphExecutionState {
    return cloneGraphExecutionState(this.state);
  }

  /** 订阅图级执行事件。 */
  subscribeGraphExecution(
    listener: (event: LeaferGraphGraphExecutionEvent) => void
  ): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 投影一条来自外部 runtime 的图级执行事件。
   *
   * @remarks
   * remote authority 模式下，图级执行状态以后端为准；
   * 这里仅把后端状态写回当前宿主，并复用现有订阅链通知 UI。
   */
  projectExternalGraphExecution(event: LeaferGraphGraphExecutionEvent): void {
    this.activeRun = null;
    this.state = cloneGraphExecutionState(event.state);

    if (!this.listeners.size) {
      return;
    }

    const snapshot: LeaferGraphGraphExecutionEvent = {
      ...event,
      state: cloneGraphExecutionState(this.state)
    };

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  /**
   * 从全部 `OnPlay` 节点开始正式运行。
   *
   * @returns 图级运行命令是否被接受。
   */
  play(): boolean {
    if (this.state.status === "running") {
      return false;
    }

    if (this.state.status === "stepping") {
      if (!this.activeRun) {
        return false;
      }

      this.state = {
        ...this.state,
        status: "running"
      };
      return this.drainActiveRun();
    }

    return this.startRun("graph-play", "drain");
  }

  /**
   * 单步推进当前图级运行。
   *
   * @returns 单步命令是否被接受。
   */
  step(): boolean {
    if (this.state.status === "running") {
      return false;
    }

    if (this.state.status === "stepping") {
      return this.advanceActiveRun();
    }

    return this.startRun("graph-step", "step");
  }

  /**
   * 停止当前图级运行。
   *
   * @returns 是否成功停止一个活动运行。
   */
  stop(): boolean {
    if (!this.activeRun) {
      return false;
    }

    const activeRun = this.activeRun;
    const stoppedAt = Date.now();
    this.activeRun = null;
    this.state = {
      status: "idle",
      queueSize: 0,
      stepCount: activeRun.stepCount,
      startedAt: activeRun.startedAt,
      stoppedAt,
      lastSource: activeRun.source
    };
    this.emitGraphExecutionEvent("stopped", {
      runId: activeRun.runId,
      source: activeRun.source,
      timestamp: stoppedAt
    });
    return true;
  }

  /**
   * 重置图级执行状态，供整图恢复复用。
   * 这一步会清空队列并回到空闲态。
   */
  resetState(): void {
    const prevRun = this.activeRun;
    const hadExecution =
      Boolean(prevRun) || this.state.status !== "idle" || this.state.queueSize > 0;
    const stoppedAt = hadExecution ? Date.now() : this.state.stoppedAt;

    this.activeRun = null;
    this.state = {
      status: "idle",
      queueSize: 0,
      stepCount: prevRun?.stepCount ?? this.state.stepCount,
      startedAt: prevRun?.startedAt ?? this.state.startedAt,
      stoppedAt,
      lastSource: prevRun?.source ?? this.state.lastSource
    };

    if (hadExecution) {
      this.emitGraphExecutionEvent("stopped", {
        runId: prevRun?.runId,
        source: prevRun?.source,
        timestamp: stoppedAt ?? Date.now()
      });
    }
  }

  /** 创建一轮新的图级运行。 */
  private startRun(
    source: LeaferGraphGraphExecutionSource,
    mode: "drain" | "step"
  ): boolean {
    const startedAt = Date.now();
    const runId = createGraphExecutionRunId(source);
    const queue = this.collectEntryTasks(source, runId, startedAt);
    if (!queue.length) {
      return false;
    }

    this.activeRun = {
      runId,
      source,
      startedAt,
      stepCount: 0,
      queue
    };
    this.state = {
      status: mode === "drain" ? "running" : "stepping",
      runId,
      queueSize: queue.length,
      stepCount: 0,
      startedAt,
      lastSource: source
    };
    this.emitGraphExecutionEvent("started", {
      runId,
      source,
      timestamp: startedAt
    });

    return mode === "drain" ? this.drainActiveRun() : this.advanceActiveRun();
  }

  /** 收集当前图中的全部入口节点任务。 */
  private collectEntryTasks(
    source: LeaferGraphGraphExecutionSource,
    runId: string,
    startedAt: number
  ): LeaferGraphNodeExecutionTask[] {
    const entryNodeIds = this.options.nodeRuntimeHost.listNodeIdsByType(
      LEAFER_GRAPH_ON_PLAY_NODE_TYPE
    );
    const tasks: LeaferGraphNodeExecutionTask[] = [];

    for (const nodeId of entryNodeIds) {
      const task = this.options.nodeRuntimeHost.createEntryExecutionTask(nodeId, {
        source,
        runId,
        startedAt
      });
      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  /** 推进当前活动运行一个节点。 */
  private advanceActiveRun(): boolean {
    const activeRun = this.activeRun;
    if (!activeRun) {
      return false;
    }

    const task = activeRun.queue.shift();
    if (!task) {
      this.finalizeDrainedRun(activeRun);
      return false;
    }

    const result = this.options.nodeRuntimeHost.executeExecutionTask(
      task,
      activeRun.stepCount
    );
    activeRun.stepCount += 1;
    activeRun.queue.push(...result.nextTasks);
    const hasMoreTasks = activeRun.queue.length > 0;
    this.state = {
      status: hasMoreTasks ? "stepping" : "idle",
      runId: hasMoreTasks ? activeRun.runId : undefined,
      queueSize: activeRun.queue.length,
      stepCount: activeRun.stepCount,
      startedAt: activeRun.startedAt,
      stoppedAt: hasMoreTasks ? undefined : Date.now(),
      lastSource: activeRun.source
    };
    this.emitGraphExecutionEvent("advanced", {
      runId: activeRun.runId,
      source: activeRun.source,
      nodeId: task.nodeId,
      timestamp: Date.now()
    });

    if (!hasMoreTasks) {
      this.finalizeDrainedRun(activeRun);
    }

    return true;
  }

  /** 持续消费当前活动运行直到队列清空。 */
  private drainActiveRun(): boolean {
    let advanced = false;

    while (this.activeRun?.queue.length) {
      advanced = this.advanceOneNodeWhileRunning() || advanced;
    }

    return advanced;
  }

  /** 以 `running` 状态推进一个节点。 */
  private advanceOneNodeWhileRunning(): boolean {
    const activeRun = this.activeRun;
    if (!activeRun) {
      return false;
    }

    const task = activeRun.queue.shift();
    if (!task) {
      this.finalizeDrainedRun(activeRun);
      return false;
    }

    const result = this.options.nodeRuntimeHost.executeExecutionTask(
      task,
      activeRun.stepCount
    );
    activeRun.stepCount += 1;
    activeRun.queue.push(...result.nextTasks);
    const hasMoreTasks = activeRun.queue.length > 0;
    this.state = {
      status: hasMoreTasks ? "running" : "idle",
      runId: hasMoreTasks ? activeRun.runId : undefined,
      queueSize: activeRun.queue.length,
      stepCount: activeRun.stepCount,
      startedAt: activeRun.startedAt,
      stoppedAt: hasMoreTasks ? undefined : Date.now(),
      lastSource: activeRun.source
    };
    this.emitGraphExecutionEvent("advanced", {
      runId: activeRun.runId,
      source: activeRun.source,
      nodeId: task.nodeId,
      timestamp: Date.now()
    });

    if (!hasMoreTasks) {
      this.finalizeDrainedRun(activeRun);
    }

    return true;
  }

  /** 结束当前已耗尽队列的运行。 */
  private finalizeDrainedRun(activeRun: LeaferGraphActiveRun): void {
    if (this.activeRun?.runId !== activeRun.runId) {
      return;
    }

    const stoppedAt = Date.now();
    this.activeRun = null;
    this.state = {
      status: "idle",
      queueSize: 0,
      stepCount: activeRun.stepCount,
      startedAt: activeRun.startedAt,
      stoppedAt,
      lastSource: activeRun.source
    };
    this.emitGraphExecutionEvent("drained", {
      runId: activeRun.runId,
      source: activeRun.source,
      timestamp: stoppedAt
    });
  }

  /** 分发一条图级执行事件。 */
  private emitGraphExecutionEvent(
    type: LeaferGraphGraphExecutionEvent["type"],
    input: {
      runId?: string;
      source?: LeaferGraphGraphExecutionSource;
      nodeId?: string;
      timestamp: number;
    }
  ): void {
    if (!this.listeners.size) {
      return;
    }

    const event: LeaferGraphGraphExecutionEvent = {
      type,
      state: cloneGraphExecutionState(this.state),
      runId: input.runId,
      source: input.source,
      nodeId: input.nodeId,
      timestamp: input.timestamp
    };

    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

function createGraphExecutionRunId(source: LeaferGraphGraphExecutionSource): string {
  const runId = `graph:${source}:${Date.now()}:${graphExecutionRunSeed}`;
  graphExecutionRunSeed += 1;
  return runId;
}

function cloneGraphExecutionState(
  state: LeaferGraphGraphExecutionState
): LeaferGraphGraphExecutionState {
  return { ...state };
}
