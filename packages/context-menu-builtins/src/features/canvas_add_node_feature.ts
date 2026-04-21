import type { NodeDefinition } from "@leafergraph/core/node";
import type { LeaferContextMenuItem } from "@leafergraph/context-menu";
import type { LeaferGraphContextMenuBuiltinFeatureDefinition } from "../types";

interface RegisteredNodeProjection {
  type: string;
  title: string;
  category: string;
  description?: string;
}

export const canvasAddNodeFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "canvasAddNode",
  register({ host, registerResolver, createNode }) {
    return registerResolver("canvas-add-node", (context) => {
      if (context.target.kind !== "canvas") {
        return [];
      }

      return [
        {
          kind: "submenu",
          key: "builtin-canvas-add-node",
          label: "从注册表添加节点",
          order: 30,
          children: createCategoryItems(host.listNodes(), async (type) => {
            const position = resolveCanvasCreatePosition(context);
            await createNode(
              {
                type,
                x: position.x,
                y: position.y
              },
              context
            );
          })
        }
      ];
    });
  }
};

/**
 * 创建分类项目。
 *
 * @param definitions - 定义。
 * @param onSelect - `onSelect` 参数。
 * @returns 创建后的结果对象。
 */
function createCategoryItems(
  definitions: readonly NodeDefinition[],
  onSelect: (type: string) => Promise<void> | void
): LeaferContextMenuItem[] {
  const registeredNodes = definitions
    .map((definition) => projectRegisteredNode(definition))
    .sort(compareRegisteredNodes);

  if (!registeredNodes.length) {
    return [
      {
        key: "builtin-canvas-add-node-empty",
        label: "暂无可添加节点",
        disabled: true
      }
    ];
  }

  const groupedNodes = new Map<string, RegisteredNodeProjection[]>();
  for (const entry of registeredNodes) {
    const entries = groupedNodes.get(entry.category);
    if (entries) {
      entries.push(entry);
    } else {
      groupedNodes.set(entry.category, [entry]);
    }
  }

  return [...groupedNodes.entries()].map(([category, entries]) => ({
    kind: "submenu" as const,
    key: `builtin-canvas-add-node-category:${category}`,
    label: category,
    children: entries.map((entry) => ({
      key: `builtin-canvas-add-node:${entry.type}`,
      label: entry.title,
      description: entry.description,
      async onSelect() {
        await onSelect(entry.type);
      }
    }))
  }));
}

/**
 * 映射`Registered` 节点。
 *
 * @param definition - 定义。
 * @returns 处理后的结果。
 */
function projectRegisteredNode(
  definition: NodeDefinition
): RegisteredNodeProjection {
  return {
    type: definition.type,
    title: definition.title?.trim() || definition.type,
    category: definition.category?.trim() || "未分类",
    description: definition.description?.trim() || undefined
  };
}

/**
 * 比较`Registered` 节点。
 *
 * @param left - `left`。
 * @param right - `right`。
 * @returns 比较`Registered` 节点的结果。
 */
function compareRegisteredNodes(
  left: RegisteredNodeProjection,
  right: RegisteredNodeProjection
): number {
  const categoryOrder = left.category.localeCompare(right.category, "zh-CN");
  if (categoryOrder !== 0) {
    return categoryOrder;
  }

  const titleOrder = left.title.localeCompare(right.title, "zh-CN");
  if (titleOrder !== 0) {
    return titleOrder;
  }

  return left.type.localeCompare(right.type, "zh-CN");
}

/**
 * 解析画布创建位置。
 *
 * @param context - 当前上下文。
 * @returns 处理后的结果。
 */
function resolveCanvasCreatePosition(context: {
  pagePoint: { x: number; y: number };
  worldPoint?: { x: number; y: number };
  containerPoint: { x: number; y: number };
}) {
  if (
    Number.isFinite(context.pagePoint.x) &&
    Number.isFinite(context.pagePoint.y)
  ) {
    return {
      x: context.pagePoint.x,
      y: context.pagePoint.y
    };
  }

  if (context.worldPoint) {
    return {
      x: context.worldPoint.x,
      y: context.worldPoint.y
    };
  }

  return {
    x: context.containerPoint.x,
    y: context.containerPoint.y
  };
}
