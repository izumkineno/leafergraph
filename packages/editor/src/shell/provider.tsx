import { createContext, type ComponentChildren, type JSX } from "preact";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { GraphDocument } from "leafergraph";
import type { NodeDefinition } from "@leafergraph/node";

import { AppDialog } from "../ui/foundation/dialog";
import { NodeLibraryHoverPreviewOverlay } from "../ui/node-library-preview";
import {
  GraphViewport,
  type GraphViewportHostBridge,
  type GraphViewportRuntimeControlsState,
  type GraphViewportToolbarActionState,
  type GraphViewportToolbarControlsState,
  type GraphViewportWorkspaceState
} from "../ui/viewport";
import type { GraphViewportRemoteRuntimeControlNotice } from "../ui/viewport/runtime_control_notice";
import { InspectorPane, NodeLibraryPane } from "../app/WorkspacePanels";
import {
  shouldEnableNodeLibraryHoverPreview,
  type NodeLibraryPreviewRequest
} from "../ui/node-library-preview/helpers";
import {
  DEFAULT_PYTHON_AUTHORITY_DEMO_URL,
  resolveDefaultEntryOnboardingDocumentNodeCount,
  resolveDefaultEntryOnboardingState
} from "./onboarding/default_entry_onboarding";
import {
  EDITOR_THEME_STORAGE_KEY,
  resolveInitialEditorTheme,
  type EditorTheme
} from "../theme";
import {
  persistWorkspacePaneOpen,
  resolveInitialWorkspacePaneOpen
} from "./workspace_preferences";
import {
  EDITOR_LEAFER_DEBUG_STORAGE_KEY,
  applyLeaferDebugSettings,
  createDefaultEditorLeaferDebugSettings,
  formatEditorLeaferDebugTypeList,
  mergeEditorLeaferDebugSettings,
  parseEditorLeaferDebugTypeListInput,
  resolveInitialEditorLeaferDebugSettings,
  serializeEditorLeaferDebugSettings,
  type EditorLeaferDebugSettings
} from "../debug/leafer_debug";
import {
  areEditorBundleDocumentsEquivalent,
  createInitialBundleCatalogState,
  createLoadedBundleRecordState,
  createLoadingBundleRecordState,
  createEditorBundleRecordKey,
  EMPTY_EDITOR_DOCUMENT,
  EDITOR_BUNDLE_SLOTS,
  ensureEditorBundleRuntimeGlobals,
  findEditorBundleRecord,
  loadEditorFrontendBundleSource,
  loadEditorBundleSource,
  removeEditorBundleRecord,
  resolveEditorBundleRuntimeSetup,
  resolveEditorBundleRecordId,
  setCurrentDemoBundle,
  setEditorBundleRecordEnabled,
  upsertEditorBundleRecord,
  toErrorMessage
} from "../loader/runtime";
import {
  persistEditorBundleRecord,
  readPersistedEditorBundleRecords,
  removePersistedEditorBundleRecord,
  updatePersistedEditorBundleEnabled
} from "../loader/persistence";
import type {
  EditorBundleCatalogState,
  EditorBundleRecordState,
  EditorBundleResolvedStatus,
  EditorBundleSlot,
  EditorResolvedBundleRecordState
} from "../loader/types";
import {
  createEditorRemoteAuthorityAppRuntime,
  type ResolvedEditorRemoteAuthorityAppRuntime
} from "../backend/authority/remote_authority_app_runtime";
import type {
  EditorGraphDocumentResyncOptions,
  EditorGraphOperationAuthorityConfirmation
} from "../session/graph_document_session";
import type { EditorRemoteAuthorityFrontendBundlesSyncEvent } from "../session/graph_document_authority_transport";
import {
  resolveRemoteAuthorityBundleProjection,
  shouldApplyRemoteAuthorityBundleProjection,
  type RemoteAuthorityBundleProjectionCheckpoint
} from "../app/remote_authority_bundle_projection";
import type { EditorAppBootstrapPreloadedBundle } from "../app/editor_app_bootstrap";
import {
  resolveWorkspaceAdaptiveMode,
  resolveWorkspaceStageLayout,
  resolveWorkspacePanePresentation,
  type WorkspaceAdaptiveMode
} from "./layout/workspace_adaptive";
import {
  createEditorController,
  syncEditorController,
  type CreateEditorControllerOptions,
  type EditorController,
  type EditorControllerActions,
  type EditorControllerState,
  type RemoteAuthorityConnectionDisplayStatus,
  type RemoteAuthorityRuntimeStatus,
  type RunConsoleTab,
  type WorkspaceSettingsTab
} from "./editor_controller";
import {
  EditorErrorBoundary,
  type EditorErrorBoundaryProps
} from "./error_boundary";
type RemoteRuntimeControlNotice = GraphViewportRemoteRuntimeControlNotice;

const TOOLBAR_ACTION_GROUPS = ["history", "selection"] as const;
const VISIBLE_TITLEBAR_ACTION_IDS = ["undo", "redo", "delete"] as const;
const RESTORE_BUNDLE_SLOTS = ["widget", "node", "demo"] as const;
const BUNDLE_SLOT_TITLE: Readonly<Record<EditorBundleSlot, string>> = {
  demo: "Demo Bundles",
  node: "Node Bundles",
  widget: "Widget Bundles"
} as const;
const BUNDLE_SLOT_DESCRIPTION: Readonly<Record<EditorBundleSlot, string>> = {
  demo: "可同时加载多个 demo，但同一时刻只选择一个当前 demo。",
  node: "可同时启用多个节点模块，并累加到节点库与渲染能力中。",
  widget: "可同时启用多个 widget 模块，并累加到节点渲染能力中。"
} as const;
const BUNDLE_STATUS_LABEL: Readonly<
  Record<EditorBundleResolvedStatus, string>
> = {
  idle: "未加载",
  ready: "已加载",
  "dependency-missing": "依赖缺失",
  failed: "加载失败",
  loading: "加载中"
} as const;

function toggleEditorTheme(theme: EditorTheme): EditorTheme {
  return theme === "dark" ? "light" : "dark";
}

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
      return "已断开待恢复";
    default:
      return "未建立连接";
  }
}

function formatRemoteAuthorityRecoveryModeLabel(
  pendingCount: number
): string {
  if (pendingCount > 0) {
    return `resync-only（${pendingCount} 条待确认操作会在重新同步时失效）`;
  }

  return "resync-only（重新同步后以 authority 文档为准）";
}

function formatPendingOperationInvalidationMessage(
  pendingCount: number,
  prefix: string
): string {
  if (pendingCount <= 0) {
    return prefix;
  }

  return `${prefix}，${pendingCount} 条待确认操作已失效，请手工重试。`;
}

function formatToolbarActionTitle(
  action: GraphViewportToolbarActionState
): string {
  return action.shortcut
    ? `${action.description}（${action.shortcut}）`
    : action.description;
}

function resolveBundleActivationLabel(slot: {
  slot: EditorBundleSlot;
  manifest: unknown;
  enabled: boolean;
  active: boolean;
  missingRequirements: string[];
}): string {
  if (!slot.manifest) {
    return slot.enabled ? "当前记录异常" : "当前未加载";
  }

  if (slot.slot === "demo") {
    if (!slot.enabled) {
      return "未设为当前 demo";
    }

    if (!slot.active && slot.missingRequirements.length > 0) {
      return `当前 demo 等待依赖：${slot.missingRequirements.join(" + ")}`;
    }

    return "当前 demo";
  }

  if (!slot.enabled) {
    return "当前已停用";
  }

  if (!slot.active && slot.missingRequirements.length > 0) {
    return `等待依赖：${slot.missingRequirements.join(" + ")}`;
  }

  return "当前已启用";
}

function formatBundlePersistenceLabel(slot: EditorBundleRecordState): string {
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

function formatTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return "无";
  }

  return new Date(timestamp).toLocaleTimeString();
}

function createBundleLoadErrorRecord(
  record: EditorBundleRecordState,
  errorMessage: string
): EditorBundleRecordState {
  return {
    ...record,
    loading: false,
    error: errorMessage
  };
}

function createRemoteBundleRecordKey(
  ownerPackageId: string,
  slot: EditorBundleSlot,
  bundleId: string
): string {
  return `remote:${ownerPackageId}:${slot}:${bundleId}`;
}

function isRemoteBundleRecord(record: EditorBundleRecordState): boolean {
  return record.source === "remote";
}

function isDemoBundleRecord(
  record: EditorResolvedBundleRecordState | EditorBundleRecordState
): boolean {
  return record.slot === "demo";
}

function formatDuration(startedAt: number, finishedAt: number): string {
  return `${Math.max(0, finishedAt - startedAt)} ms`;
}

function formatJson(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function IconPanel({
  title,
  description,
  path
}: {
  title: string;
  description: string;
  path: string;
}) {
  return (
    <span class="titlebar-icon-button__content">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
      <span class="sr-only">{title}</span>
      <span class="titlebar-icon-button__tooltip">{description}</span>
    </span>
  );
}

function WorkspaceField({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div class="workspace-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EditorLeaferDebugTypeField({
  label,
  placeholder,
  value,
  onCommit
}: {
  label: string;
  placeholder: string;
  value: readonly string[];
  onCommit(value: string[]): void;
}) {
  const serializedValue = useMemo(
    () => formatEditorLeaferDebugTypeList(value),
    [value]
  );
  const [draftValue, setDraftValue] = useState(serializedValue);

  useEffect(() => {
    setDraftValue(serializedValue);
  }, [serializedValue]);

  const commitDraftValue = useCallback(
    (rawValue: string) => {
      const nextValue = parseEditorLeaferDebugTypeListInput(rawValue);
      setDraftValue(formatEditorLeaferDebugTypeList(nextValue));
      onCommit(nextValue);
    },
    [onCommit]
  );

  return (
    <label class="preference-card__field">
      <span class="preference-card__field-label">{label}</span>
      <input
        type="text"
        class="preference-card__field-input"
        value={draftValue}
        placeholder={placeholder}
        onInput={(event) => {
          setDraftValue(event.currentTarget.value);
        }}
        onBlur={(event) => {
          commitDraftValue(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") {
            return;
          }

          event.preventDefault();
          commitDraftValue(event.currentTarget.value);
          event.currentTarget.blur();
        }}
      />
    </label>
  );
}

function readNodeLibraryHoverPreviewCapabilities(): {
  supportsHover: boolean;
  hasFinePointer: boolean;
} {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return {
      supportsHover: false,
      hasFinePointer: false
    };
  }

  return {
    supportsHover: window.matchMedia("(hover: hover)").matches,
    hasFinePointer: window.matchMedia("(pointer: fine)").matches
  };
}

interface EditorStatusbarItem {
  key: string;
  label: string;
}

interface EditorAuthoritySummary {
  modeLabel: string;
  connectionLabel: string;
  sourceLabel: string;
  pendingCount: number;
  recoveryLabel: string;
  documentLabel: string;
}

interface EditorContextValue {
  controller: EditorController;
  state: EditorControllerState;
  actions: EditorControllerActions;
  runtimeSetup: ReturnType<typeof resolveEditorBundleRuntimeSetup>;
  effectiveDocument: GraphDocument;
  effectiveCreateDocumentSessionBinding?:
    ResolvedEditorRemoteAuthorityAppRuntime["createDocumentSessionBinding"];
  effectiveRuntimeFeedbackInlet?:
    ResolvedEditorRemoteAuthorityAppRuntime["runtimeFeedbackInlet"];
  remoteAuthorityRuntime: ResolvedEditorRemoteAuthorityAppRuntime | null;
  viewportHostBridge: GraphViewportHostBridge | null;
  graphExecutionState: GraphViewportRuntimeControlsState["executionState"];
  toolbarActionGroups: readonly {
    group: (typeof TOOLBAR_ACTION_GROUPS)[number];
    actions: readonly GraphViewportToolbarActionState[];
  }[];
  showToolbarShortcuts: boolean;
  statusbarItems: readonly EditorStatusbarItem[];
  workspaceDialogSize: "fullscreen" | "sheet" | "xl";
  overlayPaneOpen: boolean;
  nodeLibraryHoverPreviewEnabled: boolean;
  authoritySummary: EditorAuthoritySummary;
  shortcutItems: readonly {
    id: string;
    label: string;
    shortcut?: string;
    description: string;
  }[];
  handleBundleFileChange(slot: EditorBundleSlot, event: Event): Promise<void>;
  toggleBundleEnabled(slot: EditorBundleSlot, bundleKey: string): void;
  unloadBundle(slot: EditorBundleSlot, bundleKey: string): void;
  activateDemoBundle(bundleKey: string): Promise<void>;
  handleViewportHostBridgeChange(bridge: GraphViewportHostBridge | null): void;
  setEditorToolbarControls(
    controls: GraphViewportToolbarControlsState | null
  ): void;
  setGraphRuntimeControls(
    controls: GraphViewportRuntimeControlsState | null
  ): void;
  setRemoteRuntimeControlNotice(
    notice: RemoteRuntimeControlNotice | null
  ): void;
  setWorkspaceState(state: GraphViewportWorkspaceState | null): void;
  resyncAuthorityDocument(options?: {
    resyncOptions?: EditorGraphDocumentResyncOptions;
    successMessagePrefix?: string;
    errorPrefix?: string;
  }): Promise<GraphDocument>;
  openPythonAuthorityDemo(): void;
  scrollToBundleGrid(): void;
  extensionsBundleGridRef: {
    current: HTMLDivElement | null;
  };
}

const EditorContext = createContext<EditorContextValue | null>(null);

export interface EditorProviderProps {
  controller: EditorController;
  children?: ComponentChildren;
}

export interface EditorShellProps {}

export type AppProps = CreateEditorControllerOptions;
export type { EditorErrorBoundaryProps };

export function useEditorContext(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) {
    throw new Error("EditorProvider 尚未挂载，无法读取 editor 上下文。");
  }

  return value;
}

export function EditorProvider({
  controller,
  children
}: EditorProviderProps) {
  const {
    preloadedBundles,
    remoteAuthoritySource,
    onViewportHostBridgeChange
  } = controller.getOptions();
  const [theme, setTheme] = useState<EditorTheme>(() =>
    resolveInitialEditorTheme()
  );
  const [leaferDebugSettings, setLeaferDebugSettings] =
    useState<EditorLeaferDebugSettings>(() =>
      resolveInitialEditorLeaferDebugSettings()
    );
  const [workspaceAdaptiveMode, setWorkspaceAdaptiveMode] =
    useState<WorkspaceAdaptiveMode>(() =>
      resolveWorkspaceAdaptiveMode(
        typeof window === "undefined" ? undefined : window.innerWidth
      )
    );
  const hasAppliedAdaptivePresetRef = useRef(false);
  const [leftPaneOpen, setLeftPaneOpen] = useState(
    resolveInitialWorkspacePaneOpen(
      "left",
      resolveWorkspacePanePresentation(
        resolveWorkspaceAdaptiveMode(
          typeof window === "undefined" ? undefined : window.innerWidth
        ),
        "left"
      ) === "docked"
    )
  );
  const [rightPaneOpen, setRightPaneOpen] = useState(
    resolveInitialWorkspacePaneOpen(
      "right",
      resolveWorkspacePanePresentation(
        resolveWorkspaceAdaptiveMode(
          typeof window === "undefined" ? undefined : window.innerWidth
        ),
        "right"
      ) === "docked"
    )
  );
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [runConsoleOpen, setRunConsoleOpen] = useState(false);
  const [workspaceSettingsTab, setWorkspaceSettingsTab] =
    useState<WorkspaceSettingsTab>("extensions");
  const [runConsoleTab, setRunConsoleTab] = useState<RunConsoleTab>("overview");
  const [graphRuntimeControls, setGraphRuntimeControls] =
    useState<GraphViewportRuntimeControlsState | null>(null);
  const [editorToolbarControls, setEditorToolbarControls] =
    useState<GraphViewportToolbarControlsState | null>(null);
  const [workspaceState, setWorkspaceState] =
    useState<GraphViewportWorkspaceState | null>(null);
  const [nodeLibrarySearchQuery, setNodeLibrarySearchQuery] = useState("");
  const [activeLibraryNodeType, setActiveLibraryNodeType] = useState<string | null>(
    null
  );
  const [availableNodeDefinitions, setAvailableNodeDefinitions] = useState<
    readonly NodeDefinition[]
  >([]);
  const [nodeLibraryPreviewRequest, setNodeLibraryPreviewRequest] =
    useState<NodeLibraryPreviewRequest | null>(null);
  const [nodeLibraryHoverPreviewCapabilities, setNodeLibraryHoverPreviewCapabilities] =
    useState(() => readNodeLibraryHoverPreviewCapabilities());
  const extensionsBundleGridRef = useRef<HTMLDivElement | null>(null);
  const [bundleCatalog, setBundleCatalog] = useState<EditorBundleCatalogState>(() =>
    createInitialBundleCatalogState()
  );
  const [loopbackDocument, setLoopbackDocument] = useState<GraphDocument>(
    structuredClone(EMPTY_EDITOR_DOCUMENT)
  );
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
  const [remoteAuthorityPendingOperationIds, setRemoteAuthorityPendingOperationIds] =
    useState<readonly string[]>([]);
  const [remoteAuthorityLastIssue, setRemoteAuthorityLastIssue] =
    useState<string | null>(null);
  const [remoteRuntimeControlNotice, setRemoteRuntimeControlNotice] =
    useState<RemoteRuntimeControlNotice | null>(null);
  const [remoteAuthorityResyncing, setRemoteAuthorityResyncing] =
    useState(false);
  const [remoteAuthorityReloadKey, setRemoteAuthorityReloadKey] = useState(0);
  const [viewportHostBridge, setViewportHostBridge] =
    useState<GraphViewportHostBridge | null>(null);
  const [remoteAuthorityRuntimeCheckpoint, setRemoteAuthorityRuntimeCheckpoint] =
    useState<RemoteAuthorityBundleProjectionCheckpoint | null>(null);
  const isRemoteAuthorityEnabled = Boolean(remoteAuthoritySource);

  useEffect(() => {
    const handleResize = (): void => {
      setWorkspaceAdaptiveMode(resolveWorkspaceAdaptiveMode(window.innerWidth));
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const hoverQuery = window.matchMedia("(hover: hover)");
    const pointerQuery = window.matchMedia("(pointer: fine)");
    const handleChange = (): void => {
      setNodeLibraryHoverPreviewCapabilities(
        readNodeLibraryHoverPreviewCapabilities()
      );
    };

    handleChange();
    hoverQuery.addEventListener("change", handleChange);
    pointerQuery.addEventListener("change", handleChange);

    return () => {
      hoverQuery.removeEventListener("change", handleChange);
      pointerQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (!hasAppliedAdaptivePresetRef.current) {
      hasAppliedAdaptivePresetRef.current = true;
      setWorkspaceMenuOpen(false);
      return;
    }

    if (workspaceAdaptiveMode === "wide-desktop") {
      setLeftPaneOpen(true);
      setRightPaneOpen(true);
      setWorkspaceMenuOpen(false);
      return;
    }

    if (workspaceAdaptiveMode === "compact-desktop") {
      setLeftPaneOpen(false);
      setRightPaneOpen(true);
      setWorkspaceMenuOpen(false);
      return;
    }

    if (workspaceAdaptiveMode === "tablet") {
      setLeftPaneOpen(false);
      setRightPaneOpen(false);
      setWorkspaceMenuOpen(false);
      return;
    }

    setLeftPaneOpen(false);
    setRightPaneOpen(false);
    setWorkspaceMenuOpen(false);
  }, [workspaceAdaptiveMode]);

  useEffect(() => {
    if (!workspaceMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest(".titlebar__workspace-menu")) {
        return;
      }

      setWorkspaceMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setWorkspaceMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [workspaceMenuOpen]);

  useEffect(() => {
    if (!remoteAuthorityRuntime) {
      setRemoteAuthorityDocument(null);
      setRemoteAuthorityConnectionStatus("idle");
      setRemoteAuthorityPendingOperationIds([]);
      setRemoteAuthorityLastIssue(null);
      setRemoteRuntimeControlNotice(null);
      setRemoteAuthorityResyncing(false);
      return;
    }

    setRemoteAuthorityLastIssue(null);
    setRemoteRuntimeControlNotice(null);
    setRemoteAuthorityDocument(remoteAuthorityRuntime.document);
  }, [remoteAuthorityRuntime]);

  useEffect(() => {
    if (!remoteAuthorityRuntime || !viewportHostBridge) {
      setRemoteAuthorityPendingOperationIds([]);
      return;
    }

    setRemoteAuthorityPendingOperationIds(
      viewportHostBridge.getPendingOperationIds()
    );

    if (!viewportHostBridge.subscribePending) {
      return;
    }

    return viewportHostBridge.subscribePending((pendingOperationIds) => {
      setRemoteAuthorityPendingOperationIds([...pendingOperationIds]);
    });
  }, [remoteAuthorityRuntime, viewportHostBridge]);

  useEffect(() => {
    if (!remoteAuthorityRuntime || !viewportHostBridge?.subscribeOperationConfirmation) {
      return;
    }

    return viewportHostBridge.subscribeOperationConfirmation(
      (confirmation: EditorGraphOperationAuthorityConfirmation) => {
        if (confirmation.accepted) {
          return;
        }

        setRemoteAuthorityLastIssue(
          confirmation.reason
            ? `最近未确认操作：${confirmation.reason}`
            : `最近未确认操作：${confirmation.operationId}`
        );
      }
    );
  }, [remoteAuthorityRuntime, viewportHostBridge]);

  const resyncAuthorityDocument = useCallback(
    async (options?: {
      resyncOptions?: EditorGraphDocumentResyncOptions;
      successMessagePrefix?: string;
      errorPrefix?: string;
    }): Promise<GraphDocument> => {
      if (!viewportHostBridge) {
        throw new Error("authority bridge 尚未就绪");
      }

      const pendingCount = viewportHostBridge.getPendingOperationIds().length;
      setRemoteAuthorityResyncing(true);

      try {
        const document = await viewportHostBridge.resyncAuthorityDocument(
          options?.resyncOptions
        );
        setRemoteAuthorityDocument(document);
        setRemoteAuthorityError(null);

        if (
          pendingCount > 0 &&
          options?.resyncOptions?.invalidatePending !== false
        ) {
          setRemoteAuthorityLastIssue(
            formatPendingOperationInvalidationMessage(
              pendingCount,
              options?.successMessagePrefix ?? "Authority 已重新同步"
            )
          );
        } else if (pendingCount === 0) {
          setRemoteAuthorityLastIssue(null);
        }

        return document;
      } catch (error: unknown) {
        setRemoteAuthorityError(
          `${options?.errorPrefix ?? "Authority 重新同步失败"}：${toErrorMessage(error)}`
        );
        throw error;
      } finally {
        setRemoteAuthorityResyncing(false);
      }
    },
    [viewportHostBridge]
  );

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
      setRemoteAuthorityConnectionStatus("idle");
      return;
    }

    const initialStatus = remoteAuthorityRuntime.getConnectionStatus();
    setRemoteAuthorityConnectionStatus(initialStatus);

    return remoteAuthorityRuntime.subscribeConnectionStatus((status) => {
      setRemoteAuthorityConnectionStatus(status);

      if (status !== "connected" || !viewportHostBridge) {
        return;
      }

      void resyncAuthorityDocument({
        resyncOptions: {
          invalidatePending: true,
          pendingReason: "authority 已重新连接，待确认操作已失效，请手工重试"
        },
        successMessagePrefix: "Authority 已重新连接并重新同步",
        errorPrefix: "Authority 已重连，但重新同步失败"
      }).catch(() => {
        // 错误状态已在 resyncAuthorityDocument 内回填到 UI。
      });
    });
  }, [remoteAuthorityRuntime, resyncAuthorityDocument, viewportHostBridge]);

  useEffect(() => {
    if (!remoteAuthorityRuntime?.subscribeFrontendBundles) {
      return;
    }

    let cancelled = false;
    let consumeQueue = Promise.resolve();

    const removeRemoteRecordsByPackageIds = (
      catalog: EditorBundleCatalogState,
      removedPackageIds: readonly string[]
    ): EditorBundleCatalogState => {
      if (removedPackageIds.length <= 0) {
        return catalog;
      }

      const removedSet = new Set(removedPackageIds);
      return {
        ...catalog,
        demo: catalog.demo.filter(
          (record) =>
            !(
              isRemoteBundleRecord(record) &&
              record.ownerPackageId &&
              removedSet.has(record.ownerPackageId)
            )
        ),
        node: catalog.node.filter(
          (record) =>
            !(
              isRemoteBundleRecord(record) &&
              record.ownerPackageId &&
              removedSet.has(record.ownerPackageId)
            )
        ),
        widget: catalog.widget.filter(
          (record) =>
            !(
              isRemoteBundleRecord(record) &&
              record.ownerPackageId &&
              removedSet.has(record.ownerPackageId)
            )
        )
      };
    };

    const handleFrontendBundlesSync = async (
      event: EditorRemoteAuthorityFrontendBundlesSyncEvent
    ): Promise<void> => {
      if (event.mode === "remove") {
        if (cancelled) {
          return;
        }
        setBundleCatalog((current) =>
          removeRemoteRecordsByPackageIds(
            current,
            event.removedPackageIds ?? []
          )
        );
        return;
      }

      const nextRemoteRecords: EditorBundleRecordState[] = [];
      for (const packageRecord of event.packages ?? []) {
        for (const bundle of packageRecord.bundles) {
          const bundleKey = createRemoteBundleRecordKey(
            packageRecord.packageId,
            bundle.slot,
            bundle.bundleId
          );
          try {
            const manifest = await loadEditorFrontendBundleSource(bundle);
            nextRemoteRecords.push(
              createLoadedBundleRecordState({
                slot: bundle.slot,
                manifest,
                fileName: bundle.fileName,
                enabled: bundle.enabled,
                persisted: false,
                restoredFromPersistence: false,
                savedAt: null,
                source: "remote",
                ownerPackageId: packageRecord.packageId,
                bundleKey
              })
            );
          } catch (error) {
            nextRemoteRecords.push(
              createBundleLoadErrorRecord(
                createLoadingBundleRecordState(
                  bundle.slot,
                  bundle.fileName,
                  "remote",
                  bundleKey
                ),
                `后端推送 bundle 加载失败：${toErrorMessage(error)}`
              )
            );
          }
        }
      }

      if (cancelled) {
        return;
      }

      setBundleCatalog((current) => {
        let nextCatalog = current;
        if (event.mode === "full") {
          nextCatalog = {
            ...current,
            demo: current.demo.filter((record) => !isRemoteBundleRecord(record)),
            node: current.node.filter((record) => !isRemoteBundleRecord(record)),
            widget: current.widget.filter((record) => !isRemoteBundleRecord(record))
          };
        }

        for (const record of nextRemoteRecords) {
          nextCatalog = upsertEditorBundleRecord(nextCatalog, record);
        }

        return nextCatalog;
      });
    };

    const disposeFrontendBundlesSubscription =
      remoteAuthorityRuntime.subscribeFrontendBundles((event) => {
        consumeQueue = consumeQueue
          .then(() => handleFrontendBundlesSync(event))
          .catch((error: unknown) => {
            if (!cancelled) {
              console.warn(
                "authority frontend bundle 同步失败",
                toErrorMessage(error)
              );
            }
          });
      });

    return () => {
      cancelled = true;
      disposeFrontendBundlesSubscription();
    };
  }, [remoteAuthorityRuntime]);

  useEffect(() => {
    ensureEditorBundleRuntimeGlobals();

    let cancelled = false;

    const restorePersistedBundles = async (): Promise<void> => {
      const records = await readPersistedEditorBundleRecords();
      if (cancelled) {
        return;
      }

      const loadedKeys = new Set<string>();
      const persistedRecords = [...records].sort((left, right) => {
        const leftOrder = RESTORE_BUNDLE_SLOTS.indexOf(left.slot);
        const rightOrder = RESTORE_BUNDLE_SLOTS.indexOf(right.slot);

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return left.savedAt - right.savedAt;
      });

      for (const preloadedBundle of preloadedBundles ?? []) {
        const fileName = resolvePreloadedBundleFileName(preloadedBundle);
        const loadingRecord = createLoadingBundleRecordState(
          preloadedBundle.slot,
          fileName
        );

        setBundleCatalog((current) =>
          upsertEditorBundleRecord(current, loadingRecord)
        );

        try {
          const response = await fetch(preloadedBundle.url);
          if (!response.ok) {
            throw new Error(
              `无法加载预装 bundle：${response.status} ${response.statusText}`.trim()
            );
          }

          const sourceCode = await response.text();
          const manifest = await loadEditorBundleSource(
            preloadedBundle.slot,
            sourceCode,
            fileName
          );
          const bundleKey = createEditorBundleRecordKey(
            preloadedBundle.slot,
            manifest.id
          );
          const enabled =
            preloadedBundle.slot === "demo"
              ? preloadedBundle.enabled === true
              : preloadedBundle.enabled ?? true;

          loadedKeys.add(bundleKey);

          if (cancelled) {
            return;
          }

          setBundleCatalog((current) => {
            let next = removeEditorBundleRecord(
              current,
              preloadedBundle.slot,
              loadingRecord.bundleKey
            );
            const existingRecord = findEditorBundleRecord(
              next,
              preloadedBundle.slot,
              bundleKey
            );

            next = upsertEditorBundleRecord(
              next,
              createLoadedBundleRecordState({
                slot: preloadedBundle.slot,
                manifest,
                fileName,
                enabled: existingRecord?.enabled ?? enabled,
                persisted: false,
                restoredFromPersistence: false,
                savedAt: null
              })
            );

            return next;
          });
        } catch (error) {
          if (cancelled) {
            return;
          }

          setBundleCatalog((current) =>
            upsertEditorBundleRecord(
              current,
              createBundleLoadErrorRecord(
                {
                  ...loadingRecord,
                  loading: false
                },
                `预装 bundle 加载失败：${toErrorMessage(error)}`
              )
            )
          );
        }
      }

      for (const record of persistedRecords) {
        const loadingRecord = createLoadingBundleRecordState(
          record.slot,
          record.fileName
        );

        setBundleCatalog((current) =>
          upsertEditorBundleRecord(current, loadingRecord)
        );

        try {
          const manifest = await loadEditorBundleSource(
            record.slot,
            record.sourceCode,
            record.fileName
          );
          const bundleKey = createEditorBundleRecordKey(record.slot, manifest.id);

          if (loadedKeys.has(bundleKey)) {
            if (cancelled) {
              return;
            }

            setBundleCatalog((current) =>
              removeEditorBundleRecord(current, record.slot, loadingRecord.bundleKey)
            );
            continue;
          }

          if (cancelled) {
            return;
          }

          setBundleCatalog((current) => {
            let next = removeEditorBundleRecord(
              current,
              record.slot,
              loadingRecord.bundleKey
            );
            const existingRecord = findEditorBundleRecord(
              next,
              record.slot,
              bundleKey
            );

            next = upsertEditorBundleRecord(
              next,
              createLoadedBundleRecordState({
                slot: record.slot,
                manifest,
                fileName: record.fileName,
                enabled: existingRecord?.enabled ?? record.enabled,
                persisted: true,
                restoredFromPersistence: true,
                savedAt: record.savedAt
              })
            );

            return next;
          });
        } catch (error) {
          await removePersistedEditorBundleRecord(record.key);

          if (cancelled) {
            return;
          }

          setBundleCatalog((current) =>
            upsertEditorBundleRecord(
              current,
              createBundleLoadErrorRecord(
                {
                  ...loadingRecord,
                  loading: false
                },
                `浏览器恢复失败，已清除本地记录：${toErrorMessage(error)}`
              )
            )
          );
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
    persistWorkspacePaneOpen("left", leftPaneOpen);
  }, [leftPaneOpen]);

  useEffect(() => {
    persistWorkspacePaneOpen("right", rightPaneOpen);
  }, [rightPaneOpen]);

  useEffect(() => {
    applyLeaferDebugSettings(leaferDebugSettings);
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(
      EDITOR_LEAFER_DEBUG_STORAGE_KEY,
      serializeEditorLeaferDebugSettings(leaferDebugSettings)
    );
  }, [leaferDebugSettings]);

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
    };
  }, [remoteAuthorityReloadKey, remoteAuthoritySource]);

  const runtimeSetup = useMemo(
    () => resolveEditorBundleRuntimeSetup(bundleCatalog),
    [bundleCatalog]
  );
  const remoteAuthorityBundleProjection = useMemo(
    () => resolveRemoteAuthorityBundleProjection(runtimeSetup),
    [runtimeSetup]
  );
  const effectiveDocument = remoteAuthorityRuntime?.document ?? loopbackDocument;
  const effectiveCreateDocumentSessionBinding =
    remoteAuthorityRuntime?.createDocumentSessionBinding;
  const effectiveRuntimeFeedbackInlet =
    remoteAuthorityRuntime?.runtimeFeedbackInlet;

  useEffect(() => {
    if (remoteAuthorityRuntime || viewportHostBridge) {
      return;
    }

    const currentDemoDocument =
      runtimeSetup.currentDemo?.manifest?.kind === "demo"
        ? runtimeSetup.currentDemo.manifest.document
        : null;

    if (!currentDemoDocument) {
      return;
    }

    setLoopbackDocument((current) =>
      areEditorBundleDocumentsEquivalent(current, currentDemoDocument)
        ? current
        : structuredClone(currentDemoDocument)
    );
  }, [remoteAuthorityRuntime, runtimeSetup.currentDemo, viewportHostBridge]);

  useEffect(() => {
    if (!remoteAuthorityRuntime) {
      setRemoteAuthorityRuntimeCheckpoint(null);
      setBundleCatalog((current) => ({
        ...current,
        demo: current.demo.filter((record) => !isRemoteBundleRecord(record)),
        node: current.node.filter((record) => !isRemoteBundleRecord(record)),
        widget: current.widget.filter((record) => !isRemoteBundleRecord(record))
      }));
    }
  }, [remoteAuthorityRuntime]);

  useEffect(() => {
    if (!remoteAuthorityBundleProjection) {
      setRemoteAuthorityRuntimeCheckpoint(null);
      return;
    }

    if (!remoteAuthorityRuntime || !viewportHostBridge) {
      return;
    }

    if (
      !shouldApplyRemoteAuthorityBundleProjection({
        runtime: remoteAuthorityRuntime,
        projection: remoteAuthorityBundleProjection,
        checkpoint: remoteAuthorityRuntimeCheckpoint
      })
    ) {
      return;
    }

    setRemoteAuthorityRuntimeCheckpoint({
      runtime: remoteAuthorityRuntime,
      document: remoteAuthorityBundleProjection.document
    });

    viewportHostBridge.replaceDocument(
      structuredClone(remoteAuthorityBundleProjection.document)
    );
  }, [
    remoteAuthorityBundleProjection,
    remoteAuthorityRuntime,
    remoteAuthorityRuntimeCheckpoint,
    viewportHostBridge
  ]);

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
  const canStepGraph = canPlayGraph;
  const canStopGraph = Boolean(
    graphRuntimeControls?.available &&
      (graphExecutionState.status === "running" ||
        graphExecutionState.status === "stepping")
  );
  const toolbarActionGroups = TOOLBAR_ACTION_GROUPS.map((group) => ({
    group,
    actions:
      editorToolbarControls?.actions.filter(
        (action) =>
          action.group === group &&
          VISIBLE_TITLEBAR_ACTION_IDS.includes(
            action.id as (typeof VISIBLE_TITLEBAR_ACTION_IDS)[number]
          )
      ) ?? []
  })).filter((entry) => entry.actions.length > 0);
  const leftPanePresentation = resolveWorkspacePanePresentation(
    workspaceAdaptiveMode,
    "left"
  );
  const rightPanePresentation = resolveWorkspacePanePresentation(
    workspaceAdaptiveMode,
    "right"
  );
  const isWorkspaceOverflowMode =
    workspaceAdaptiveMode === "tablet" || workspaceAdaptiveMode === "mobile";
  const nodeLibraryHoverPreviewEnabled = shouldEnableNodeLibraryHoverPreview({
    adaptiveMode: workspaceAdaptiveMode,
    supportsHover: nodeLibraryHoverPreviewCapabilities.supportsHover,
    hasFinePointer: nodeLibraryHoverPreviewCapabilities.hasFinePointer
  });
  const overlayPaneOpen =
    (leftPanePresentation !== "docked" && leftPaneOpen) ||
    (rightPanePresentation !== "docked" && rightPaneOpen);
  const { stageLayout } = resolveWorkspaceStageLayout({
    adaptiveMode: workspaceAdaptiveMode,
    leftPanePresentation,
    rightPanePresentation,
    leftPaneOpen,
    rightPaneOpen
  });
  const showToolbarShortcuts = workspaceAdaptiveMode === "wide-desktop";
  const defaultEntryDocumentNodeCount = useMemo(
    () =>
      resolveDefaultEntryOnboardingDocumentNodeCount({
        initialDocumentNodeCount: effectiveDocument.nodes.length,
        workspaceDocumentNodeCount: workspaceState?.document.nodeCount
      }),
    [effectiveDocument.nodes.length, workspaceState?.document.nodeCount]
  );
  const defaultEntryOnboardingState = useMemo(
    () =>
      resolveDefaultEntryOnboardingState({
        isRemoteAuthorityEnabled,
        hasLoadedNodeBundle: runtimeSetup.bundles.node.some(
          (bundle) => bundle.active
        ),
        hasLoadedWidgetBundle: runtimeSetup.bundles.widget.some(
          (bundle) => bundle.active
        ),
        documentNodeCount: defaultEntryDocumentNodeCount
      }),
    [
      defaultEntryDocumentNodeCount,
      isRemoteAuthorityEnabled,
      runtimeSetup.bundles.node,
      runtimeSetup.bundles.widget
    ]
  );

  useEffect(() => {
    if (!viewportHostBridge) {
      setAvailableNodeDefinitions([]);
      return;
    }

    let cancelled = false;
    const syncDefinitions = (): void => {
      if (cancelled) {
        return;
      }

      setAvailableNodeDefinitions(viewportHostBridge.graph.listNodes());
    };

    syncDefinitions();
    void viewportHostBridge.graph.ready.then(() => {
      syncDefinitions();
    });

    return () => {
      cancelled = true;
    };
  }, [runtimeSetup.plugins, viewportHostBridge]);

  useEffect(() => {
    if (!availableNodeDefinitions.length) {
      setActiveLibraryNodeType(null);
      return;
    }

    if (
      activeLibraryNodeType &&
      availableNodeDefinitions.some(
        (definition) => definition.type === activeLibraryNodeType
      )
    ) {
      return;
    }

    setActiveLibraryNodeType(availableNodeDefinitions[0]?.type ?? null);
  }, [activeLibraryNodeType, availableNodeDefinitions]);

  useEffect(() => {
    if (!nodeLibraryPreviewRequest) {
      return;
    }

    if (nodeLibraryHoverPreviewEnabled && leftPaneOpen) {
      return;
    }

    setNodeLibraryPreviewRequest(null);
  }, [
    leftPaneOpen,
    nodeLibraryHoverPreviewEnabled,
    nodeLibraryPreviewRequest
  ]);

  useEffect(() => {
    if (!nodeLibraryPreviewRequest) {
      return;
    }

    if (
      availableNodeDefinitions.some(
        (definition) =>
          definition.type === nodeLibraryPreviewRequest.definition.type
      )
    ) {
      return;
    }

    setNodeLibraryPreviewRequest(null);
  }, [availableNodeDefinitions, nodeLibraryPreviewRequest]);

  useEffect(() => {
    if (!nodeLibraryPreviewRequest) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setNodeLibraryPreviewRequest(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [nodeLibraryPreviewRequest]);

  const syncPersistedCurrentDemoSelection = useCallback(
    (nextCurrentBundleKey: string | null): void => {
      for (const record of bundleCatalog.demo) {
        if (!record.manifest || !record.persisted) {
          continue;
        }

        void updatePersistedEditorBundleEnabled(
          record.bundleKey,
          nextCurrentBundleKey !== null &&
            record.bundleKey === nextCurrentBundleKey
        );
      }
    },
    [bundleCatalog.demo]
  );

  const loadBundleFiles = useCallback(
    async (slot: EditorBundleSlot, files: readonly File[]): Promise<void> => {
      for (const file of files) {
        const loadingRecord = createLoadingBundleRecordState(slot, file.name);

        setBundleCatalog((current) =>
          upsertEditorBundleRecord(current, loadingRecord)
        );

        try {
          const sourceCode = await file.text();
          const manifest = await loadEditorBundleSource(slot, sourceCode, file.name);
          const bundleKey = createEditorBundleRecordKey(slot, manifest.id);
          const existingRecord = findEditorBundleRecord(
            bundleCatalog,
            slot,
            bundleKey
          );
          const enabled =
            existingRecord?.enabled ??
            (slot === "demo" ? false : true);
          const savedAt = Date.now();
          const persisted = await persistEditorBundleRecord({
            key: bundleKey,
            slot,
            bundleId: manifest.id,
            fileName: file.name,
            sourceCode,
            enabled,
            savedAt
          });

          setBundleCatalog((current) => {
            let next = removeEditorBundleRecord(
              current,
              slot,
              loadingRecord.bundleKey
            );

            next = upsertEditorBundleRecord(
              next,
              createLoadedBundleRecordState({
                slot,
                manifest,
                fileName: file.name,
                enabled,
                persisted,
                restoredFromPersistence: false,
                savedAt
              })
            );

            return next;
          });
        } catch (error) {
          setBundleCatalog((current) =>
            upsertEditorBundleRecord(
              current,
              createBundleLoadErrorRecord(
                {
                  ...loadingRecord,
                  loading: false
                },
                toErrorMessage(error)
              )
            )
          );
        }
      }
    },
    [bundleCatalog]
  );

  const handleBundleFileChange = async (
    slot: EditorBundleSlot,
    event: Event
  ): Promise<void> => {
    const input = event.currentTarget as HTMLInputElement | null;
    const files = Array.from(input?.files ?? []);

    if (input) {
      input.value = "";
    }

    if (!files.length) {
      return;
    }

    await loadBundleFiles(slot, files);
  };

  const toggleBundleEnabled = useCallback(
    (slot: EditorBundleSlot, bundleKey: string): void => {
      if (slot === "demo") {
        return;
      }

      const record = findEditorBundleRecord(bundleCatalog, slot, bundleKey);
      if (!record?.manifest) {
        return;
      }

      const nextEnabled = !record.enabled;
      setBundleCatalog((current) =>
        setEditorBundleRecordEnabled(current, slot, bundleKey, nextEnabled)
      );

      if (record.persisted) {
        void updatePersistedEditorBundleEnabled(bundleKey, nextEnabled);
      }
    },
    [bundleCatalog]
  );

  const unloadBundle = useCallback(
    (slot: EditorBundleSlot, bundleKey: string): void => {
      const record = findEditorBundleRecord(bundleCatalog, slot, bundleKey);
      setBundleCatalog((current) =>
        removeEditorBundleRecord(current, slot, bundleKey)
      );

      if (record?.persisted) {
        void removePersistedEditorBundleRecord(bundleKey);
      }
    },
    [bundleCatalog]
  );

  const activateDemoBundle = useCallback(
    async (bundleKey: string): Promise<void> => {
      const targetRecord = findEditorBundleRecord(bundleCatalog, "demo", bundleKey);
      const resolvedTargetRecord =
        runtimeSetup.bundles.demo.find((record) => record.bundleKey === bundleKey) ??
        null;
      const targetManifest = targetRecord?.manifest;
      if (!targetRecord || targetManifest?.kind !== "demo") {
        return;
      }

      if (
        targetRecord.enabled ||
        (resolvedTargetRecord?.missingRequirements.length ?? 0) > 0
      ) {
        return;
      }

      const currentDocument =
        viewportHostBridge?.getCurrentDocument() ?? effectiveDocument;
      const targetDocument = targetManifest.document;
      const shouldReplaceDocument = !areEditorBundleDocumentsEquivalent(
        currentDocument,
        targetDocument
      );

      if (
        shouldReplaceDocument &&
        typeof window !== "undefined" &&
        !window.confirm(
          `切换到 demo “${targetManifest.name}” 会替换当前画布内容，是否继续？`
        )
      ) {
        return;
      }

      setBundleCatalog((current) => setCurrentDemoBundle(current, bundleKey));
      syncPersistedCurrentDemoSelection(bundleKey);
      if (remoteAuthorityRuntime) {
        setRemoteAuthorityRuntimeCheckpoint({
          runtime: remoteAuthorityRuntime,
          document: targetDocument
        });
      }
      if (shouldReplaceDocument) {
        setLoopbackDocument(structuredClone(targetDocument));
        viewportHostBridge?.replaceDocument(structuredClone(targetDocument));
      }
    },
    [
      bundleCatalog,
      effectiveDocument,
      remoteAuthorityRuntime,
      runtimeSetup.bundles.demo,
      syncPersistedCurrentDemoSelection,
      viewportHostBridge
    ]
  );

  const handleViewportHostBridgeChange = useCallback(
    (bridge: GraphViewportHostBridge | null): void => {
      setViewportHostBridge(bridge);
      onViewportHostBridgeChange?.(bridge);
    },
    [onViewportHostBridgeChange]
  );

  const closeOverlayPanes = useCallback((): void => {
    setWorkspaceMenuOpen(false);
    setNodeLibraryPreviewRequest(null);
    if (leftPanePresentation !== "docked") {
      setLeftPaneOpen(false);
    }
    if (rightPanePresentation !== "docked") {
      setRightPaneOpen(false);
    }
  }, [leftPanePresentation, rightPanePresentation]);

  const openLeftPane = useCallback((): void => {
    setWorkspaceMenuOpen(false);
    setLeftPaneOpen(true);
    if (isWorkspaceOverflowMode) {
      setRightPaneOpen(false);
    }
  }, [isWorkspaceOverflowMode]);

  const openRightPane = useCallback((): void => {
    setWorkspaceMenuOpen(false);
    setRightPaneOpen(true);
    if (isWorkspaceOverflowMode) {
      setLeftPaneOpen(false);
    }
  }, [isWorkspaceOverflowMode]);

  const toggleLeftPane = useCallback((): void => {
    setWorkspaceMenuOpen(false);
    setLeftPaneOpen((current) => {
      const nextOpen = !current;
      if (nextOpen && isWorkspaceOverflowMode) {
        setRightPaneOpen(false);
      }
      return nextOpen;
    });
  }, [isWorkspaceOverflowMode]);

  const toggleRightPane = useCallback((): void => {
    setWorkspaceMenuOpen(false);
    setRightPaneOpen((current) => {
      const nextOpen = !current;
      if (nextOpen && isWorkspaceOverflowMode) {
        setLeftPaneOpen(false);
      }
      return nextOpen;
    });
  }, [isWorkspaceOverflowMode]);

  const handleCreateNodeFromWorkspace = useCallback(
    (nodeType: string): void => {
      if (!viewportHostBridge) {
        return;
      }

      setNodeLibraryPreviewRequest(null);
      setActiveLibraryNodeType(nodeType);
      viewportHostBridge.executeCommand({
        type: "canvas.create-node-from-workspace",
        nodeType,
        placement: "last-pointer"
      });

      if (leftPanePresentation !== "docked") {
        setLeftPaneOpen(false);
      }
    },
    [leftPanePresentation, viewportHostBridge]
  );

  const authoritySummary = {
    modeLabel: isRemoteAuthorityEnabled ? "Remote Authority" : "Local Loopback",
    connectionLabel: formatRemoteAuthorityConnectionStatusLabel(
      remoteAuthorityConnectionStatus
    ),
    sourceLabel:
      remoteAuthorityRuntime?.sourceLabel ?? remoteAuthoritySource?.label ?? "未接入",
    pendingCount: remoteAuthorityPendingOperationIds.length,
    recoveryLabel: formatRemoteAuthorityRecoveryModeLabel(
      remoteAuthorityPendingOperationIds.length
    ),
    documentLabel: remoteAuthorityDocument
      ? `${remoteAuthorityDocument.documentId} @ ${remoteAuthorityDocument.revision}`
      : workspaceState?.status.documentLabel ?? "使用当前本地图文档"
  };
  const workspaceDialogSize =
    workspaceAdaptiveMode === "mobile"
      ? "fullscreen"
      : workspaceAdaptiveMode === "tablet"
        ? "sheet"
        : "xl";

  const openWorkspaceSettingsDialog = useCallback(
    (tab?: WorkspaceSettingsTab): void => {
      setWorkspaceMenuOpen(false);
      closeOverlayPanes();
      if (tab) {
        setWorkspaceSettingsTab(tab);
      }
      setWorkspaceSettingsOpen(true);
    },
    [closeOverlayPanes]
  );

  const openRunConsoleDialog = useCallback(
    (tab: RunConsoleTab = "overview"): void => {
      setWorkspaceMenuOpen(false);
      closeOverlayPanes();
      setRunConsoleTab(tab);
      setRunConsoleOpen(true);
    },
    [closeOverlayPanes]
  );
  const openPythonAuthorityDemo = useCallback((): void => {
    if (typeof window === "undefined") {
      return;
    }

    window.location.assign(DEFAULT_PYTHON_AUTHORITY_DEMO_URL);
  }, []);
  const scrollToBundleGrid = useCallback((): void => {
    extensionsBundleGridRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, []);

  const shortcutItems = [
    ...(editorToolbarControls?.actions.filter((action) => action.shortcut) ?? []),
    {
      id: "context-menu",
      label: "右键菜单",
      shortcut: "Mouse",
      description: "在画布空白处创建节点、粘贴节点或适配视图"
    }
  ];
  const statusbarItems = useMemo(() => {
    const authorityLabel = `Authority ${formatRemoteAuthorityConnectionStatusLabel(
      remoteAuthorityConnectionStatus
    )}`;
    const documentLabel = workspaceState?.status.documentLabel ?? "等待文档";
    const selectionLabel = workspaceState?.status.selectionLabel ?? "未选择节点";
    const runtimeLabel = formatGraphExecutionStatusLabel(graphExecutionState.status);
    const runtimeStatusLabel = remoteRuntimeControlNotice
      ? `${runtimeLabel} · ${remoteRuntimeControlNotice.message}`
      : workspaceState?.status.runtimeDetailLabel
        ? `${runtimeLabel} · ${workspaceState.status.runtimeDetailLabel}`
        : runtimeLabel;
    const pendingLabel = `Pending ${remoteAuthorityPendingOperationIds.length}`;

    if (workspaceAdaptiveMode === "mobile") {
      return [
        {
          key: "document",
          label: documentLabel
        },
        {
          key: "authority",
          label:
            remoteAuthorityPendingOperationIds.length > 0
              ? `${authorityLabel} · ${remoteAuthorityPendingOperationIds.length} pending`
              : authorityLabel
        },
        {
          key: "selection",
          label: selectionLabel
        }
      ];
    }

    if (workspaceAdaptiveMode === "tablet") {
      return [
        {
          key: "document",
          label: documentLabel
        },
        {
          key: "authority",
          label:
            remoteAuthorityPendingOperationIds.length > 0
              ? `${authorityLabel} · ${remoteAuthorityPendingOperationIds.length} pending`
              : authorityLabel
        },
        {
          key: "runtime",
          label: runtimeStatusLabel
        },
        {
          key: "selection",
          label: selectionLabel
        }
      ];
    }

    return [
      {
        key: "document",
        label: documentLabel
      },
      {
        key: "authority",
        label: authorityLabel
      },
      {
        key: "pending",
        label: pendingLabel
      },
      {
        key: "runtime",
        label: runtimeStatusLabel
      },
      {
        key: "selection",
        label: selectionLabel
      }
    ];
  }, [
    graphExecutionState.status,
    remoteRuntimeControlNotice,
    remoteAuthorityConnectionStatus,
    remoteAuthorityPendingOperationIds.length,
    workspaceAdaptiveMode,
    workspaceState?.status.documentLabel,
    workspaceState?.status.runtimeDetailLabel,
    workspaceState?.status.selectionLabel
  ]);

  const controllerState = useMemo<EditorControllerState>(
    () => ({
      theme,
      leaferDebugSettings,
      workspaceAdaptiveMode,
      leftPaneOpen,
      rightPaneOpen,
      workspaceMenuOpen,
      workspaceSettingsOpen,
      runConsoleOpen,
      workspaceSettingsTab,
      runConsoleTab,
      nodeLibrarySearchQuery,
      activeLibraryNodeType,
      availableNodeDefinitions,
      nodeLibraryPreviewRequest,
      bundleCatalog,
      remoteAuthorityStatus,
      remoteAuthorityError,
      remoteAuthorityConnectionStatus,
      remoteAuthorityDocument,
      remoteAuthorityPendingOperationIds,
      remoteAuthorityLastIssue,
      remoteRuntimeControlNotice,
      remoteAuthorityResyncing,
      graphRuntimeControls,
      editorToolbarControls,
      workspaceState,
      leftPanePresentation,
      rightPanePresentation,
      stageLayout,
      canPlayGraph,
      canStepGraph,
      canStopGraph,
      isRemoteAuthorityEnabled,
      defaultEntryOnboardingState
    }),
    [
      activeLibraryNodeType,
      availableNodeDefinitions,
      bundleCatalog,
      canPlayGraph,
      canStepGraph,
      canStopGraph,
      defaultEntryOnboardingState,
      editorToolbarControls,
      graphRuntimeControls,
      isRemoteAuthorityEnabled,
      leaferDebugSettings,
      leftPaneOpen,
      leftPanePresentation,
      nodeLibraryPreviewRequest,
      nodeLibrarySearchQuery,
      remoteAuthorityConnectionStatus,
      remoteAuthorityDocument,
      remoteAuthorityError,
      remoteAuthorityLastIssue,
      remoteAuthorityPendingOperationIds,
      remoteAuthorityResyncing,
      remoteAuthorityStatus,
      remoteRuntimeControlNotice,
      rightPaneOpen,
      rightPanePresentation,
      runConsoleOpen,
      runConsoleTab,
      stageLayout,
      theme,
      workspaceAdaptiveMode,
      workspaceMenuOpen,
      workspaceSettingsOpen,
      workspaceSettingsTab,
      workspaceState
    ]
  );

  const controllerActions = useMemo<EditorControllerActions>(
    () => ({
      setTheme,
      toggleTheme() {
        setTheme((currentTheme) => toggleEditorTheme(currentTheme));
      },
      updateLeaferDebugSettings(patch) {
        setLeaferDebugSettings((currentSettings) =>
          mergeEditorLeaferDebugSettings(currentSettings, patch)
        );
      },
      resetLeaferDebugSettings() {
        setLeaferDebugSettings(createDefaultEditorLeaferDebugSettings());
      },
      setWorkspaceMenuOpen,
      openLeftPane,
      openRightPane,
      toggleLeftPane,
      toggleRightPane,
      closeOverlayPanes,
      openWorkspaceSettings: openWorkspaceSettingsDialog,
      closeWorkspaceSettings() {
        setWorkspaceSettingsOpen(false);
      },
      setWorkspaceSettingsTab,
      openRunConsole: openRunConsoleDialog,
      closeRunConsole() {
        setRunConsoleOpen(false);
      },
      setRunConsoleTab,
      setNodeLibrarySearchQuery,
      setActiveLibraryNodeType,
      setNodeLibraryPreviewRequest,
      loadBundleFiles,
      toggleBundleRecord: toggleBundleEnabled,
      unloadBundleRecord: unloadBundle,
      activateDemoBundle,
      createNodeFromWorkspace: handleCreateNodeFromWorkspace,
      openPythonAuthorityDemo,
      reloadRemoteAuthority() {
        setRemoteAuthorityReloadKey((current) => current + 1);
      },
      async resyncRemoteAuthority(options) {
        if (!viewportHostBridge) {
          return null;
        }

        return await resyncAuthorityDocument({
          resyncOptions: options
        });
      },
      playGraph() {
        graphRuntimeControls?.play();
      },
      stepGraph() {
        graphRuntimeControls?.step();
      },
      stopGraph() {
        graphRuntimeControls?.stop();
      }
    }),
    [
      closeOverlayPanes,
      loadBundleFiles,
      activateDemoBundle,
      graphRuntimeControls,
      handleCreateNodeFromWorkspace,
      openLeftPane,
      openPythonAuthorityDemo,
      openRightPane,
      openRunConsoleDialog,
      openWorkspaceSettingsDialog,
      resyncAuthorityDocument,
      toggleBundleEnabled,
      unloadBundle,
      viewportHostBridge
    ]
  );

  useEffect(() => {
    syncEditorController(controller, controllerState, controllerActions);
  }, [controller, controllerActions, controllerState]);

  const contextValue = useMemo<EditorContextValue>(
    () => ({
      controller,
      state: controllerState,
      actions: controllerActions,
      runtimeSetup,
      effectiveDocument,
      effectiveCreateDocumentSessionBinding,
      effectiveRuntimeFeedbackInlet,
      remoteAuthorityRuntime,
      viewportHostBridge,
      graphExecutionState,
      toolbarActionGroups,
      showToolbarShortcuts,
      statusbarItems,
      workspaceDialogSize,
      overlayPaneOpen,
      nodeLibraryHoverPreviewEnabled,
      authoritySummary,
      shortcutItems,
      handleBundleFileChange,
      toggleBundleEnabled,
      unloadBundle,
      activateDemoBundle,
      handleViewportHostBridgeChange,
      setEditorToolbarControls,
      setGraphRuntimeControls,
      setRemoteRuntimeControlNotice,
      setWorkspaceState,
      resyncAuthorityDocument,
      openPythonAuthorityDemo,
      scrollToBundleGrid,
      extensionsBundleGridRef
    }),
    [
      authoritySummary,
      controller,
      controllerActions,
      controllerState,
      effectiveCreateDocumentSessionBinding,
      effectiveDocument,
      effectiveRuntimeFeedbackInlet,
      graphExecutionState,
      handleBundleFileChange,
      handleViewportHostBridgeChange,
      activateDemoBundle,
      nodeLibraryHoverPreviewEnabled,
      openPythonAuthorityDemo,
      overlayPaneOpen,
      remoteAuthorityRuntime,
      resyncAuthorityDocument,
      runtimeSetup,
      scrollToBundleGrid,
      shortcutItems,
      showToolbarShortcuts,
      statusbarItems,
      viewportHostBridge,
      toggleBundleEnabled,
      toolbarActionGroups,
      unloadBundle,
      workspaceDialogSize
    ]
  );

  const renderWorkspaceStage = (): JSX.Element => {
    if (isRemoteAuthorityEnabled && remoteAuthorityStatus !== "ready") {
      return (
        <div class="workspace-stage__empty">
          <div class="workspace-stage__empty-card">
            <p class="workspace-pane__eyebrow">Remote Authority</p>
            <h2>
              {remoteAuthorityStatus === "error"
                ? "Authority 连接失败"
                : "正在装配远端文档"}
            </h2>
            <p>
              {remoteAuthorityStatus === "error"
                ? remoteAuthorityError ??
                  "当前 authority 未能返回可用文档，请重试或切回本地模式。"
                : "Editor 正在等待 authority client、正式 GraphDocument 和 runtime feedback 通道就绪。"}
            </p>
            <div class="workspace-stage__empty-actions">
              <button
                type="button"
                class="workspace-primary-button"
                disabled={remoteAuthorityStatus === "loading"}
                onClick={() => {
                  setRemoteAuthorityReloadKey((current) => current + 1);
                }}
              >
                {remoteAuthorityStatus === "loading" ? "连接中" : "重试连接"}
              </button>
              <button
                type="button"
                class="workspace-secondary-button"
                onClick={() => {
                  openWorkspaceSettingsDialog("authority");
                }}
              >
                打开 Authority 设置
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div class="workspace-stage__stack">
        <GraphViewport
          document={effectiveDocument}
          plugins={runtimeSetup.plugins}
          debugSettings={leaferDebugSettings}
          createDocumentSessionBinding={effectiveCreateDocumentSessionBinding}
          runtimeFeedbackInlet={effectiveRuntimeFeedbackInlet}
          runtimeController={remoteAuthorityRuntime?.runtimeController}
          runtimeControlMode={remoteAuthorityRuntime ? "remote" : "local"}
          onHostBridgeChange={handleViewportHostBridgeChange}
          quickCreateNodeType={runtimeSetup.quickCreateNodeType}
          theme={theme}
          onEditorToolbarControlsChange={setEditorToolbarControls}
          onGraphRuntimeControlsChange={setGraphRuntimeControls}
          onRemoteRuntimeControlNoticeChange={setRemoteRuntimeControlNotice}
          onWorkspaceStateChange={setWorkspaceState}
        />
        {defaultEntryOnboardingState.showStageOnboarding ? (
          <div class="workspace-stage__overlay">
            <div class="workspace-stage__onboarding-card">
              <p class="workspace-pane__eyebrow">Clean Entry</p>
              <h2>当前打开的是干净编辑器入口</h2>
              <p>
                这里不会自动预加载 node/widget bundle，也不会直接切到 demo
                authority，所以你现在看到的是本地 loopback + 空工作区。
              </p>
              <p>
                如果想马上看到完整节点库和示例链路，可以直接进入预载好的
                Python Authority Demo；如果想保持当前入口干净，也可以先去
                Extensions 手动加载本地 bundle。
              </p>
              <div class="workspace-stage__empty-actions">
                <button
                  type="button"
                  class="workspace-primary-button"
                  onClick={openPythonAuthorityDemo}
                >
                  打开 Python Authority Demo
                </button>
                <button
                  type="button"
                  class="workspace-secondary-button"
                  onClick={() => {
                    openWorkspaceSettingsDialog("extensions");
                  }}
                >
                  打开 Extensions
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  };
  void renderWorkspaceStage;

  return (
    <EditorContext.Provider value={contextValue}>
      {children ?? <EditorShell />}
      {/* 旧的内联壳层已停用，默认统一走 EditorShell；保留待后续整体删除。
        <div
          class="app-shell"
          data-theme={theme}
          data-adaptive={workspaceAdaptiveMode}
          data-left-open={leftPaneOpen ? "true" : "false"}
          data-right-open={rightPaneOpen ? "true" : "false"}
          data-stage-layout={stageLayout}
        >
      <header class="titlebar">
        <div class="titlebar__identity">
          <div class="titlebar__brand">
            <span class="titlebar__brand-mark">LG</span>
            <div>
              <p class="titlebar__eyebrow">LeaferGraph Editor</p>
              <h1>专业工作区</h1>
            </div>
          </div>
          <div class="titlebar__document-meta">
            <span class="titlebar__document-chip">
              {workspaceState?.status.documentLabel ?? "等待文档"}
            </span>
            <span class="titlebar__document-subtle">
              {workspaceState
                ? `${workspaceState.document.nodeCount} Nodes · ${workspaceState.document.linkCount} Links`
                : "等待 GraphViewport 挂载"}
            </span>
          </div>
        </div>

        <div class="titlebar__toolbar">
          {toolbarActionGroups.length ? (
            <div class="commandbar" aria-label="编辑工具栏">
              {toolbarActionGroups.map(({ group, actions }) => (
                <div class="commandbar__group" key={group}>
                  {actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      class={`commandbar__button${
                        action.danger ? " commandbar__button--danger" : ""
                      }`}
                      disabled={action.disabled}
                      title={formatToolbarActionTitle(action)}
                      onClick={() => {
                        editorToolbarControls?.execute(action.id);
                      }}
                    >
                      <span>{action.label}</span>
                      {action.shortcut && showToolbarShortcuts ? (
                        <span class="commandbar__shortcut">{action.shortcut}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div class="commandbar commandbar--placeholder">
              <span>等待画布命令总线就绪</span>
            </div>
          )}
          <div class="titlebar__primary-actions">
            <span class="titlebar-status-pill" data-status={graphExecutionState.status}>
              {formatGraphExecutionStatusLabel(graphExecutionState.status)}
            </span>
          </div>
          <div class="titlebar__runtime">
            <button
              type="button"
              class="workspace-primary-button workspace-primary-button--ghost"
              disabled={!canPlayGraph}
              onClick={() => {
                graphRuntimeControls?.play();
              }}
            >
              Play
            </button>
            <button
              type="button"
              class="workspace-primary-button workspace-primary-button--ghost"
              disabled={!canStepGraph}
              onClick={() => {
                graphRuntimeControls?.step();
              }}
            >
              Step
            </button>
            <button
              type="button"
              class="workspace-secondary-button workspace-secondary-button--danger"
              disabled={!canStopGraph}
              onClick={() => {
                graphRuntimeControls?.stop();
              }}
            >
              Stop
            </button>
          </div>
        </div>

        <div class="titlebar__workspace">
          {!isWorkspaceOverflowMode ? (
            <>
              <button
                type="button"
                class="titlebar-icon-button"
                onClick={toggleLeftPane}
                aria-label="切换节点库"
              >
                <IconPanel
                  title="切换节点库"
                  description="切换节点库"
                  path="M4 6h16M4 12h16M4 18h16"
                />
              </button>
              <button
                type="button"
                class="titlebar-icon-button"
                onClick={toggleRightPane}
                aria-label="切换检查器"
              >
                <IconPanel
                  title="切换检查器"
                  description="切换检查器"
                  path="M5 5h14v14H5zM9 5v14"
                />
              </button>
              <button
                type="button"
                class="workspace-secondary-button"
                onClick={() => {
                  openRunConsoleDialog();
                }}
              >
                Run Console
              </button>
              <button
                type="button"
                class="workspace-secondary-button"
                onClick={() => {
                  openWorkspaceSettingsDialog();
                }}
              >
                Workspace Settings
              </button>
            </>
          ) : (
            <div class="titlebar__workspace-menu">
              <button
                type="button"
                class="workspace-secondary-button titlebar__workspace-trigger"
                data-active={workspaceMenuOpen ? "true" : "false"}
                aria-expanded={workspaceMenuOpen ? "true" : "false"}
                onClick={() => {
                  setWorkspaceMenuOpen((current) => !current);
                }}
              >
                Workspace
              </button>
              {workspaceMenuOpen ? (
                <div
                  class="titlebar__workspace-popover"
                  role="menu"
                  aria-label="工作区快捷入口"
                >
                  <button
                    type="button"
                    class="titlebar__workspace-item"
                    role="menuitem"
                    onClick={openLeftPane}
                  >
                    打开节点库
                  </button>
                  <button
                    type="button"
                    class="titlebar__workspace-item"
                    role="menuitem"
                    onClick={openRightPane}
                  >
                    打开检查器
                  </button>
                  <button
                    type="button"
                    class="titlebar__workspace-item"
                    role="menuitem"
                    onClick={() => {
                      openRunConsoleDialog();
                    }}
                  >
                    Run Console
                  </button>
                  <button
                    type="button"
                    class="titlebar__workspace-item"
                    role="menuitem"
                    onClick={() => {
                      openWorkspaceSettingsDialog();
                    }}
                  >
                    Workspace Settings
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </header>

      <div class="workspace-grid" data-stage-layout={stageLayout}>
        {overlayPaneOpen ? (
          <button
            type="button"
            class="workspace-grid__backdrop"
            aria-label="关闭侧栏覆盖层"
            onClick={closeOverlayPanes}
          />
        ) : null}
        <aside
          class="workspace-sidebar workspace-sidebar--left"
          data-presentation={leftPanePresentation}
          data-open={leftPaneOpen ? "true" : "false"}
        >
          <NodeLibraryPane
            definitions={availableNodeDefinitions}
            searchQuery={nodeLibrarySearchQuery}
            activeNodeType={activeLibraryNodeType}
            presentation={leftPanePresentation}
            quickCreateNodeType={runtimeSetup.quickCreateNodeType}
            disabled={!viewportHostBridge}
            hoverPreviewEnabled={nodeLibraryHoverPreviewEnabled}
            focusSearchOnOpen={leftPaneOpen && leftPanePresentation !== "docked"}
            cleanEntryHint={
              defaultEntryOnboardingState.showNodeLibraryHint
                ? {
                    onOpenExtensions: () => {
                      openWorkspaceSettingsDialog("extensions");
                    },
                    onOpenPythonAuthorityDemo: openPythonAuthorityDemo
                  }
                : undefined
            }
            onSearchQueryChange={setNodeLibrarySearchQuery}
            onActiveNodeTypeChange={setActiveLibraryNodeType}
            onCreateNode={handleCreateNodeFromWorkspace}
            onPreviewRequestChange={setNodeLibraryPreviewRequest}
          />
        </aside>

        <main class="workspace-stage">{renderWorkspaceStage()}</main>

        <aside
          class="workspace-sidebar workspace-sidebar--right"
          data-presentation={rightPanePresentation}
          data-open={rightPaneOpen ? "true" : "false"}
        >
          <InspectorPane
            presentation={rightPanePresentation}
            workspaceState={workspaceState}
            authoritySummary={authoritySummary}
            onOpenRunConsole={() => {
              openRunConsoleDialog("overview");
            }}
          />
        </aside>
      </div>

      {nodeLibraryHoverPreviewEnabled &&
      leftPaneOpen &&
      nodeLibraryPreviewRequest ? (
        <NodeLibraryHoverPreviewOverlay
          request={nodeLibraryPreviewRequest}
          theme={theme}
          plugins={runtimeSetup.plugins}
          debugSettings={leaferDebugSettings}
        />
      ) : null}

      <footer class="statusbar" data-density={workspaceAdaptiveMode}>
        {statusbarItems.map((item) => (
          <span key={item.key} class="statusbar__item">
            {item.label}
          </span>
        ))}
      </footer>

      <AppDialog
        open={workspaceSettingsOpen}
        title="Workspace Settings"
        description="系统级信息统一收敛到这里，主界面只保留创作和检查所需的核心上下文。"
        size={workspaceDialogSize}
        onClose={() => {
          setWorkspaceSettingsOpen(false);
        }}
      >
        <div class="dialog-tabs" role="tablist" aria-label="工作区设置标签">
          {(
            [
              ["extensions", "Extensions"],
              ["authority", "Authority"],
              ["preferences", "Preferences"],
              ["shortcuts", "Shortcuts"]
            ] as const
          ).map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              class="dialog-tab"
              data-active={workspaceSettingsTab === tabId ? "true" : "false"}
              onClick={() => {
                setWorkspaceSettingsTab(tabId);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {workspaceSettingsTab === "extensions" ? (
          <section class="dialog-section">
            <div class="dialog-section__header">
              <div>
                <p class="workspace-pane__eyebrow">Extensions</p>
                <h3>Bundle 管理</h3>
              </div>
              <p class="dialog-section__summary">
                当前激活 <strong>{runtimeSetup.plugins.length}</strong> 个插件，
                优先创建节点为{" "}
                <strong>{runtimeSetup.quickCreateNodeType ?? "未指定"}</strong>
              </p>
            </div>
            {defaultEntryOnboardingState.showExtensionsQuickActions ? (
              <div class="workspace-quickstart">
                <div class="workspace-quickstart__body">
                  <p class="workspace-pane__eyebrow">Quick Start</p>
                  <h4>当前是干净入口</h4>
                  <p>
                    默认页不会自动预装 node/widget bundle。你可以直接打开预载好的
                    Python Authority Demo，或继续在下方手动加载本地 bundle。
                  </p>
                </div>
                <div class="dialog-actions">
                  <button
                    type="button"
                    class="workspace-primary-button"
                    onClick={openPythonAuthorityDemo}
                  >
                    打开 Python Authority Demo
                  </button>
                  <button
                    type="button"
                    class="workspace-secondary-button"
                    onClick={scrollToBundleGrid}
                  >
                    继续手动加载本地 bundle
                  </button>
                </div>
              </div>
            ) : null}
            <div class="bundle-grid" ref={extensionsBundleGridRef}>
              {EDITOR_BUNDLE_SLOTS.map((slot) => {
                const state = runtimeSetup.bundles[slot][0] ?? null;
                if (!state) {
                  return null;
                }
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
                    <dl class="bundle-card__info">
                      <WorkspaceField label="文件" value={state.fileName ?? "未选择"} />
                      <WorkspaceField label="名称" value={manifest?.name ?? "未加载"} />
                      <WorkspaceField label="ID" value={manifest?.id ?? "未加载"} />
                      <WorkspaceField
                        label="版本"
                        value={manifest?.version ? `v${manifest.version}` : "未声明"}
                      />
                      <WorkspaceField
                        label="依赖"
                        value={
                          manifest?.requires?.length
                            ? manifest.requires.join(" + ")
                            : "无"
                        }
                      />
                      <WorkspaceField
                        label="状态"
                        value={resolveBundleActivationLabel(state)}
                      />
                      <WorkspaceField
                        label="持久化"
                        value={formatBundlePersistenceLabel(state)}
                      />
                      <WorkspaceField
                        label="快速创建"
                        value={quickCreateNodeType ?? "无"}
                      />
                    </dl>
                    {state.error ? (
                      <p class="bundle-card__error">{state.error}</p>
                    ) : null}
                    <div class="bundle-card__actions">
                      <label class="workspace-primary-button workspace-primary-button--ghost bundle-card__upload">
                        选择文件
                        <input
                          type="file"
                          class="bundle-card__file-input"
                          accept=".js,text/javascript,application/javascript"
                          multiple
                          onChange={(event) => {
                            void handleBundleFileChange(slot, event);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        class="workspace-secondary-button"
                        disabled={!manifest || state.loading}
                        onClick={() => {
                          if (slot === "demo") {
                            void activateDemoBundle(state.bundleKey);
                            return;
                          }

                          toggleBundleEnabled(slot, state.bundleKey);
                        }}
                      >
                        {slot === "demo"
                          ? state.enabled
                            ? "当前 Demo"
                            : "切换为当前 Demo"
                          : state.enabled
                            ? "停用"
                            : "启用"}
                      </button>
                      <button
                        type="button"
                        class="workspace-secondary-button"
                        disabled={state.loading && !manifest}
                        onClick={() => {
                          unloadBundle(slot, state.bundleKey);
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
        ) : null}

        {workspaceSettingsTab === "authority" ? (
          <section class="dialog-section">
            <div class="dialog-section__header">
              <div>
                <p class="workspace-pane__eyebrow">Authority</p>
                <h3>后端与同步状态</h3>
              </div>
              <p class="dialog-section__summary">
                当前模式：<strong>{authoritySummary.modeLabel}</strong>，装配状态：
                <strong>{formatRemoteAuthorityStatusLabel(remoteAuthorityStatus)}</strong>
              </p>
            </div>
            <dl class="detail-grid">
              <WorkspaceField label="连接状态" value={authoritySummary.connectionLabel} />
              <WorkspaceField label="当前来源" value={authoritySummary.sourceLabel} />
              <WorkspaceField label="当前文档" value={authoritySummary.documentLabel} />
              <WorkspaceField
                label="待确认操作"
                value={String(authoritySummary.pendingCount)}
              />
              <WorkspaceField label="恢复策略" value={authoritySummary.recoveryLabel} />
              <WorkspaceField
                label="Graph 状态"
                value={workspaceState?.status.runtimeLabel ?? "等待画布"}
              />
            </dl>
            {remoteAuthorityRuntime?.sourceDescription ? (
              <p class="workspace-note">{remoteAuthorityRuntime.sourceDescription}</p>
            ) : null}
            {remoteAuthorityLastIssue ? (
              <p class="workspace-note">{remoteAuthorityLastIssue}</p>
            ) : null}
            {remoteAuthorityError ? (
              <p class="workspace-error">{remoteAuthorityError}</p>
            ) : null}
            <div class="dialog-actions">
              {isRemoteAuthorityEnabled ? (
                <>
                  {remoteAuthorityStatus === "ready" && viewportHostBridge ? (
                    <button
                      type="button"
                      class="workspace-primary-button"
                      disabled={remoteAuthorityResyncing}
                      onClick={() => {
                        void resyncAuthorityDocument({
                          resyncOptions: {
                            invalidatePending: true,
                            pendingReason:
                              "authority 已手工重新同步，待确认操作已失效，请手工重试"
                          },
                          successMessagePrefix: "Authority 已手工重新同步"
                        }).catch(() => {
                          // 错误状态已在 resyncAuthorityDocument 内回填到 UI。
                        });
                      }}
                    >
                      {remoteAuthorityResyncing
                        ? "同步中"
                        : remoteAuthorityPendingOperationIds.length > 0
                          ? "放弃待确认并重新同步"
                          : "重新同步文档"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    class="workspace-secondary-button"
                    disabled={remoteAuthorityStatus === "loading"}
                    onClick={() => {
                      setRemoteAuthorityReloadKey((current) => current + 1);
                    }}
                  >
                    {remoteAuthorityStatus === "loading"
                      ? "连接中"
                      : "重新连接 Authority"}
                  </button>
                </>
              ) : (
                <p class="workspace-note">当前没有接入外部 authority，正在使用本地 loopback 文档会话。</p>
              )}
            </div>
          </section>
        ) : null}

        {workspaceSettingsTab === "preferences" ? (
          <section class="dialog-section">
            <div class="dialog-section__header">
              <div>
                <p class="workspace-pane__eyebrow">Preferences</p>
                <h3>工作区偏好</h3>
              </div>
            </div>
            <div class="preferences-grid">
              <article class="preference-card">
                <h4>主题</h4>
                <p>默认采用专业工作站式暗色，亮色保持信息密度与对比度对等。</p>
                <div class="segmented-control">
                  <button
                    type="button"
                    class="segmented-control__button"
                    data-active={theme === "dark" ? "true" : "false"}
                    onClick={() => {
                      setTheme("dark");
                    }}
                  >
                    暗色
                  </button>
                  <button
                    type="button"
                    class="segmented-control__button"
                    data-active={theme === "light" ? "true" : "false"}
                    onClick={() => {
                      setTheme("light");
                    }}
                  >
                    亮色
                  </button>
                  <button
                    type="button"
                    class="segmented-control__button"
                    onClick={() => {
                      setTheme((currentTheme) => toggleEditorTheme(currentTheme));
                    }}
                  >
                    切换
                  </button>
                </div>
              </article>
              <article class="preference-card">
                <h4>工作区可见性</h4>
                <p>在桌面和窄屏之间切换时，节点库与检查器都支持折叠与唤起。</p>
                <div class="dialog-actions">
                  <button
                    type="button"
                    class="workspace-secondary-button"
                    onClick={toggleLeftPane}
                  >
                    {leftPaneOpen ? "收起节点库" : "展开节点库"}
                  </button>
                  <button
                    type="button"
                    class="workspace-secondary-button"
                    onClick={toggleRightPane}
                  >
                    {rightPaneOpen ? "收起检查器" : "展开检查器"}
                  </button>
                </div>
              </article>
            </div>
          </section>
        ) : null}

        {workspaceSettingsTab === "shortcuts" ? (
          <section class="dialog-section">
            <div class="dialog-section__header">
              <div>
                <p class="workspace-pane__eyebrow">Shortcuts</p>
                <h3>快捷键与工作流</h3>
              </div>
            </div>
            <div class="shortcut-list">
              {shortcutItems.map((item) => (
                <article class="shortcut-item" key={item.id}>
                  <div>
                    <h4>{item.label}</h4>
                    <p>{item.description}</p>
                  </div>
                  <kbd>{item.shortcut}</kbd>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </AppDialog>

      <AppDialog
        open={runConsoleOpen}
        title="Run Console"
        description="图级运行链、失败聚合和焦点节点运行态统一移入这里，主界面只保留精简摘要。"
        size={workspaceDialogSize}
        onClose={() => {
          setRunConsoleOpen(false);
        }}
      >
        <div class="dialog-tabs" role="tablist" aria-label="运行控制台标签">
          {(
            [
              ["overview", "Overview"],
              ["chains", "Chains"],
              ["failures", "Failures"],
              ["node-runtime", "Node Runtime"]
            ] as const
          ).map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              class="dialog-tab"
              data-active={runConsoleTab === tabId ? "true" : "false"}
              onClick={() => {
                setRunConsoleTab(tabId);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {remoteRuntimeControlNotice ? (
          <p
            class={
              remoteRuntimeControlNotice.tone === "error"
                ? "workspace-error"
                : "workspace-note"
            }
          >
            {remoteRuntimeControlNotice.message}
          </p>
        ) : null}

        {!workspaceState ? (
          <div class="workspace-empty-state">
            <h3>等待运行上下文</h3>
            <p>GraphViewport 完成挂载后，运行控制台会读取执行摘要与节点快照。</p>
          </div>
        ) : null}

        {workspaceState && runConsoleTab === "overview" ? (
          <section class="dialog-section">
            <div class="run-console-grid">
              <article class="run-console-card">
                <p class="run-console-card__label">图级状态</p>
                <strong>{workspaceState.status.runtimeLabel}</strong>
                <span>
                  Run {workspaceState.runtime.graphExecutionState.runId ?? "无"}
                </span>
              </article>
              <article class="run-console-card">
                <p class="run-console-card__label">焦点节点</p>
                <strong>{workspaceState.status.focusLabel}</strong>
                <span>{workspaceState.runtime.focus.focusMode}</span>
              </article>
              <article class="run-console-card">
                <p class="run-console-card__label">最近检查链</p>
                <strong>
                  {workspaceState.runtime.latestChain?.rootNodeTitle ?? "暂无"}
                </strong>
                <span>
                  {workspaceState.runtime.latestChain
                    ? `${workspaceState.runtime.latestChain.stepCount} 步`
                    : "等待新的执行链"}
                </span>
              </article>
              <article class="run-console-card">
                <p class="run-console-card__label">失败聚合</p>
                <strong>{workspaceState.runtime.failures.length}</strong>
                <span>最近失败节点数</span>
              </article>
            </div>
            <dl class="detail-grid">
              <WorkspaceField
                label="队列长度"
                value={String(workspaceState.runtime.graphExecutionState.queueSize)}
              />
              <WorkspaceField
                label="已推进步数"
                value={String(workspaceState.runtime.graphExecutionState.stepCount)}
              />
              <WorkspaceField
                label="最近推进"
                value={workspaceState.status.runtimeDetailLabel ?? "暂无"}
              />
              <WorkspaceField
                label="最近命令"
                value={workspaceState.status.lastCommandSummary ?? "无"}
              />
              <WorkspaceField
                label="最近成功"
                value={formatTimestamp(
                  workspaceState.runtime.focus.executionState?.lastSucceededAt
                )}
              />
              <WorkspaceField
                label="最近失败"
                value={formatTimestamp(
                  workspaceState.runtime.focus.executionState?.lastFailedAt
                )}
              />
              <WorkspaceField
                label="Document"
                value={workspaceState.status.documentLabel}
              />
            </dl>
            {workspaceState.runtime.latestErrorMessage ? (
              <p class="workspace-error">
                {workspaceState.runtime.latestErrorMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        {workspaceState && runConsoleTab === "chains" ? (
          <section class="dialog-section">
            {workspaceState.runtime.recentChains.length ? (
              <div class="run-chain-list">
                {workspaceState.runtime.recentChains.map((chain) => (
                  <article class="run-chain-card" key={chain.chainId}>
                    <header class="run-chain-card__header">
                      <div>
                        <h4>{chain.rootNodeTitle}</h4>
                        <p>
                          {chain.rootNodeType ?? "未知类型"} · 最近于{" "}
                          {formatTimestamp(chain.finishedAt)}
                        </p>
                      </div>
                      <span class="titlebar-status-pill" data-status={chain.status}>
                        {chain.status}
                      </span>
                    </header>
                    <p class="run-chain-card__summary">
                      {chain.stepCount} 步 · 最深 {chain.maxDepth} 层 · 主动{" "}
                      {chain.directCount} 次 · 传播 {chain.propagatedCount} 次 ·{" "}
                      {formatDuration(chain.startedAt, chain.finishedAt)}
                    </p>
                    <ul class="run-chain-card__steps">
                      {chain.entries.map((entry) => (
                        <li key={`${chain.chainId}:${entry.id}`}>
                          <strong>{entry.sequence + 1}. {entry.nodeTitle}</strong>
                          <span>
                            {entry.status} · {formatTimestamp(entry.timestamp)}
                          </span>
                          <p>{entry.summary}</p>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            ) : (
              <div class="workspace-empty-state">
                <h3>当前还没有执行链</h3>
                <p>先使用顶栏 Play / Step，或从节点菜单里直接起跑一个节点。</p>
              </div>
            )}
          </section>
        ) : null}

        {workspaceState && runConsoleTab === "failures" ? (
          <section class="dialog-section">
            {workspaceState.runtime.failures.length ? (
              <div class="run-chain-list">
                {workspaceState.runtime.failures.map((failure) => (
                  <article class="run-chain-card" key={failure.nodeId}>
                    <header class="run-chain-card__header">
                      <div>
                        <h4>{failure.nodeTitle}</h4>
                        <p>
                          {failure.nodeType ?? "未知类型"} · 最近于{" "}
                          {formatTimestamp(failure.latestTimestamp)}
                        </p>
                      </div>
                      <span class="titlebar-status-pill" data-status="error">
                        失败
                      </span>
                    </header>
                    <p class="run-chain-card__summary">
                      累计失败 {failure.failureCount} 次
                    </p>
                    {failure.latestErrorMessage ? (
                      <pre class="inspector-code">
                        {failure.latestErrorMessage}
                      </pre>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div class="workspace-empty-state">
                <h3>当前没有失败聚合</h3>
                <p>运行控制台会在检测到 error 后自动保留最近失败节点摘要。</p>
              </div>
            )}
          </section>
        ) : null}

        {workspaceState && runConsoleTab === "node-runtime" ? (
          <section class="dialog-section">
            {workspaceState.runtime.focusNode ? (
              <>
                <div class="dialog-section__header">
                  <div>
                    <p class="workspace-pane__eyebrow">Node Runtime</p>
                    <h3>{workspaceState.runtime.focusNode.title}</h3>
                  </div>
                  <span class="titlebar__document-chip">
                    {workspaceState.runtime.focusNode.type}
                  </span>
                </div>
                <dl class="detail-grid">
                  <WorkspaceField
                    label="位置"
                    value={`${workspaceState.runtime.focusNode.layout.x}, ${workspaceState.runtime.focusNode.layout.y}`}
                  />
                  <WorkspaceField
                    label="尺寸"
                    value={`${workspaceState.runtime.focusNode.layout.width ?? "auto"} × ${workspaceState.runtime.focusNode.layout.height ?? "auto"}`}
                  />
                  <WorkspaceField
                    label="执行次数"
                    value={String(
                      workspaceState.runtime.focusNode.executionState.runCount
                    )}
                  />
                  <WorkspaceField
                    label="最近成功"
                    value={formatTimestamp(
                      workspaceState.runtime.focusNode.executionState.lastSucceededAt
                    )}
                  />
                  <WorkspaceField
                    label="最近失败"
                    value={formatTimestamp(
                      workspaceState.runtime.focusNode.executionState.lastFailedAt
                    )}
                  />
                  <WorkspaceField
                    label="Inputs"
                    value={String(workspaceState.runtime.focusNode.inputs.length)}
                  />
                </dl>
                <div class="run-console-node-grid">
                  <article class="run-console-card run-console-card--code">
                    <p class="run-console-card__label">Flags</p>
                    <pre class="inspector-code">
                      {formatJson(workspaceState.runtime.focusNode.flags)}
                    </pre>
                  </article>
                  <article class="run-console-card run-console-card--code">
                    <p class="run-console-card__label">Properties</p>
                    <pre class="inspector-code">
                      {formatJson(workspaceState.runtime.focusNode.properties)}
                    </pre>
                  </article>
                  <article class="run-console-card run-console-card--code">
                    <p class="run-console-card__label">Inputs</p>
                    <pre class="inspector-code">
                      {formatJson(workspaceState.runtime.focusNode.inputs)}
                    </pre>
                  </article>
                  <article class="run-console-card run-console-card--code">
                    <p class="run-console-card__label">Outputs</p>
                    <pre class="inspector-code">
                      {formatJson(workspaceState.runtime.focusNode.outputs)}
                    </pre>
                  </article>
                </div>
              </>
            ) : (
              <div class="workspace-empty-state">
                <h3>当前没有焦点节点</h3>
                <p>先选中一个节点，或触发一次节点执行，控制台会显示焦点节点运行态。</p>
              </div>
            )}
          </section>
        ) : null}
      </AppDialog>
        </div>
      */}
    </EditorContext.Provider>
  );
}

export function EditorTitlebar() {
  const { state, actions, graphExecutionState, toolbarActionGroups, showToolbarShortcuts } =
    useEditorContext();
  const isWorkspaceOverflowMode =
    state.workspaceAdaptiveMode === "tablet" ||
    state.workspaceAdaptiveMode === "mobile";

  return (
    <header class="titlebar">
      <div class="titlebar__identity">
        <div class="titlebar__brand">
          <span class="titlebar__brand-mark">LG</span>
          <div>
            <p class="titlebar__eyebrow">LeaferGraph Editor</p>
            <h1>专业工作区</h1>
          </div>
        </div>
        <div class="titlebar__document-meta">
          <span class="titlebar__document-chip">
            {state.workspaceState?.status.documentLabel ?? "等待文档"}
          </span>
          <span class="titlebar__document-subtle">
            {state.workspaceState
              ? `${state.workspaceState.document.nodeCount} Nodes · ${state.workspaceState.document.linkCount} Links`
              : "等待 GraphViewport 挂载"}
          </span>
        </div>
      </div>

      <div class="titlebar__toolbar">
        {toolbarActionGroups.length ? (
          <div class="commandbar" aria-label="编辑工具栏">
            {toolbarActionGroups.map(({ group, actions: groupActions }) => (
              <div class="commandbar__group" key={group}>
                {groupActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    class={`commandbar__button${
                      action.danger ? " commandbar__button--danger" : ""
                    }`}
                    disabled={action.disabled}
                    title={formatToolbarActionTitle(action)}
                    onClick={() => {
                      state.editorToolbarControls?.execute(action.id);
                    }}
                  >
                    <span>{action.label}</span>
                    {action.shortcut && showToolbarShortcuts ? (
                      <span class="commandbar__shortcut">{action.shortcut}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div class="commandbar commandbar--placeholder">
            <span>等待画布命令总线就绪</span>
          </div>
        )}
        <div class="titlebar__primary-actions">
          <span class="titlebar-status-pill" data-status={graphExecutionState.status}>
            {formatGraphExecutionStatusLabel(graphExecutionState.status)}
          </span>
        </div>
        <div class="titlebar__runtime">
          <button
            type="button"
            class="workspace-primary-button workspace-primary-button--ghost"
            disabled={!state.canPlayGraph}
            onClick={() => {
              actions.playGraph();
            }}
          >
            Play
          </button>
          <button
            type="button"
            class="workspace-primary-button workspace-primary-button--ghost"
            disabled={!state.canStepGraph}
            onClick={() => {
              actions.stepGraph();
            }}
          >
            Step
          </button>
          <button
            type="button"
            class="workspace-secondary-button workspace-secondary-button--danger"
            disabled={!state.canStopGraph}
            onClick={() => {
              actions.stopGraph();
            }}
          >
            Stop
          </button>
        </div>
      </div>

      <div class="titlebar__workspace">
        {!isWorkspaceOverflowMode ? (
          <>
            <button
              type="button"
              class="titlebar-icon-button"
              onClick={actions.toggleLeftPane}
              aria-label="切换节点库"
            >
              <IconPanel
                title="切换节点库"
                description="切换节点库"
                path="M4 6h16M4 12h16M4 18h16"
              />
            </button>
            <button
              type="button"
              class="titlebar-icon-button"
              onClick={actions.toggleRightPane}
              aria-label="切换检查器"
            >
              <IconPanel
                title="切换检查器"
                description="切换检查器"
                path="M5 5h14v14H5zM9 5v14"
              />
            </button>
            <button
              type="button"
              class="workspace-secondary-button"
              onClick={() => {
                actions.openRunConsole();
              }}
            >
              Run Console
            </button>
            <button
              type="button"
              class="workspace-secondary-button"
              onClick={() => {
                actions.openWorkspaceSettings();
              }}
            >
              Workspace Settings
            </button>
          </>
        ) : (
          <div class="titlebar__workspace-menu">
            <button
              type="button"
              class="workspace-secondary-button titlebar__workspace-trigger"
              data-active={state.workspaceMenuOpen ? "true" : "false"}
              aria-expanded={state.workspaceMenuOpen ? "true" : "false"}
              onClick={() => {
                actions.setWorkspaceMenuOpen(!state.workspaceMenuOpen);
              }}
            >
              Workspace
            </button>
            {state.workspaceMenuOpen ? (
              <div
                class="titlebar__workspace-popover"
                role="menu"
                aria-label="工作区快捷入口"
              >
                <button
                  type="button"
                  class="titlebar__workspace-item"
                  role="menuitem"
                  onClick={actions.openLeftPane}
                >
                  打开节点库
                </button>
                <button
                  type="button"
                  class="titlebar__workspace-item"
                  role="menuitem"
                  onClick={actions.openRightPane}
                >
                  打开检查器
                </button>
                <button
                  type="button"
                  class="titlebar__workspace-item"
                  role="menuitem"
                  onClick={() => {
                    actions.openRunConsole();
                  }}
                >
                  Run Console
                </button>
                <button
                  type="button"
                  class="titlebar__workspace-item"
                  role="menuitem"
                  onClick={() => {
                    actions.openWorkspaceSettings();
                  }}
                >
                  Workspace Settings
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
}

export function EditorNodeLibrary() {
  const { state, actions, runtimeSetup, nodeLibraryHoverPreviewEnabled, viewportHostBridge } =
    useEditorContext();

  return (
    <NodeLibraryPane
      definitions={state.availableNodeDefinitions}
      searchQuery={state.nodeLibrarySearchQuery}
      activeNodeType={state.activeLibraryNodeType}
      presentation={state.leftPanePresentation}
      quickCreateNodeType={runtimeSetup.quickCreateNodeType}
      disabled={!viewportHostBridge}
      hoverPreviewEnabled={nodeLibraryHoverPreviewEnabled}
      focusSearchOnOpen={
        state.leftPaneOpen && state.leftPanePresentation !== "docked"
      }
      cleanEntryHint={
        state.defaultEntryOnboardingState.showNodeLibraryHint
          ? {
              onOpenExtensions: () => {
                actions.openWorkspaceSettings("extensions");
              },
              onOpenPythonAuthorityDemo: actions.openPythonAuthorityDemo
            }
          : undefined
      }
      onSearchQueryChange={actions.setNodeLibrarySearchQuery}
      onActiveNodeTypeChange={(nodeType) => {
        actions.setActiveLibraryNodeType(nodeType);
      }}
      onCreateNode={actions.createNodeFromWorkspace}
      onPreviewRequestChange={actions.setNodeLibraryPreviewRequest}
    />
  );
}

export function EditorInspector() {
  const { state, authoritySummary, actions } = useEditorContext();

  return (
    <InspectorPane
      presentation={state.rightPanePresentation}
      workspaceState={state.workspaceState}
      authoritySummary={authoritySummary}
      onOpenRunConsole={() => {
        actions.openRunConsole("overview");
      }}
    />
  );
}

export function EditorViewportPane() {
  const {
    state,
    actions,
    runtimeSetup,
    effectiveDocument,
    effectiveCreateDocumentSessionBinding,
    effectiveRuntimeFeedbackInlet,
    remoteAuthorityRuntime,
    handleViewportHostBridgeChange,
    setEditorToolbarControls,
    setGraphRuntimeControls,
    setRemoteRuntimeControlNotice,
    setWorkspaceState
  } = useEditorContext();

  if (state.isRemoteAuthorityEnabled && state.remoteAuthorityStatus !== "ready") {
    return (
      <div class="workspace-stage__empty">
        <div class="workspace-stage__empty-card">
          <p class="workspace-pane__eyebrow">Remote Authority</p>
          <h2>
            {state.remoteAuthorityStatus === "error"
              ? "Authority 连接失败"
              : "正在装配远端文档"}
          </h2>
          <p>
            {state.remoteAuthorityStatus === "error"
              ? state.remoteAuthorityError ??
                "当前 authority 未能返回可用文档，请重试或切回本地模式。"
              : "Editor 正在等待 authority client、正式 GraphDocument 和 runtime feedback 通道就绪。"}
          </p>
          <div class="workspace-stage__empty-actions">
            <button
              type="button"
              class="workspace-primary-button"
              disabled={state.remoteAuthorityStatus === "loading"}
              onClick={() => {
                actions.reloadRemoteAuthority();
              }}
            >
              {state.remoteAuthorityStatus === "loading" ? "连接中" : "重试连接"}
            </button>
            <button
              type="button"
              class="workspace-secondary-button"
              onClick={() => {
                actions.openWorkspaceSettings("authority");
              }}
            >
              打开 Authority 设置
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="workspace-stage__stack">
      <GraphViewport
        document={effectiveDocument}
        plugins={runtimeSetup.plugins}
        debugSettings={state.leaferDebugSettings}
        createDocumentSessionBinding={effectiveCreateDocumentSessionBinding}
        runtimeFeedbackInlet={effectiveRuntimeFeedbackInlet}
        runtimeController={remoteAuthorityRuntime?.runtimeController}
        runtimeControlMode={remoteAuthorityRuntime ? "remote" : "local"}
        onHostBridgeChange={handleViewportHostBridgeChange}
        quickCreateNodeType={runtimeSetup.quickCreateNodeType}
        theme={state.theme}
        onEditorToolbarControlsChange={setEditorToolbarControls}
        onGraphRuntimeControlsChange={setGraphRuntimeControls}
        onRemoteRuntimeControlNoticeChange={setRemoteRuntimeControlNotice}
        onWorkspaceStateChange={setWorkspaceState}
      />
      {state.defaultEntryOnboardingState.showStageOnboarding ? (
        <div class="workspace-stage__overlay">
          <div class="workspace-stage__onboarding-card">
            <p class="workspace-pane__eyebrow">Clean Entry</p>
            <h2>当前打开的是干净编辑器入口</h2>
            <p>
              这里不会自动预加载 node/widget bundle，也不会直接切到 demo
              authority，所以你现在看到的是本地 loopback + 空工作区。
            </p>
            <p>
              如果想马上看到完整节点库和示例链路，可以直接进入预载好的
              Python Authority Demo；如果想保持当前入口干净，也可以先去
              Extensions 手动加载本地 bundle。
            </p>
            <div class="workspace-stage__empty-actions">
              <button
                type="button"
                class="workspace-primary-button"
                onClick={actions.openPythonAuthorityDemo}
              >
                打开 Python Authority Demo
              </button>
              <button
                type="button"
                class="workspace-secondary-button"
                onClick={() => {
                  actions.openWorkspaceSettings("extensions");
                }}
              >
                打开 Extensions
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function EditorWorkspace() {
  const {
    state,
    actions,
    overlayPaneOpen,
    nodeLibraryHoverPreviewEnabled,
    runtimeSetup
  } = useEditorContext();

  return (
    <>
      <div class="workspace-grid" data-stage-layout={state.stageLayout}>
        {overlayPaneOpen ? (
          <button
            type="button"
            class="workspace-grid__backdrop"
            aria-label="关闭侧栏覆盖层"
            onClick={actions.closeOverlayPanes}
          />
        ) : null}
        <aside
          class="workspace-sidebar workspace-sidebar--left"
          data-presentation={state.leftPanePresentation}
          data-open={state.leftPaneOpen ? "true" : "false"}
        >
          <EditorNodeLibrary />
        </aside>

        <main class="workspace-stage" id="editor-main-canvas" tabIndex={-1}>
          <EditorViewportPane />
        </main>

        <aside
          class="workspace-sidebar workspace-sidebar--right"
          data-presentation={state.rightPanePresentation}
          data-open={state.rightPaneOpen ? "true" : "false"}
        >
          <EditorInspector />
        </aside>
      </div>

      {nodeLibraryHoverPreviewEnabled &&
      state.leftPaneOpen &&
      state.nodeLibraryPreviewRequest ? (
        <NodeLibraryHoverPreviewOverlay
          request={state.nodeLibraryPreviewRequest}
          theme={state.theme}
          plugins={runtimeSetup.plugins}
          debugSettings={state.leaferDebugSettings}
        />
      ) : null}
    </>
  );
}

export function EditorStatusbar() {
  const { state, statusbarItems } = useEditorContext();

  return (
    <footer class="statusbar" data-density={state.workspaceAdaptiveMode}>
      {statusbarItems.map((item) => (
        <span key={item.key} class="statusbar__item">
          {item.label}
        </span>
      ))}
    </footer>
  );
}

function EditorLeaferDebugPreferenceCard() {
  const { state, actions } = useEditorContext();
  const settings = state.leaferDebugSettings;

  return (
    <article class="preference-card">
      <h4>Leafer 调试</h4>
      <p>
        直接映射 Leafer 的全局 Debug 开关，会同时影响当前 editor 页面中的主画布和节点预览。
      </p>
      <div class="preference-card__stack">
        <div class="segmented-control" role="group" aria-label="Leafer 调试开关">
          <button
            type="button"
            class="segmented-control__button"
            data-active={settings.enabled ? "true" : "false"}
            aria-pressed={settings.enabled ? "true" : "false"}
            onClick={() => {
              actions.updateLeaferDebugSettings({ enabled: true });
            }}
          >
            开启调试
          </button>
          <button
            type="button"
            class="segmented-control__button"
            data-active={!settings.enabled ? "true" : "false"}
            aria-pressed={!settings.enabled ? "true" : "false"}
            onClick={() => {
              actions.updateLeaferDebugSettings({ enabled: false });
            }}
          >
            关闭调试
          </button>
        </div>

        <div class="segmented-control" role="group" aria-label="Leafer 调试选项">
          <button
            type="button"
            class="segmented-control__button"
            data-active={settings.showWarn ? "true" : "false"}
            aria-pressed={settings.showWarn ? "true" : "false"}
            onClick={() => {
              actions.updateLeaferDebugSettings({
                showWarn: !settings.showWarn
              });
            }}
          >
            显示警告
          </button>
          <button
            type="button"
            class="segmented-control__button"
            data-active={settings.showRepaint ? "true" : "false"}
            aria-pressed={settings.showRepaint ? "true" : "false"}
            onClick={() => {
              actions.updateLeaferDebugSettings({
                showRepaint: !settings.showRepaint
              });
            }}
          >
            显示重绘区域
          </button>
        </div>

        <div class="segmented-control" role="group" aria-label="Leafer 包围盒模式">
          <button
            type="button"
            class="segmented-control__button"
            data-active={settings.showBoundsMode === "off" ? "true" : "false"}
            aria-pressed={settings.showBoundsMode === "off" ? "true" : "false"}
            onClick={() => {
              actions.updateLeaferDebugSettings({ showBoundsMode: "off" });
            }}
          >
            关闭包围盒
          </button>
          <button
            type="button"
            class="segmented-control__button"
            data-active={settings.showBoundsMode === "bounds" ? "true" : "false"}
            aria-pressed={
              settings.showBoundsMode === "bounds" ? "true" : "false"
            }
            onClick={() => {
              actions.updateLeaferDebugSettings({ showBoundsMode: "bounds" });
            }}
          >
            显示包围盒
          </button>
          <button
            type="button"
            class="segmented-control__button"
            data-active={settings.showBoundsMode === "hit" ? "true" : "false"}
            aria-pressed={settings.showBoundsMode === "hit" ? "true" : "false"}
            onClick={() => {
              actions.updateLeaferDebugSettings({ showBoundsMode: "hit" });
            }}
          >
            显示 hit 区域
          </button>
        </div>

        <EditorLeaferDebugTypeField
          label="仅输出类型"
          placeholder="例如：RunTime, Life"
          value={settings.filter}
          onCommit={(value) => {
            actions.updateLeaferDebugSettings({ filter: value });
          }}
        />
        <EditorLeaferDebugTypeField
          label="排除类型"
          placeholder="例如：Life"
          value={settings.exclude}
          onCommit={(value) => {
            actions.updateLeaferDebugSettings({ exclude: value });
          }}
        />

        <p class="preference-card__hint">
          `filter / exclude` 使用逗号分隔，可填写官方或自定义调试类型。
        </p>

        <div class="dialog-actions">
          <button
            type="button"
            class="workspace-secondary-button"
            onClick={() => {
              actions.resetLeaferDebugSettings();
            }}
          >
            恢复默认调试设置
          </button>
        </div>
      </div>
    </article>
  );
}

export function EditorWorkspaceSettingsDialog() {
  const {
    state,
    actions,
    runtimeSetup,
    workspaceDialogSize,
    authoritySummary,
    remoteAuthorityRuntime,
    viewportHostBridge,
    handleBundleFileChange,
    toggleBundleEnabled,
    unloadBundle,
    resyncAuthorityDocument,
    extensionsBundleGridRef,
    scrollToBundleGrid,
    shortcutItems,
    activateDemoBundle
  } = useEditorContext();
  const currentDemoLabel = runtimeSetup.currentDemo?.manifest?.name ?? "未选择";
  const workspaceSettingsTabIdPrefix = "workspace-settings-tab-";
  const workspaceSettingsPanelIdPrefix = "workspace-settings-panel-";

  return (
    <AppDialog
      open={state.workspaceSettingsOpen}
      title="Workspace Settings"
      description="系统级信息统一收敛到这里，主界面只保留创作和检查所需的核心上下文。"
      size={workspaceDialogSize}
      onClose={() => {
        actions.closeWorkspaceSettings();
      }}
    >
      <div class="dialog-tabs" role="tablist" aria-label="工作区设置标签">
        {(
          [
            ["extensions", "Extensions"],
            ["authority", "Authority"],
            ["preferences", "Preferences"],
            ["shortcuts", "Shortcuts"]
          ] as const
        ).map(([tabId, label]) => (
          <button
            key={tabId}
            id={`${workspaceSettingsTabIdPrefix}${tabId}`}
            type="button"
            role="tab"
            class="dialog-tab"
            data-active={state.workspaceSettingsTab === tabId ? "true" : "false"}
            aria-selected={state.workspaceSettingsTab === tabId ? "true" : "false"}
            aria-controls={`${workspaceSettingsPanelIdPrefix}${tabId}`}
            onClick={() => {
              actions.setWorkspaceSettingsTab(tabId);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {state.workspaceSettingsTab === "extensions" ? (
        <section
          class="dialog-section"
          id={`${workspaceSettingsPanelIdPrefix}extensions`}
          role="tabpanel"
          aria-labelledby={`${workspaceSettingsTabIdPrefix}extensions`}
        >
          <div class="dialog-section__header">
            <div>
              <p class="workspace-pane__eyebrow">Extensions</p>
              <h3>Bundle 管理</h3>
            </div>
            <p class="dialog-section__summary">
              当前激活 <strong>{runtimeSetup.plugins.length}</strong> 个插件，
              当前 demo 为 <strong>{currentDemoLabel}</strong>，优先创建节点为{" "}
              <strong>{runtimeSetup.quickCreateNodeType ?? "未指定"}</strong>
            </p>
          </div>
          {state.defaultEntryOnboardingState.showExtensionsQuickActions ? (
            <div class="workspace-quickstart">
              <div class="workspace-quickstart__body">
                <p class="workspace-pane__eyebrow">Quick Start</p>
                <h4>当前是干净入口</h4>
                <p>
                  默认页不会自动预装 node/widget bundle。你可以直接打开预载好的
                  Python Authority Demo，或继续在下方手动加载本地 bundle。
                </p>
              </div>
              <div class="dialog-actions">
                <button
                  type="button"
                  class="workspace-primary-button"
                  onClick={actions.openPythonAuthorityDemo}
                >
                  打开 Python Authority Demo
                </button>
                <button
                  type="button"
                  class="workspace-secondary-button"
                  onClick={scrollToBundleGrid}
                >
                  继续手动加载本地 bundle
                </button>
              </div>
            </div>
          ) : null}
          <div class="bundle-stack" ref={extensionsBundleGridRef}>
            {EDITOR_BUNDLE_SLOTS.map((slot) => (
              <section class="bundle-group" key={slot}>
                <div class="bundle-group__header">
                  <div>
                    <h4>{BUNDLE_SLOT_TITLE[slot]}</h4>
                    <p>{BUNDLE_SLOT_DESCRIPTION[slot]}</p>
                  </div>
                  <label class="workspace-primary-button workspace-primary-button--ghost bundle-card__upload">
                    选择文件
                    <input
                      type="file"
                      class="bundle-card__file-input"
                      accept=".js,text/javascript,application/javascript"
                      multiple
                      onChange={(event) => {
                        void handleBundleFileChange(slot, event);
                      }}
                    />
                  </label>
                </div>
                <div class="bundle-group__list">
                  {runtimeSetup.bundles[slot].length ? (
                    runtimeSetup.bundles[slot].map((bundleState) => {
                      const manifest = bundleState.manifest;
                      const quickCreateNodeType =
                        manifest?.kind === "node" || manifest?.kind === "widget"
                          ? manifest.quickCreateNodeType
                          : undefined;

                      return (
                        <article class="bundle-card" key={bundleState.bundleKey}>
                          <div class="bundle-card__header">
                            <div>
                              <h4>{manifest?.name ?? bundleState.fileName ?? "未加载"}</h4>
                              <p>{bundleState.fileName ?? "未选择文件"}</p>
                            </div>
                            <span
                              class="bundle-card__status"
                              data-status={bundleState.status}
                            >
                              {BUNDLE_STATUS_LABEL[bundleState.status]}
                            </span>
                          </div>
                          <dl class="bundle-card__info">
                            <WorkspaceField
                              label="文件"
                              value={bundleState.fileName ?? "未选择"}
                            />
                            <WorkspaceField
                              label="名称"
                              value={manifest?.name ?? "未加载"}
                            />
                            <WorkspaceField
                              label="ID"
                              value={resolveEditorBundleRecordId(bundleState) ?? "未加载"}
                            />
                            <WorkspaceField
                              label="版本"
                              value={manifest?.version ? `v${manifest.version}` : "未声明"}
                            />
                            <WorkspaceField
                              label="依赖"
                              value={
                                manifest?.requires?.length
                                  ? manifest.requires.join(" + ")
                                  : "无"
                              }
                            />
                            <WorkspaceField
                              label="状态"
                              value={resolveBundleActivationLabel(bundleState)}
                            />
                            <WorkspaceField
                              label="持久化"
                              value={formatBundlePersistenceLabel(bundleState)}
                            />
                            <WorkspaceField
                              label="快速创建"
                              value={quickCreateNodeType ?? "无"}
                            />
                          </dl>
                          {bundleState.error ? (
                            <p class="bundle-card__error">{bundleState.error}</p>
                          ) : null}
                          <div class="bundle-card__actions">
                            {isDemoBundleRecord(bundleState) ? (
                              <button
                                type="button"
                                class="workspace-secondary-button"
                                disabled={
                                  !manifest ||
                                  bundleState.loading ||
                                  bundleState.enabled ||
                                  bundleState.missingRequirements.length > 0
                                }
                                onClick={() => {
                                  void activateDemoBundle(bundleState.bundleKey);
                                }}
                              >
                                {bundleState.enabled ? "当前 Demo" : "切换为当前 Demo"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                class="workspace-secondary-button"
                                disabled={!manifest || bundleState.loading}
                                onClick={() => {
                                  toggleBundleEnabled(slot, bundleState.bundleKey);
                                }}
                              >
                                {bundleState.enabled ? "停用" : "启用"}
                              </button>
                            )}
                            <button
                              type="button"
                              class="workspace-secondary-button"
                              disabled={bundleState.loading && !manifest}
                              onClick={() => {
                                unloadBundle(slot, bundleState.bundleKey);
                              }}
                            >
                              卸载
                            </button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div class="workspace-empty-state bundle-group__empty">
                      <h3>{BUNDLE_SLOT_TITLE[slot]} 尚未加载</h3>
                      <p>可以一次选择多个 `.js` bundle 文件并加入当前工作区。</p>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </section>
      ) : null}

      {state.workspaceSettingsTab === "authority" ? (
        <section
          class="dialog-section"
          id={`${workspaceSettingsPanelIdPrefix}authority`}
          role="tabpanel"
          aria-labelledby={`${workspaceSettingsTabIdPrefix}authority`}
        >
          <div class="dialog-section__header">
            <div>
              <p class="workspace-pane__eyebrow">Authority</p>
              <h3>后端与同步状态</h3>
            </div>
            <p class="dialog-section__summary">
              当前模式：<strong>{authoritySummary.modeLabel}</strong>，装配状态：
              <strong>{formatRemoteAuthorityStatusLabel(state.remoteAuthorityStatus)}</strong>
            </p>
          </div>
          <dl class="detail-grid">
            <WorkspaceField label="连接状态" value={authoritySummary.connectionLabel} />
            <WorkspaceField label="当前来源" value={authoritySummary.sourceLabel} />
            <WorkspaceField label="当前文档" value={authoritySummary.documentLabel} />
            <WorkspaceField
              label="待确认操作"
              value={String(authoritySummary.pendingCount)}
            />
            <WorkspaceField label="恢复策略" value={authoritySummary.recoveryLabel} />
            <WorkspaceField
              label="Graph 状态"
              value={state.workspaceState?.status.runtimeLabel ?? "等待画布"}
            />
          </dl>
          {remoteAuthorityRuntime?.sourceDescription ? (
            <p class="workspace-note">{remoteAuthorityRuntime.sourceDescription}</p>
          ) : null}
          {state.remoteAuthorityLastIssue ? (
            <p class="workspace-note">{state.remoteAuthorityLastIssue}</p>
          ) : null}
          {state.remoteAuthorityError ? (
            <p class="workspace-error">{state.remoteAuthorityError}</p>
          ) : null}
          <div class="dialog-actions">
            {state.isRemoteAuthorityEnabled ? (
              <>
                {state.remoteAuthorityStatus === "ready" && viewportHostBridge ? (
                  <button
                    type="button"
                    class="workspace-primary-button"
                    disabled={state.remoteAuthorityResyncing}
                    onClick={() => {
                      void resyncAuthorityDocument({
                        resyncOptions: {
                          invalidatePending: true,
                          pendingReason:
                            "authority 已手工重新同步，待确认操作已失效，请手工重试"
                        },
                        successMessagePrefix: "Authority 已手工重新同步"
                      }).catch(() => {
                        // 错误状态已在 resyncAuthorityDocument 内回填到 UI。
                      });
                    }}
                  >
                    {state.remoteAuthorityResyncing
                      ? "同步中"
                      : state.remoteAuthorityPendingOperationIds.length > 0
                        ? "放弃待确认并重新同步"
                        : "重新同步文档"}
                  </button>
                ) : null}
                <button
                  type="button"
                  class="workspace-secondary-button"
                  disabled={state.remoteAuthorityStatus === "loading"}
                  onClick={() => {
                    actions.reloadRemoteAuthority();
                  }}
                >
                  {state.remoteAuthorityStatus === "loading"
                    ? "连接中"
                    : "重新连接 Authority"}
                </button>
              </>
            ) : (
              <p class="workspace-note">
                当前没有接入外部 authority，正在使用本地 loopback 文档会话。
              </p>
            )}
          </div>
        </section>
      ) : null}

      {state.workspaceSettingsTab === "preferences" ? (
        <section
          class="dialog-section"
          id={`${workspaceSettingsPanelIdPrefix}preferences`}
          role="tabpanel"
          aria-labelledby={`${workspaceSettingsTabIdPrefix}preferences`}
        >
          <div class="dialog-section__header">
            <div>
              <p class="workspace-pane__eyebrow">Preferences</p>
              <h3>工作区偏好</h3>
            </div>
          </div>
          <div class="preferences-grid">
            <article class="preference-card">
              <h4>主题</h4>
              <p>默认采用专业工作站式暗色，亮色保持信息密度与对比度对等。</p>
              <div class="segmented-control">
                <button
                  type="button"
                  class="segmented-control__button"
                  data-active={state.theme === "dark" ? "true" : "false"}
                  onClick={() => {
                    actions.setTheme("dark");
                  }}
                >
                  暗色
                </button>
                <button
                  type="button"
                  class="segmented-control__button"
                  data-active={state.theme === "light" ? "true" : "false"}
                  onClick={() => {
                    actions.setTheme("light");
                  }}
                >
                  亮色
                </button>
                <button
                  type="button"
                  class="segmented-control__button"
                  onClick={actions.toggleTheme}
                >
                  切换
                </button>
              </div>
            </article>
            <article class="preference-card">
              <h4>工作区可见性</h4>
              <p>在桌面和窄屏之间切换时，节点库与检查器都支持折叠与唤起。</p>
              <div class="dialog-actions">
                <button
                  type="button"
                  class="workspace-secondary-button"
                  onClick={actions.toggleLeftPane}
                >
                  {state.leftPaneOpen ? "收起节点库" : "展开节点库"}
                </button>
                <button
                  type="button"
                  class="workspace-secondary-button"
                  onClick={actions.toggleRightPane}
                >
                  {state.rightPaneOpen ? "收起检查器" : "展开检查器"}
                </button>
                </div>
              </article>
            <EditorLeaferDebugPreferenceCard />
          </div>
        </section>
      ) : null}

      {state.workspaceSettingsTab === "shortcuts" ? (
        <section
          class="dialog-section"
          id={`${workspaceSettingsPanelIdPrefix}shortcuts`}
          role="tabpanel"
          aria-labelledby={`${workspaceSettingsTabIdPrefix}shortcuts`}
        >
          <div class="dialog-section__header">
            <div>
              <p class="workspace-pane__eyebrow">Shortcuts</p>
              <h3>快捷键与工作流</h3>
            </div>
          </div>
          <div class="shortcut-list">
            {shortcutItems.map((item) => (
              <article class="shortcut-item" key={item.id}>
                <div>
                  <h4>{item.label}</h4>
                  <p>{item.description}</p>
                </div>
                <kbd>{item.shortcut}</kbd>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </AppDialog>
  );
}

export function EditorRunConsoleDialog() {
  const { state, actions, workspaceDialogSize } = useEditorContext();
  const runConsoleTabIdPrefix = "run-console-tab-";
  const runConsolePanelIdPrefix = "run-console-panel-";

  return (
    <AppDialog
      open={state.runConsoleOpen}
      title="Run Console"
      description="图级运行链、失败聚合和焦点节点运行态统一移入这里，主界面只保留精简摘要。"
      size={workspaceDialogSize}
      onClose={() => {
        actions.closeRunConsole();
      }}
    >
      <div class="dialog-tabs" role="tablist" aria-label="运行控制台标签">
        {(
          [
            ["overview", "Overview"],
            ["chains", "Chains"],
            ["failures", "Failures"],
            ["node-runtime", "Node Runtime"]
          ] as const
        ).map(([tabId, label]) => (
          <button
            key={tabId}
            id={`${runConsoleTabIdPrefix}${tabId}`}
            type="button"
            role="tab"
            class="dialog-tab"
            data-active={state.runConsoleTab === tabId ? "true" : "false"}
            aria-selected={state.runConsoleTab === tabId ? "true" : "false"}
            aria-controls={`${runConsolePanelIdPrefix}${tabId}`}
            onClick={() => {
              actions.setRunConsoleTab(tabId);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        id={`${runConsolePanelIdPrefix}${state.runConsoleTab}`}
        role="tabpanel"
        aria-labelledby={`${runConsoleTabIdPrefix}${state.runConsoleTab}`}
      >
        <EditorRunConsoleBody />
      </div>
    </AppDialog>
  );
}

function EditorRunConsoleBody() {
  const { state } = useEditorContext();

  if (state.remoteRuntimeControlNotice) {
    return (
      <>
        <p
          class={
            state.remoteRuntimeControlNotice.tone === "error"
              ? "workspace-error"
              : "workspace-note"
          }
        >
          {state.remoteRuntimeControlNotice.message}
        </p>
        <EditorRunConsolePanels />
      </>
    );
  }

  return <EditorRunConsolePanels />;
}

function EditorRunConsolePanels() {
  const { state } = useEditorContext();

  if (!state.workspaceState) {
    return (
      <div class="workspace-empty-state">
        <h3>等待运行上下文</h3>
        <p>GraphViewport 完成挂载后，运行控制台会读取执行摘要与节点快照。</p>
      </div>
    );
  }

  const workspaceState = state.workspaceState;

  if (state.runConsoleTab === "overview") {
    return (
      <section class="dialog-section">
        <div class="run-console-grid">
          <article class="run-console-card">
            <p class="run-console-card__label">图级状态</p>
            <strong>{workspaceState.status.runtimeLabel}</strong>
            <span>Run {workspaceState.runtime.graphExecutionState.runId ?? "无"}</span>
          </article>
          <article class="run-console-card">
            <p class="run-console-card__label">焦点节点</p>
            <strong>{workspaceState.status.focusLabel}</strong>
            <span>{workspaceState.runtime.focus.focusMode}</span>
          </article>
          <article class="run-console-card">
            <p class="run-console-card__label">最近检查链</p>
            <strong>{workspaceState.runtime.latestChain?.rootNodeTitle ?? "暂无"}</strong>
            <span>
              {workspaceState.runtime.latestChain
                ? `${workspaceState.runtime.latestChain.stepCount} 步`
                : "等待新的执行链"}
            </span>
          </article>
          <article class="run-console-card">
            <p class="run-console-card__label">失败聚合</p>
            <strong>{workspaceState.runtime.failures.length}</strong>
            <span>最近失败节点数</span>
          </article>
        </div>
        <dl class="detail-grid">
          <WorkspaceField
            label="队列长度"
            value={String(workspaceState.runtime.graphExecutionState.queueSize)}
          />
          <WorkspaceField
            label="已推进步数"
            value={String(workspaceState.runtime.graphExecutionState.stepCount)}
          />
          <WorkspaceField
            label="最近推进"
            value={workspaceState.status.runtimeDetailLabel ?? "暂无"}
          />
          <WorkspaceField
            label="最近命令"
            value={workspaceState.status.lastCommandSummary ?? "无"}
          />
          <WorkspaceField
            label="最近成功"
            value={formatTimestamp(
              workspaceState.runtime.focus.executionState?.lastSucceededAt
            )}
          />
          <WorkspaceField
            label="最近失败"
            value={formatTimestamp(
              workspaceState.runtime.focus.executionState?.lastFailedAt
            )}
          />
          <WorkspaceField label="Document" value={workspaceState.status.documentLabel} />
        </dl>
        {workspaceState.runtime.latestErrorMessage ? (
          <p class="workspace-error">{workspaceState.runtime.latestErrorMessage}</p>
        ) : null}
      </section>
    );
  }

  if (state.runConsoleTab === "chains") {
    return (
      <section class="dialog-section">
        {workspaceState.runtime.recentChains.length ? (
          <div class="run-chain-list">
            {workspaceState.runtime.recentChains.map((chain) => (
              <article class="run-chain-card" key={chain.chainId}>
                <header class="run-chain-card__header">
                  <div>
                    <h4>{chain.rootNodeTitle}</h4>
                    <p>
                      {chain.rootNodeType ?? "未知类型"} · 最近于{" "}
                      {formatTimestamp(chain.finishedAt)}
                    </p>
                  </div>
                  <span class="titlebar-status-pill" data-status={chain.status}>
                    {chain.status}
                  </span>
                </header>
                <p class="run-chain-card__summary">
                  {chain.stepCount} 步 · 最深 {chain.maxDepth} 层 · 主动{" "}
                  {chain.directCount} 次 · 传播 {chain.propagatedCount} 次 ·{" "}
                  {formatDuration(chain.startedAt, chain.finishedAt)}
                </p>
                <ul class="run-chain-card__steps">
                  {chain.entries.map((entry) => (
                    <li key={`${chain.chainId}:${entry.id}`}>
                      <strong>
                        {entry.sequence + 1}. {entry.nodeTitle}
                      </strong>
                      <span>
                        {entry.status} · {formatTimestamp(entry.timestamp)}
                      </span>
                      <p>{entry.summary}</p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <div class="workspace-empty-state">
            <h3>当前还没有执行链</h3>
            <p>先使用顶栏 Play / Step，或从节点菜单里直接起跑一个节点。</p>
          </div>
        )}
      </section>
    );
  }

  if (state.runConsoleTab === "failures") {
    return (
      <section class="dialog-section">
        {workspaceState.runtime.failures.length ? (
          <div class="run-chain-list">
            {workspaceState.runtime.failures.map((failure) => (
              <article class="run-chain-card" key={failure.nodeId}>
                <header class="run-chain-card__header">
                  <div>
                    <h4>{failure.nodeTitle}</h4>
                    <p>
                      {failure.nodeType ?? "未知类型"} · 最近于{" "}
                      {formatTimestamp(failure.latestTimestamp)}
                    </p>
                  </div>
                  <span class="titlebar-status-pill" data-status="error">
                    失败
                  </span>
                </header>
                <p class="run-chain-card__summary">累计失败 {failure.failureCount} 次</p>
                {failure.latestErrorMessage ? (
                  <pre class="inspector-code">{failure.latestErrorMessage}</pre>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div class="workspace-empty-state">
            <h3>当前没有失败聚合</h3>
            <p>运行控制台会在检测到 error 后自动保留最近失败节点摘要。</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section class="dialog-section">
      {workspaceState.runtime.focusNode ? (
        <>
          <div class="dialog-section__header">
            <div>
              <p class="workspace-pane__eyebrow">Node Runtime</p>
              <h3>{workspaceState.runtime.focusNode.title}</h3>
            </div>
            <span class="titlebar__document-chip">
              {workspaceState.runtime.focusNode.type}
            </span>
          </div>
          <dl class="detail-grid">
            <WorkspaceField
              label="位置"
              value={`${workspaceState.runtime.focusNode.layout.x}, ${workspaceState.runtime.focusNode.layout.y}`}
            />
            <WorkspaceField
              label="尺寸"
              value={`${workspaceState.runtime.focusNode.layout.width ?? "auto"} × ${workspaceState.runtime.focusNode.layout.height ?? "auto"}`}
            />
            <WorkspaceField
              label="执行次数"
              value={String(workspaceState.runtime.focusNode.executionState.runCount)}
            />
            <WorkspaceField
              label="最近成功"
              value={formatTimestamp(
                workspaceState.runtime.focusNode.executionState.lastSucceededAt
              )}
            />
            <WorkspaceField
              label="最近失败"
              value={formatTimestamp(
                workspaceState.runtime.focusNode.executionState.lastFailedAt
              )}
            />
            <WorkspaceField
              label="Inputs"
              value={String(workspaceState.runtime.focusNode.inputs.length)}
            />
          </dl>
          <div class="run-console-node-grid">
            <article class="run-console-card run-console-card--code">
              <p class="run-console-card__label">Flags</p>
              <pre class="inspector-code">
                {formatJson(workspaceState.runtime.focusNode.flags)}
              </pre>
            </article>
            <article class="run-console-card run-console-card--code">
              <p class="run-console-card__label">Properties</p>
              <pre class="inspector-code">
                {formatJson(workspaceState.runtime.focusNode.properties)}
              </pre>
            </article>
            <article class="run-console-card run-console-card--code">
              <p class="run-console-card__label">Inputs</p>
              <pre class="inspector-code">
                {formatJson(workspaceState.runtime.focusNode.inputs)}
              </pre>
            </article>
            <article class="run-console-card run-console-card--code">
              <p class="run-console-card__label">Outputs</p>
              <pre class="inspector-code">
                {formatJson(workspaceState.runtime.focusNode.outputs)}
              </pre>
            </article>
          </div>
        </>
      ) : (
        <div class="workspace-empty-state">
          <h3>当前没有焦点节点</h3>
          <p>先选中一个节点，或触发一次节点执行，控制台会显示焦点节点运行态。</p>
        </div>
      )}
    </section>
  );
}

export function EditorShell(_: EditorShellProps) {
  const { state } = useEditorContext();

  return (
    <div
      class="app-shell"
      data-theme={state.theme}
      data-adaptive={state.workspaceAdaptiveMode}
      data-left-open={state.leftPaneOpen ? "true" : "false"}
      data-right-open={state.rightPaneOpen ? "true" : "false"}
      data-stage-layout={state.stageLayout}
    >
      <a class="skip-link" href="#editor-main-canvas">
        跳到主画布
      </a>
      <EditorTitlebar />
      <EditorWorkspace />
      <EditorStatusbar />
      <EditorWorkspaceSettingsDialog />
      <EditorRunConsoleDialog />
    </div>
  );
}

export function App(props: AppProps) {
  const controller = useMemo(
    () => createEditorController(props),
    [
      props.onViewportHostBridgeChange,
      props.preloadedBundles,
      props.remoteAuthoritySource
    ]
  );

  return (
    <EditorErrorBoundary>
      <EditorProvider controller={controller}>
        <EditorShell />
      </EditorProvider>
    </EditorErrorBoundary>
  );
}
