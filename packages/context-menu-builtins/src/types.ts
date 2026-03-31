import type {
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphSelectionUpdateMode
} from "@leafergraph/contracts";
import type {
  GraphLink,
  NodeDefinition,
  NodeRuntimeState,
  NodeSerializeResult
} from "@leafergraph/node";
import type {
  LeaferContextMenu,
  LeaferContextMenuContext,
  LeaferContextMenuResolver
} from "@leafergraph/context-menu";

export interface LeaferGraphContextMenuClipboardFragment {
  nodes: NodeSerializeResult[];
  links: GraphLink[];
}

export interface LeaferGraphContextMenuClipboardState {
  getFragment(): LeaferGraphContextMenuClipboardFragment | null;
  setFragment(fragment: LeaferGraphContextMenuClipboardFragment | null): void;
  clear(): void;
  hasFragment(): boolean;
}

export type LeaferGraphContextMenuBuiltinActionId =
  | "graph.copy"
  | "graph.cut"
  | "graph.paste"
  | "graph.duplicate"
  | "graph.select-all"
  | "graph.delete-selection"
  | "graph.undo"
  | "graph.redo";

export interface LeaferGraphContextMenuBuiltinHistoryHost {
  undo(): boolean;
  redo(): boolean;
  canUndo?(): boolean;
  canRedo?(): boolean;
}

export type LeaferGraphContextMenuBuiltinFeatureToggle =
  | boolean
  | {
      enabled?: boolean;
    };

export interface LeaferGraphContextMenuBuiltinFeatureFlags {
  canvasAddNode?: LeaferGraphContextMenuBuiltinFeatureToggle;
  canvasPaste?: LeaferGraphContextMenuBuiltinFeatureToggle;
  canvasControls?: LeaferGraphContextMenuBuiltinFeatureToggle;
  canvasUndo?: LeaferGraphContextMenuBuiltinFeatureToggle;
  canvasRedo?: LeaferGraphContextMenuBuiltinFeatureToggle;
  canvasSelectAll?: LeaferGraphContextMenuBuiltinFeatureToggle;
  canvasDeleteSelection?: LeaferGraphContextMenuBuiltinFeatureToggle;
  nodeRunFromHere?: LeaferGraphContextMenuBuiltinFeatureToggle;
  nodeCopy?: LeaferGraphContextMenuBuiltinFeatureToggle;
  nodeCut?: LeaferGraphContextMenuBuiltinFeatureToggle;
  nodeDuplicate?: LeaferGraphContextMenuBuiltinFeatureToggle;
  nodeDelete?: LeaferGraphContextMenuBuiltinFeatureToggle;
  linkDelete?: LeaferGraphContextMenuBuiltinFeatureToggle;
}

export interface LeaferGraphContextMenuBuiltinsHost {
  listNodes(): readonly NodeDefinition[];
  listNodeIds?(): readonly string[];
  getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined;
  findLinksByNode(nodeId: string): readonly GraphLink[];
  isNodeSelected(nodeId: string): boolean;
  listSelectedNodeIds(): string[];
  setSelectedNodeIds(
    nodeIds: readonly string[],
    mode?: LeaferGraphSelectionUpdateMode
  ): string[];
  createNode(
    input: LeaferGraphCreateNodeInput,
    context: LeaferContextMenuContext
  ): NodeRuntimeState;
  createLink(
    input: LeaferGraphCreateLinkInput,
    context: LeaferContextMenuContext
  ): GraphLink;
  play(context: LeaferContextMenuContext): void;
  step(context: LeaferContextMenuContext): void;
  stop(context: LeaferContextMenuContext): void;
  fitView(context: LeaferContextMenuContext): void;
  playFromNode(nodeId: string, context: LeaferContextMenuContext): void;
  removeNode(nodeId: string, context: LeaferContextMenuContext): void;
  removeNodes?(
    nodeIds: readonly string[],
    context: LeaferContextMenuContext
  ): void;
  removeLink(linkId: string, context: LeaferContextMenuContext): void;
}

export interface LeaferGraphContextMenuBuiltinOptions {
  host: LeaferGraphContextMenuBuiltinsHost;
  features?: LeaferGraphContextMenuBuiltinFeatureFlags;
  clipboard?: LeaferGraphContextMenuClipboardState;
  history?: LeaferGraphContextMenuBuiltinHistoryHost;
  resolveShortcutLabel?(
    actionId: LeaferGraphContextMenuBuiltinActionId
  ): string | undefined;
  pasteOffset?: {
    x: number;
    y: number;
  };
}

export interface LeaferGraphContextMenuBuiltinFeatureRegistrationContext {
  menu: LeaferContextMenu;
  host: LeaferGraphContextMenuBuiltinsHost;
  clipboard: LeaferGraphContextMenuClipboardState;
  history?: LeaferGraphContextMenuBuiltinHistoryHost;
  options: LeaferGraphContextMenuBuiltinOptions;
  registerResolver(
    key: string,
    resolver: LeaferContextMenuResolver
  ): () => void;
  resolveShortcutLabel(
    actionId: LeaferGraphContextMenuBuiltinActionId
  ): string | undefined;
  createNode(
    input: LeaferGraphCreateNodeInput,
    context: LeaferContextMenuContext
  ): NodeRuntimeState;
  createLink(
    input: LeaferGraphCreateLinkInput,
    context: LeaferContextMenuContext
  ): GraphLink;
  play(context: LeaferContextMenuContext): void;
  step(context: LeaferContextMenuContext): void;
  stop(context: LeaferContextMenuContext): void;
  fitView(context: LeaferContextMenuContext): void;
  playFromNode(nodeId: string, context: LeaferContextMenuContext): void;
  removeNode(nodeId: string, context: LeaferContextMenuContext): void;
  removeNodes(nodeIds: readonly string[], context: LeaferContextMenuContext): void;
  removeLink(linkId: string, context: LeaferContextMenuContext): void;
}

export interface LeaferGraphContextMenuBuiltinFeatureDefinition {
  id: keyof LeaferGraphContextMenuBuiltinFeatureFlags;
  register(
    context: LeaferGraphContextMenuBuiltinFeatureRegistrationContext
  ): () => void;
}
