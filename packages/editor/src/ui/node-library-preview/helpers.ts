/**
 * 节点库预览辅助模块。
 *
 * @remarks
 * 负责 hover/focus 预览请求、预览文档构造、浮层落点和能力判定等纯工具逻辑。
 */
import type { GraphDocument } from "leafergraph";
import type { NodeDefinition } from "@leafergraph/node";

import type { WorkspaceAdaptiveMode } from "../../shell/layout/workspace_adaptive";

/** 节点库预览浮层使用的标准锚点矩形。 */
export interface NodeLibraryPreviewAnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** 一次节点库预览请求的最小输入。 */
export interface NodeLibraryPreviewRequest {
  definition: NodeDefinition;
  anchorRect: NodeLibraryPreviewAnchorRect;
  source: "hover" | "focus";
}

/** 判断当前设备是否适合启用 hover 预览时需要的能力输入。 */
export interface NodeLibraryHoverPreviewCapabilityOptions {
  adaptiveMode: WorkspaceAdaptiveMode;
  supportsHover: boolean;
  hasFinePointer: boolean;
}

/** 计算节点库预览浮层落点时需要的几何输入。 */
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

/** 节点库预览浮层最终应落到的页面位置。 */
export interface NodeLibraryPreviewPlacement {
  top: number;
  left: number;
  side: "left" | "right";
}

/** 节点库预览专用文档 ID。 */
export const NODE_LIBRARY_PREVIEW_DOCUMENT_ID = "node-library-preview";
/** 节点库预览专用节点 ID。 */
export const NODE_LIBRARY_PREVIEW_NODE_ID = "node-library-preview-node";
/** 节点库 hover 预览浮层的固定画布尺寸。 */
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

/** 把 DOMRect 归一化为预览浮层内部统一使用的锚点结构。 */
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

/** 根据节点定义和锚点元素创建一条标准预览请求。 */
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

/** 生成节点库预览专用的最小 GraphDocument。 */
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

/** 根据锚点和视口几何，计算浮层应落到左侧还是右侧。 */
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

/** 根据断点和输入设备能力判断是否启用 hover 预览。 */
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
