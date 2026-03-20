import type { GraphDocument } from "leafergraph";
import type { NodeDefinition } from "@leafergraph/node";

import type { WorkspaceAdaptiveMode } from "../../shell/layout/workspace_adaptive";

export interface NodeLibraryPreviewAnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface NodeLibraryPreviewRequest {
  definition: NodeDefinition;
  anchorRect: NodeLibraryPreviewAnchorRect;
  source: "hover" | "focus";
}

export interface NodeLibraryHoverPreviewCapabilityOptions {
  adaptiveMode: WorkspaceAdaptiveMode;
  supportsHover: boolean;
  hasFinePointer: boolean;
}

export interface NodeLibraryPreviewPlacementOptions {
  anchorRect: NodeLibraryPreviewAnchorRect;
  viewportRect: NodeLibraryPreviewAnchorRect;
  previewSize: {
    width: number;
    height: number;
  };
  gap?: number;
  margin?: number;
}

export interface NodeLibraryPreviewPlacement {
  top: number;
  left: number;
  side: "left" | "right";
}

export const NODE_LIBRARY_PREVIEW_DOCUMENT_ID = "node-library-preview";
export const NODE_LIBRARY_PREVIEW_NODE_ID = "node-library-preview-node";
export const NODE_LIBRARY_HOVER_PREVIEW_SIZE = {
  width: 360,
  height: 332
} as const;

function clamp(value: number, min: number, max: number): number {
  if (max <= min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

export function normalizeNodeLibraryPreviewAnchorRect(
  rect: Pick<DOMRect, "top" | "left" | "right" | "bottom" | "width" | "height">
): NodeLibraryPreviewAnchorRect {
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height
  };
}

export function createNodeLibraryPreviewRequest(
  definition: NodeDefinition,
  anchorElement: Element,
  source: NodeLibraryPreviewRequest["source"]
): NodeLibraryPreviewRequest {
  return {
    definition,
    anchorRect: normalizeNodeLibraryPreviewAnchorRect(
      anchorElement.getBoundingClientRect()
    ),
    source
  };
}

export function createNodeLibraryPreviewDocument(
  definition: NodeDefinition
): GraphDocument {
  return {
    documentId: NODE_LIBRARY_PREVIEW_DOCUMENT_ID,
    revision: `preview:${definition.type}`,
    appKind: "leafergraph-node-library-preview",
    nodes: [
      {
        id: NODE_LIBRARY_PREVIEW_NODE_ID,
        type: definition.type,
        title: definition.title ?? definition.type,
        layout: {
          x: 96,
          y: 72,
          width: definition.size?.[0],
          height: definition.size?.[1]
        },
        properties: {},
        propertySpecs: structuredClone(definition.properties ?? []),
        inputs: structuredClone(definition.inputs ?? []),
        outputs: structuredClone(definition.outputs ?? []),
        widgets: structuredClone(definition.widgets ?? []),
        flags: {}
      }
    ],
    links: []
  };
}

export function resolveNodeLibraryPreviewPlacement(
  options: NodeLibraryPreviewPlacementOptions
): NodeLibraryPreviewPlacement {
  const gap = options.gap ?? 16;
  const margin = options.margin ?? 12;
  const { anchorRect, viewportRect, previewSize } = options;
  const viewportLeft = viewportRect.left + margin;
  const viewportRight = viewportRect.right - margin;
  const viewportTop = viewportRect.top + margin;
  const viewportBottom = viewportRect.bottom - margin;
  const availableRight = viewportRight - anchorRect.right - gap;
  const availableLeft = anchorRect.left - viewportLeft - gap;
  const side =
    availableRight >= previewSize.width || availableRight >= availableLeft
      ? "right"
      : "left";
  const preferredLeft =
    side === "right"
      ? anchorRect.right + gap
      : anchorRect.left - gap - previewSize.width;
  const preferredTop =
    anchorRect.top + (anchorRect.height - previewSize.height) / 2;

  return {
    side,
    left: clamp(
      preferredLeft,
      viewportLeft,
      viewportRight - previewSize.width
    ),
    top: clamp(
      preferredTop,
      viewportTop,
      viewportBottom - previewSize.height
    )
  };
}

export function shouldEnableNodeLibraryHoverPreview(
  options: NodeLibraryHoverPreviewCapabilityOptions
): boolean {
  if (
    options.adaptiveMode !== "wide-desktop" &&
    options.adaptiveMode !== "compact-desktop"
  ) {
    return false;
  }

  return options.supportsHover && options.hasFinePointer;
}
