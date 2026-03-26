/**
 * 最小图示例图生命周期 hook。
 *
 * @remarks
 * 负责统一管理：
 * - `LeaferGraph` 实例创建与销毁
 * - 节点注册与最小示例图恢复
 * - 运行反馈订阅与日志投影
 * - 页面动作按钮对应的图操作
 */
import { useEffect, useRef, useState } from "preact/hooks";

import { createLeaferGraph, type LeaferGraph } from "leafergraph";

import {
  createEmptyExampleDocument,
  createExampleSeedLinks,
  createExampleSeedNodes
} from "./example_document";
import {
  createCounterNodeDefinition,
  createWatchNodeDefinition
} from "./example_nodes";
import { formatRuntimeFeedback } from "./runtime_feedback_format";

const MAX_LOG_ENTRIES = 60;
const DEFAULT_FIT_VIEW_PADDING = 120;

const EXAMPLE_STAGE_BADGES: readonly ExampleStageBadge[] = [
  { id: "no-editor", label: "无 editor" },
  { id: "no-authority", label: "无 authority" },
  { id: "core-direct", label: "主包直连" }
];

const EXAMPLE_CHAIN_STEPS: readonly ExampleChainStep[] = [
  {
    id: "system-on-play",
    title: "system/on-play",
    description: "作为图级执行入口。"
  },
  {
    id: "example-counter",
    title: "example/counter",
    description: "每次执行把内部计数加一并输出。"
  },
  {
    id: "example-watch",
    title: "example/watch",
    description: "把最近一次输入值显示在节点标题里。"
  }
];

/** UI 日志中的一条最小记录。 */
export interface ExampleLogEntry {
  /** 日志产生时间戳。 */
  timestamp: number;
  /** 当前日志的人类可读文案。 */
  message: string;
}

/** 右侧画布卡片 badge 的最小结构。 */
export interface ExampleStageBadge {
  /** badge 稳定标识。 */
  id: string;
  /** badge 展示文案。 */
  label: string;
}

/** 当前最小执行链中的一个阅读步骤。 */
export interface ExampleChainStep {
  /** 步骤稳定标识。 */
  id: string;
  /** 步骤标题。 */
  title: string;
  /** 步骤说明。 */
  description: string;
}

/** UI 可直接消费的最小动作集合。 */
export interface ExampleGraphActions {
  /** 触发图级 `play`。 */
  play(): void;
  /** 触发图级 `step`。 */
  step(): void;
  /** 触发图级 `stop`。 */
  stop(): void;
  /** 对当前图执行 `fitView`。 */
  fit(): void;
  /** 恢复默认最小执行链。 */
  reset(): void;
  /** 清空当前日志列表。 */
  clearLog(): void;
}

/** `useExampleGraph()` 对页面层暴露的最小结果。 */
export interface UseExampleGraphResult {
  /** 右侧画布实际挂载点。 */
  stageRef: { current: HTMLDivElement | null };
  /** 当前运行日志。 */
  logs: readonly ExampleLogEntry[];
  /** 页面层可直接绑定的图动作。 */
  actions: ExampleGraphActions;
  /** 右侧画布卡片 badge 数据。 */
  stageBadges: readonly ExampleStageBadge[];
  /** 左侧执行链说明步骤。 */
  chainSteps: readonly ExampleChainStep[];
}

/**
 * 最小图示例主 hook。
 *
 * @returns 当前示例所需的图挂载 ref、日志、动作和只读展示数据。
 */
export function useExampleGraph(): UseExampleGraphResult {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<LeaferGraph | null>(null);
  const [logs, setLogs] = useState<ExampleLogEntry[]>([]);

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

  const resetExampleGraph = (): void => {
    const graph = graphRef.current;
    if (!graph) {
      appendLog("图实例尚未就绪，暂时无法恢复示例图");
      return;
    }

    graph.stop();
    graph.replaceGraphDocument(createEmptyExampleDocument());

    for (const nodeInput of createExampleSeedNodes()) {
      graph.createNode(nodeInput);
    }
    for (const linkInput of createExampleSeedLinks()) {
      graph.createLink(linkInput);
    }

    scheduleFitView();
    appendLog("已恢复最小图：On Play -> Counter -> Watch");
  };

  const actions: ExampleGraphActions = {
    play(): void {
      const graph = graphRef.current;
      if (!graph) {
        appendLog("图实例尚未就绪，暂时无法执行 graph.play()");
        return;
      }

      const changed = graph.play();
      appendLog(changed ? "已触发 graph.play()" : "graph.play() 未产生新运行");
    },
    step(): void {
      const graph = graphRef.current;
      if (!graph) {
        appendLog("图实例尚未就绪，暂时无法执行 graph.step()");
        return;
      }

      const changed = graph.step();
      appendLog(changed ? "已触发 graph.step()" : "graph.step() 未产生新运行");
    },
    stop(): void {
      const graph = graphRef.current;
      if (!graph) {
        appendLog("图实例尚未就绪，暂时无法执行 graph.stop()");
        return;
      }

      const changed = graph.stop();
      appendLog(
        changed
          ? "已触发 graph.stop()"
          : "graph.stop() 没有活动运行可停止"
      );
    },
    fit(): void {
      if (!graphRef.current) {
        appendLog("图实例尚未就绪，暂时无法执行 graph.fitView()");
        return;
      }

      scheduleFitView();
      appendLog("已执行 graph.fitView()");
    },
    reset(): void {
      resetExampleGraph();
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
    let disposeRuntimeFeedback = (): void => {};

    const handleWindowResize = (): void => {
      scheduleFitView();
    };

    const cleanup = (): void => {
      if (disposed) {
        return;
      }

      disposed = true;
      disposeRuntimeFeedback();
      window.removeEventListener("resize", handleWindowResize);

      const graph = graphRef.current;
      graphRef.current = null;
      graph?.destroy();
    };

    /**
     * 图实例创建与 ready 时序统一收口在这里：
     * 1. 用空图创建主包实例
     * 2. 等待 `graph.ready`
     * 3. 注册示例节点
     * 4. 建立运行反馈订阅和 resize 响应
     * 5. 恢复默认最小执行链
     */
    const bootstrap = async (): Promise<void> => {
      const graph = createLeaferGraph(stageHost, {
        document: createEmptyExampleDocument()
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

      /**
       * 运行反馈进入页面后，不再手工拼 DOM，
       * 而是统一转成短文本日志并投影到 Preact state。
       */
      disposeRuntimeFeedback = graph.subscribeRuntimeFeedback((event) => {
        appendLog(formatRuntimeFeedback(event));
      });

      window.addEventListener("resize", handleWindowResize);

      /**
       * 节点注册完成后立即恢复默认示例图，
       * 保证页面第一次打开就能看到最小执行链。
       */
      resetExampleGraph();
    };

    void bootstrap();

    /**
     * 卸载与 HMR 都走同一套清理逻辑：
     * - 取消运行反馈订阅
     * - 移除窗口 resize 监听
     * - 销毁图实例
     *
     * 这样可以避免热更新后残留重复订阅或多个图实例。
     */
    if (import.meta.hot) {
      import.meta.hot.dispose(cleanup);
    }

    return cleanup;
  }, []);

  return {
    stageRef,
    logs,
    actions,
    stageBadges: EXAMPLE_STAGE_BADGES,
    chainSteps: EXAMPLE_CHAIN_STEPS
  };
}
