/**
 * 最小执行链 demo 的图生命周期 hook。
 *
 * 页面层不直接持有 `LeaferGraph` 实例，而是统一通过这个 hook 获取：
 * - 画布挂载 ref
 * - 图运行状态
 * - 控制按钮动作
 * - 执行链说明
 * - 运行日志
 *
 * 这样页面壳和图运行时可以保持清晰分层。
 */
import { useEffect, useRef, useState } from "preact/hooks";
import {
  createLeaferGraph,
  type LeaferGraph,
  type LeaferGraphThemeMode
} from "leafergraph";

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

/** `fitView()` 的统一留白，避免节点紧贴画布边缘。 */
const DEFAULT_FIT_VIEW_PADDING = 120;

/** 运行日志最多保留的条目数，避免长时间运行后面板无限膨胀。 */
const MAX_LOG_ENTRIES = 60;

/** 画布顶部辅助 badge，强调这个 demo 的定位。 */
const EXAMPLE_STAGE_BADGES = [
  { id: "public-api", label: "公开 API" },
  { id: "minimal-chain", label: "最小执行链" },
  { id: "auto-theme", label: "Auto Theme" }
] as const;

/** 画布左上角展示的默认执行链说明。 */
const EXAMPLE_CHAIN_STEPS = [
  {
    id: "system-on-play",
    title: "system/on-play",
    description: "图级 play / step 的正式入口。"
  },
  {
    id: "example-counter",
    title: "example/counter",
    description: "每次执行将内部 count 增加后输出。"
  },
  {
    id: "example-watch",
    title: "example/watch",
    description: "把最新输入回显到节点标题。"
  }
] as const;

/** 页面可见的最小图状态。 */
export type ExampleGraphStatus = "loading" | "ready" | "error";

/** 单条日志在页面层的最小投影结构。 */
export interface ExampleLogEntry {
  timestamp: number;
  message: string;
}

/** 页面按钮会用到的动作集合。 */
export interface ExampleGraphActions {
  play(): void;
  step(): void;
  stop(): void;
  fit(): void;
  reset(): void;
  clearLog(): void;
}

/** 页面层消费 hook 结果时使用的完整返回值结构。 */
export interface UseExampleGraphResult {
  stageRef: { current: HTMLDivElement | null };
  logs: readonly ExampleLogEntry[];
  actions: ExampleGraphActions;
  status: ExampleGraphStatus;
  errorMessage: string;
  stageBadges: readonly { id: string; label: string }[];
  chainSteps: readonly { id: string; title: string; description: string }[];
}

/**
 * 解析当前系统主题偏好。
 *
 * demo 既要让 CSS 跟随系统主题，也要让图运行时主题同步切换，
 * 所以这里单独抽成一个 helper 供初始化和监听回调复用。
 */
function resolvePreferredThemeMode(): LeaferGraphThemeMode {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }

  return "dark";
}

/** 对页面层暴露最小图生命周期与控制能力。 */
export function useExampleGraph(): UseExampleGraphResult {
  // `stageRef` 是图实例真正挂载到 DOM 的位置。
  const stageRef = useRef<HTMLDivElement | null>(null);

  // `graphRef` 只在 hook 内部持有，避免页面层直接耦合运行时细节。
  const graphRef = useRef<LeaferGraph | null>(null);
  const [logs, setLogs] = useState<ExampleLogEntry[]>([]);
  const [status, setStatus] = useState<ExampleGraphStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  /** 追加一条日志，并把总量限制在可控范围内。 */
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

  /**
   * 下一帧再执行 `fitView()`。
   *
   * 节点和连线恢复需要先完成一次渲染，
   * 下一帧适配视图会更稳定，不容易拿到旧边界。
   */
  const scheduleFitView = (): void => {
    requestAnimationFrame(() => {
      graphRef.current?.fitView(DEFAULT_FIT_VIEW_PADDING);
    });
  };

  /**
   * 恢复参考示例中的最小执行链。
   *
   * 每次 reset 都走同一条路径：
   * 1. 停掉当前运行
   * 2. 替换为空文档
   * 3. 重新创建节点与连线
   * 4. 适配到当前视口
   */
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
    appendLog("已恢复最小执行链：On Play -> Counter -> Watch");
  };

  /**
   * 页面控制按钮对应的动作集合。
   *
   * 这里统一做“实例是否就绪”的防御判断，
   * 这样页面层只管绑定按钮，不需要重复写判空逻辑。
   */
  const actions: ExampleGraphActions = {
    play() {
      const graph = graphRef.current;
      if (!graph) {
        appendLog("图实例尚未就绪，暂时无法执行 graph.play()");
        return;
      }

      const changed = graph.play();
      appendLog(changed ? "已触发 graph.play()" : "graph.play() 未产生新运行");
    },
    step() {
      const graph = graphRef.current;
      if (!graph) {
        appendLog("图实例尚未就绪，暂时无法执行 graph.step()");
        return;
      }

      const changed = graph.step();
      appendLog(changed ? "已触发 graph.step()" : "graph.step() 未产生新运行");
    },
    stop() {
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
    fit() {
      const graph = graphRef.current;
      if (!graph) {
        appendLog("图实例尚未就绪，暂时无法执行 graph.fitView()");
        return;
      }

      scheduleFitView();
      appendLog("已执行 graph.fitView()");
    },
    reset() {
      resetExampleGraph();
    },
    clearLog() {
      setLogs([]);
    }
  };

  useEffect(() => {
    // 理论上 `stageRef` 在首次挂载后就应该可用，这里保留兜底错误提示。
    const stageHost = stageRef.current;
    if (!stageHost) {
      setStatus("error");
      setErrorMessage("缺少图宿主容器。");
      return;
    }

    let disposed = false;
    let cleanupRuntimeFeedback = (): void => {};
    let cleanupThemeListener = (): void => {};

    /** 浏览器窗口尺寸变化后，重新让图内容适配视图。 */
    const handleWindowResize = (): void => {
      scheduleFitView();
    };

    /**
     * 统一清理当前 hook 挂上的全部副作用。
     *
     * 包括：
     * - 运行反馈订阅
     * - 系统主题监听
     * - window resize 监听
     * - 图实例本身
     */
    const cleanup = (): void => {
      if (disposed) {
        return;
      }

      disposed = true;
      cleanupRuntimeFeedback();
      cleanupThemeListener();
      window.removeEventListener("resize", handleWindowResize);

      const graph = graphRef.current;
      graphRef.current = null;
      graph?.destroy();
    };

    /**
     * 图初始化主流程。
     *
     * 顺序刻意保持固定：
     * 1. 创建空图实例
     * 2. 等待 `graph.ready`
     * 3. 注册自定义节点
     * 4. 建立运行反馈与主题、窗口监听
     * 5. 恢复默认最小执行链
     */
    const bootstrap = async (): Promise<void> => {
      try {
        const graph = createLeaferGraph(stageHost, {
          document: createEmptyExampleDocument(),
          themeMode: resolvePreferredThemeMode()
        });
        graphRef.current = graph;

        const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
        const handleThemeChange = (): void => {
          graph.setThemeMode(resolvePreferredThemeMode());
        };

        // 主题切换时只刷新图主题，不重新创建图实例。
        mediaQuery.addEventListener("change", handleThemeChange);
        cleanupThemeListener = () => {
          mediaQuery.removeEventListener("change", handleThemeChange);
        };

        await graph.ready;
        if (disposed) {
          graph.destroy();
          return;
        }

        // 自定义节点必须在恢复示例图之前注册完成。
        graph.registerNode(createCounterNodeDefinition(), { overwrite: true });
        graph.registerNode(createWatchNodeDefinition(), { overwrite: true });

        // 统一订阅运行反馈，再投影成页面层可直接显示的中文日志。
        cleanupRuntimeFeedback = graph.subscribeRuntimeFeedback((event) => {
          appendLog(formatRuntimeFeedback(event));
        });

        window.addEventListener("resize", handleWindowResize);
        resetExampleGraph();
        setStatus("ready");
        setErrorMessage("");
        appendLog("LeaferGraph 已完成初始化");
      } catch (error) {
        if (disposed) {
          return;
        }

        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "LeaferGraph 初始化失败。"
        );
        appendLog("LeaferGraph 初始化失败");
      }
    };

    void bootstrap();

    // HMR 时主动走同一套清理逻辑，避免保留重复图实例或重复订阅。
    if (import.meta.hot) {
      import.meta.hot.dispose(cleanup);
    }

    return cleanup;
  }, []);

  return {
    stageRef,
    logs,
    actions,
    status,
    errorMessage,
    stageBadges: EXAMPLE_STAGE_BADGES,
    chainSteps: EXAMPLE_CHAIN_STEPS
  };
}
