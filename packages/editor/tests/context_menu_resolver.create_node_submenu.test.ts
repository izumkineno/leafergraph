import { describe, expect, test } from "bun:test";

import type {
  LeaferGraph,
  LeaferGraphContextMenuContext
} from "leafergraph";
import { createEditorContextMenuResolver } from "../src/menu/context_menu_resolver";
import type {
  EditorCommandBus,
  EditorCommandRequest
} from "../src/commands/command_bus";
import type { EditorNodeSelectionController } from "../src/state/selection";

function createSelectionStub(): EditorNodeSelectionController {
  return {
    primarySelectedNodeId: null,
    selectedNodeId: null,
    selectedNodeIds: [],
    isSelected() {
      return false;
    },
    hasMultipleSelected() {
      return false;
    },
    setMany(): void {},
    select(): void {},
    add(): void {},
    remove(): void {},
    toggle(): void {},
    clear(): void {},
    clearIfContains(): void {},
    subscribe(): () => void {
      return () => {};
    }
  };
}

function createGraphStub(): LeaferGraph {
  return {
    listNodes() {
      return [
        {
          type: "system.math.add",
          title: "Add",
          category: "System/Math"
        },
        {
          type: "system.math.sub",
          title: "Sub",
          category: "System/Math"
        },
        {
          type: "ai.prompt",
          title: "Prompt",
          category: "AI"
        },
        {
          type: "misc.node",
          title: "Misc"
        }
      ];
    }
  } as unknown as LeaferGraph;
}

describe("editor context menu resolver", () => {
  test("画布菜单应按 category 生成递归创建节点子菜单", () => {
    const executedRequests: EditorCommandRequest[] = [];
    const commandBus: EditorCommandBus = {
      clipboard: null,
      lastExecution: null,
      setClipboardPayload(): void {},
      canExecute() {
        return true;
      },
      resolveCommandState(request) {
        return {
          disabled: false,
          description:
            request.type === "canvas.create-node-by-type"
              ? `create ${request.nodeType}`
              : request.type
        };
      },
      execute(request) {
        executedRequests.push(request);
        return {
          request,
          result: true,
          authority: {
            status: "confirmed",
            operationIds: []
          },
          success: true,
          changed: true,
          recordable: false,
          summary: "test",
          timestamp: Date.now()
        };
      },
      resolveCreateNodeState() {
        return {
          disabled: false,
          description: "quick create"
        };
      },
      resolveResizeState() {
        return {
          disabled: false,
          description: "resize"
        };
      },
      isClipboardSourceNode() {
        return false;
      }
    };
    const resolver = createEditorContextMenuResolver({
      graph: createGraphStub(),
      selection: createSelectionStub(),
      resolveCommandBus() {
        return commandBus;
      },
      executeUiCommand(request) {
        commandBus.execute(request);
      },
      resolveNodePlayState() {
        return {
          disabled: true,
          description: "play disabled"
        };
      },
      onPlayNode(): void {},
      onRemoveLink(): void {},
      onStartReconnect(): void {}
    });

    const items = resolver({
      bindingKind: "canvas",
      bindingKey: "canvas",
      pagePoint: { x: 100, y: 80 }
    } as LeaferGraphContextMenuContext);

    const createSubmenu = items.find(
      (item) => item.kind === "submenu" && item.key === "create-node-from-registry"
    );
    expect(createSubmenu?.kind).toBe("submenu");
    if (!createSubmenu || createSubmenu.kind !== "submenu") {
      throw new Error("未生成创建节点子菜单");
    }

    const groupLabels = createSubmenu.items
      .filter((item) => item.kind === "submenu")
      .map((item) => item.label);
    expect(groupLabels).toEqual(["AI", "Other", "System"]);

    const systemGroup = createSubmenu.items.find(
      (item) => item.kind === "submenu" && item.label === "System"
    );
    expect(systemGroup?.kind).toBe("submenu");
    if (!systemGroup || systemGroup.kind !== "submenu") {
      throw new Error("缺少 System 分组");
    }

    const mathGroup = systemGroup.items.find(
      (item) => item.kind === "submenu" && item.label === "Math"
    );
    expect(mathGroup?.kind).toBe("submenu");
    if (!mathGroup || mathGroup.kind !== "submenu") {
      throw new Error("缺少 Math 分组");
    }

    const addLeaf = mathGroup.items.find(
      (item) => item.kind !== "separator" && item.key === "create-node:system.math.add"
    );
    expect(addLeaf?.kind).not.toBe("submenu");
    if (!addLeaf || addLeaf.kind === "separator" || addLeaf.kind === "submenu") {
      throw new Error("缺少 Add 节点项");
    }

    addLeaf.onSelect?.({} as LeaferGraphContextMenuContext);

    expect(executedRequests).toEqual([
      {
        type: "canvas.create-node-by-type",
        context: {
          bindingKind: "canvas",
          bindingKey: "canvas",
          pagePoint: { x: 100, y: 80 }
        },
        nodeType: "system.math.add"
      }
    ]);
  });
});
