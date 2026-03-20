import type {
  GraphLink,
  LeaferGraph,
  LeaferGraphContextMenuBindingTarget,
  LeaferGraphContextMenuManager
} from "leafergraph";

const NODE_POINTER_DOWN_BOUND_FLAG = "__editorNodePointerDownBound";

/**
 * editor 当前关心的节点按下事件最小子集。
 *
 * @remarks
 * 这里只读取修饰键，不直接依赖 Leafer 完整事件类型，
 * 避免把 editor 绑死到具体实现细节。
 */
export interface EditorNodePointerDownEvent {
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  left?: boolean;
  right?: boolean;
  origin?: {
    button?: number;
  };
}

/** 节点菜单挂载元信息。 */
export interface EditorNodeMenuBindingMeta extends Record<string, unknown> {
  nodeId: string;
  nodeTitle: string;
  nodeType?: string;
}

/** 连线菜单挂载元信息。 */
export interface EditorLinkMenuBindingMeta extends Record<string, unknown> {
  entity: "link";
  linkId: string;
  sourceNodeId: string;
  sourceSlot: number;
  targetNodeId: string;
  targetSlot: number;
}

/** 为节点级菜单生成稳定挂载 key。 */
export function createNodeMenuBindingKey(nodeId: string): string {
  return `node:${nodeId}`;
}

/** 为连线级菜单生成稳定挂载 key。 */
export function createLinkMenuBindingKey(linkId: string): string {
  return `link:${linkId}`;
}

/** 规范化节点菜单挂载元信息。 */
export function createNodeMenuBindingMeta(node: {
  id: string;
  title: string;
  type?: string;
}): EditorNodeMenuBindingMeta {
  return {
    nodeId: node.id,
    nodeTitle: node.title,
    nodeType: node.type
  };
}

/** 规范化连线菜单挂载元信息。 */
export function createLinkMenuBindingMeta(
  link: GraphLink
): EditorLinkMenuBindingMeta {
  return {
    entity: "link",
    linkId: link.id,
    sourceNodeId: link.source.nodeId,
    sourceSlot: link.source.slot ?? 0,
    targetNodeId: link.target.nodeId,
    targetSlot: link.target.slot ?? 0
  };
}

/** 判断一份未知菜单元信息是否表达了连线菜单挂载。 */
export function isEditorLinkMenuBindingMeta(
  value: Record<string, unknown> | undefined
): value is EditorLinkMenuBindingMeta {
  return value?.entity === "link";
}

/**
 * 绑定或刷新单个节点的右键菜单。
 *
 * @remarks
 * 这里显式先解绑再绑定，避免后续节点视图被替换时菜单仍然挂在旧图元上。
 */
export function bindNodeContextMenu(
  graph: LeaferGraph,
  menu: LeaferGraphContextMenuManager,
  onSelectNode: (nodeId: string, event?: EditorNodePointerDownEvent) => void,
  node: {
    id: string;
    title: string;
    type?: string;
  }
): void {
  const key = createNodeMenuBindingKey(node.id);
  const view = graph.getNodeView(node.id);
  if (!view) {
    return;
  }

  const nodeView = view as typeof view & {
    [NODE_POINTER_DOWN_BOUND_FLAG]?: boolean;
  };
  if (!nodeView[NODE_POINTER_DOWN_BOUND_FLAG]) {
    view.on("pointer.down", (event: EditorNodePointerDownEvent) => {
      onSelectNode(node.id, event);
    });
    nodeView[NODE_POINTER_DOWN_BOUND_FLAG] = true;
  }
  menu.unbindTarget(key);
  menu.bindNode(key, view, createNodeMenuBindingMeta(node));
}

/** 绑定或刷新单条连线的右键菜单。 */
export function bindLinkContextMenu(
  graph: LeaferGraph,
  menu: LeaferGraphContextMenuManager,
  link: GraphLink
): void {
  const key = createLinkMenuBindingKey(link.id);
  const view = graph.getLinkView(link.id);
  if (!view) {
    return;
  }

  menu.unbindTarget(key);
  menu.bindTarget({
    key,
    kind: "custom",
    target: view as LeaferGraphContextMenuBindingTarget,
    meta: createLinkMenuBindingMeta(link)
  });
}
