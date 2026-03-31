import type { NodeRuntimeState } from "@leafergraph/node";
import { LEAFER_GRAPH_ON_PLAY_NODE_TYPE } from "../builtin/on_play_node.js";
import type { LeaferGraphTimerRuntimePayload } from "../builtin/timer_node.js";
import type {
  LeaferGraphExecutionSource,
  LeaferGraphGraphExecutionEvent,
  LeaferGraphGraphExecutionState
} from "../types.js";
import type {
  LeaferGraphNodeExecutionHost,
  LeaferGraphNodeExecutionTask
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
}

interface LeaferGraphGraphExecutionHostOptions<
  TNodeState extends NodeRuntimeState
> {
  nodeExecutionHost: Pick<
    LeaferGraphNodeExecutionHost<TNodeState>,
    | "listNodeIdsByType"
    | "createEntryExecutionTask"
    | "executeExecutionTask"
  >;
}

let graphExecutionRunSeed = 1;

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
    this.clearAllGraphTimers();
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
    if (this.state.status === "running") {
      return false;
    }

    if (this.state.status === "stepping") {
      if (!this.activeRun) {
        return false;
      }

      this.state = {
        ...this.state,
        status: "running",
        runId: this.activeRun.runId,
        stoppedAt: undefined
      };
      this.drainActiveRun();
      this.finalizeRunIfCompleted(this.activeRun);
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
    this.clearGraphTimersForRun(activeRun.runId);
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

    this.clearAllGraphTimers();
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
    if (!activeRun) {
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
    // 再推进核心执行或传播流程，并把结果、事件和运行态统一收口。
    activeRun.queue.push(...result.nextTasks);

    if (this.timerActivatedDuringAdvance) {
      this.state = {
        status: "running",
        runId: activeRun.runId,
        queueSize: activeRun.queue.length,
        stepCount: activeRun.stepCount,
        startedAt: activeRun.startedAt,
        stoppedAt: undefined,
        lastSource: activeRun.source
      };
    } else {
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
    }
    this.emitGraphExecutionEvent("advanced", {
      runId: activeRun.runId,
      source: activeRun.source,
      nodeId: task.nodeId,
      timestamp: Date.now()
    });

    if (this.state.status === "running") {
      this.drainActiveRun();
    }

    if (this.activeRun) {
      this.finalizeRunIfCompleted(this.activeRun);
    }
    return true;
  }

  /**
   * 处理 `drainActiveRun` 相关逻辑。
   *
   * @returns 对应的判断结果。
   */
  private drainActiveRun(): boolean {
    let advanced = false;

    while (this.activeRun?.queue.length) {
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
    if (!activeRun) {
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
    activeRun.queue.push(...result.nextTasks);
    const hasMoreWork =
      activeRun.queue.length > 0 || this.hasActiveTimersForRun(activeRun.runId);
    this.state = {
      status: hasMoreWork ? "running" : "idle",
      runId: hasMoreWork ? activeRun.runId : undefined,
      queueSize: activeRun.queue.length,
      stepCount: activeRun.stepCount,
      startedAt: activeRun.startedAt,
      stoppedAt: hasMoreWork ? undefined : Date.now(),
      lastSource: activeRun.source
    };
    this.emitGraphExecutionEvent("advanced", {
      runId: activeRun.runId,
      source: activeRun.source,
      nodeId: task.nodeId,
      timestamp: Date.now()
    });

    if (!hasMoreWork) {
      this.finalizeRunIfCompleted(activeRun);
    }

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

    this.clearGraphTimersForRun(activeRun.runId);
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
          source: input.source,
          runId: input.runId,
          startedAt: input.startedAt
        });
      },
      unregisterGraphTimer: ({ nodeId, timerId }) => {
        this.clearGraphTimerByKey(
          createGraphTimerKey(input.runId, nodeId, timerId)
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
    this.clearGraphTimerByKey(timerKey);

    const intervalMs = normalizeGraphTimerInterval(input.intervalMs);
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
      handle: timerHandle
    });
    this.timerActivatedDuringAdvance = true;
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
      this.clearGraphTimerByKey(timerKey);
      return;
    }

    if (timer.mode === "interval") {
      timer.handle = setTimeout(() => {
        this.handleGraphTimerTick(runId, nodeId, timer.timerId);
      }, timer.intervalMs);
      this.activeTimersByKey.set(timerKey, timer);
    } else {
      // 再执行核心更新步骤，并同步派生副作用与收尾状态。
      this.activeTimersByKey.delete(timerKey);
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
      this.clearGraphTimerByKey(timerKey);
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
  private clearGraphTimersForRun(runId: string): void {
    for (const [timerKey, timer] of this.activeTimersByKey.entries()) {
      if (timer.runId !== runId) {
        continue;
      }

      clearTimeout(timer.handle);
      this.activeTimersByKey.delete(timerKey);
    }
  }

  /**
   * 清理全部图定时器。
   *
   * @returns 无返回值。
   */
  private clearAllGraphTimers(): void {
    for (const timer of this.activeTimersByKey.values()) {
      clearTimeout(timer.handle);
    }
    this.activeTimersByKey.clear();
  }

  /**
   * 按键值清理图定时器。
   *
   * @param timerKey - 定时器键值。
   * @returns 无返回值。
   */
  private clearGraphTimerByKey(timerKey: string): void {
    const timer = this.activeTimersByKey.get(timerKey);
    if (!timer) {
      return;
    }

    clearTimeout(timer.handle);
    this.activeTimersByKey.delete(timerKey);
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
