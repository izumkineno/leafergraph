import { describe, expect, test } from "bun:test";
import type { NodeDefinition } from "@leafergraph/node";

import {
  NODE_LIBRARY_HOVER_PREVIEW_SIZE,
  NODE_LIBRARY_PREVIEW_DOCUMENT_ID,
  NODE_LIBRARY_PREVIEW_NODE_ID,
  createNodeLibraryPreviewDocument,
  resolveNodeLibraryPreviewPlacement,
  shouldEnableNodeLibraryHoverPreview
} from "../src/ui/node-library-preview/helpers";

function createAnchorRect(overrides?: Partial<DOMRect>): DOMRect {
  return {
    top: 260,
    left: 180,
    right: 260,
    bottom: 308,
    width: 80,
    height: 48,
    x: 180,
    y: 260,
    toJSON() {
      return this;
    },
    ...overrides
  } as DOMRect;
}

describe("node library hover preview helpers", () => {
  test("应生成稳定的单节点预览文档", () => {
    const definition: NodeDefinition = {
      type: "demo/math/add",
      title: "Add",
      category: "Math/Basic",
      description: "把两个输入相加。",
      size: [280, 160],
      inputs: [{ name: "a", type: "number", label: "A" }],
      outputs: [{ name: "sum", type: "number", label: "Result" }],
      properties: [
        {
          name: "precision",
          type: "number",
          default: 2
        }
      ],
      widgets: [
        {
          type: "slider",
          name: "gain",
          value: 0.5,
          options: {
            min: 0,
            max: 1,
            step: 0.1
          }
        }
      ]
    };

    const previewDocument = createNodeLibraryPreviewDocument(definition);
    const previewNode = previewDocument.nodes[0];
    if (!previewNode) {
      throw new Error("预览文档缺少节点");
    }

    expect(previewDocument.documentId).toBe(NODE_LIBRARY_PREVIEW_DOCUMENT_ID);
    expect(previewDocument.revision).toBe("preview:demo/math/add");
    expect(previewDocument.appKind).toBe("leafergraph-node-library-preview");
    expect(previewDocument.links).toEqual([]);
    expect(previewNode.id).toBe(NODE_LIBRARY_PREVIEW_NODE_ID);
    expect(previewNode.type).toBe(definition.type);
    expect(previewNode.title).toBe("Add");
    expect(previewNode.layout).toEqual({
      x: 96,
      y: 72,
      width: 280,
      height: 160
    });
    expect(previewNode.inputs).toEqual(definition.inputs);
    expect(previewNode.outputs).toEqual(definition.outputs);
    expect(previewNode.propertySpecs).toEqual(definition.properties);
    expect(previewNode.widgets).toEqual(definition.widgets);
    expect(previewNode.inputs).not.toBe(definition.inputs);
    expect(previewNode.outputs).not.toBe(definition.outputs);
    expect(previewNode.propertySpecs).not.toBe(definition.properties);
    expect(previewNode.widgets).not.toBe(definition.widgets);
  });

  test("右侧空间足够时应优先摆在右侧", () => {
    const placement = resolveNodeLibraryPreviewPlacement({
      anchorRect: createAnchorRect(),
      viewportRect: createAnchorRect({
        top: 0,
        left: 0,
        right: 1280,
        bottom: 800,
        width: 1280,
        height: 800,
        x: 0,
        y: 0
      }),
      previewSize: NODE_LIBRARY_HOVER_PREVIEW_SIZE
    });

    expect(placement).toEqual({
      side: "right",
      left: 276,
      top: 118
    });
  });

  test("右侧空间不足时应翻到左侧，并把上下位置夹回视口", () => {
    const placement = resolveNodeLibraryPreviewPlacement({
      anchorRect: createAnchorRect({
        top: 620,
        bottom: 668,
        left: 1160,
        right: 1240,
        x: 1160,
        y: 620
      }),
      viewportRect: createAnchorRect({
        top: 0,
        left: 0,
        right: 1280,
        bottom: 800,
        width: 1280,
        height: 800,
        x: 0,
        y: 0
      }),
      previewSize: NODE_LIBRARY_HOVER_PREVIEW_SIZE
    });

    expect(placement).toEqual({
      side: "left",
      left: 784,
      top: 456
    });
  });

  test("只在桌面精细指针 hover 环境下启用自动预览", () => {
    expect(
      shouldEnableNodeLibraryHoverPreview({
        adaptiveMode: "wide-desktop",
        supportsHover: true,
        hasFinePointer: true
      })
    ).toBe(true);

    expect(
      shouldEnableNodeLibraryHoverPreview({
        adaptiveMode: "compact-desktop",
        supportsHover: true,
        hasFinePointer: true
      })
    ).toBe(true);

    expect(
      shouldEnableNodeLibraryHoverPreview({
        adaptiveMode: "tablet",
        supportsHover: true,
        hasFinePointer: true
      })
    ).toBe(false);

    expect(
      shouldEnableNodeLibraryHoverPreview({
        adaptiveMode: "mobile",
        supportsHover: true,
        hasFinePointer: true
      })
    ).toBe(false);

    expect(
      shouldEnableNodeLibraryHoverPreview({
        adaptiveMode: "wide-desktop",
        supportsHover: false,
        hasFinePointer: true
      })
    ).toBe(false);

    expect(
      shouldEnableNodeLibraryHoverPreview({
        adaptiveMode: "wide-desktop",
        supportsHover: true,
        hasFinePointer: false
      })
    ).toBe(false);
  });
});
