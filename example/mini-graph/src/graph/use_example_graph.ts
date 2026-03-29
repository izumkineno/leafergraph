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
import type { NodeRuntimeState } from "@leafergraph/node";
import {
  createLeaferGraph,
  type GraphLink,
  type LeaferGraph,
  type LeaferGraphCreateLinkInput,
  type LeaferGraphCreateNodeInput,
  type LeaferGraphLinkPropagationAnimationPreset,
  type LeaferGraphThemeMode,
  type RuntimeFeedbackEvent
} from "leafergraph";

import {
  loadAuthoringBundleRegistration,
  type ExampleAuthoringBundleRegistration
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
  },
  {
    id: "animation-preset",
    title: "运行时动画预设",
    description: "顶部可切换 Off / Performance / Balanced / Expressive，对比不同连线传播反馈。"
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

/** demo 暴露给页面层的动画预设选项。 */
export type ExampleLinkPropagationAnimationOption =
  | LeaferGraphLinkPropagationAnimationPreset
  | false;

/** 单条日志在页面层的最小投影结构。 */
export interface ExampleLogEntry {
  timestamp: number;
  message: string;
}

/** demo 内部维护的最小连线投影，专供右键菜单绑定与日志复用。 */
export interface ExampleTrackedLinkEntry {
  id: string;
  sourceNodeId: string;
  sourceSlot: string;
  targetNodeId: string;
  targetSlot: string;
}

interface ExampleRegisteredBundleEntry {
  fingerprint: string;
  fileName: string;
  registration: ExampleAuthoringBundleRegistration;
}

/** 页面按钮会用到的动作集合。 */
export interface ExampleGraphActions {
  play(): void;
  step(): void;
  stop(): void;
  fit(): void;
  reset(): void;
  clearLog(): void;
  setLinkPropagationAnimationPreset(
    preset: ExampleLinkPropagationAnimationOption
  ): void;
  removeNode(nodeId: string): void;
  removeLink(linkId: string): void;
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
  linkPropagationAnimationPreset: ExampleLinkPropagationAnimationOption;
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

function resolveAnimationPresetLabel(
  preset: ExampleLinkPropagationAnimationOption
): string {
  if (preset === false) {
    return "Off";
  }

  switch (preset) {
    case "balanced":
      return "Balanced";
    case "expressive":
      return "Expressive";
    case "performance":
    default:
      return "Performance";
  }
}

/** 把运行时 `GraphLink` 压缩成 demo 自己维护的最小连线元信息。 */
function projectTrackedLink(
  link: Pick<ReturnType<LeaferGraph["createLink"]>, "id" | "source" | "target">
): ExampleTrackedLinkEntry {
  return {
    id: link.id,
    sourceNodeId: link.source.nodeId,
    sourceSlot: String(link.source.slot ?? ""),
    targetNodeId: link.target.nodeId,
    targetSlot: String(link.target.slot ?? "")
  };
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
  const registeredBundlesRef = useRef<ExampleRegisteredBundleEntry[]>([]);
  const trackedLinksRef = useRef(new Map<string, ExampleTrackedLinkEntry>());
  const [logs, setLogs] = useState<ExampleLogEntry[]>([]);
  const [status, setStatus] = useState<ExampleGraphStatus>("loading");
  const [authoringBundleStatus, setAuthoringBundleStatus] =
    useState<ExampleAuthoringBundleStatus>("idle");
  const [registeredBundleCount, setRegisteredBundleCount] = useState(0);
  const [
    linkPropagationAnimationPreset,
    setLinkPropagationAnimationPresetState
  ] =
    useState<ExampleLinkPropagationAnimationOption>("performance");
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

  /** 记录一条正式连线，并立刻把它挂到右键菜单系统里。 */
  const rememberTrackedLink = (link: ExampleTrackedLinkEntry): void => {
    trackedLinksRef.current.set(link.id, link);
    contextMenuRef.current?.bindLinkTarget(link);
  };

  /** 移除一条已跟踪连线，并同步清理对应的右键菜单 target。 */
  const forgetTrackedLink = (
    linkId: string
  ): ExampleTrackedLinkEntry | undefined => {
    const trackedLink = trackedLinksRef.current.get(linkId);
    contextMenuRef.current?.unbindLinkTarget(linkId);
    trackedLinksRef.current.delete(linkId);
    return trackedLink;
  };

  /** 删除节点前后都需要用到“这个节点关联了哪些已跟踪连线”。 */
  const listTrackedLinksByNodeId = (
    nodeId: string
  ): ExampleTrackedLinkEntry[] => {
    const trackedLinks: ExampleTrackedLinkEntry[] = [];
    for (const trackedLink of trackedLinksRef.current.values()) {
      if (
        trackedLink.sourceNodeId === nodeId ||
        trackedLink.targetNodeId === nodeId
      ) {
        trackedLinks.push(trackedLink);
      }
    }

    return trackedLinks;
  };

  /** reset / 销毁时统一清理所有连线挂载，避免残留失效 binding。 */
  const clearTrackedLinks = (): void => {
    for (const linkId of trackedLinksRef.current.keys()) {
      contextMenuRef.current?.unbindLinkTarget(linkId);
    }

    trackedLinksRef.current.clear();
  };

  /** graph 重建后重放已成功注册过的 bundle，保持 demo 可继续使用这些节点。 */
  const replayRegisteredBundles = async (
    graph: LeaferGraph
  ): Promise<boolean> => {
    if (!registeredBundlesRef.current.length) {
      return true;
    }

    try {
      for (const entry of registeredBundlesRef.current) {
        await entry.registration.apply(graph);
      }

      appendLog(
        `已重放 ${registeredBundlesRef.current.length} 个 JS bundle 注册`
      );
      return true;
    } catch (error) {
      appendLog(
        error instanceof Error
          ? `重放 JS bundle 注册失败：${error.message}`
          : "重放 JS bundle 注册失败"
      );
      return false;
    }
  };

  /** 统一创建节点，并把日志语义收口到 hook 内部。 */
  const createNodeWithLogging = (
    input: LeaferGraphCreateNodeInput
  ): NodeRuntimeState => {
    const graph = graphRef.current;
    if (!graph) {
      throw new Error("图实例尚未就绪，暂时无法创建节点");
    }

    try {
      const nextNode = graph.createNode(input);
      appendLog(
        `已通过右键菜单创建节点：${nextNode.title} · ${nextNode.type} @ (${Math.round(
          nextNode.layout.x
        )}, ${Math.round(nextNode.layout.y)})`
      );
      return nextNode;
    } catch (error) {
      const typeLabel =
        typeof input.type === "string" && input.type.trim()
          ? input.type
          : "unknown";
      appendLog(
        error instanceof Error
          ? `创建节点失败：${error.message}`
          : `创建节点失败：${typeLabel}`
      );
      throw error;
    }
  };

  /** 统一创建正式连线，并同步接入 demo 自己的连线跟踪与日志。 */
  const createLinkWithLogging = (
    input: LeaferGraphCreateLinkInput
  ): GraphLink => {
    const graph = graphRef.current;
    if (!graph) {
      throw new Error("图实例尚未就绪，暂时无法创建连线");
    }

    try {
      const link = graph.createLink(input);
      rememberTrackedLink(projectTrackedLink(link));
      appendLog(
        `已创建连线：${link.source.nodeId}:${link.source.slot} -> ${link.target.nodeId}:${link.target.slot}`
      );
      return link;
    } catch (error) {
      appendLog(
        error instanceof Error ? `创建连线失败：${error.message}` : "创建连线失败"
      );
      throw error;
    }
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
    clearTrackedLinks();

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
    setLinkPropagationAnimationPreset(preset) {
      if (preset === linkPropagationAnimationPreset) {
        return;
      }

      setStatus("loading");
      setErrorMessage("");
      setAuthoringBundleStatus(
        registeredBundlesRef.current.length ? "registering" : "idle"
      );
      appendLog(
        `切换连线传播动画预设：${resolveAnimationPresetLabel(
          preset
        )}，正在重建图实例`
      );
      setLinkPropagationAnimationPresetState(preset);
    },
    removeNode(nodeId) {
      const graph = graphRef.current;
      if (!graph) {
        appendLog("图实例尚未就绪，暂时无法删除节点");
        return;
      }

      const relatedLinks = listTrackedLinksByNodeId(nodeId);
      const snapshot = graph.getNodeSnapshot(nodeId);
      const removed = graph.removeNode(nodeId);
      if (!removed) {
        appendLog(`删除节点失败：未找到节点 ${nodeId}`);
        return;
      }

      for (const trackedLink of relatedLinks) {
        forgetTrackedLink(trackedLink.id);
      }

      appendLog(
        `已删除节点：${snapshot?.title?.trim() || nodeId} · ${
          snapshot?.type ?? "unknown"
        }${
          relatedLinks.length
            ? `，并清理 ${relatedLinks.length} 条关联连线`
            : ""
        }`
      );
    },
    removeLink(linkId) {
      const graph = graphRef.current;
      if (!graph) {
        appendLog("图实例尚未就绪，暂时无法删除连线");
        return;
      }

      const trackedLink = trackedLinksRef.current.get(linkId);
      const removed = graph.removeLink(linkId);
      if (!removed) {
        appendLog(`删除连线失败：未找到连线 ${linkId}`);
        return;
      }

      forgetTrackedLink(linkId);
      appendLog(
        trackedLink
          ? `已删除连线：${trackedLink.sourceNodeId}:${trackedLink.sourceSlot} -> ${trackedLink.targetNodeId}:${trackedLink.targetSlot}`
          : `已删除连线：${linkId}`
      );
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
        registeredBundlesRef.current.push({
          fingerprint: bundleFingerprint,
          fileName: file.name,
          registration
        });
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
    let cleanupInteractionCommit = (): void => {};
    let cleanupNodeState = (): void => {};
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
      cleanupInteractionCommit();
      cleanupNodeState();
      cleanupThemeListener();
      window.removeEventListener("resize", handleWindowResize);

      clearTrackedLinks();
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
          themeMode: resolvePreferredThemeMode(),
          linkPropagationAnimation: linkPropagationAnimationPreset
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

        const replaySucceeded = await replayRegisteredBundles(graph);
        setAuthoringBundleStatus(
          registeredBundlesRef.current.length
            ? replaySucceeded
              ? "registered"
              : "error"
            : "idle"
        );

        // 统一订阅运行反馈，再投影成页面层可直接显示的中文日志。
        cleanupRuntimeFeedback = graph.subscribeRuntimeFeedback((event) => {
          appendLog(formatRuntimeFeedback(event));
        });

        /**
         * mini-graph 当前没有 authority / editor 命令总线去消费交互提交事件，
         * 因此这里本地回放最小的连线提交，把拖线结束后的 commit 真正落成正式 link。
         *
         * 节点移动、resize、折叠这类交互已经在宿主内部直接写回场景，
         * 只有 `link.create.commit` 还需要在 pointer up 后显式转成正式 createLink。
         */
        cleanupInteractionCommit = graph.subscribeInteractionCommit((event) => {
          if (event.type !== "link.create.commit") {
            return;
          }

          try {
            createLinkWithLogging(event.input);
          } catch {
            // 创建失败日志已经在 `createLinkWithLogging(...)` 内统一记录。
          }
        });

        /**
         * 节点右键菜单 target 跟随节点生命周期自动同步。
         *
         * 这样无论节点来自：
         * - 右键菜单即时创建
         * - 后续其它宿主动作
         * - reset / 删除后的移除
         *
         * 菜单挂载都不需要页面层手动介入。
         */
        cleanupNodeState = graph.subscribeNodeState((event) => {
          if (event.reason === "created" && event.exists) {
            contextMenuRef.current?.bindNodeTarget(event.nodeId);
            return;
          }

          if (event.reason === "removed" || !event.exists) {
            contextMenuRef.current?.unbindNodeTarget(event.nodeId);
          }
        });

        window.addEventListener("resize", handleWindowResize);
        scheduleFitView();
        setStatus("ready");
        setErrorMessage("");
        appendLog("LeaferGraph 已完成初始化");
        appendLog("默认节点已移除，当前为空画布");
        appendLog(
          `当前连线传播动画预设：${resolveAnimationPresetLabel(
            linkPropagationAnimationPreset
          )}`
        );
        appendLog("可点击顶部按钮选择编译后的 JS bundle 来注册 authoring 库");
        appendLog("Leafer 右键菜单已就绪，可右键画布添加节点，右键节点或连线执行删除");
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
  }, [linkPropagationAnimationPreset]);

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
      createNode: createNodeWithLogging,
      createLink: createLinkWithLogging,
      removeNode: actions.removeNode,
      removeLink: actions.removeLink,
      appendLog
    });

    // 菜单实例重建后，重新把当前仍然存在的连线 target 挂回去。
    for (const trackedLink of trackedLinksRef.current.values()) {
      contextMenuRef.current.bindLinkTarget(trackedLink);
    }

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
    linkPropagationAnimationPreset,
    errorMessage,
    stageBadges: EXAMPLE_STAGE_BADGES,
    chainSteps: EXAMPLE_CHAIN_STEPS
  };
}
