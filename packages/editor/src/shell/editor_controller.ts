import type { GraphDocument } from "leafergraph";
import type { NodeDefinition } from "@leafergraph/node";

import type {
  GraphViewportHostBridge,
  GraphViewportRuntimeControlsState,
  GraphViewportToolbarControlsState,
  GraphViewportWorkspaceState
} from "../ui/viewport";
import type { DefaultEntryOnboardingState } from "./onboarding/default_entry_onboarding";
import type { EditorAppBootstrapPreloadedBundle } from "../app/editor_app_bootstrap";
import type { NodeLibraryPreviewRequest } from "../ui/node-library-preview/helpers";
import type { EditorRemoteAuthorityAppSource } from "../backend/authority/remote_authority_app_runtime";
import type { GraphViewportRemoteRuntimeControlNotice } from "../ui/viewport/runtime_control_notice";
import type { EditorTheme } from "../theme";
import type {
  EditorBundleCatalogState,
  EditorBundleSlot
} from "../loader/types";
import { createInitialBundleCatalogState } from "../loader/runtime";
import type { EditorRemoteAuthorityConnectionStatus } from "../session/graph_document_authority_client";
import type {
  EditorGraphDocumentResyncOptions
} from "../session/graph_document_session";
import type {
  WorkspaceAdaptiveMode,
  WorkspacePanePresentation,
  WorkspaceStageLayout
} from "./layout/workspace_adaptive";

export type RemoteAuthorityRuntimeStatus =
  | "disabled"
  | "idle"
  | "loading"
  | "ready"
  | "error";

export type RemoteAuthorityConnectionDisplayStatus =
  | "idle"
  | EditorRemoteAuthorityConnectionStatus;

export type WorkspaceSettingsTab =
  | "extensions"
  | "authority"
  | "preferences"
  | "shortcuts";

export type RunConsoleTab = "overview" | "chains" | "failures" | "node-runtime";

export interface CreateEditorControllerOptions {
  preloadedBundles?: readonly EditorAppBootstrapPreloadedBundle[];
  remoteAuthoritySource?: EditorRemoteAuthorityAppSource;
  onViewportHostBridgeChange?(bridge: GraphViewportHostBridge | null): void;
}

export interface EditorControllerState {
  theme: EditorTheme;
  workspaceAdaptiveMode: WorkspaceAdaptiveMode;
  leftPaneOpen: boolean;
  rightPaneOpen: boolean;
  workspaceMenuOpen: boolean;
  workspaceSettingsOpen: boolean;
  runConsoleOpen: boolean;
  workspaceSettingsTab: WorkspaceSettingsTab;
  runConsoleTab: RunConsoleTab;
  nodeLibrarySearchQuery: string;
  activeLibraryNodeType: string | null;
  availableNodeDefinitions: readonly NodeDefinition[];
  nodeLibraryPreviewRequest: NodeLibraryPreviewRequest | null;
  bundleCatalog: EditorBundleCatalogState;
  remoteAuthorityStatus: RemoteAuthorityRuntimeStatus;
  remoteAuthorityError: string | null;
  remoteAuthorityConnectionStatus: RemoteAuthorityConnectionDisplayStatus;
  remoteAuthorityDocument: GraphDocument | null;
  remoteAuthorityPendingOperationIds: readonly string[];
  remoteAuthorityLastIssue: string | null;
  remoteRuntimeControlNotice: GraphViewportRemoteRuntimeControlNotice | null;
  remoteAuthorityResyncing: boolean;
  graphRuntimeControls: GraphViewportRuntimeControlsState | null;
  editorToolbarControls: GraphViewportToolbarControlsState | null;
  workspaceState: GraphViewportWorkspaceState | null;
  leftPanePresentation: WorkspacePanePresentation;
  rightPanePresentation: WorkspacePanePresentation;
  stageLayout: WorkspaceStageLayout;
  canPlayGraph: boolean;
  canStepGraph: boolean;
  canStopGraph: boolean;
  isRemoteAuthorityEnabled: boolean;
  defaultEntryOnboardingState: DefaultEntryOnboardingState;
}

export interface EditorControllerActions {
  setTheme(theme: EditorTheme): void;
  toggleTheme(): void;
  setWorkspaceMenuOpen(open: boolean): void;
  openLeftPane(): void;
  openRightPane(): void;
  toggleLeftPane(): void;
  toggleRightPane(): void;
  closeOverlayPanes(): void;
  openWorkspaceSettings(tab?: WorkspaceSettingsTab): void;
  closeWorkspaceSettings(): void;
  setWorkspaceSettingsTab(tab: WorkspaceSettingsTab): void;
  openRunConsole(tab?: RunConsoleTab): void;
  closeRunConsole(): void;
  setRunConsoleTab(tab: RunConsoleTab): void;
  setNodeLibrarySearchQuery(value: string): void;
  setActiveLibraryNodeType(nodeType: string | null): void;
  setNodeLibraryPreviewRequest(request: NodeLibraryPreviewRequest | null): void;
  loadBundleFiles(slot: EditorBundleSlot, files: readonly File[]): Promise<void>;
  toggleBundleRecord(slot: EditorBundleSlot, bundleKey: string): void;
  unloadBundleRecord(slot: EditorBundleSlot, bundleKey: string): void;
  activateDemoBundle(bundleKey: string): Promise<void>;
  createNodeFromWorkspace(nodeType: string): void;
  openNodeAuthorityDemo(): void;
  openPythonAuthorityDemo(): void;
  reloadRemoteAuthority(): void;
  resyncRemoteAuthority(
    options?: EditorGraphDocumentResyncOptions
  ): Promise<GraphDocument | null>;
  playGraph(): void;
  stepGraph(): void;
  stopGraph(): void;
}

export interface EditorController {
  getOptions(): Readonly<CreateEditorControllerOptions>;
  getState(): EditorControllerState;
  subscribe(listener: (state: EditorControllerState) => void): () => void;
  readonly actions: EditorControllerActions;
}

interface InternalEditorController extends EditorController {
  __update(
    state: EditorControllerState,
    actions: EditorControllerActions
  ): void;
}

function createInitialEditorControllerState(
  options: CreateEditorControllerOptions
): EditorControllerState {
  return {
    theme: "dark",
    workspaceAdaptiveMode: "wide-desktop",
    leftPaneOpen: true,
    rightPaneOpen: true,
    workspaceMenuOpen: false,
    workspaceSettingsOpen: false,
    runConsoleOpen: false,
    workspaceSettingsTab: "extensions",
    runConsoleTab: "overview",
    nodeLibrarySearchQuery: "",
    activeLibraryNodeType: null,
    availableNodeDefinitions: [],
    nodeLibraryPreviewRequest: null,
    bundleCatalog: createInitialBundleCatalogState(),
    remoteAuthorityStatus: options.remoteAuthoritySource ? "idle" : "disabled",
    remoteAuthorityError: null,
    remoteAuthorityConnectionStatus: "idle",
    remoteAuthorityDocument: null,
    remoteAuthorityPendingOperationIds: [],
    remoteAuthorityLastIssue: null,
    remoteRuntimeControlNotice: null,
    remoteAuthorityResyncing: false,
    graphRuntimeControls: null,
    editorToolbarControls: null,
    workspaceState: null,
    leftPanePresentation: "docked",
    rightPanePresentation: "docked",
    stageLayout: "dual-docked",
    canPlayGraph: false,
    canStepGraph: false,
    canStopGraph: false,
    isRemoteAuthorityEnabled: Boolean(options.remoteAuthoritySource),
    defaultEntryOnboardingState: {
      isCleanEntryMode: !options.remoteAuthoritySource,
      showStageOnboarding: !options.remoteAuthoritySource,
      showNodeLibraryHint: !options.remoteAuthoritySource,
      showExtensionsQuickActions: !options.remoteAuthoritySource
    }
  };
}

function createNoopActions(): EditorControllerActions {
  return {
    setTheme() {},
    toggleTheme() {},
    setWorkspaceMenuOpen() {},
    openLeftPane() {},
    openRightPane() {},
    toggleLeftPane() {},
    toggleRightPane() {},
    closeOverlayPanes() {},
    openWorkspaceSettings() {},
    closeWorkspaceSettings() {},
    setWorkspaceSettingsTab() {},
    openRunConsole() {},
    closeRunConsole() {},
    setRunConsoleTab() {},
    setNodeLibrarySearchQuery() {},
    setActiveLibraryNodeType() {},
    setNodeLibraryPreviewRequest() {},
    async loadBundleFiles() {},
    toggleBundleRecord() {},
    unloadBundleRecord() {},
    async activateDemoBundle() {},
    createNodeFromWorkspace() {},
    openNodeAuthorityDemo() {},
    openPythonAuthorityDemo() {},
    reloadRemoteAuthority() {},
    async resyncRemoteAuthority() {
      return null;
    },
    playGraph() {},
    stepGraph() {},
    stopGraph() {}
  };
}

export function createEditorController(
  options: CreateEditorControllerOptions = {}
): EditorController {
  const listeners = new Set<(state: EditorControllerState) => void>();
  let currentState = createInitialEditorControllerState(options);
  let currentActions = createNoopActions();

  const controller: InternalEditorController = {
    getOptions() {
      return options;
    },
    getState() {
      return currentState;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get actions() {
      return currentActions;
    },
    __update(state, actions) {
      currentState = state;
      currentActions = actions;
      for (const listener of listeners) {
        listener(currentState);
      }
    }
  };

  return controller;
}

export function syncEditorController(
  controller: EditorController,
  state: EditorControllerState,
  actions: EditorControllerActions
): void {
  (controller as InternalEditorController).__update(state, actions);
}
