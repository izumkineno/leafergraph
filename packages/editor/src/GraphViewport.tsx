import { useEffect, useRef } from "preact/hooks";

import {
  createLeaferGraph,
  createLeaferGraphContextMenu,
  type LeaferGraphContextMenuContext,
  type LeaferGraphContextMenuItem,
  type LeaferGraphNodeData
} from "leafergraph";

interface GraphViewportProps {
  nodes: LeaferGraphNodeData[];
}

/**
 * 根据当前右键菜单上下文生成 demo 菜单项。
 * 这里先提供 editor 级最小示例，后续再逐步接入真正的命令系统。
 */
function resolveDemoMenuItems(
  context: LeaferGraphContextMenuContext
): LeaferGraphContextMenuItem[] {
  if (context.bindingKind === "node") {
    const nodeId = String(context.bindingMeta?.nodeId ?? context.bindingKey);
    const nodeTitle = String(context.bindingMeta?.nodeTitle ?? nodeId);

    return [
      {
        key: "copy-node",
        label: `复制 ${nodeTitle}`,
        shortcut: "Ctrl+C",
        description: "下一步接入节点复制命令",
        onSelect() {
          console.log("[editor] 复制节点（待接入）", {
            nodeId,
            nodeTitle,
            point: context.worldPoint
          });
        }
      },
      {
        key: "duplicate-node",
        label: "复制并粘贴",
        shortcut: "Ctrl+D",
        description: "下一步接入图命令与粘贴定位",
        onSelect() {
          console.log("[editor] 复制并粘贴节点（待接入）", {
            nodeId,
            nodeTitle,
            point: context.worldPoint
          });
        }
      },
      { kind: "separator", key: "node-divider" },
      {
        key: "remove-node",
        label: "删除节点",
        shortcut: "Delete",
        description: "下一步接入删除与撤销",
        danger: true,
        onSelect() {
          console.log("[editor] 删除节点（待接入）", {
            nodeId,
            nodeTitle,
            point: context.worldPoint
          });
        }
      }
    ];
  }

  return [
    {
      key: "create-node-here",
      label: "在这里创建节点",
      description: "下一步接入节点搜索与创建器",
      onSelect() {
        console.log("[editor] 在画布位置创建节点（待接入）", {
          containerPoint: context.containerPoint,
          worldPoint: context.worldPoint
        });
      }
    },
    {
      key: "fit-view",
      label: "适配视图",
      shortcut: "Shift+1",
      description: "下一步接入 viewport 命令",
      onSelect() {
        console.log("[editor] 适配视图（待接入）", {
          containerPoint: context.containerPoint
        });
      }
    }
  ];
}

export function GraphViewport({ nodes }: GraphViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const graph = createLeaferGraph(host, { nodes });
    const menu = createLeaferGraphContextMenu({
      app: graph.app,
      container: graph.container,
      resolveItems: resolveDemoMenuItems
    });
    let disposed = false;

    graph.ready.then(() => {
      if (disposed) {
        return;
      }

      for (const node of nodes) {
        const nodeView = graph.getNodeView(node.id);
        if (!nodeView) {
          continue;
        }

        menu.bindNode(`node:${node.id}`, nodeView, {
          nodeId: node.id,
          nodeTitle: node.title,
          nodeType: node.type
        });
      }
    });

    return () => {
      disposed = true;
      menu.destroy();
      graph.destroy();
    };
  }, [nodes]);

  return <div ref={hostRef} class="graph-root" />;
}
