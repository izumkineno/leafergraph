/**
 * 最小空画布 demo 的图生命周期 hook。
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
  type LeaferGraphThemeMode,
  type RuntimeFeedbackEvent
} from "leafergraph";

import {
  loadAuthoringBundleRegistration
} from "./example_authoring_bundle_loader";
import { createEmptyExampleDocument } from "./example_document";
import {
  createExampleContextMenu,
  type ExampleContextMenuHandle
} from "./example_context_menu";

/** `fitView()` 的统一留白，避免节点紧贴画布边缘。 */
const DEFAULT_FIT_VIEW_PADDING = 120;

/** 运行日志最多保留的条目数，避免长时间运行后面板无限膨胀。 */
const MAX_LOG_ENTRIES = 60;

/** 画布顶部辅助 badge，强调这个 demo 的定位。 */
const EXAMPLE_STAGE_BADGES = [
  { id: "public-api", label: "公开 API" },
  { id: "empty-canvas", label: "空画布" },
  { id: "bundle-loader", label: "Bundle Loader" },
  { id: "context-menu", label: "Context Menu" }
] as const;

/** 画布左上角展示的 demo 说明。 */
const EXAMPLE_CHAIN_STEPS = [
  {
    id: "empty-canvas",
    title: "默认空画布",
    description: "初始化时不再注入任何节点或连线，直接展示最小宿主页。"
  },
  {
    id: "reset-empty",
    title: "Reset 会清空画布",
    description: "点击 Reset 后会停止当前运行，并恢复到默认空画布。"
  },
  {
    id: "context-menu",
    title: "右键菜单入口",
    description: "右键画布可打开菜单，并从当前节点注册表里直接创建节点。"
  },
  {
    id: "register-bundle",
    title: "选择编译后 JS 注册",
    description: "顶部按钮会选择单文件 ESM JS bundle，并把其中导出的 plugin 或 module 注册进 graph；注册后右键菜单会按分类展示新增节点。"
  }
] as const;

/** 页面可见的最小图状态。 */
export type ExampleGraphStatus = "loading" | "ready" | "error";

/** authoring bundle 注册入口的最小状态。 */
export type ExampleAuthoringBundleStatus =
  | "idle"
  | "registering"
  | "registered"
  | "error";

/** 单条日志在页面层的最小投影结构。 */
export interface ExampleLogEntry {
  timestamp: number;
  message: string;
}

type ExampleRegisteredNodeDefinition = ReturnType<LeaferGraph["listNodes"]>[number];

/** 右键菜单“从注册表添加节点”会消费的最小节点投影。 */
export interface ExampleRegisteredNodeEntry {
  type: string;
  title: string;
  category: string;
  description?: string;
}

/** 从当前注册表创建节点时使用的最小输入。 */
export interface ExampleCreateNodeFromRegistryInput {
  type: string;
  position: {
    x: number;
    y: number;
  };
}

/** 页面按钮会用到的动作集合。 */
export interface ExampleGraphActions {
  play(): void;
  step(): void;
  stop(): void;
  fit(): void;
  reset(): void;
  clearLog(): void;
  createNodeFromRegistry(input: ExampleCreateNodeFromRegistryInput): void;
  registerAuthoringBundle(file: File): Promise<void>;
}

/** 页面层消费 hook 结果时使用的完整返回值结构。 */
export interface UseExampleGraphResult {
  stageRef: { current: HTMLDivElement | null };
  logs: readonly ExampleLogEntry[];
  actions: ExampleGraphActions;
  status: ExampleGraphStatus;
  authoringBundleStatus: ExampleAuthoringBundleStatus;
  registeredBundleCount: number;
  errorMessage: string;
  stageBadges: readonly { id: string; label: string }[];
  chainSteps: readonly { id: string; title: string; description: string }[];
}

/** 把统一运行反馈事件压缩成一行简洁中文日志。 */
function formatRuntimeFeedback(event: RuntimeFeedbackEvent): string {
  switch (event.type) {
    case "graph.execution":
      return `图执行 ${event.event.type}，状态=${event.event.state.status}，步数=${event.event.state.stepCount}`;
    case "node.execution":
      return `节点执行 ${event.event.nodeTitle}，来源=${event.event.source}，序号=${event.event.sequence}`;
    case "node.state":
      return `节点状态 ${event.event.nodeId} -> ${event.event.reason}，exists=${event.event.exists}`;
    case "link.propagation":
      return `连线传播 ${event.event.sourceNodeId} -> ${event.event.targetNodeId}`;
    default:
      return "收到未知运行反馈";
  }
}

/** 用文件名、大小和修改时间生成一个稳定的 bundle 指纹。 */
function createBundleFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/** 把 `NodeDefinition` 压缩成菜单需要的最小节点信息。 */
function projectRegisteredNode(
  definition: ExampleRegisteredNodeDefinition
): ExampleRegisteredNodeEntry {
  return {
    type: definition.type,
    title: definition.title?.trim() || definition.type,
    category: definition.category?.trim() || "未分类",
    description: definition.description?.trim() || undefined
  };
}

/** 统一排序注册表节点，避免菜单层重复做同样的整理逻辑。 */
function compareRegisteredNodes(
  left: ExampleRegisteredNodeEntry,
  right: ExampleRegisteredNodeEntry
): number {
  const categoryOrder = left.category.localeCompare(right.category, "zh-CN");
  if (categoryOrder !== 0) {
    return categoryOrder;
  }

  const titleOrder = left.title.localeCompare(right.title, "zh-CN");
  if (titleOrder !== 0) {
    return titleOrder;
  }

  return left.type.localeCompare(right.type, "zh-CN");
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
  const contextMenuRef = useRef<ExampleContextMenuHandle | null>(null);
  const registeredBundleFingerprintsRef = useRef(new Set<string>());
  const [logs, setLogs] = useState<ExampleLogEntry[]>([]);
  const [status, setStatus] = useState<ExampleGraphStatus>("loading");
  const [authoringBundleStatus, setAuthoringBundleStatus] =
    useState<ExampleAuthoringBundleStatus>("idle");
  const [registeredBundleCount, setRegisteredBundleCount] = useState(0);
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
   * 当前 demo 虽然默认是空画布，但初始化和 reset 后仍会触发场景刷新，
   * 下一帧再适配视图会更稳定。
   */
  const scheduleFitView = (): void => {
    requestAnimationFrame(() => {
      graphRef.current?.fitView(DEFAULT_FIT_VIEW_PADDING);
    });
  };

  /** 读取当前 graph 已注册的节点定义，并投影成菜单需要的结构。 */
  const listRegisteredNodes = (): ExampleRegisteredNodeEntry[] => {
    const graph = graphRef.current;
    if (!graph) {
      return [];
    }

    return graph
      .listNodes()
      .map((definition) => projectRegisteredNode(definition))
      .sort(compareRegisteredNodes);
  };

  /**
   * 把 demo 恢复为默认空画布。
   *
   * 每次 reset 都走同一条路径：
   * 1. 停掉当前运行
   * 2. 替换为空文档
   * 3. 适配到当前视口
   */
  const resetExampleGraph = (): void => {
    const graph = graphRef.current;
    if (!graph) {
      appendLog("图实例尚未就绪，暂时无法恢复空画布");
      return;
    }

    graph.stop();
    graph.replaceGraphDocument(createEmptyExampleDocument());

    scheduleFitView();
    appendLog("已恢复默认空画布");
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
    },
    createNodeFromRegistry(input) {
      const graph = graphRef.current;
      if (!graph) {
        appendLog("图实例尚未就绪，暂时无法从注册表创建节点");
        return;
      }

      try {
        const nextNode = graph.createNode({
          type: input.type,
          x: input.position.x,
          y: input.position.y
        });

        appendLog(
          `已从注册表添加节点：${nextNode.title} · ${nextNode.type} @ (${Math.round(
            nextNode.layout.x
          )}, ${Math.round(nextNode.layout.y)})`
        );
      } catch (error) {
        appendLog(
          error instanceof Error
            ? `从注册表添加节点失败：${error.message}`
            : `从注册表添加节点失败：${input.type}`
        );
      }
    },
    async registerAuthoringBundle(file: File) {
      const graph = graphRef.current;
      if (!graph) {
        appendLog("图实例尚未就绪，暂时无法注册 authoring bundle");
        return;
      }

      if (authoringBundleStatus === "registering") {
        return;
      }

      const bundleFingerprint = createBundleFingerprint(file);
      if (registeredBundleFingerprintsRef.current.has(bundleFingerprint)) {
        setAuthoringBundleStatus("registered");
        appendLog(`该 JS bundle 已注册过：${file.name}`);
        return;
      }

      setAuthoringBundleStatus("registering");

      try {
        const registration = await loadAuthoringBundleRegistration(file);
        await registration.apply(graph);
        registeredBundleFingerprintsRef.current.add(bundleFingerprint);
        setRegisteredBundleCount(
          registeredBundleFingerprintsRef.current.size
        );
        setAuthoringBundleStatus("registered");
        appendLog(
          `已注册 JS bundle：${registration.packageName} · ${file.name}`
        );
        appendLog(
          `导出入口=${registration.exportName} · 注册方式=${registration.registrationMode}`
        );
      } catch (error) {
        setAuthoringBundleStatus("error");
        appendLog(
          error instanceof Error
            ? `注册 JS bundle 失败：${error.message}`
            : "注册 JS bundle 失败"
        );
      }
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

      contextMenuRef.current?.destroy();
      contextMenuRef.current = null;
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
     * 3. 建立运行反馈与主题、窗口监听
     * 4. 进入默认空画布
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

        // 统一订阅运行反馈，再投影成页面层可直接显示的中文日志。
        cleanupRuntimeFeedback = graph.subscribeRuntimeFeedback((event) => {
          appendLog(formatRuntimeFeedback(event));
        });

        window.addEventListener("resize", handleWindowResize);
        scheduleFitView();
        setStatus("ready");
        setAuthoringBundleStatus("idle");
        setErrorMessage("");
        appendLog("LeaferGraph 已完成初始化");
        appendLog("默认节点已移除，当前为空画布");
        appendLog("可点击顶部按钮选择编译后的 JS bundle 来注册 authoring 库");
        appendLog("Leafer 右键菜单已就绪，可右键画布从当前注册表添加节点");
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

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    const graph = graphRef.current;
    const stageHost = stageRef.current;
    if (!graph || !stageHost) {
      return;
    }

    contextMenuRef.current?.destroy();
    contextMenuRef.current = createExampleContextMenu({
      graph,
      container: stageHost,
      play: actions.play,
      step: actions.step,
      stop: actions.stop,
      fit: actions.fit,
      reset: actions.reset,
      clearLog: actions.clearLog,
      listRegisteredNodes,
      createNodeFromRegistry: actions.createNodeFromRegistry,
      appendLog
    });

    return () => {
      contextMenuRef.current?.destroy();
      contextMenuRef.current = null;
    };
  }, [status]);

  return {
    stageRef,
    logs,
    actions,
    status,
    authoringBundleStatus,
    registeredBundleCount,
    errorMessage,
    stageBadges: EXAMPLE_STAGE_BADGES,
    chainSteps: EXAMPLE_CHAIN_STEPS
  };
}
