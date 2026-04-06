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
import { Debug } from "leafer-ui";
import { leaferGraphBasicKitPlugin } from "@leafergraph/basic-kit";
import {
  createLeaferGraphContextMenuClipboardStore
} from "@leafergraph/context-menu-builtins";
import {
  createLeaferGraphEditingController,
  type LeaferGraphEditingController
} from "@leafergraph/context-menu-builtins/editing";
import {
  bindLeaferGraphUndoRedo,
  type BoundLeaferGraphUndoRedo
} from "@leafergraph/undo-redo/graph";
import type { UndoRedoControllerState } from "@leafergraph/undo-redo";
import {
  bindLeaferGraphShortcuts,
  type BoundLeaferGraphShortcuts
} from "@leafergraph/shortcuts/graph";
import type { GraphLink, NodeRuntimeState } from "@leafergraph/node";
import type {
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  RuntimeFeedbackEvent
} from "@leafergraph/contracts";
import type {
  LeaferGraphLinkPropagationAnimationPreset,
  LeaferGraphThemeMode
} from "@leafergraph/theme";
import {
  createLeaferGraph,
  type LeaferGraph
} from "leafergraph";

import {
  loadAuthoringBundleRegistration,
  type ExampleAuthoringBundleRegistration
} from "./example_authoring_bundle_loader";
import { miniGraphExampleDemoPlugin } from "./example_demo_plugin";
import { createEmptyExampleDocument } from "./example_document";
import {
  createExampleContextMenu,
  type ExampleContextMenuHandle
} from "./example_context_menu";

interface ExampleGraphCoordinateHost {
  getPagePointByClient(
    clientPoint: { clientX: number; clientY: number },
    updateClient?: boolean
  ): { x: number; y: number };
}

/** `fitView()` 的统一留白，避免节点紧贴画布边缘。 */
const DEFAULT_FIT_VIEW_PADDING = 120;

/** 运行日志最多保留的条目数，避免长时间运行后面板无限膨胀。 */
const MAX_LOG_ENTRIES = 60;

/** demo 默认历史配置；`graph.history` 是真源，但不会因为写了 config 就自动启用历史。 */
const EXAMPLE_GRAPH_HISTORY_CONFIG = {
  maxEntries: 100,
  resetOnDocumentSync: true
} as const;

/**
 * mini-graph 自己维护的 Leafer debug 配置。
 *
 * @remarks
 * Leafer 的调试能力来自 `leafer-ui` 的全局 `Debug`，并不属于 `leafergraph`
 * 的正式 `config` 真源；因此这里单独作为 demo 配置管理，并在图实例生命周期内应用。
 */
export interface ExampleLeaferDebugConfig {
  /** 是否开启 Leafer 调试模式。 */
  enable: boolean;
  /** 是否输出 Leafer warning。 */
  showWarn: boolean;
  /** 只打印指定调试分类。 */
  filter: string | readonly string[];
  /** 排除指定调试分类。 */
  exclude: string | readonly string[];
  /** 是否显示重绘区域。 */
  showRepaint: boolean | string;
  /** 是否显示元素包围盒或命中区域。 */
  showBounds: boolean | string | "hit";
}

/** demo 默认的 Leafer debug 配置。 */
const EXAMPLE_LEAFER_DEBUG_CONFIG = {
  enable: false,
  showWarn: true,
  filter: "RunTime",
  exclude: [],
  showRepaint: false,
  showBounds: false
} as const satisfies ExampleLeaferDebugConfig;

/**
 * mini-graph 的示例级配置集合。
 *
 * @remarks
 * `graph` 继续交给 `leafergraph` 主包消费，`leaferDebug` 则由 demo 自己在
 * `createLeaferGraph(...)` 前后应用到 Leafer 全局调试开关。
 */
export const EXAMPLE_MINI_GRAPH_CONFIG = {
  graph: {
    graph: {
      runtime: {
        linkPropagationAnimation: "expressive"
      },
      history: EXAMPLE_GRAPH_HISTORY_CONFIG
    },
    widget: {
      editing: {
        enabled: true
      }
    }
  },
  leaferDebug: EXAMPLE_LEAFER_DEBUG_CONFIG
} as const;

/** Widget 文本编辑器当前会把 DOM 挂到 body，这里用 class 统一判断编辑态。 */
const WIDGET_TEXT_EDITOR_SELECTOR = ".leafergraph-widget-text-editor";

/**
 * 键盘 paste 拿不到最近鼠标锚点时，沿用和菜单 builtins 一致的偏移量。
 *
 * 即便拿到了鼠标位置，仍保留一小段位移，让新节点不要完全压在指针热点下。
 */
const DEFAULT_CLIPBOARD_PASTE_OFFSET = {
  x: 24,
  y: 24
} as const;

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
    description:
      "右键画布可直接插入动画示例链，或从当前节点注册表里创建 System / Example 节点。"
  },
  {
    id: "register-bundle",
    title: "选择编译后 JS 注册",
    description: "顶部按钮会选择单文件 ESM JS bundle，并把其中导出的 plugin 或 module 注册进 graph；注册后右键菜单会按分类展示新增节点。"
  },
  {
    id: "animation-preset",
    title: "运行时动画预设",
    description:
      "顶部可切换 Off / Performance / Balanced / Expressive；demo 默认使用 Expressive，方便直接观察连线传播反馈。"
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
  id: number;
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
  undo(): void;
  redo(): void;
  play(): void;
  step(): void;
  stop(): void;
  fit(): void;
  reset(): void;
  clearLog(): void;
  setLinkPropagationAnimationPreset(
    preset: ExampleLinkPropagationAnimationOption
  ): void;
  setLeaferDebugConfig(
    patch: Partial<ExampleLeaferDebugConfig>
  ): void;
  removeNode(nodeId: string): void;
  removeLink(linkId: string): void;
  registerAuthoringBundle(file: File): Promise<void>;
}

/** 页面层消费 hook 结果时使用的完整返回值结构。 */
export interface UseExampleGraphResult {
  stageRef: { current: HTMLDivElement | null };
  logs: readonly ExampleLogEntry[];
  historyState: ExampleHistoryState;
  actions: ExampleGraphActions;
  status: ExampleGraphStatus;
  authoringBundleStatus: ExampleAuthoringBundleStatus;
  registeredBundleCount: number;
  linkPropagationAnimationPreset: ExampleLinkPropagationAnimationOption;
  leaferDebugConfig: ExampleLeaferDebugConfig;
  errorMessage: string;
  stageBadges: readonly { id: string; label: string }[];
  chainSteps: readonly { id: string; title: string; description: string }[];
}

export type ExampleHistoryState = UndoRedoControllerState;

/**
 *  把统一运行反馈事件压缩成一行简洁中文日志。
 *
 * @param event - 当前事件对象。
 * @returns 处理后的结果。
 */
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

/**
 *  用文件名、大小和修改时间生成一个稳定的 bundle 指纹。
 *
 * @param file - 文件。
 * @returns 创建后的结果对象。
 */
function createBundleFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * 解析动画预设标签。
 *
 * @param preset - 预设。
 * @returns 处理后的结果。
 */
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

/**
 *  把运行时 `GraphLink` 压缩成 demo 自己维护的最小连线元信息。
 *
 * @param link - 连线。
 * @returns 处理后的结果。
 */
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
 * 从创建输入映射`Tracked` 连线。
 *
 * @param input - 输入参数。
 * @returns 处理后的结果。
 */
function projectTrackedLinkFromCreateInput(
  input: LeaferGraphCreateLinkInput
): ExampleTrackedLinkEntry | null {
  if (!input.id) {
    return null;
  }

  return {
    id: input.id,
    sourceNodeId: input.source.nodeId,
    sourceSlot: String(input.source.slot ?? ""),
    targetNodeId: input.target.nodeId,
    targetSlot: String(input.target.slot ?? "")
  };
}

/**
 * 判断一个浏览器 client 点是否仍位于当前画布宿主范围内。
 *
 * @param stageHost - 画布宿主元素。
 * @param clientPoint - 最近一次记录到的鼠标 client 坐标。
 * @returns 是否位于画布范围内。
 */
function isClientPointInsideStage(
  stageHost: HTMLElement,
  clientPoint: { x: number; y: number }
): boolean {
  const rect = stageHost.getBoundingClientRect();
  return (
    clientPoint.x >= rect.left &&
    clientPoint.x <= rect.right &&
    clientPoint.y >= rect.top &&
    clientPoint.y <= rect.bottom
  );
}

/**
 * 把最近一次浏览器 client 坐标转换成图真正使用的 page 坐标。
 *
 * @param graph - 当前图实例。
 * @param stageHost - 图宿主元素。
 * @param clientPoint - 最近一次位于画布内的鼠标点。
 * @returns 可用于节点布局写回的 page 坐标；拿不到时返回 `null`。
 */
function resolveGraphPageAnchorPoint(input: {
  graph: LeaferGraph;
  stageHost: HTMLElement;
  clientPoint: { x: number; y: number } | null;
}): { x: number; y: number } | null {
  if (!input.clientPoint || !isClientPointInsideStage(input.stageHost, input.clientPoint)) {
    return null;
  }

  const coordinateHost = input.graph.app as typeof input.graph.app &
    Partial<ExampleGraphCoordinateHost>;
  if (typeof coordinateHost.getPagePointByClient !== "function") {
    return null;
  }

  const pagePoint = coordinateHost.getPagePointByClient(
    {
      clientX: input.clientPoint.x,
      clientY: input.clientPoint.y
    },
    true
  );

  return Number.isFinite(pagePoint.x) && Number.isFinite(pagePoint.y)
    ? pagePoint
    : null;
}

/**
 * 创建`Empty` 历史状态。
 *
 * @returns 创建后的结果对象。
 */
function createEmptyHistoryState(): ExampleHistoryState {
  return {
    canUndo: false,
    canRedo: false,
    undoCount: 0,
    redoCount: 0,
    nextUndoLabel: undefined,
    nextRedoLabel: undefined
  };
}

/**
 * 把一份 Leafer debug 配置克隆成可安全复用的普通对象。
 *
 * @param config - 原始配置。
 * @returns 克隆后的配置对象。
 */
function cloneExampleLeaferDebugConfig(
  config: ExampleLeaferDebugConfig
): ExampleLeaferDebugConfig {
  return {
    ...config,
    filter:
      typeof config.filter === "string" ? config.filter : [...config.filter],
    exclude:
      typeof config.exclude === "string" ? config.exclude : [...config.exclude]
  };
}

/**
 * 把 demo 层的 debug 名称列表规范成 Leafer 真正接受的输入格式。
 *
 * @param value - demo 配置里的 filter / exclude 值。
 * @returns 适合直接写回 `Debug.filter` / `Debug.exclude` 的值。
 */
function normalizeLeaferDebugNameList(
  value: string | readonly string[] | undefined
): string | string[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return value;
  }

  return [...value];
}

/**
 * 把 debug 名称列表统一投影成字符串数组，便于比较和展示。
 *
 * @param value - filter / exclude 当前值。
 * @returns 归一化后的名称列表。
 */
function listLeaferDebugNames(value: string | readonly string[]): string[] {
  if (typeof value === "string") {
    return value ? [value] : [];
  }

  return [...value].filter((name) => Boolean(name));
}

/**
 * 比较两组 debug 名称列表是否等价。
 *
 * @param left - 左侧值。
 * @param right - 右侧值。
 * @returns 是否等价。
 */
function areLeaferDebugNameListsEqual(
  left: string | readonly string[],
  right: string | readonly string[]
): boolean {
  const leftNames = listLeaferDebugNames(left);
  const rightNames = listLeaferDebugNames(right);
  if (leftNames.length !== rightNames.length) {
    return false;
  }

  return leftNames.every((name, index) => name === rightNames[index]);
}

/**
 * 判断两份 Leafer debug 配置是否完全一致。
 *
 * @param left - 左侧配置。
 * @param right - 右侧配置。
 * @returns 是否完全一致。
 */
function isSameExampleLeaferDebugConfig(
  left: ExampleLeaferDebugConfig,
  right: ExampleLeaferDebugConfig
): boolean {
  return (
    left.enable === right.enable &&
    left.showWarn === right.showWarn &&
    left.showRepaint === right.showRepaint &&
    left.showBounds === right.showBounds &&
    areLeaferDebugNameListsEqual(left.filter, right.filter) &&
    areLeaferDebugNameListsEqual(left.exclude, right.exclude)
  );
}

/**
 * 把 debug 名称列表格式化成日志可读文本。
 *
 * @param value - filter / exclude 当前值。
 * @returns 用于日志的文本。
 */
function formatLeaferDebugNameList(
  value: string | readonly string[]
): string {
  const names = listLeaferDebugNames(value);
  return names.length ? names.join(", ") : "none";
}

/**
 * 把包围盒调试值格式化成日志可读文本。
 *
 * @param value - 当前包围盒调试值。
 * @returns 用于日志的文本。
 */
function formatLeaferDebugBoundsValue(
  value: ExampleLeaferDebugConfig["showBounds"]
): string {
  if (value === "hit") {
    return "hit";
  }

  return value ? "bounds" : "off";
}

/**
 * 读取当前 Leafer 全局 debug 配置快照。
 *
 * @returns 当前 Leafer debug 状态快照。
 */
function captureLeaferDebugConfig(): ExampleLeaferDebugConfig {
  return {
    enable: Debug.enable,
    showWarn: Debug.showWarn,
    filter: [...Debug.filterList],
    exclude: [...Debug.excludeList],
    showRepaint: Debug.showRepaint,
    showBounds: Debug.showBounds
  };
}

/**
 * 把一组 Leafer debug 配置应用到当前页面。
 *
 * @param config - 目标 debug 配置。
 * @returns 无返回值。
 */
function applyLeaferDebugConfig(config: ExampleLeaferDebugConfig): void {
  Debug.enable = config.enable;
  Debug.showWarn = config.showWarn;
  Debug.filter = normalizeLeaferDebugNameList(config.filter);
  Debug.exclude = normalizeLeaferDebugNameList(config.exclude);
  Debug.showRepaint = config.showRepaint;
  Debug.showBounds = config.showBounds;
}

/**
 * 解析当前系统主题偏好。
 *
 * demo 既要让 CSS 跟随系统主题，也要让图运行时主题同步切换，
 * 所以这里单独抽成一个 helper 供初始化和监听回调复用。
 *
 * @returns 处理后的结果。
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

/**
 *  对页面层暴露最小图生命周期与控制能力。
 *
 * @returns 处理后的结果。
 */
export function useExampleGraph(): UseExampleGraphResult {
  // `stageRef` 是图实例真正挂载到 DOM 的位置。
  const stageRef = useRef<HTMLDivElement | null>(null);

  // `graphRef` 只在 hook 内部持有，避免页面层直接耦合运行时细节。
  const graphRef = useRef<LeaferGraph | null>(null);
  const undoRedoBindingRef = useRef<BoundLeaferGraphUndoRedo | null>(null);
  const shortcutsBindingRef = useRef<BoundLeaferGraphShortcuts | null>(null);
  const contextMenuRef = useRef<ExampleContextMenuHandle | null>(null);
  const clipboardStoreRef = useRef(createLeaferGraphContextMenuClipboardStore());
  const editingControllerRef = useRef<LeaferGraphEditingController | null>(null);
  const latestStagePointerClientPointRef = useRef<{ x: number; y: number } | null>(null);
  const themeModeRef = useRef<LeaferGraphThemeMode>(resolvePreferredThemeMode());
  const nodeIdsRef = useRef(new Set<string>());
  const registeredBundleFingerprintsRef = useRef(new Set<string>());
  const registeredBundlesRef = useRef<ExampleRegisteredBundleEntry[]>([]);
  const trackedLinksRef = useRef(new Map<string, ExampleTrackedLinkEntry>());
  const logEntrySeedRef = useRef(1);
  const [logs, setLogs] = useState<ExampleLogEntry[]>([]);
  const [historyState, setHistoryState] =
    useState<ExampleHistoryState>(createEmptyHistoryState);
  const [status, setStatus] = useState<ExampleGraphStatus>("loading");
  const [authoringBundleStatus, setAuthoringBundleStatus] =
    useState<ExampleAuthoringBundleStatus>("idle");
  const [registeredBundleCount, setRegisteredBundleCount] = useState(0);
  const [
    linkPropagationAnimationPreset,
    setLinkPropagationAnimationPresetState
  ] =
    useState<ExampleLinkPropagationAnimationOption>("expressive");
  const [leaferDebugConfig, setLeaferDebugConfigState] =
    useState<ExampleLeaferDebugConfig>(() =>
      cloneExampleLeaferDebugConfig(EXAMPLE_MINI_GRAPH_CONFIG.leaferDebug)
    );
  const [errorMessage, setErrorMessage] = useState("");

  /**
   *  追加一条日志，并把总量限制在可控范围内。
   *
   * @param message - 消息。
   * @returns 无返回值。
   */
  const appendLog = (message: string): void => {
    const logEntryId = logEntrySeedRef.current;
    logEntrySeedRef.current += 1;

    setLogs((currentLogs) =>
      [
        {
          id: logEntryId,
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
   *
   * @returns 无返回值。
   */
  const scheduleFitView = (): void => {
    requestAnimationFrame(() => {
      graphRef.current?.fitView(DEFAULT_FIT_VIEW_PADDING);
    });
  };

  /**
   *  记录一条正式连线，并立刻把它挂到右键菜单系统里。
   *
   * @param link - 连线。
   * @returns 无返回值。
   */
  const rememberTrackedLink = (link: ExampleTrackedLinkEntry): void => {
    trackedLinksRef.current.set(link.id, link);
    contextMenuRef.current?.bindLinkTarget(link);
  };

  /**
   *  移除一条已跟踪连线，并同步清理对应的右键菜单 target。
   *
   * @param linkId - 目标连线 ID。
   * @returns 移除`Tracked` 连线的结果。
   */
  const forgetTrackedLink = (
    linkId: string
  ): ExampleTrackedLinkEntry | undefined => {
    const trackedLink = trackedLinksRef.current.get(linkId);
    contextMenuRef.current?.unbindLinkTarget(linkId);
    trackedLinksRef.current.delete(linkId);
    return trackedLink;
  };

  /**
   *  删除节点前后都需要用到“这个节点关联了哪些已跟踪连线”。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 收集到的结果列表。
   */
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

  /**
   *  reset / 销毁时统一清理所有连线挂载，避免残留失效 binding。
   *
   * @returns 无返回值。
   */
  const clearTrackedLinks = (): void => {
    for (const linkId of trackedLinksRef.current.keys()) {
      contextMenuRef.current?.unbindLinkTarget(linkId);
    }

    trackedLinksRef.current.clear();
  };

  /**
   *  根据当前节点集重建 demo 的连线 target 缓存，供 undo/redo 和 document restore 后复用。
   *
   * @returns 无返回值。
   */
  const syncTrackedLinksFromGraph = (): void => {
    const graph = graphRef.current;
    if (!graph) {
      clearTrackedLinks();
      return;
    }

    const nextTrackedLinks = new Map<string, ExampleTrackedLinkEntry>();
    for (const nodeId of nodeIdsRef.current) {
      for (const link of graph.findLinksByNode(nodeId)) {
        nextTrackedLinks.set(link.id, projectTrackedLink(link));
      }
    }

    for (const existingLinkId of [...trackedLinksRef.current.keys()]) {
      if (!nextTrackedLinks.has(existingLinkId)) {
        forgetTrackedLink(existingLinkId);
      }
    }

    for (const trackedLink of nextTrackedLinks.values()) {
      trackedLinksRef.current.set(trackedLink.id, trackedLink);
      contextMenuRef.current?.bindLinkTarget(trackedLink);
    }
  };

  /**
   *  批量删除节点，并把关联连线清理与日志语义统一收口。
   *
   * @param nodeIds - 节点 ID 列表。
   * @returns 无返回值。
   */
  const removeNodesWithLogging = (nodeIds: readonly string[]): void => {
    // 先读取当前目标状态与上下文约束，避免处理中出现不一致的中间态。
    const graph = graphRef.current;
    if (!graph) {
      appendLog("图实例尚未就绪，暂时无法删除节点");
      return;
    }

    const uniqueNodeIds = [...new Set(nodeIds)];
    if (!uniqueNodeIds.length) {
      return;
    }

    const linkIdsToForget = new Set<string>();
    const removedNodeLabels: string[] = [];
    let removedCount = 0;

    for (const nodeId of uniqueNodeIds) {
      const relatedLinks = listTrackedLinksByNodeId(nodeId);
      const snapshot = graph.getNodeSnapshot(nodeId);
      const removed = graph.removeNode(nodeId);
      if (!removed) {
        // 再执行核心更新步骤，并同步派生副作用与收尾状态。
        continue;
      }

      removedCount += 1;
      removedNodeLabels.push(snapshot?.title?.trim() || nodeId);
      for (const trackedLink of relatedLinks) {
        linkIdsToForget.add(trackedLink.id);
      }
    }

    if (!removedCount) {
      if (uniqueNodeIds.length === 1) {
        appendLog(`删除节点失败：未找到节点 ${uniqueNodeIds[0]}`);
      } else {
        appendLog(`批量删除节点失败：未找到 ${uniqueNodeIds.length} 个目标节点`);
      }
      return;
    }

    for (const linkId of linkIdsToForget) {
      forgetTrackedLink(linkId);
    }

    if (removedCount === 1) {
      appendLog(
        `已删除节点：${removedNodeLabels[0]}${
          linkIdsToForget.size ? `，并清理 ${linkIdsToForget.size} 条关联连线` : ""
        }`
      );
      return;
    }

    appendLog(
      `已批量删除 ${removedCount} 个节点：${removedNodeLabels.join("、")}${
        linkIdsToForget.size ? `，并清理 ${linkIdsToForget.size} 条关联连线` : ""
      }`
    );
  };

  /**
   *  键盘复制只操作当前选区，并复用和右键菜单一致的 clipboard store。
   *
   * @returns 对应的判断结果。
   */
  const copySelectedNodesToClipboard = (): boolean => {
    const editingController = editingControllerRef.current;
    if (!editingController) {
      return false;
    }

    const fragment = editingController.copySelection();
    if (!fragment) {
      return false;
    }

    appendLog(
      fragment.nodes.length > 1
        ? `已复制 ${fragment.nodes.length} 个节点到剪贴板`
        : `已复制节点：${fragment.nodes[0]?.title?.trim() || fragment.nodes[0]?.id}`
    );
    return true;
  };

  /**
   *  剪切沿用复制语义写入 clipboard，再复用现有删除路径统一日志和连线清理。
   *
   * @returns 对应的判断结果。
   */
  const cutSelectedNodesToClipboard = (): boolean => {
    const editingController = editingControllerRef.current;
    if (!editingController) {
      return false;
    }

    return Boolean(editingController.cutSelection());
  };

  /**
   *  粘贴使用裸 graph API，避免快捷键一次性粘贴时产生逐节点日志噪声。
   *
   * @returns 对应的判断结果。
   */
  const pasteNodesFromClipboard = (): boolean => {
    const editingController = editingControllerRef.current;
    if (!editingController) {
      return false;
    }

    const createdNodeIds = editingController.pasteClipboard();
    syncTrackedLinksFromGraph();
    if (!createdNodeIds.length) {
      return false;
    }

    appendLog(
      createdNodeIds.length > 1
        ? `已粘贴 ${createdNodeIds.length} 个节点`
        : `已粘贴节点：${createdNodeIds[0]}`
    );
    return Boolean(createdNodeIds.length);
  };

  /**
   *  duplicate 直接基于当前选区创建临时 fragment，不覆盖已有 clipboard。
   *
   * @returns 对应的判断结果。
   */
  const duplicateSelectedNodes = (): boolean => {
    const editingController = editingControllerRef.current;
    if (!editingController) {
      return false;
    }

    const createdNodeIds = editingController.duplicateSelection();
    syncTrackedLinksFromGraph();
    if (!createdNodeIds.length) {
      return false;
    }

    appendLog(
      createdNodeIds.length > 1
        ? `已创建 ${createdNodeIds.length} 个节点副本`
        : `已创建节点副本：${createdNodeIds[0]}`
    );
    return Boolean(createdNodeIds.length);
  };

  /**
   *  graph 重建后重放已成功注册过的 bundle，保持 demo 可继续使用这些节点。
   *
   * @param graph - 当前图实例。
   * @returns 重放`Registered` Bundle的结果。
   */
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

  /**
   *  统一创建节点，并把日志语义收口到 hook 内部。
   *
   * @param input - 输入参数。
   * @returns 创建后的结果对象。
   */
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

  /**
   *  统一创建正式连线，并同步接入 demo 自己的连线跟踪与日志。
   *
   * @param input - 输入参数。
   * @returns 创建后的结果对象。
   */
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
   *
   * @returns 无返回值。
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
   *  统一执行撤回/重做，并在成功后同步 demo 自己维护的节点图元缓存。
   *
   * @param direction - `direction`。
   * @param options - 可选配置项。
   * @returns 对应的判断结果。
   */
  const runHistoryAction = (
    direction: "undo" | "redo",
    options?: {
      log?: boolean;
    }
  ): boolean => {
    const controller = undoRedoBindingRef.current?.controller;
    const shouldLog = options?.log ?? true;
    if (!controller) {
      if (shouldLog) {
        appendLog("undo / redo 扩展尚未启用");
      }
      return false;
    }

    const state = controller.getState();
    const label =
      direction === "undo" ? state.nextUndoLabel : state.nextRedoLabel;
    const changed =
      direction === "undo" ? controller.undo() : controller.redo();

    if (!changed) {
      if (shouldLog) {
        appendLog(
          direction === "undo" ? "没有可撤回的历史" : "没有可重做的历史"
        );
      }
      return false;
    }

    queueMicrotask(() => {
      syncTrackedLinksFromGraph();
    });

    if (shouldLog) {
      appendLog(
        direction === "undo"
          ? `已撤回：${label ?? "上一条操作"}`
          : `已重做：${label ?? "下一条操作"}`
      );
    }

    return true;
  };

  /**
   * 页面控制按钮对应的动作集合。
   *
   * 这里统一做“实例是否就绪”的防御判断，
   * 这样页面层只管绑定按钮，不需要重复写判空逻辑。
   */
  const actions: ExampleGraphActions = {
    undo() {
      runHistoryAction("undo");
    },
    redo() {
      runHistoryAction("redo");
    },
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
    setLeaferDebugConfig(patch) {
      setLeaferDebugConfigState((currentConfig) => {
        const nextConfig = cloneExampleLeaferDebugConfig({
          ...currentConfig,
          ...patch
        });
        if (isSameExampleLeaferDebugConfig(currentConfig, nextConfig)) {
          return currentConfig;
        }

        appendLog(
          `已更新 Leafer Debug：enable=${
            nextConfig.enable ? "on" : "off"
          }，warn=${nextConfig.showWarn ? "on" : "off"}，filter=${formatLeaferDebugNameList(
            nextConfig.filter
          )}，exclude=${formatLeaferDebugNameList(
            nextConfig.exclude
          )}，repaint=${
            nextConfig.showRepaint ? "on" : "off"
          }，bounds=${formatLeaferDebugBoundsValue(nextConfig.showBounds)}`
        );
        return nextConfig;
      });
    },
    removeNode(nodeId) {
      removeNodesWithLogging([nodeId]);
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
    /**
     * 处理 `cleanupRuntimeFeedback` 相关逻辑。
     *
     * @returns 无返回值。
     */
    let cleanupRuntimeFeedback = (): void => {};
    /**
     * 处理 `cleanupHistory` 相关逻辑。
     *
     * @returns 无返回值。
     */
    let cleanupHistory = (): void => {};
    /**
     * 处理 `cleanupNodeState` 相关逻辑。
     *
     * @returns 无返回值。
     */
    let cleanupNodeState = (): void => {};
    /**
     * 处理 `cleanupUndoRedo` 相关逻辑。
     *
     * @returns 无返回值。
     */
    let cleanupUndoRedo = (): void => {};
    /**
     * 处理 `cleanupThemeListener` 相关逻辑。
     *
     * @returns 无返回值。
     */
    let cleanupThemeListener = (): void => {};
    /**
     * 处理 `restoreLeaferDebugConfig` 相关逻辑。
     *
     * @returns 无返回值。
     */
    let restoreLeaferDebugConfig = (): void => {};

    /**
     *  浏览器窗口尺寸变化后，重新让图内容适配视图。
     *
     * @returns 无返回值。
     */
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
     *
     * @returns 无返回值。
     */
    const cleanup = (): void => {
      if (disposed) {
        return;
      }

      disposed = true;
      cleanupRuntimeFeedback();
      cleanupHistory();
      cleanupNodeState();
      cleanupUndoRedo();
      cleanupThemeListener();
      restoreLeaferDebugConfig();
      window.removeEventListener("resize", handleWindowResize);

      clearTrackedLinks();
      setHistoryState(createEmptyHistoryState());
      nodeIdsRef.current.clear();
      shortcutsBindingRef.current = null;
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
     *
     * @returns 无返回值。
     */
    const bootstrap = async (): Promise<void> => {
      try {
        themeModeRef.current = resolvePreferredThemeMode();
        nodeIdsRef.current.clear();
        setHistoryState(createEmptyHistoryState());
        const exampleConfig = {
          graph: {
            ...EXAMPLE_MINI_GRAPH_CONFIG.graph,
            graph: {
              ...EXAMPLE_MINI_GRAPH_CONFIG.graph.graph,
              runtime: {
                linkPropagationAnimation: linkPropagationAnimationPreset
              }
            }
          },
          leaferDebug: cloneExampleLeaferDebugConfig(leaferDebugConfig)
        };
        const previousLeaferDebugConfig = captureLeaferDebugConfig();
        applyLeaferDebugConfig(exampleConfig.leaferDebug);
        restoreLeaferDebugConfig = () => {
          applyLeaferDebugConfig(previousLeaferDebugConfig);
        };
        const graph = createLeaferGraph(stageHost, {
          document: createEmptyExampleDocument(),
          plugins: [leaferGraphBasicKitPlugin, miniGraphExampleDemoPlugin],
          themeMode: themeModeRef.current,
          config: exampleConfig.graph
        });
        graphRef.current = graph;

        const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
        /**
         * 处理主题`Change`。
         *
         * @returns 无返回值。
         */
        const handleThemeChange = (): void => {
          const nextThemeMode = resolvePreferredThemeMode();
          themeModeRef.current = nextThemeMode;
          graph.setThemeMode(nextThemeMode);
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

        cleanupHistory = graph.subscribeHistory((event) => {
          if (
            event.type !== "history.record" ||
            event.record.kind !== "operation" ||
            event.record.source !== "interaction.commit"
          ) {
            return;
          }

          for (const operation of event.record.redoOperations) {
            if (operation.type !== "link.create") {
              continue;
            }

            const trackedLink = projectTrackedLinkFromCreateInput(operation.input);
            if (!trackedLink || trackedLinksRef.current.has(trackedLink.id)) {
              continue;
            }

            rememberTrackedLink(trackedLink);
            appendLog(
              `已通过拖线创建连线：${trackedLink.sourceNodeId}:${trackedLink.sourceSlot} -> ${trackedLink.targetNodeId}:${trackedLink.targetSlot}`
            );
          }
        });

        const undoRedoBinding = bindLeaferGraphUndoRedo({
          host: graph,
          config: exampleConfig.graph.graph.history
        });
        undoRedoBindingRef.current = undoRedoBinding;
        const unsubscribeHistoryState = undoRedoBinding.controller.subscribeState(
          (state: ExampleHistoryState) => {
            setHistoryState({ ...state });
          }
        );
        cleanupUndoRedo = () => {
          unsubscribeHistoryState();
          undoRedoBindingRef.current = null;
          undoRedoBinding.destroy();
          setHistoryState(createEmptyHistoryState());
        };

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
            nodeIdsRef.current.add(event.nodeId);
            contextMenuRef.current?.bindNodeTarget(event.nodeId);
            return;
          }

          if (event.reason === "removed" || !event.exists) {
            nodeIdsRef.current.delete(event.nodeId);
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
        appendLog(
          `历史已启用：最多保留 ${undoRedoBinding.config.maxEntries} 条，文档同步重置=${undoRedoBinding.config.resetOnDocumentSync ? "on" : "off"}`
        );
        appendLog(
          "右键画布可直接插入动画示例链，或从 Example 分类添加 Event Relay / Tick Monitor"
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

    applyLeaferDebugConfig(leaferDebugConfig);
  }, [leaferDebugConfig, status]);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    const graph = graphRef.current;
    const stageHost = stageRef.current;
    if (!graph || !stageHost) {
      return;
    }

    editingControllerRef.current = createLeaferGraphEditingController({
      host: {
        listSelectedNodeIds() {
          return graph.listSelectedNodeIds();
        },
        setSelectedNodeIds(nodeIds, mode) {
          return graph.setSelectedNodeIds(nodeIds, mode);
        },
        getNodeSnapshot(nodeId) {
          return graph.getNodeSnapshot(nodeId);
        },
        findLinksByNode(nodeId) {
          return graph.findLinksByNode(nodeId);
        }
      },
      clipboard: clipboardStoreRef.current,
      pasteOffset: DEFAULT_CLIPBOARD_PASTE_OFFSET,
      resolveAnchorPoint() {
        return resolveGraphPageAnchorPoint({
          graph,
          stageHost,
          clientPoint: latestStagePointerClientPointRef.current
        });
      },
      mutationAdapters: {
        createNode(input) {
          return graph.createNode(input);
        },
        createLink(input) {
          return graph.createLink(input);
        },
        removeNode(nodeId) {
          actions.removeNode(nodeId);
        },
        removeNodes(nodeIds) {
          removeNodesWithLogging(nodeIds);
        }
      }
    });

    return () => {
      editingControllerRef.current = null;
    };
  }, [status]);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    const graph = graphRef.current;
    const stageHost = stageRef.current;
    const editingController = editingControllerRef.current;
    if (!graph || !stageHost || !editingController) {
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
      listNodeIds() {
        return [...nodeIdsRef.current];
      },
      createNode: createNodeWithLogging,
      createLink: createLinkWithLogging,
      removeNode: actions.removeNode,
      removeNodes: removeNodesWithLogging,
      removeLink: actions.removeLink,
      appendLog,
      clipboard: clipboardStoreRef.current,
      editingController,
      history: {
        undo() {
          return runHistoryAction("undo");
        },
        redo() {
          return runHistoryAction("redo");
        },
        canUndo() {
          return undoRedoBindingRef.current?.controller.getState().canUndo ?? false;
        },
        canRedo() {
          return undoRedoBindingRef.current?.controller.getState().canRedo ?? false;
        }
      },
      resolveShortcutLabel(actionId) {
        return shortcutsBindingRef.current?.resolveShortcutLabel(actionId);
      },
      resolveThemeMode: () => themeModeRef.current
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

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    const stageHost = stageRef.current;
    if (!stageHost) {
      return;
    }

    const updateLatestPointerPoint = (event: PointerEvent): void => {
      latestStagePointerClientPointRef.current = {
        x: event.clientX,
        y: event.clientY
      };
    };

    stageHost.addEventListener("pointermove", updateLatestPointerPoint);
    stageHost.addEventListener("pointerdown", updateLatestPointerPoint);
    stageHost.addEventListener("pointerenter", updateLatestPointerPoint);

    return () => {
      stageHost.removeEventListener("pointermove", updateLatestPointerPoint);
      stageHost.removeEventListener("pointerdown", updateLatestPointerPoint);
      stageHost.removeEventListener("pointerenter", updateLatestPointerPoint);
    };
  }, [status]);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    const graph = graphRef.current;
    const stageHost = stageRef.current;
    const editingController = editingControllerRef.current;
    if (!graph || !stageHost || !editingController) {
      return;
    }

    const shortcutsBinding = bindLeaferGraphShortcuts({
      target: stageHost.ownerDocument,
      scopeElement: stageHost,
      host: {
        listNodeIds() {
          return [...nodeIdsRef.current];
        },
        listSelectedNodeIds() {
          return graph.listSelectedNodeIds();
        },
        setSelectedNodeIds(nodeIds: readonly string[]) {
          return graph.setSelectedNodeIds(nodeIds);
        },
        clearSelectedNodes() {
          return graph.clearSelectedNodes();
        },
        removeNode(nodeId: string) {
          actions.removeNode(nodeId);
        },
        fitView() {
          actions.fit();
        },
        play() {
          actions.play();
        },
        step() {
          actions.step();
        },
        stop() {
          actions.stop();
        },
        isTextEditingActive() {
          return Boolean(
            stageHost.ownerDocument.querySelector(WIDGET_TEXT_EDITOR_SELECTOR)
          );
        },
        isContextMenuOpen() {
          return contextMenuRef.current?.isOpen() ?? false;
        },
        getInteractionActivityState() {
          return graph.getInteractionActivityState();
        }
      },
      clipboard: {
        copySelection() {
          return copySelectedNodesToClipboard();
        },
        cutSelection() {
          return cutSelectedNodesToClipboard();
        },
        pasteClipboard() {
          return pasteNodesFromClipboard();
        },
        duplicateSelection() {
          return duplicateSelectedNodes();
        },
        canCopySelection() {
          return editingController.canCopySelection();
        },
        canCutSelection() {
          return editingController.canCutSelection();
        },
        canPasteClipboard() {
          return editingController.canPasteClipboard();
        },
        canDuplicateSelection() {
          return editingController.canDuplicateSelection();
        }
      },
      history: {
        undo() {
          return runHistoryAction("undo");
        },
        redo() {
          return runHistoryAction("redo");
        },
        canUndo() {
          return undoRedoBindingRef.current?.controller.getState().canUndo ?? false;
        },
        canRedo() {
          return undoRedoBindingRef.current?.controller.getState().canRedo ?? false;
        }
      }
    });
    shortcutsBindingRef.current = shortcutsBinding;

    /**
     * 处理 `shortcutLabel` 相关逻辑。
     *
     * @param functionId - 功能 ID。
     * @returns 处理后的结果。
     */
    const shortcutLabel = (functionId: Parameters<
      typeof shortcutsBinding.resolveShortcutLabel
    >[0]): string =>
      shortcutsBinding.resolveShortcutLabel(functionId) ?? "未绑定";
    appendLog(
      `快捷键已就绪：${shortcutLabel("graph.copy")} 复制，${shortcutLabel("graph.cut")} 剪切，${shortcutLabel("graph.paste")} 粘贴，${shortcutLabel("graph.duplicate")} 复制副本，${shortcutLabel("graph.select-all")} 全选，${shortcutLabel("graph.delete-selection")} 删除，${shortcutLabel("graph.undo")} 撤回，${shortcutLabel("graph.redo")} 重做`
    );

    return () => {
      shortcutsBindingRef.current = null;
      shortcutsBinding.destroy();
    };
  }, [status]);

  return {
    stageRef,
    logs,
    historyState,
    actions,
    status,
    authoringBundleStatus,
    registeredBundleCount,
    linkPropagationAnimationPreset,
    leaferDebugConfig,
    errorMessage,
    stageBadges: EXAMPLE_STAGE_BADGES,
    chainSteps: EXAMPLE_CHAIN_STEPS
  };
}
