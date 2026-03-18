import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { GraphDocument } from "leafergraph";

import {
  GraphViewport,
  type GraphViewportHostBridge,
  type GraphViewportToolbarActionState,
  type GraphViewportToolbarControlsState,
  type GraphViewportRuntimeControlsState
} from "./GraphViewport";
import {
  EDITOR_THEME_STORAGE_KEY,
  resolveInitialEditorTheme,
  type EditorTheme
} from "../theme";
import {
  createInitialBundleSlotState,
  EDITOR_BUNDLE_SLOTS,
  ensureEditorBundleRuntimeGlobals,
  loadEditorBundleSource,
  resolveEditorBundleRuntimeSetup,
  toErrorMessage
} from "../loader/runtime";
import {
  persistEditorBundleRecord,
  readPersistedEditorBundleRecords,
  removePersistedEditorBundleRecord,
  updatePersistedEditorBundleEnabled
} from "../loader/persistence";
import type {
  EditorBundleResolvedStatus,
  EditorBundleSlot,
  EditorBundleSlotState
} from "../loader/types";
import {
  createEditorRemoteAuthorityAppRuntime,
  type EditorRemoteAuthorityAppSource,
  type ResolvedEditorRemoteAuthorityAppRuntime
} from "./remote_authority_app_runtime";
import type { EditorRemoteAuthorityConnectionStatus } from "../session/graph_document_authority_client";
import {
  resolveRemoteAuthorityBundleProjection,
  shouldApplyRemoteAuthorityBundleProjection,
  type RemoteAuthorityBundleProjectionCheckpoint
} from "./remote_authority_bundle_projection";
import type { EditorAppBootstrapPreloadedBundle } from "./editor_app_bootstrap";

/** 切换到相反主题。 */
function toggleEditorTheme(theme: EditorTheme): EditorTheme {
  return theme === "dark" ? "light" : "dark";
}

/** editor 顶栏展示用的图级运行状态文案。 */
function formatGraphExecutionStatusLabel(
  status: GraphViewportRuntimeControlsState["executionState"]["status"]
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

type RemoteAuthorityRuntimeStatus =
  | "disabled"
  | "idle"
  | "loading"
  | "ready"
  | "error";

type RemoteAuthorityConnectionDisplayStatus =
  | "idle"
  | EditorRemoteAuthorityConnectionStatus;

/** editor 顶层 remote authority 状态文案。 */
function formatRemoteAuthorityStatusLabel(
  status: RemoteAuthorityRuntimeStatus
): string {
  switch (status) {
    case "loading":
      return "远端加载中";
    case "ready":
      return "远端已接通";
    case "error":
      return "远端连接失败";
    case "idle":
      return "远端待启动";
    default:
      return "本地模式";
  }
}

/** editor 顶层 authority 连接状态文案。 */
function formatRemoteAuthorityConnectionStatusLabel(
  status: RemoteAuthorityConnectionDisplayStatus
): string {
  switch (status) {
    case "connecting":
      return "正在建立连接";
    case "connected":
      return "已连接";
    case "reconnecting":
      return "自动重连中";
    case "disconnected":
      return "连接已断开";
    default:
      return "未建立连接";
  }
}

/** 固定的 bundle 槽位标题。 */
const BUNDLE_SLOT_TITLE: Readonly<Record<EditorBundleSlot, string>> = {
  demo: "Demo Bundle",
  node: "Node Bundle",
  widget: "Widget Bundle"
} as const;

/** 固定的 bundle 槽位说明。 */
const BUNDLE_SLOT_DESCRIPTION: Readonly<Record<EditorBundleSlot, string>> = {
  demo: "只负责提供默认图数据，推荐在 node 和 widget 就绪后再启用。",
  node: "安装可独立运行的节点模块，并提供默认快速创建节点类型。",
  widget: "注册外部 widget，并可附带一个消费该 widget 的伴生节点。"
} as const;

/** editor 面板使用的状态文案。 */
const BUNDLE_STATUS_LABEL: Readonly<
  Record<EditorBundleResolvedStatus, string>
> = {
  idle: "未加载",
  ready: "已加载",
  "dependency-missing": "依赖缺失",
  failed: "加载失败",
  loading: "加载中"
} as const;

/** editor 当前阶段的工作分页定义。 */
const WORKSPACE_PAGES = [
  {
    id: "bundle-loader",
    title: "Bundle 接入",
    description: "从本地 dist IIFE 文件加载 demo、node、widget"
  },
  {
    id: "main-canvas",
    title: "主画布",
    description: "当前本地 bundle 的默认渲染页"
  }
] as const;

/** 浏览器恢复 bundle 时使用的固定顺序。 */
const RESTORE_BUNDLE_SLOTS = ["widget", "node", "demo"] as const;
const TOOLBAR_ACTION_GROUPS = ["history", "canvas", "selection"] as const;

type EditorWorkspacePageId = (typeof WORKSPACE_PAGES)[number]["id"];

/** 生成工具栏按钮 title，统一复用命令说明和快捷键信息。 */
function formatToolbarActionTitle(
  action: GraphViewportToolbarActionState
): string {
  return action.shortcut
    ? `${action.description}（${action.shortcut}）`
    : action.description;
}

/** 创建 editor 的初始 bundle 槽位映射。 */
function createInitialBundleSlots(): Record<EditorBundleSlot, EditorBundleSlotState> {
  return {
    demo: createInitialBundleSlotState("demo"),
    node: createInitialBundleSlotState("node"),
    widget: createInitialBundleSlotState("widget")
  };
}

/** 读取某个槽位当前的激活提示。 */
function resolveBundleActivationLabel(slot: {
  manifest: unknown;
  enabled: boolean;
  active: boolean;
  missingRequirements: EditorBundleSlot[];
}): string {
  if (!slot.manifest) {
    return "当前未加载";
  }

  if (!slot.enabled) {
    return "当前已停用";
  }

  if (!slot.active && slot.missingRequirements.length > 0) {
    return `等待依赖：${slot.missingRequirements.join(" + ")}`;
  }

  return "当前已启用";
}

/** 将浏览器持久化状态格式化为面板文案。 */
function formatBundlePersistenceLabel(slot: EditorBundleSlotState): string {
  if (!slot.manifest) {
    return "无";
  }

  if (!slot.persisted) {
    return "未写入浏览器";
  }

  return slot.restoredFromPersistence
    ? "已从浏览器恢复"
    : "已写入浏览器，刷新后自动恢复";
}

function resolvePreloadedBundleFileName(
  bundle: EditorAppBootstrapPreloadedBundle
): string {
  if (typeof bundle.fileName === "string" && bundle.fileName.trim().length > 0) {
    return bundle.fileName.trim();
  }

  try {
    const url = new URL(bundle.url, window.location.href);
    const segments = url.pathname.split("/").filter(Boolean);
    const lastSegment = segments.at(-1);
    if (lastSegment) {
      return lastSegment;
    }
  } catch {
    // ignore invalid URL and fall back to slot name below
  }

  return `${bundle.slot}.bundle.js`;
}

export interface AppProps {
  preloadedBundles?: readonly EditorAppBootstrapPreloadedBundle[];
  remoteAuthoritySource?: EditorRemoteAuthorityAppSource;
  onViewportHostBridgeChange?(bridge: GraphViewportHostBridge | null): void;
}

export function App({
  preloadedBundles,
  remoteAuthoritySource,
  onViewportHostBridgeChange
}: AppProps) {
  const [theme, setTheme] = useState<EditorTheme>(() =>
    resolveInitialEditorTheme()
  );
  const [activeWorkspacePageId, setActiveWorkspacePageId] =
    useState<EditorWorkspacePageId>("bundle-loader");
  const [hasStartedRendering, setHasStartedRendering] = useState(false);
  const viewportSectionRef = useRef<HTMLElement | null>(null);
  const [graphRuntimeControls, setGraphRuntimeControls] =
    useState<GraphViewportRuntimeControlsState | null>(null);
  const [editorToolbarControls, setEditorToolbarControls] =
    useState<GraphViewportToolbarControlsState | null>(null);
  const [bundleSlots, setBundleSlots] = useState<
    Record<EditorBundleSlot, EditorBundleSlotState>
  >(() => createInitialBundleSlots());
  const [remoteAuthorityStatus, setRemoteAuthorityStatus] =
    useState<RemoteAuthorityRuntimeStatus>(
      remoteAuthoritySource ? "idle" : "disabled"
    );
  const [remoteAuthorityError, setRemoteAuthorityError] = useState<string | null>(
    null
  );
  const [remoteAuthorityRuntime, setRemoteAuthorityRuntime] =
    useState<ResolvedEditorRemoteAuthorityAppRuntime | null>(null);
  const [remoteAuthorityDocument, setRemoteAuthorityDocument] =
    useState<GraphDocument | null>(null);
  const [remoteAuthorityConnectionStatus, setRemoteAuthorityConnectionStatus] =
    useState<RemoteAuthorityConnectionDisplayStatus>("idle");
  const [remoteAuthorityReloadKey, setRemoteAuthorityReloadKey] = useState(0);
  const [viewportHostBridge, setViewportHostBridge] =
    useState<GraphViewportHostBridge | null>(null);
  const remoteAuthorityBundleProjectionCheckpointRef =
    useRef<RemoteAuthorityBundleProjectionCheckpoint | null>(null);
  const isCanvasWorkspace =
    hasStartedRendering && activeWorkspacePageId === "main-canvas";
  const remoteAuthorityRuntimeRef =
    useRef<ResolvedEditorRemoteAuthorityAppRuntime | null>(null);
  const remoteAuthorityConnectionStatusRef =
    useRef<RemoteAuthorityConnectionDisplayStatus>("idle");
  const isRemoteAuthorityEnabled = Boolean(remoteAuthoritySource);

  useEffect(() => {
    remoteAuthorityRuntimeRef.current = remoteAuthorityRuntime;
  }, [remoteAuthorityRuntime]);

  useEffect(() => {
    remoteAuthorityConnectionStatusRef.current = remoteAuthorityConnectionStatus;
  }, [remoteAuthorityConnectionStatus]);

  useEffect(() => {
    if (!remoteAuthorityRuntime) {
      setRemoteAuthorityDocument(null);
      setRemoteAuthorityConnectionStatus("idle");
      return;
    }

    setRemoteAuthorityDocument(remoteAuthorityRuntime.document);
  }, [remoteAuthorityRuntime]);

  useEffect(() => {
    if (!remoteAuthorityRuntime || !viewportHostBridge) {
      return;
    }

    setRemoteAuthorityDocument(viewportHostBridge.getCurrentDocument());
    return viewportHostBridge.subscribeDocument((document) => {
      setRemoteAuthorityDocument(document);
    });
  }, [remoteAuthorityRuntime, viewportHostBridge]);

  useEffect(() => {
    if (!remoteAuthorityRuntime) {
      remoteAuthorityConnectionStatusRef.current = "idle";
      setRemoteAuthorityConnectionStatus("idle");
      return;
    }

    const initialStatus = remoteAuthorityRuntime.getConnectionStatus();
    remoteAuthorityConnectionStatusRef.current = initialStatus;
    setRemoteAuthorityConnectionStatus(initialStatus);

    return remoteAuthorityRuntime.subscribeConnectionStatus((status) => {
      const previousStatus = remoteAuthorityConnectionStatusRef.current;
      remoteAuthorityConnectionStatusRef.current = status;
      setRemoteAuthorityConnectionStatus(status);

      if (
        status !== "connected" ||
        (previousStatus !== "reconnecting" &&
          previousStatus !== "disconnected" &&
          previousStatus !== "connecting")
      ) {
        return;
      }

      if (!viewportHostBridge) {
        return;
      }

      void viewportHostBridge
        .resyncAuthorityDocument()
        .then((document) => {
          setRemoteAuthorityDocument(document);
          setRemoteAuthorityError(null);
        })
        .catch((error: unknown) => {
          setRemoteAuthorityError(
            `Authority 已重连，但重新同步失败：${toErrorMessage(error)}`
          );
        });
    });
  }, [remoteAuthorityRuntime, viewportHostBridge]);

  useEffect(() => {
    ensureEditorBundleRuntimeGlobals();

    let cancelled = false;

    const restorePersistedBundles = async (): Promise<void> => {
      const records = await readPersistedEditorBundleRecords();
      if (cancelled) {
        return;
      }

      const preloadedBundleMap = new Map(
        (preloadedBundles ?? []).map((bundle) => [bundle.slot, bundle])
      );
      const recordMap = new Map(records.map((record) => [record.slot, record]));
      const restoreSlots = RESTORE_BUNDLE_SLOTS.filter(
        (slot) => preloadedBundleMap.has(slot) || recordMap.has(slot)
      );
      if (restoreSlots.length === 0) {
        return;
      }

      setBundleSlots((current) => {
        const next = { ...current };

        for (const slot of restoreSlots) {
          next[slot] = {
            ...current[slot],
            loading: true,
            error: null
          };
        }

        return next;
      });

      for (const slot of RESTORE_BUNDLE_SLOTS) {
        const preloadedBundle = preloadedBundleMap.get(slot);
        if (preloadedBundle) {
          const fileName = resolvePreloadedBundleFileName(preloadedBundle);

          try {
            const response = await fetch(preloadedBundle.url);
            if (!response.ok) {
              throw new Error(
                `无法加载预装 bundle：${response.status} ${response.statusText}`.trim()
              );
            }

            const sourceCode = await response.text();
            const manifest = await loadEditorBundleSource(slot, sourceCode, fileName);

            if (cancelled) {
              return;
            }

            setBundleSlots((current) => ({
              ...current,
              [slot]: {
                slot,
                manifest,
                fileName,
                enabled: preloadedBundle.enabled ?? true,
                loading: false,
                error: null,
                persisted: false,
                restoredFromPersistence: false
              }
            }));
          } catch (error) {
            if (cancelled) {
              return;
            }

            setBundleSlots((current) => ({
              ...current,
              [slot]: {
                ...createInitialBundleSlotState(slot),
                fileName,
                loading: false,
                error: `预装 bundle 加载失败：${toErrorMessage(error)}`
              }
            }));
          }

          continue;
        }

        const record = recordMap.get(slot);
        if (!record) {
          continue;
        }

        try {
          const manifest = await loadEditorBundleSource(
            slot,
            record.sourceCode,
            record.fileName
          );

          if (cancelled) {
            return;
          }

          setBundleSlots((current) => ({
            ...current,
            [slot]: {
              slot,
              manifest,
              fileName: record.fileName,
              enabled: record.enabled,
              loading: false,
              error: null,
              persisted: true,
              restoredFromPersistence: true
            }
          }));
        } catch (error) {
          await removePersistedEditorBundleRecord(slot);

          if (cancelled) {
            return;
          }

          setBundleSlots((current) => ({
            ...current,
            [slot]: {
              ...createInitialBundleSlotState(slot),
              fileName: record.fileName,
              loading: false,
              error: `浏览器恢复失败，已清除本地记录：${toErrorMessage(error)}`
            }
          }));
        }
      }
    };

    void restorePersistedBundles();

    return () => {
      cancelled = true;
    };
  }, [preloadedBundles]);

  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(EDITOR_THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!hasStartedRendering) {
      return;
    }

    const ownerWindow =
      viewportSectionRef.current?.ownerDocument.defaultView ?? window;

    ownerWindow.requestAnimationFrame(() => {
      viewportSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }, [hasStartedRendering]);

  useEffect(() => {
    if (!remoteAuthoritySource) {
      setRemoteAuthorityStatus("disabled");
      setRemoteAuthorityError(null);
      setRemoteAuthorityRuntime((current) => {
        current?.dispose();
        return null;
      });
      return;
    }

    if (!hasStartedRendering || activeWorkspacePageId !== "main-canvas") {
      setRemoteAuthorityStatus("idle");
      setRemoteAuthorityError(null);
      setRemoteAuthorityRuntime((current) => {
        current?.dispose();
        return null;
      });
      return;
    }

    let cancelled = false;
    let createdRuntime: ResolvedEditorRemoteAuthorityAppRuntime | null = null;
    setRemoteAuthorityStatus("loading");
    setRemoteAuthorityError(null);
    setRemoteAuthorityRuntime((current) => {
      current?.dispose();
      return null;
    });

    void createEditorRemoteAuthorityAppRuntime(remoteAuthoritySource).then(
      (runtime) => {
        if (cancelled) {
          runtime.dispose();
          return;
        }

        createdRuntime = runtime;
        setRemoteAuthorityRuntime(runtime);
        setRemoteAuthorityStatus("ready");
      },
      (error: unknown) => {
        if (cancelled) {
          return;
        }

        setRemoteAuthorityStatus("error");
        setRemoteAuthorityError(toErrorMessage(error));
      }
    );

    return () => {
      cancelled = true;
      createdRuntime?.dispose();
      remoteAuthorityRuntimeRef.current = null;
    };
  }, [
    activeWorkspacePageId,
    hasStartedRendering,
    remoteAuthorityReloadKey,
    remoteAuthoritySource
  ]);

  const runtimeSetup = useMemo(
    () => resolveEditorBundleRuntimeSetup(bundleSlots),
    [bundleSlots]
  );
  const remoteAuthorityBundleProjection = useMemo(
    () => resolveRemoteAuthorityBundleProjection(runtimeSetup),
    [runtimeSetup]
  );
  /**
   * 远端 authority 的实时文档只用于状态展示和 bundle projection 判断，
   * 不能反过来作为 GraphViewport 的初始化输入，否则每次 revision 变化都会触发整棵画布卸载重建。
   */
  const effectiveDocument =
    remoteAuthorityRuntime?.document ?? runtimeSetup.document;
  const effectiveCreateDocumentSessionBinding =
    remoteAuthorityRuntime?.createDocumentSessionBinding;
  const effectiveRuntimeFeedbackInlet =
    remoteAuthorityRuntime?.runtimeFeedbackInlet;

  useEffect(() => {
    if (!remoteAuthorityRuntime) {
      remoteAuthorityBundleProjectionCheckpointRef.current = null;
    }
  }, [remoteAuthorityRuntime]);

  useEffect(() => {
    if (!remoteAuthorityBundleProjection) {
      remoteAuthorityBundleProjectionCheckpointRef.current = null;
      return;
    }

    if (!remoteAuthorityRuntime || !viewportHostBridge) {
      return;
    }

    if (
      !shouldApplyRemoteAuthorityBundleProjection({
        runtime: remoteAuthorityRuntime,
        projection: remoteAuthorityBundleProjection,
        checkpoint: remoteAuthorityBundleProjectionCheckpointRef.current
      })
    ) {
      return;
    }

    remoteAuthorityBundleProjectionCheckpointRef.current = {
      runtime: remoteAuthorityRuntime,
      document: remoteAuthorityBundleProjection.document
    };

    viewportHostBridge.replaceDocument(
      structuredClone(remoteAuthorityBundleProjection.document)
    );
  }, [
    remoteAuthorityBundleProjection,
    remoteAuthorityRuntime,
    viewportHostBridge
  ]);
  const activeWorkspacePage = WORKSPACE_PAGES.find(
    (page) => page.id === activeWorkspacePageId
  )!;
  const graphExecutionState: GraphViewportRuntimeControlsState["executionState"] =
    graphRuntimeControls?.executionState ?? {
      status: "idle",
      queueSize: 0,
      stepCount: 0
    };
  const canPlayGraph = Boolean(
    graphRuntimeControls?.available &&
      (graphExecutionState.status === "idle" ||
        graphExecutionState.status === "stepping")
  );
  const canStepGraph = Boolean(
    graphRuntimeControls?.available &&
      (graphExecutionState.status === "idle" ||
        graphExecutionState.status === "stepping")
  );
  const canStopGraph = Boolean(
    graphRuntimeControls?.available &&
      (graphExecutionState.status === "running" ||
        graphExecutionState.status === "stepping")
  );
  const toolbarActionGroups = TOOLBAR_ACTION_GROUPS.map((group) => ({
    group,
    actions:
      editorToolbarControls?.actions.filter((action) => action.group === group) ??
      []
  })).filter((entry) => entry.actions.length > 0);

  /** 统一进入主画布渲染态，避免多个入口各自维护同一组状态。 */
  const startRendering = (): void => {
    setActiveWorkspacePageId("main-canvas");
    setHasStartedRendering(true);
  };

  /** 卸载当前画布宿主，让 GraphViewport 走完整销毁链路。 */
  const stopRendering = (): void => {
    setHasStartedRendering(false);
    setGraphRuntimeControls(null);
    setEditorToolbarControls(null);
    setRemoteAuthorityRuntime((current) => {
      current?.dispose();
      return null;
    });
  };

  const handleBundleFileChange = async (
    slot: EditorBundleSlot,
    event: Event
  ): Promise<void> => {
    const input = event.currentTarget as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (input) {
      input.value = "";
    }

    if (!file) {
      return;
    }

    const previousSlotState = bundleSlots[slot];

    setBundleSlots((current) => ({
      ...current,
      [slot]: {
        ...current[slot],
        loading: true,
        error: null,
        restoredFromPersistence: false
      }
    }));

    try {
      const sourceCode = await file.text();
      const manifest = await loadEditorBundleSource(slot, sourceCode, file.name);
      const persisted = await persistEditorBundleRecord({
        slot,
        fileName: file.name,
        sourceCode,
        enabled: true,
        savedAt: Date.now()
      });

      setBundleSlots((current) => ({
        ...current,
        [slot]: {
          slot,
          manifest,
          fileName: file.name,
          enabled: true,
          loading: false,
          error: null,
          persisted,
          restoredFromPersistence: false
        }
      }));
    } catch (error) {
      const errorMessage = toErrorMessage(error);

      setBundleSlots((current) => ({
        ...current,
        [slot]: {
          ...previousSlotState,
          loading: false,
          error: errorMessage,
          fileName: previousSlotState.fileName ?? file.name
        }
      }));
    }
  };

  const toggleBundleEnabled = (slot: EditorBundleSlot): void => {
    const nextEnabled = !bundleSlots[slot].enabled;

    setBundleSlots((current) => ({
      ...current,
      [slot]: {
        ...current[slot],
        enabled: nextEnabled
      }
    }));

    void updatePersistedEditorBundleEnabled(slot, nextEnabled);
  };

  const unloadBundle = (slot: EditorBundleSlot): void => {
    setBundleSlots((current) => ({
      ...current,
      [slot]: createInitialBundleSlotState(slot)
    }));

    void removePersistedEditorBundleRecord(slot);
  };

  const handleViewportHostBridgeChange = useCallback(
    (bridge: GraphViewportHostBridge | null): void => {
      setViewportHostBridge(bridge);
      onViewportHostBridgeChange?.(bridge);
    },
    [onViewportHostBridgeChange]
  );

  return (
    <div
      class="shell"
      data-theme={theme}
      data-workspace-mode={isCanvasWorkspace ? "canvas" : "default"}
    >
      <aside class="sidebar">
        <p class="eyebrow">LeaferGraph</p>
        <h1>Editor Sandbox</h1>
        <p class="lead">
          编辑器控制层现在由 <code>Preact</code> 承担，LeaferGraph 继续作为底层
          画布与图形宿主。
        </p>

        <section class="panel">
          <h2>当前结构</h2>
          <ul>
            <li>核心库：LeaferGraph API 与渲染宿主</li>
            <li>编辑器：Preact 组件树管理布局和状态</li>
            <li>
              {isRemoteAuthorityEnabled
                ? "远端 authority：由 App 装配 client、文档快照和反馈回流"
                : "本地接入：通过 IIFE bundle 装载 demo、node、widget"}
            </li>
          </ul>
        </section>

        <section class="panel">
          <h2>Authority</h2>
          <ul>
            <li>
              当前模式：
              {isRemoteAuthorityEnabled ? "Remote Authority" : "Local Loopback"}
            </li>
            <li>装配状态：{formatRemoteAuthorityStatusLabel(remoteAuthorityStatus)}</li>
            <li>
              连接状态：
              {formatRemoteAuthorityConnectionStatusLabel(
                remoteAuthorityConnectionStatus
              )}
            </li>
            <li>
              当前来源：
              {remoteAuthorityRuntime?.sourceLabel ??
                remoteAuthoritySource?.label ??
                "未接入"}
            </li>
            <li>
              当前文档：
              {remoteAuthorityDocument
                ? `${remoteAuthorityDocument.documentId} @ ${remoteAuthorityDocument.revision}`
                : "使用当前本地图文档"}
            </li>
          </ul>
          {remoteAuthorityRuntime?.sourceDescription ? (
            <p class="bundle-panel__note">{remoteAuthorityRuntime.sourceDescription}</p>
          ) : null}
          {remoteAuthorityStatus === "ready" &&
          remoteAuthorityConnectionStatus === "reconnecting" ? (
            <p class="bundle-panel__note">
              authority 连接已断开，正在自动重连；恢复后会重新拉取权威文档。
            </p>
          ) : null}
          {remoteAuthorityError ? (
            <p class="bundle-card__error">{remoteAuthorityError}</p>
          ) : null}
          {isRemoteAuthorityEnabled ? (
            <button
              type="button"
              class="bundle-card__button"
              disabled={remoteAuthorityStatus === "loading"}
              onClick={() => {
                setRemoteAuthorityReloadKey((current) => current + 1);
              }}
            >
              {remoteAuthorityStatus === "loading"
                ? "连接中"
                : remoteAuthorityConnectionStatus === "reconnecting"
                  ? "自动重连中"
                  : "重新连接 Authority"}
            </button>
          ) : null}
        </section>

        <section class="panel">
          <h2>当前建议顺序</h2>
          <ul>
            <li>先加载 Widget Bundle，确保外部 widget 已注册</li>
            <li>再加载 Node Bundle，挂上可独立使用的节点模块</li>
            <li>最后加载 Demo Bundle，让默认图数据一次性落图</li>
          </ul>
        </section>
      </aside>

      <main class="workspace">
        <header class="toolbar">
          <div>
            <p class="toolbar__label">Workspace</p>
            <h2>Leafer-first Node Graph</h2>
          </div>
          <div class="toolbar__actions">
            {toolbarActionGroups.length ? (
              <div class="toolbar__command-groups" aria-label="编辑工具栏">
                {toolbarActionGroups.map(({ group, actions }) => (
                  <div class="toolbar__command-group" data-group={group} key={group}>
                    {actions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        class={`toolbar__command-button${
                          action.danger ? " toolbar__command-button--danger" : ""
                        }`}
                        disabled={action.disabled}
                        title={formatToolbarActionTitle(action)}
                        aria-label={formatToolbarActionTitle(action)}
                        onClick={() => {
                          editorToolbarControls?.execute(action.id);
                        }}
                      >
                        <span>{action.label}</span>
                        {action.shortcut ? (
                          <span class="toolbar__command-shortcut">
                            {action.shortcut}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p class="toolbar__command-placeholder">
                主画布挂载后，这里会显示复用命令总线的编辑工具栏。
              </p>
            )}
            <div class="toolbar__runtime-controls">
              <span
                class="badge badge--runtime"
                data-status={graphExecutionState.status}
              >
                {formatGraphExecutionStatusLabel(graphExecutionState.status)}
              </span>
              <button
                type="button"
                class="render-toggle render-toggle--graph"
                disabled={!canPlayGraph}
                onClick={() => {
                  graphRuntimeControls?.play();
                }}
              >
                Play
              </button>
              <button
                type="button"
                class="render-toggle render-toggle--graph"
                disabled={!canStepGraph}
                onClick={() => {
                  graphRuntimeControls?.step();
                }}
              >
                Step
              </button>
              <button
                type="button"
                class="render-toggle render-toggle--graph render-toggle--stop"
                disabled={!canStopGraph}
                onClick={() => {
                  graphRuntimeControls?.stop();
                }}
              >
                Stop
              </button>
            </div>
            <span class="badge">
              {theme === "dark" ? "暗色工作区" : "亮色工作区"}
            </span>
            <button
              type="button"
              class="theme-toggle"
              data-theme={theme}
              aria-label={`切换到${theme === "dark" ? "亮色" : "暗色"}模式`}
              title={`切换到${theme === "dark" ? "亮色" : "暗色"}模式`}
              onClick={() => {
                setTheme((currentTheme) => toggleEditorTheme(currentTheme));
              }}
            >
              <span class="theme-toggle__thumb" aria-hidden="true" />
              <span class="theme-toggle__option theme-toggle__option--light">
                亮色
              </span>
              <span class="theme-toggle__option theme-toggle__option--dark">
                暗色
              </span>
            </button>
          </div>
        </header>

        <section
          class={`canvas-pages${isCanvasWorkspace ? " canvas-pages--compact" : ""}`}
          aria-label="工作分页"
        >
          <div class="canvas-pages__header">
            <div>
              <p class="toolbar__label">Workspace Pages</p>
              <h3>工作分页</h3>
            </div>
            <div class="canvas-pages__actions">
              <p class="canvas-pages__summary">
                当前页：
                <strong>{activeWorkspacePage.title}</strong>
                ，
                {hasStartedRendering ? "已挂载渲染宿主" : "尚未开始渲染"}
              </p>
              {hasStartedRendering ? (
                <button
                  type="button"
                  class="render-toggle render-toggle--stop"
                  onClick={stopRendering}
                >
                  停止渲染
                </button>
              ) : (
                <button
                  type="button"
                  class="render-toggle"
                  onClick={startRendering}
                >
                  开始渲染
                </button>
              )}
            </div>
          </div>

          <div class="canvas-pages__tabs" role="tablist" aria-label="工作分页标签">
            {WORKSPACE_PAGES.map((page) => {
              const active = page.id === activeWorkspacePageId;

              return (
                <button
                  key={page.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  class="canvas-pages__tab"
                  data-active={active ? "true" : "false"}
                  onClick={() => {
                    setActiveWorkspacePageId(page.id);
                  }}
                >
                  <span class="canvas-pages__tab-title">{page.title}</span>
                  <span class="canvas-pages__tab-description">
                    {page.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {activeWorkspacePage.id === "bundle-loader" ? (
          <section
            ref={viewportSectionRef}
            class="workspace-page-shell"
            aria-live="polite"
          >
            <div class="canvas-page">
              <div class="canvas-page__header">
                <div>
                  <p class="toolbar__label">Bundle Center</p>
                  <h3>{activeWorkspacePage.title}</h3>
                </div>
                <p class="canvas-page__description">
                  {activeWorkspacePage.description}
                </p>
              </div>

              <div class="canvas-page__body canvas-page__body--scroll">
                <section
                  class="bundle-panel bundle-panel--embedded"
                  aria-label="本地 bundle 加载面板"
                >
                  <div class="bundle-panel__header">
                    <div>
                      <p class="toolbar__label">Local Bundles</p>
                      <h3>从本地 dist IIFE 文件加载</h3>
                    </div>
                    <p class="bundle-panel__summary">
                    当前激活：
                      <strong>{runtimeSetup.plugins.length}</strong>
                      个插件，
                      <strong>{runtimeSetup.quickCreateNodeType ?? "无"}</strong>
                      作为优先创建节点
                    </p>
                  </div>
                  <p class="bundle-panel__note">
                    已加载 bundle 会记录到浏览器本地，刷新后自动恢复。
                  </p>

                  <div class="bundle-grid">
                    {EDITOR_BUNDLE_SLOTS.map((slot) => {
                      const state = runtimeSetup.slots[slot];
                      const manifest = state.manifest;
                      const quickCreateNodeType =
                        manifest?.kind === "node" || manifest?.kind === "widget"
                          ? manifest.quickCreateNodeType
                          : undefined;

                      return (
                        <article class="bundle-card" key={slot}>
                          <div class="bundle-card__header">
                            <div>
                              <h4>{BUNDLE_SLOT_TITLE[slot]}</h4>
                              <p>{BUNDLE_SLOT_DESCRIPTION[slot]}</p>
                            </div>
                            <span
                              class="bundle-card__status"
                              data-status={state.status}
                            >
                              {BUNDLE_STATUS_LABEL[state.status]}
                            </span>
                          </div>

                          <div class="bundle-card__meta">
                            <span>{resolveBundleActivationLabel(state)}</span>
                            <span>
                              {manifest?.version
                                ? `v${manifest.version}`
                                : "未声明版本"}
                            </span>
                          </div>

                          <dl class="bundle-card__info">
                            <div>
                              <dt>文件</dt>
                              <dd>{state.fileName ?? "未选择"}</dd>
                            </div>
                            <div>
                              <dt>名称</dt>
                              <dd>{manifest?.name ?? "未加载"}</dd>
                            </div>
                            <div>
                              <dt>ID</dt>
                              <dd>{manifest?.id ?? "未加载"}</dd>
                            </div>
                            <div>
                              <dt>依赖</dt>
                              <dd>
                                {manifest?.requires?.length
                                  ? manifest.requires.join(" + ")
                                  : "无"}
                              </dd>
                            </div>
                            <div>
                              <dt>记录</dt>
                              <dd>{formatBundlePersistenceLabel(state)}</dd>
                            </div>
                            {quickCreateNodeType !== undefined ? (
                              <div>
                                <dt>快速创建</dt>
                                <dd>{quickCreateNodeType}</dd>
                              </div>
                            ) : null}
                          </dl>

                          {state.error ? (
                            <p class="bundle-card__error">{state.error}</p>
                          ) : null}

                          <div class="bundle-card__actions">
                            <label class="bundle-card__button bundle-card__button--primary">
                              选择文件
                              <input
                                type="file"
                                class="bundle-card__file-input"
                                accept=".js,text/javascript,application/javascript"
                                onChange={(event) => {
                                  void handleBundleFileChange(slot, event);
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              class="bundle-card__button"
                              disabled={!manifest || state.loading}
                              onClick={() => {
                                toggleBundleEnabled(slot);
                              }}
                            >
                              {state.enabled ? "停用" : "启用"}
                            </button>
                            <button
                              type="button"
                              class="bundle-card__button"
                              disabled={state.loading && !manifest}
                              onClick={() => {
                                unloadBundle(slot);
                              }}
                            >
                              卸载
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          </section>
        ) : hasStartedRendering ? (
          <section ref={viewportSectionRef} class="workspace-page-shell" aria-live="polite">
            <div class="canvas-page canvas-page--canvas">
              <div class="canvas-page__header">
                <div>
                  <p class="toolbar__label">Canvas View</p>
                  <h3>{activeWorkspacePage.title}</h3>
                </div>
                <p class="canvas-page__description">
                  {activeWorkspacePage.description}
                </p>
              </div>

              <div class="canvas-page__body">
                {isRemoteAuthorityEnabled && remoteAuthorityStatus !== "ready" ? (
                  <div class="graph-root graph-root--idle">
                    <div class="graph-empty-state">
                      <p class="toolbar__label">Remote Authority</p>
                      <h3>
                        {remoteAuthorityStatus === "error"
                          ? "Authority 连接失败"
                          : "正在加载远端文档"}
                      </h3>
                      <p>
                        {remoteAuthorityStatus === "error"
                          ? remoteAuthorityError ??
                            "当前 authority 未能返回可用文档，请重试或切回本地模式。"
                          : "App 正在装配 authority client、拉取正式 GraphDocument，并等待反馈通道就绪。"}
                      </p>
                      <button
                        type="button"
                        class="render-toggle render-toggle--hero"
                        disabled={remoteAuthorityStatus === "loading"}
                        onClick={() => {
                          setRemoteAuthorityReloadKey((current) => current + 1);
                        }}
                      >
                        {remoteAuthorityStatus === "loading" ? "连接中" : "重试连接"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <GraphViewport
                    document={effectiveDocument}
                    plugins={runtimeSetup.plugins}
                    createDocumentSessionBinding={effectiveCreateDocumentSessionBinding}
                    runtimeFeedbackInlet={effectiveRuntimeFeedbackInlet}
                    onHostBridgeChange={handleViewportHostBridgeChange}
                    quickCreateNodeType={runtimeSetup.quickCreateNodeType}
                    theme={theme}
                    onEditorToolbarControlsChange={setEditorToolbarControls}
                    onGraphRuntimeControlsChange={setGraphRuntimeControls}
                  />
                )}
              </div>
            </div>
          </section>
        ) : (
          <section ref={viewportSectionRef} class="workspace-page-shell" aria-live="polite">
            <div class="canvas-page canvas-page--canvas">
              <div class="canvas-page__header">
                <div>
                  <p class="toolbar__label">Canvas View</p>
                  <h3>{activeWorkspacePage.title}</h3>
                </div>
                <p class="canvas-page__description">
                  {activeWorkspacePage.description}
                </p>
              </div>

              <div class="canvas-page__body">
                <div class="graph-root graph-root--idle">
                  <div class="graph-empty-state">
                    <p class="toolbar__label">Viewport</p>
                    <h3>等待开始渲染</h3>
                    <p>
                      你可以先加载本地 bundle，再点击上方画布分页里的“开始渲染”挂载画布。
                    </p>
                    <button
                      type="button"
                      class="render-toggle render-toggle--hero"
                      onClick={startRendering}
                    >
                      在主画布开始渲染
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
