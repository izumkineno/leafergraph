import type { GraphLink, NodeRuntimeState, NodeSerializeResult } from "@leafergraph/node";
import type { LeaferGraph, LeaferGraphCreateNodeInput } from "leafergraph";
import type {
  LeaferContextMenu,
  LeaferContextMenuContext,
  LeaferContextMenuResolver
} from "../leafer_context_menu";

export interface LeaferContextMenuClipboardFragment {
  nodes: NodeSerializeResult[];
  links: GraphLink[];
}

export interface LeaferContextMenuClipboardState {
  getFragment(): LeaferContextMenuClipboardFragment | null;
  setFragment(fragment: LeaferContextMenuClipboardFragment | null): void;
  clear(): void;
  hasFragment(): boolean;
}

export type LeaferContextMenuBuiltinFeatureToggle =
  | boolean
  | {
      enabled?: boolean;
    };

export interface LeaferContextMenuBuiltinFeatureFlags {
  canvasAddNode?: LeaferContextMenuBuiltinFeatureToggle;
  canvasPaste?: LeaferContextMenuBuiltinFeatureToggle;
  canvasControls?: LeaferContextMenuBuiltinFeatureToggle;
  nodeRunFromHere?: LeaferContextMenuBuiltinFeatureToggle;
  nodeCopy?: LeaferContextMenuBuiltinFeatureToggle;
  nodeDelete?: LeaferContextMenuBuiltinFeatureToggle;
  linkDelete?: LeaferContextMenuBuiltinFeatureToggle;
}

export interface LeaferContextMenuBuiltinOptions {
  graph: LeaferGraph;
  features: LeaferContextMenuBuiltinFeatureFlags;
  clipboard?: LeaferContextMenuClipboardState;
  play?(context: LeaferContextMenuContext): void;
  step?(context: LeaferContextMenuContext): void;
  stop?(context: LeaferContextMenuContext): void;
  fitView?(context: LeaferContextMenuContext): void;
  playFromNode?(nodeId: string, context: LeaferContextMenuContext): void;
  createLink?(
    input: Parameters<LeaferGraph["createLink"]>[0],
    context: LeaferContextMenuContext
  ): GraphLink;
  removeNode?(nodeId: string, context: LeaferContextMenuContext): void;
  removeNodes?(
    nodeIds: readonly string[],
    context: LeaferContextMenuContext
  ): void;
  removeLink?(linkId: string, context: LeaferContextMenuContext): void;
  nodeFactory?(
    input: LeaferGraphCreateNodeInput,
    context: LeaferContextMenuContext
  ): NodeRuntimeState;
  pasteOffset?: {
    x: number;
    y: number;
  };
}

export interface LeaferContextMenuBuiltinFeatureRegistrationContext {
  menu: LeaferContextMenu;
  graph: LeaferGraph;
  clipboard: LeaferContextMenuClipboardState;
  options: LeaferContextMenuBuiltinOptions;
  registerResolver(
    key: string,
    resolver: LeaferContextMenuResolver
  ): () => void;
  createNode(
    input: LeaferGraphCreateNodeInput,
    context: LeaferContextMenuContext
  ): NodeRuntimeState;
  createLink(
    input: Parameters<LeaferGraph["createLink"]>[0],
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
  createDefaultNodeProjection?(type: string): {
    title: string;
    category: string;
    description?: string;
  };
}

export interface LeaferContextMenuBuiltinFeatureDefinition {
  id: keyof LeaferContextMenuBuiltinFeatureFlags;
  register(
    context: LeaferContextMenuBuiltinFeatureRegistrationContext
  ): () => void;
}
