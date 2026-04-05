import type { NodeRuntimeState } from "@leafergraph/node";
import { LEAFER_GRAPH_ON_PLAY_NODE_TYPE } from "../builtin/on_play_node.js";
import type { LeaferGraphTimerRuntimePayload } from "../builtin/timer_node.js";
import type {
  LeaferGraphExecutionSource,
  LeaferGraphGraphExecutionEvent,
  LeaferGraphGraphExecutionState,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeExecutionState
} from "../types.js";
import type {
  LeaferGraphNodeExecutionHost,
  LeaferGraphNodeExecutionTask,
  LeaferGraphNodeExecutionTaskResult
} from "../node/node_execution_host.js";

type LeaferGraphGraphExecutionSource = Extract<
  LeaferGraphExecutionSource,
  "graph-play" | "graph-step"
>;

interface LeaferGraphActiveRun {
  runId: string;
  source: LeaferGraphGraphExecutionSource;
  startedAt: number;
  stepCount: number;
  mode: "drain" | "step";
  pendingAsyncTaskCount: number;
  queue: LeaferGraphNodeExecutionTask[];
}

interface LeaferGraphActiveTimer {
  timerKey: string;
  runId: string;
  nodeId: string;
  timerId: string;
  mode: "interval" | "timeout";
  source: LeaferGraphGraphExecutionSource;
  startedAt: number;
  intervalMs: number;
  handle: ReturnType<typeof setTimeout>;
  trackProgress: boolean;
  progressChainId: string;
  nextProgressSequence: number;
  progressHandle?: ReturnType<typeof setTimeout>;
  progressElapsedMs: number;
}

interface LeaferGraphTimerProgressNodeSnapshot {
  id: string;
  type: string;
  title?: string;
}

interface LeaferGraphGraphExecutionHostOptions<
  TNodeState extends NodeRuntimeState
> {
  nodeExecutionHost: Pick<
    LeaferGraphNodeExecutionHost<TNodeState>,
    | "listNodeIdsByType"
    | "createEntryExecutionTask"
    | "executeExecutionTask"
  > & {
    getNodeExecutionState?(
      nodeId: string
    ): LeaferGraphNodeExecutionState | undefined;
    getNodeSnapshot?(
      nodeId: string
    ): LeaferGraphTimerProgressNodeSnapshot | undefined;
    projectExternalNodeExecution?(event: LeaferGraphNodeExecutionEvent): void;
  };
}

let graphExecutionRunSeed = 1;
const GRAPH_TIMER_PROGRESS_INTERVAL_STEP_COUNT = 6;
const GRAPH_TIMER_PROGRESS_INTERVAL_MIN_MS = 80;
const GRAPH_TIMER_PROGRESS_INTERVAL_MAX_MS = 220;

/**
 * 封装 LeaferGraphGraphExecutionHost 的宿主能力。
 */
export class LeaferGraphGraphExecutionHost<
  TNodeState extends NodeRuntimeState = NodeRuntimeState
> {
  private readonly listeners = new Set<
    (event: LeaferGraphGraphExecutionEvent) => void
  >();

  private readonly options: LeaferGraphGraphExecutionHostOptions<TNodeState>;

  private activeRun: LeaferGraphActiveRun | null = null;

  private readonly activeTimersByKey = new Map<string, LeaferGraphActiveTimer>();

  private timerActivatedDuringAdvance = false;

  private state: LeaferGraphGraphExecutionState = {
    status: "idle",
    queueSize: 0,
    stepCount: 0
  };

  /**
   * 初始化 LeaferGraphGraphExecutionHost 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(options: LeaferGraphGraphExecutionHostOptions<TNodeState>) {
    this.options = options;
  }

  /**
   * 获取图执行状态。
   *
   * @returns 处理后的结果。
   */
  getGraphExecutionState(): LeaferGraphGraphExecutionState {
    return cloneGraphExecutionState(this.state);
  }

  /**
   * 订阅图执行。
   *
   * @param listener - 需要注册的监听器。
   * @returns 用于取消当前订阅的清理函数。
   */
  subscribeGraphExecution(
    listener: (event: LeaferGraphGraphExecutionEvent) => void
  ): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 映射外部图执行。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  projectExternalGraphExecution(event: LeaferGraphGraphExecutionEvent): void {
    this.clearAllGraphTimers(false);
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
   * 处理 `play` 相关逻辑。
   *
   * @returns 对应的判断结果。
   */
  play(): boolean {
    const activeRun = this.activeRun;
    if (this.state.status === "running") {
      if (activeRun?.mode === "step") {
        activeRun.mode = "drain";
        this.state = {
          ...this.state,
          status: "running",
          runId: activeRun.runId,
          stoppedAt: undefined
        };
        return true;
      }
      return false;
    }

    if (this.state.status === "stepping") {
      if (!activeRun) {
        return false;
      }

      activeRun.mode = "drain";
      this.state = {
        ...this.state,
        status: "running",
        runId: activeRun.runId,
        stoppedAt: undefined
      };
      this.drainActiveRun();
      if (this.activeRun) {
        this.finalizeRunIfCompleted(this.activeRun);
      }
      return true;
    }

    return this.startRun("graph-play", "drain");
  }

  /**
   * 处理 `step` 相关逻辑。
   *
   * @returns 对应的判断结果。
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
   * 处理 `stop` 相关逻辑。
   *
   * @returns 对应的判断结果。
   */
  stop(): boolean {
    if (!this.activeRun) {
      return false;
    }

    const activeRun = this.activeRun;
    this.clearGraphTimersForRun(activeRun.runId, true);
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
   * 重置状态。
   *
   * @returns 无返回值。
   */
  resetState(): void {
    const prevRun = this.activeRun;
    const hadExecution =
      Boolean(prevRun) || this.state.status !== "idle" || this.state.queueSize > 0;
    const stoppedAt = hadExecution ? Date.now() : this.state.stoppedAt;

    this.clearAllGraphTimers(true);
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

  /**
   * 处理 `startRun` 相关逻辑。
   *
   * @param source - 当前来源对象。
   * @param mode - 模式。
   * @returns 对应的判断结果。
   */
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
      mode,
      pendingAsyncTaskCount: 0,
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

    if (mode === "drain") {
      const advanced = this.drainActiveRun();
      if (this.activeRun) {
        this.finalizeRunIfCompleted(this.activeRun);
      }
      return advanced;
    }

    return this.advanceActiveRun();
  }

  /**
   * 收集条目任务。
   *
   * @param source - 当前来源对象。
   * @param runId - 当前运行 ID。
   * @param startedAt - `startedAt` 参数。
   * @returns 收集条目任务的结果。
   */
  private collectEntryTasks(
    source: LeaferGraphGraphExecutionSource,
    runId: string,
    startedAt: number
  ): LeaferGraphNodeExecutionTask[] {
    const entryNodeIds = this.options.nodeExecutionHost.listNodeIdsByType(
      LEAFER_GRAPH_ON_PLAY_NODE_TYPE
    );
    const tasks: LeaferGraphNodeExecutionTask[] = [];

    for (const nodeId of entryNodeIds) {
      const task = this.options.nodeExecutionHost.createEntryExecutionTask(nodeId, {
        source,
        runId,
        startedAt,
        payload: this.createExecutionPayload({
          source,
          runId,
          startedAt
        })
      });
      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  /**
   * 推进活动运行。
   *
   * @returns 对应的判断结果。
   */
  private advanceActiveRun(): boolean {
    // 先整理本轮执行所需的输入、上下文和前置约束，避免后续阶段重复分散取值。
    const activeRun = this.activeRun;
    if (!activeRun || activeRun.pendingAsyncTaskCount > 0) {
      return false;
    }

    const task = activeRun.queue.shift();
    if (!task) {
      this.finalizeRunIfCompleted(activeRun);
      return false;
    }

    this.timerActivatedDuringAdvance = false;
    const result = this.options.nodeExecutionHost.executeExecutionTask(
      task,
      activeRun.stepCount
    );
    activeRun.stepCount += 1;
    if (isPromiseLike(result)) {
      this.handlePendingAsyncTask(activeRun, task, result);
      return true;
    }

    this.handleCompletedTaskResult(activeRun, task, result);
    return true;
  }

  /**
   * 处理 `drainActiveRun` 相关逻辑。
   *
   * @returns 对应的判断结果。
   */
  private drainActiveRun(): boolean {
    let advanced = false;

    while (this.activeRun?.queue.length && !this.activeRun.pendingAsyncTaskCount) {
      advanced = this.advanceOneNodeWhileRunning() || advanced;
    }

    return advanced;
  }

  /**
   * 处理 `advanceOneNodeWhileRunning` 相关逻辑。
   *
   * @returns 对应的判断结果。
   */
  private advanceOneNodeWhileRunning(): boolean {
    // 先整理本轮执行所需的输入、上下文和前置约束，避免后续阶段重复分散取值。
    const activeRun = this.activeRun;
    if (!activeRun || activeRun.pendingAsyncTaskCount > 0) {
      return false;
    }

    const task = activeRun.queue.shift();
    if (!task) {
      this.finalizeRunIfCompleted(activeRun);
      return false;
    }

    this.timerActivatedDuringAdvance = false;
    // 再推进核心执行或传播流程，并把结果、事件和运行态统一收口。
    const result = this.options.nodeExecutionHost.executeExecutionTask(
      task,
      activeRun.stepCount
    );
    activeRun.stepCount += 1;
    if (isPromiseLike(result)) {
      this.handlePendingAsyncTask(activeRun, task, result);
      return true;
    }

    this.handleCompletedTaskResult(activeRun, task, result);

    return true;
  }

  /**
   * 处理 `finalizeRunIfCompleted` 相关逻辑。
   *
   * @param activeRun - 活动运行。
   * @returns 无返回值。
   */
  private finalizeRunIfCompleted(activeRun: LeaferGraphActiveRun): void {
    if (this.activeRun?.runId !== activeRun.runId) {
      return;
    }

    if (activeRun.queue.length > 0) {
      return;
    }

    if (activeRun.pendingAsyncTaskCount > 0) {
      return;
    }

    if (this.hasActiveTimersForRun(activeRun.runId)) {
      this.state = {
        status: "running",
        runId: activeRun.runId,
        queueSize: 0,
        stepCount: activeRun.stepCount,
        startedAt: activeRun.startedAt,
        stoppedAt: undefined,
        lastSource: activeRun.source
      };
      return;
    }

    this.finalizeDrainedRun(activeRun);
  }

  /**
   * 处理 `finalizeDrainedRun` 相关逻辑。
   *
   * @param activeRun - 活动运行。
   * @returns 无返回值。
   */
  private finalizeDrainedRun(activeRun: LeaferGraphActiveRun): void {
    if (this.activeRun?.runId !== activeRun.runId) {
      return;
    }

    this.clearGraphTimersForRun(activeRun.runId, false);
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

  /**
   * 创建执行载荷。
   *
   * @param input - 输入参数。
   * @returns 创建后的结果对象。
   */
  private createExecutionPayload(input: {
    source: LeaferGraphGraphExecutionSource;
    runId: string;
    startedAt: number;
    timerTickNodeId?: string;
    timerTickTimerId?: string;
    timerTickMode?: "interval" | "timeout";
  }): LeaferGraphTimerRuntimePayload {
    return {
      timerTickNodeId: input.timerTickNodeId,
      timerTickTimerId: input.timerTickTimerId,
      timerTickMode: input.timerTickMode,
      registerGraphTimer: (registration) => {
        this.registerGraphTimer({
          nodeId: registration.nodeId,
          intervalMs: registration.intervalMs,
          immediate: registration.immediate,
          timerId: registration.timerId,
          mode: registration.mode,
          trackProgress: registration.trackProgress,
          source: input.source,
          runId: input.runId,
          startedAt: input.startedAt
        });
      },
      unregisterGraphTimer: ({ nodeId, timerId }) => {
        this.clearGraphTimerByKey(
          createGraphTimerKey(input.runId, nodeId, timerId),
          true
        );
      }
    };
  }

  /**
   * 注册图定时器。
   *
   * @param input - 输入参数。
   * @returns 无返回值。
   */
  private registerGraphTimer(input: {
    nodeId: string;
    intervalMs: number;
    immediate: boolean;
    timerId?: string;
    mode?: "interval" | "timeout";
    trackProgress?: boolean;
    source: LeaferGraphGraphExecutionSource;
    runId: string;
    startedAt: number;
  }): void {
    const activeRun = this.activeRun;
    if (!activeRun || activeRun.runId !== input.runId) {
      return;
    }

    const timerId = normalizeGraphTimerId(input.timerId);
    const timerMode = normalizeGraphTimerMode(input.mode);
    const timerKey = createGraphTimerKey(input.runId, input.nodeId, timerId);
    const intervalMs = normalizeGraphTimerInterval(input.intervalMs);
    const trackProgress = Boolean(
      input.trackProgress && timerMode === "timeout" && intervalMs > 0
    );
    const existingTimer = this.activeTimersByKey.get(timerKey);
    // Interval timer 在 tick 回调开始时已经预订了下一次触发；
    // 如果本轮执行再次以同配置注册，就复用现有调度，避免把执行耗时叠进帧间隔。
    if (
      existingTimer &&
      existingTimer.mode === timerMode &&
      existingTimer.intervalMs === intervalMs
    ) {
      this.timerActivatedDuringAdvance = true;
      return;
    }

    this.clearGraphTimerByKey(timerKey, false);
    const timerHandle = setTimeout(() => {
      this.handleGraphTimerTick(input.runId, input.nodeId, timerId);
    }, intervalMs);

    this.activeTimersByKey.set(timerKey, {
      timerKey,
      runId: input.runId,
      nodeId: input.nodeId,
      timerId,
      mode: timerMode,
      source: input.source,
      startedAt: input.startedAt,
      intervalMs,
      handle: timerHandle,
      trackProgress,
      progressChainId: createGraphTimerProgressChainId(
        input.runId,
        input.nodeId,
        timerId
      ),
      nextProgressSequence: 0,
      progressElapsedMs: 0
    });
    this.timerActivatedDuringAdvance = true;

    if (trackProgress) {
      queueMicrotask(() => {
        const activeTimer = this.activeTimersByKey.get(timerKey);
        if (!activeTimer?.trackProgress) {
          return;
        }

        this.emitGraphTimerNodeExecution(activeTimer, "running", 0);
        this.scheduleGraphTimerProgressTick(activeTimer.timerKey);
      });
    }
  }

  /**
   * 处理图定时器`Tick`。
   *
   * @param runId - 当前运行 ID。
   * @param nodeId - 目标节点 ID。
   * @param timerId - 当前定时器 ID。
   * @returns 无返回值。
   */
  private handleGraphTimerTick(
    runId: string,
    nodeId: string,
    timerId = DEFAULT_GRAPH_TIMER_ID
  ): void {
    // 先读取当前目标状态与上下文约束，避免处理中出现不一致的中间态。
    const timerKey = createGraphTimerKey(runId, nodeId, timerId);
    const timer = this.activeTimersByKey.get(timerKey);
    if (!timer) {
      return;
    }

    const activeRun = this.activeRun;
    if (!activeRun || activeRun.runId !== runId) {
      this.clearGraphTimerByKey(timerKey, false);
      return;
    }

    if (timer.mode === "interval") {
      timer.handle = setTimeout(() => {
        this.handleGraphTimerTick(runId, nodeId, timer.timerId);
      }, timer.intervalMs);
      this.activeTimersByKey.set(timerKey, timer);
    } else {
      // 再执行核心更新步骤，并同步派生副作用与收尾状态。
      this.clearGraphTimerByKey(timerKey, false);
    }

    const task = this.options.nodeExecutionHost.createEntryExecutionTask(nodeId, {
      source: timer.source,
      runId: timer.runId,
      startedAt: timer.startedAt,
      payload: this.createExecutionPayload({
        source: timer.source,
        runId: timer.runId,
        startedAt: timer.startedAt,
        timerTickNodeId: nodeId,
        timerTickTimerId: timer.timerId,
        timerTickMode: timer.mode
      })
    });

    if (!task) {
      this.clearGraphTimerByKey(timerKey, true);
      this.finalizeRunIfCompleted(activeRun);
      return;
    }

    activeRun.queue.push(task);
    this.state = {
      status: "running",
      runId: activeRun.runId,
      queueSize: activeRun.queue.length,
      stepCount: activeRun.stepCount,
      startedAt: activeRun.startedAt,
      stoppedAt: undefined,
      lastSource: activeRun.source
    };

    this.drainActiveRun();
    if (this.activeRun) {
      this.finalizeRunIfCompleted(this.activeRun);
    }
  }

  private handlePendingAsyncTask(
    activeRun: LeaferGraphActiveRun,
    task: LeaferGraphNodeExecutionTask,
    result: PromiseLike<LeaferGraphNodeExecutionTaskResult>
  ): void {
    activeRun.pendingAsyncTaskCount += 1;
    this.state = {
      status: "running",
      runId: activeRun.runId,
      queueSize: activeRun.queue.length,
      stepCount: activeRun.stepCount,
      startedAt: activeRun.startedAt,
      stoppedAt: undefined,
      lastSource: activeRun.source
    };

    void result.then(
      (resolvedResult) => {
        this.resumeAsyncTask(activeRun.runId, task, resolvedResult);
      },
      (error) => {
        console.error("[leafergraph] 图执行宿主等待异步节点结果失败", error);
        this.resumeAsyncTask(activeRun.runId, task, {
          handled: true,
          nextTasks: []
        });
      }
    );
  }

  private resumeAsyncTask(
    runId: string,
    task: LeaferGraphNodeExecutionTask,
    result: LeaferGraphNodeExecutionTaskResult
  ): void {
    const activeRun = this.activeRun;
    if (!activeRun || activeRun.runId !== runId) {
      return;
    }

    activeRun.pendingAsyncTaskCount = Math.max(0, activeRun.pendingAsyncTaskCount - 1);
    this.handleCompletedTaskResult(activeRun, task, result);
  }

  private handleCompletedTaskResult(
    activeRun: LeaferGraphActiveRun,
    task: LeaferGraphNodeExecutionTask,
    result: LeaferGraphNodeExecutionTaskResult
  ): void {
    activeRun.queue.push(...result.nextTasks);
    const hasActiveTimers = this.hasActiveTimersForRun(activeRun.runId);
    const hasPendingAsync = activeRun.pendingAsyncTaskCount > 0;
    const hasMoreTasks = activeRun.queue.length > 0;
    const waitingForMoreWork =
      hasMoreTasks || hasActiveTimers || hasPendingAsync || this.timerActivatedDuringAdvance;

    if (activeRun.mode === "drain") {
      this.state = {
        status: waitingForMoreWork ? "running" : "idle",
        runId: waitingForMoreWork ? activeRun.runId : undefined,
        queueSize: activeRun.queue.length,
        stepCount: activeRun.stepCount,
        startedAt: activeRun.startedAt,
        stoppedAt: waitingForMoreWork ? undefined : Date.now(),
        lastSource: activeRun.source
      };
    } else if (waitingForMoreWork) {
      this.state = {
        status:
          hasPendingAsync || hasActiveTimers || this.timerActivatedDuringAdvance
            ? "running"
            : "stepping",
        runId: activeRun.runId,
        queueSize: activeRun.queue.length,
        stepCount: activeRun.stepCount,
        startedAt: activeRun.startedAt,
        stoppedAt: undefined,
        lastSource: activeRun.source
      };
    } else {
      this.state = {
        status: "idle",
        queueSize: 0,
        stepCount: activeRun.stepCount,
        startedAt: activeRun.startedAt,
        stoppedAt: Date.now(),
        lastSource: activeRun.source
      };
    }

    this.emitGraphExecutionEvent("advanced", {
      runId: activeRun.runId,
      source: activeRun.source,
      nodeId: task.nodeId,
      timestamp: Date.now()
    });

    if (activeRun.mode === "drain" && !activeRun.pendingAsyncTaskCount) {
      this.drainActiveRun();
    }

    if (this.activeRun) {
      this.finalizeRunIfCompleted(this.activeRun);
    }
  }

  /**
   * 安排图定时器进度更新。
   *
   * @param timerKey - 定时器键值。
   * @returns 无返回值。
   */
  private scheduleGraphTimerProgressTick(timerKey: string): void {
    const timer = this.activeTimersByKey.get(timerKey);
    if (!timer?.trackProgress) {
      return;
    }

    if (timer.progressHandle) {
      clearTimeout(timer.progressHandle);
    }

    timer.progressHandle = setTimeout(() => {
      this.handleGraphTimerProgressTick(timerKey);
    }, resolveGraphTimerProgressInterval(timer.intervalMs));
    this.activeTimersByKey.set(timerKey, timer);
  }

  /**
   * 处理图定时器进度更新。
   *
   * @param timerKey - 定时器键值。
   * @returns 无返回值。
   */
  private handleGraphTimerProgressTick(timerKey: string): void {
    const timer = this.activeTimersByKey.get(timerKey);
    if (!timer?.trackProgress) {
      return;
    }

    timer.progressHandle = undefined;
    const nextElapsedMs = Math.min(
      timer.progressElapsedMs + resolveGraphTimerProgressInterval(timer.intervalMs),
      timer.intervalMs
    );

    if (nextElapsedMs >= timer.intervalMs) {
      timer.progressElapsedMs = timer.intervalMs;
      this.activeTimersByKey.set(timerKey, timer);
      return;
    }

    timer.progressElapsedMs = nextElapsedMs;
    this.activeTimersByKey.set(timerKey, timer);
    this.emitGraphTimerNodeExecution(
      timer,
      "running",
      nextElapsedMs / timer.intervalMs
    );
    this.scheduleGraphTimerProgressTick(timerKey);
  }

  /**
   * 投影图定时器期间的节点执行态。
   *
   * @param timer - 活动定时器。
   * @param status - 节点状态。
   * @param progress - 当前进度。
   * @returns 无返回值。
   */
  private emitGraphTimerNodeExecution(
    timer: LeaferGraphActiveTimer,
    status: "running" | "idle",
    progress?: number
  ): void {
    const snapshot = this.options.nodeExecutionHost.getNodeSnapshot?.(timer.nodeId);
    if (!snapshot) {
      return;
    }
    const nodeTitle =
      typeof snapshot.title === "string" && snapshot.title.trim().length > 0
        ? snapshot.title
        : snapshot.type;

    const previousState =
      this.options.nodeExecutionHost.getNodeExecutionState?.(timer.nodeId);
    const safeProgress =
      status === "running" ? normalizeGraphTimerProgress(progress) : undefined;

    this.options.nodeExecutionHost.projectExternalNodeExecution?.({
      chainId: timer.progressChainId,
      rootNodeId: snapshot.id,
      rootNodeType: snapshot.type,
      rootNodeTitle: nodeTitle,
      nodeId: snapshot.id,
      nodeType: snapshot.type,
      nodeTitle,
      depth: 0,
      sequence: timer.nextProgressSequence++,
      source: timer.source,
      trigger: "direct",
      timestamp: Date.now(),
      executionContext: {
        source: timer.source,
        runId: timer.runId,
        entryNodeId: snapshot.id,
        stepIndex: timer.nextProgressSequence - 1,
        startedAt: timer.startedAt
      },
      state:
        status === "running"
          ? {
              status: "running",
              runCount: previousState?.runCount ?? 0,
              progress: safeProgress,
              lastExecutedAt:
                previousState?.lastExecutedAt ?? previousState?.lastSucceededAt
            }
          : {
              status: "idle",
              runCount: previousState?.runCount ?? 0,
              lastExecutedAt: previousState?.lastExecutedAt,
              lastSucceededAt: previousState?.lastSucceededAt,
              lastFailedAt: previousState?.lastFailedAt,
              lastErrorMessage: previousState?.lastErrorMessage
            }
    });
  }

  /**
   * 判断运行是否存在活动定时器。
   *
   * @param runId - 当前运行 ID。
   * @returns 对应的判断结果。
   */
  private hasActiveTimersForRun(runId: string): boolean {
    for (const timer of this.activeTimersByKey.values()) {
      if (timer.runId === runId) {
        return true;
      }
    }

    return false;
  }

  /**
   * 为运行清理图定时器。
   *
   * @param runId - 当前运行 ID。
   * @returns 无返回值。
   */
  private clearGraphTimersForRun(runId: string, emitIdle: boolean): void {
    for (const [timerKey, timer] of this.activeTimersByKey.entries()) {
      if (timer.runId !== runId) {
        continue;
      }

      this.clearActiveTimer(timerKey, timer, emitIdle);
    }
  }

  /**
   * 清理全部图定时器。
   *
   * @returns 无返回值。
   */
  private clearAllGraphTimers(emitIdle: boolean): void {
    for (const [timerKey, timer] of this.activeTimersByKey.entries()) {
      this.clearActiveTimer(timerKey, timer, emitIdle);
    }
  }

  /**
   * 按键值清理图定时器。
   *
   * @param timerKey - 定时器键值。
   * @returns 无返回值。
   */
  private clearGraphTimerByKey(timerKey: string, emitIdle: boolean): void {
    const timer = this.activeTimersByKey.get(timerKey);
    if (!timer) {
      return;
    }

    this.clearActiveTimer(timerKey, timer, emitIdle);
  }

  /**
   * 清理一个活动定时器，并按需把等待中的节点恢复到 idle。
   *
   * @param timerKey - 定时器键值。
   * @param timer - 活动定时器。
   * @param emitIdle - 是否同步投影 idle。
   * @returns 无返回值。
   */
  private clearActiveTimer(
    timerKey: string,
    timer: LeaferGraphActiveTimer,
    emitIdle: boolean
  ): void {
    clearTimeout(timer.handle);
    if (timer.progressHandle) {
      clearTimeout(timer.progressHandle);
    }

    this.activeTimersByKey.delete(timerKey);
    if (emitIdle && timer.trackProgress) {
      this.emitGraphTimerNodeExecution(timer, "idle");
    }
  }

  /**
   * 派发图执行事件。
   *
   * @param type - 类型。
   * @param input - 输入参数。
   * @returns 无返回值。
   */
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

/**
 * 创建图执行运行 ID。
 *
 * @param source - 当前来源对象。
 * @returns 创建后的结果对象。
 */
function createGraphExecutionRunId(source: LeaferGraphGraphExecutionSource): string {
  const runId = `graph:${source}:${Date.now()}:${graphExecutionRunSeed}`;
  graphExecutionRunSeed += 1;
  return runId;
}

/**
 * 克隆图执行状态。
 *
 * @param state - 当前状态。
 * @returns 处理后的结果。
 */
function cloneGraphExecutionState(
  state: LeaferGraphGraphExecutionState
): LeaferGraphGraphExecutionState {
  return { ...state };
}

const DEFAULT_GRAPH_TIMER_ID = "default";

/**
 * 创建图定时器键值。
 *
 * @param runId - 当前运行 ID。
 * @param nodeId - 目标节点 ID。
 * @param timerId - 当前定时器 ID。
 * @returns 创建后的结果对象。
 */
function createGraphTimerKey(
  runId: string,
  nodeId: string,
  timerId = DEFAULT_GRAPH_TIMER_ID
): string {
  return `${runId}::${nodeId}::${timerId}`;
}

/**
 * 规范化图定时器间隔。
 *
 * @param intervalMs - 间隔`Ms`。
 * @returns 处理后的结果。
 */
function normalizeGraphTimerInterval(intervalMs: number): number {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return 1000;
  }

  return Math.max(1, Math.floor(intervalMs));
}

/**
 * 规范化图定时器 ID。
 *
 * @param timerId - 当前定时器 ID。
 * @returns 处理后的结果。
 */
function normalizeGraphTimerId(timerId: string | undefined): string {
  return timerId?.trim() || DEFAULT_GRAPH_TIMER_ID;
}

/**
 * 规范化图定时器模式。
 *
 * @param mode - 模式。
 * @returns 处理后的结果。
 */
function normalizeGraphTimerMode(
  mode: "interval" | "timeout" | undefined
): "interval" | "timeout" {
  return mode === "timeout" ? "timeout" : "interval";
}

/**
 * 创建图定时器进度链路 ID。
 *
 * @param runId - 当前运行 ID。
 * @param nodeId - 目标节点 ID。
 * @param timerId - 当前定时器 ID。
 * @returns 创建后的结果对象。
 */
function createGraphTimerProgressChainId(
  runId: string,
  nodeId: string,
  timerId: string
): string {
  return `graph-timer:${runId}:${nodeId}:${timerId}`;
}

/**
 * 解析图定时器进度更新间隔。
 *
 * @param intervalMs - 间隔毫秒数。
 * @returns 处理后的结果。
 */
function resolveGraphTimerProgressInterval(intervalMs: number): number {
  const stepMs = Math.floor(
    normalizeGraphTimerInterval(intervalMs) / GRAPH_TIMER_PROGRESS_INTERVAL_STEP_COUNT
  );

  return Math.max(
    GRAPH_TIMER_PROGRESS_INTERVAL_MIN_MS,
    Math.min(
      GRAPH_TIMER_PROGRESS_INTERVAL_MAX_MS,
      stepMs || GRAPH_TIMER_PROGRESS_INTERVAL_MIN_MS
    )
  );
}

/**
 * 规范化图定时器进度。
 *
 * @param progress - 原始进度值。
 * @returns 处理后的结果。
 */
function normalizeGraphTimerProgress(progress: number | undefined): number | undefined {
  if (typeof progress !== "number" || !Number.isFinite(progress)) {
    return undefined;
  }

  return Math.max(0, Math.min(1, progress));
}

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}
