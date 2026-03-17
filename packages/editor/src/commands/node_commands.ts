import type { LeaferGraph, LeaferGraphCreateNodeInput } from "leafergraph";
import {
  createNodeCreateOperation,
  createNodeRemoveOperation,
  createNodeResizeOperation,
  ensureNodeCreateInputId
} from "./graph_operation_utils";
import type { EditorGraphDocumentSession } from "../session/graph_document_session";
import type { EditorNodeSelectionController } from "../state/selection";

/** 从主包读取到的正式节点快照。 */
export type EditorNodeSnapshot = NonNullable<
  ReturnType<LeaferGraph["getNodeSnapshot"]>
>;

/**
 * 一次批量节点命令的创建结果。
 * 单节点命令也统一落到数组，便于多选和单选共用同一条调用链。
 */
export type EditorNodeCommandResult = EditorNodeSnapshot[];

/**
 * 剪贴板中的单个节点条目。
 * `offsetX / offsetY` 记录的是相对选区左上角的偏移，
 * 这样粘贴多节点时可以稳定保留原有相对排布。
 */
export interface EditorNodeClipboardEntry {
  sourceNodeId: string;
  snapshot: EditorNodeSnapshot;
  offsetX: number;
  offsetY: number;
}

/**
 * editor 当前阶段的节点剪贴板。
 * 它既支持单节点，也支持多节点批量复制 / 剪切 / 粘贴。
 */
export interface EditorNodeClipboard {
  sourceNodeIds: string[];
  anchorX: number;
  anchorY: number;
  entries: EditorNodeClipboardEntry[];
}

/**
 * 节点尺寸重置命令的菜单状态。
 * editor 当前只关心是否可用，以及给用户看的最小原因说明。
 */
export interface EditorNodeResizeCommandState {
  disabled: boolean;
  description: string;
}

/**
 * editor 当前阶段的最小节点命令控制器。
 * 它把 GraphViewport 里散落的节点操作收敛成统一入口，
 * 便于后续继续演进成更正式的命令层和历史记录接口。
 */
export interface EditorNodeCommandController {
  /** 当前剪贴板，没有复制内容时返回 `null`。 */
  readonly clipboard: EditorNodeClipboard | null;
  /** 创建节点并自动绑定菜单与选区。 */
  createNode(input: LeaferGraphCreateNodeInput): EditorNodeSnapshot | undefined;
  /** 删除当前选中节点；多选时删除整个选区。 */
  removePrimarySelectedNode(): boolean;
  /** 删除当前全部选中节点。 */
  removeSelectedNodes(): boolean;
  /** 判断剪贴板是否来自指定节点。 */
  isClipboardSourceNode(nodeId: string): boolean;
  /** 复制节点到 editor 剪贴板。 */
  copyNode(nodeId: string): boolean;
  /** 复制当前选区；若只有一个节点，则等价于复制主选中节点。 */
  copyPrimarySelectedNode(): boolean;
  /** 显式复制当前全部选中节点。 */
  copySelectedNodes(): boolean;
  /** 剪切当前选区。 */
  cutSelectedNodes(): boolean;
  /** 将当前剪贴板粘贴到指定位置。 */
  pasteClipboardAt(x: number, y: number): EditorNodeCommandResult | undefined;
  /** 将当前剪贴板粘贴到主选中节点附近。 */
  pasteClipboardNearSelection(): EditorNodeCommandResult | undefined;
  /** 基于现有节点创建偏移副本。 */
  duplicateNode(
    nodeId: string,
    x: number,
    y: number
  ): EditorNodeSnapshot | undefined;
  /** 复制当前选区，并按默认偏移生成副本。 */
  duplicatePrimarySelectedNode(): EditorNodeCommandResult | undefined;
  /** 显式复制当前全部选中节点并生成副本。 */
  duplicateSelectedNodes(): EditorNodeCommandResult | undefined;
  /** 删除节点，并同步处理菜单绑定、选区和剪贴板。 */
  removeNode(nodeId: string): boolean;
  /** 读取节点尺寸重置命令状态。 */
  resolveResizeState(nodeId: string): EditorNodeResizeCommandState;
  /** 执行节点尺寸重置，并保持当前节点为主选中节点。 */
  resetNodeSize(nodeId: string): boolean;
}

/**
 * 节点命令控制器创建参数。
 * GraphViewport 只需要提供菜单绑定和选区同步能力，不必再重复实现节点命令细节。
 */
export interface CreateEditorNodeCommandControllerOptions {
  graph: LeaferGraph;
  session: EditorGraphDocumentSession;
  selection: EditorNodeSelectionController;
  bindNode(node: { id: string; title: string; type?: string }): void;
  unbindNode(nodeId: string): void;
}

/** 深拷贝一个节点创建输入，避免剪贴板对象被后续操作原地污染。 */
export function cloneNodeCreateInput(
  input: LeaferGraphCreateNodeInput
): LeaferGraphCreateNodeInput {
  return structuredClone(input);
}

/** 将节点输入重新定位到指定坐标，供粘贴和 duplicate 共用。 */
export function relocateNodeCreateInput(
  input: LeaferGraphCreateNodeInput,
  x: number,
  y: number
): LeaferGraphCreateNodeInput {
  const next = cloneNodeCreateInput(input);
  next.x = Math.round(x);
  next.y = Math.round(y);
  return next;
}

/** 将正式节点快照重新包装成 `createNode(...)` 可消费的便捷输入。 */
export function createNodeInputFromSnapshot(
  snapshot: EditorNodeSnapshot,
  x: number = snapshot.layout.x,
  y: number = snapshot.layout.y
): LeaferGraphCreateNodeInput {
  return relocateNodeCreateInput(
    structuredClone({
      type: snapshot.type,
      title: snapshot.title,
      x: snapshot.layout.x,
      y: snapshot.layout.y,
      width: snapshot.layout.width,
      height: snapshot.layout.height,
      properties: snapshot.properties,
      propertySpecs: snapshot.propertySpecs,
      inputs: snapshot.inputs,
      outputs: snapshot.outputs,
      widgets: snapshot.widgets,
      data: snapshot.data
    } satisfies LeaferGraphCreateNodeInput),
    x,
    y
  );
}

/** 把任意节点 ID 列表整理成稳定且无重复的顺序集合。 */
export function normalizeNodeIdList(nodeIds: readonly string[]): string[] {
  const orderedNodeIds: string[] = [];
  const nodeIdSet = new Set<string>();

  for (const nodeId of nodeIds) {
    const safeNodeId = nodeId.trim();
    if (!safeNodeId || nodeIdSet.has(safeNodeId)) {
      continue;
    }

    nodeIdSet.add(safeNodeId);
    orderedNodeIds.push(safeNodeId);
  }

  return orderedNodeIds;
}

/** 判断当前剪贴板是否来自某个节点。 */
export function isClipboardSourceNode(
  clipboard: EditorNodeClipboard | null,
  nodeId: string
): boolean {
  return Boolean(clipboard?.sourceNodeIds.includes(nodeId));
}

/**
 * 从一组节点快照生成 editor 剪贴板。
 * 锚点统一取选区左上角，后续多节点粘贴时会保留相对布局。
 */
export function copyNodesToClipboard(
  graph: LeaferGraph,
  nodeIds: readonly string[]
): EditorNodeClipboard | null {
  const orderedNodeIds = normalizeNodeIdList(nodeIds);
  const snapshotEntries = orderedNodeIds
    .map((sourceNodeId) => {
      const snapshot = graph.getNodeSnapshot(sourceNodeId);
      return snapshot ? { sourceNodeId, snapshot } : null;
    })
    .filter(
      (
        entry
      ): entry is {
        sourceNodeId: string;
        snapshot: EditorNodeSnapshot;
      } => Boolean(entry)
    );

  if (!snapshotEntries.length) {
    return null;
  }

  const anchorX = Math.min(
    ...snapshotEntries.map(({ snapshot }) => snapshot.layout.x)
  );
  const anchorY = Math.min(
    ...snapshotEntries.map(({ snapshot }) => snapshot.layout.y)
  );

  return {
    sourceNodeIds: snapshotEntries.map(({ sourceNodeId }) => sourceNodeId),
    anchorX,
    anchorY,
    entries: snapshotEntries.map(({ sourceNodeId, snapshot }) => ({
      sourceNodeId,
      snapshot,
      offsetX: snapshot.layout.x - anchorX,
      offsetY: snapshot.layout.y - anchorY
    }))
  };
}

/**
 * 从主包读取单节点快照，并包装成当前使用的剪贴板对象。
 * 这是 `copyNodesToClipboard(...)` 的单节点便捷入口。
 */
export function copyNodeToClipboard(
  graph: LeaferGraph,
  nodeId: string
): EditorNodeClipboard | null {
  return copyNodesToClipboard(graph, [nodeId]);
}

/**
 * 解析键盘粘贴时的目标位置。
 * 若当前存在主选中节点，则优先相对它做偏移；否则相对剪贴板原始锚点偏移。
 */
export function resolveKeyboardPastePosition(
  graph: LeaferGraph,
  clipboard: EditorNodeClipboard | null,
  selectedNodeId: string | null
): { x: number; y: number } | undefined {
  if (!clipboard) {
    return undefined;
  }

  if (selectedNodeId) {
    const selectedSnapshot = graph.getNodeSnapshot(selectedNodeId);
    if (selectedSnapshot) {
      return {
        x: selectedSnapshot.layout.x + 48,
        y: selectedSnapshot.layout.y + 48
      };
    }
  }

  return {
    x: clipboard.anchorX + 48,
    y: clipboard.anchorY + 48
  };
}

/**
 * 使用当前剪贴板在指定位置创建节点。
 * 若剪贴板中包含多个节点，会按相对偏移批量创建。
 */
export function createNodesFromClipboard(
  graph: LeaferGraph,
  session: EditorGraphDocumentSession,
  clipboard: EditorNodeClipboard,
  x: number,
  y: number
): EditorNodeCommandResult {
  const createInputs = clipboard.entries.map((entry) =>
    ensureNodeCreateInputId(
      createNodeInputFromSnapshot(
        entry.snapshot,
        x + entry.offsetX,
        y + entry.offsetY
      )
    )
  );

  return createInputs
    .map((input) => ({
      input,
      result: session.submitOperation(createNodeCreateOperation(input))
    }))
    .map(({ input, result }) =>
      graph.getNodeSnapshot(result.affectedNodeIds[0] ?? input.id ?? "")
    )
    .filter((snapshot): snapshot is EditorNodeSnapshot => Boolean(snapshot));
}

/**
 * 基于已存在节点快照创建一个偏移副本。
 * 若节点不存在或暂时无法读取快照，则返回 `undefined`。
 */
export function duplicateNodeFromSnapshot(
  graph: LeaferGraph,
  session: EditorGraphDocumentSession,
  nodeId: string,
  x: number,
  y: number
): EditorNodeSnapshot | undefined {
  const snapshot = graph.getNodeSnapshot(nodeId);
  if (!snapshot) {
    return undefined;
  }

  const createInput = ensureNodeCreateInputId(
    createNodeInputFromSnapshot(snapshot, x, y)
  );
  const result = session.submitOperation(
    createNodeCreateOperation(createInput)
  );
  return graph.getNodeSnapshot(
    result.affectedNodeIds[0] ?? createInput.id ?? ""
  );
}

/**
 * 基于一组节点创建整组选区副本。
 * 复制结果会保留原有相对排布，并整体以新锚点落位。
 */
export function duplicateNodesFromSelection(
  graph: LeaferGraph,
  session: EditorGraphDocumentSession,
  nodeIds: readonly string[],
  x: number,
  y: number
): EditorNodeCommandResult | undefined {
  const clipboard = copyNodesToClipboard(graph, nodeIds);
  if (!clipboard) {
    return undefined;
  }

  return createNodesFromClipboard(graph, session, clipboard, x, y);
}

/**
 * 解析节点“重置尺寸”命令状态。
 * 当前只基于主包公开的 resize 约束和节点快照做判断，不在 editor 内重复实现尺寸协议。
 */
export function resolveNodeResizeCommandState(
  graph: LeaferGraph,
  nodeId: string
): EditorNodeResizeCommandState {
  const constraint = graph.getNodeResizeConstraint(nodeId);
  if (!constraint?.enabled) {
    return {
      disabled: true,
      description: "当前节点未开启尺寸调整能力"
    };
  }

  const snapshot = graph.getNodeSnapshot(nodeId);
  const width = snapshot?.layout.width ?? constraint.defaultWidth;
  const height = snapshot?.layout.height ?? constraint.defaultHeight;
  const isDefaultSize =
    Math.round(width) === Math.round(constraint.defaultWidth) &&
    Math.round(height) === Math.round(constraint.defaultHeight);

  if (isDefaultSize) {
    return {
      disabled: true,
      description: "当前节点已经处于默认尺寸"
    };
  }

  return {
    disabled: false,
    description: `恢复到默认尺寸 ${constraint.defaultWidth} x ${constraint.defaultHeight}`
  };
}

/** 执行节点尺寸重置命令，并返回是否真的发生了尺寸回写。 */
export function resetNodeSizeById(
  graph: LeaferGraph,
  session: EditorGraphDocumentSession,
  nodeId: string
): boolean {
  const constraint = graph.getNodeResizeConstraint(nodeId);
  if (!constraint?.enabled) {
    return false;
  }

  const result = session.submitOperation(
    createNodeResizeOperation(nodeId, {
      width: constraint.defaultWidth,
      height: constraint.defaultHeight
    })
  );

  return result.accepted;
}

/** 为 authority pending 场景生成最小节点快照。 */
function createPendingNodeSnapshot(
  input: LeaferGraphCreateNodeInput
): EditorNodeSnapshot {
  const normalizedInput = ensureNodeCreateInputId(input);
  return {
    id: normalizedInput.id ?? "",
    type: normalizedInput.type,
    title: normalizedInput.title ?? normalizedInput.type,
    layout: {
      x: normalizedInput.x,
      y: normalizedInput.y,
      width: normalizedInput.width ?? 240,
      height: normalizedInput.height ?? 140
    },
    flags: {},
    properties: structuredClone(normalizedInput.properties ?? {}),
    propertySpecs: structuredClone(normalizedInput.propertySpecs ?? []),
    inputs: structuredClone(
      normalizedInput.inputs ?? []
    ) as EditorNodeSnapshot["inputs"],
    outputs: structuredClone(
      normalizedInput.outputs ?? []
    ) as EditorNodeSnapshot["outputs"],
    widgets: structuredClone(normalizedInput.widgets ?? []),
    data: structuredClone(normalizedInput.data ?? {})
  };
}

/**
 * 创建 editor 当前阶段的最小节点命令控制器。
 * 这一轮继续扩展到“多选批量命令”：
 * 1. 多选复制 / 剪切 / 删除
 * 2. 保留相对布局的整组粘贴
 * 3. 多选 duplicate
 */
export function createEditorNodeCommandController(
  options: CreateEditorNodeCommandControllerOptions
): EditorNodeCommandController {
  let clipboard: EditorNodeClipboard | null = null;

  const createNode = (
    input: LeaferGraphCreateNodeInput
  ): EditorNodeSnapshot | undefined => {
    const normalizedInput = ensureNodeCreateInputId(input);
    const result = options.session.submitOperation(
      createNodeCreateOperation(normalizedInput)
    );
    if (!result.accepted) {
      return undefined;
    }

    const nodeId = result.affectedNodeIds[0] ?? normalizedInput.id;
    const snapshot = nodeId ? options.graph.getNodeSnapshot(nodeId) : undefined;
    if (snapshot) {
      options.bindNode({
        id: snapshot.id,
        title: snapshot.title ?? snapshot.id,
        type: snapshot.type
      });
      options.selection.select(snapshot.id);
      return snapshot;
    }

    return createPendingNodeSnapshot(normalizedInput);
  };

  const createNodes = (
    inputs: readonly LeaferGraphCreateNodeInput[]
  ): EditorNodeCommandResult => {
    const snapshots: EditorNodeSnapshot[] = [];

    for (const input of inputs) {
      const snapshot = createNode(input);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }

    const materializedNodeIds = snapshots
      .map((snapshot) => options.graph.getNodeSnapshot(snapshot.id)?.id ?? null)
      .filter((nodeId): nodeId is string => Boolean(nodeId));
    if (materializedNodeIds.length) {
      options.selection.setMany(materializedNodeIds);
    }

    return snapshots;
  };

  const removeNodeIds = (
    nodeIds: readonly string[],
    optionsOverride?: { preserveClipboard?: boolean }
  ): boolean => {
    const orderedNodeIds = normalizeNodeIdList(nodeIds);
    if (!orderedNodeIds.length) {
      return false;
    }

    const removedNodeIds: string[] = [];
    let submitted = false;
    for (const nodeId of orderedNodeIds) {
      const result = options.session.submitOperation(
        createNodeRemoveOperation(nodeId)
      );
      if (!result.accepted) {
        continue;
      }
      submitted = true;

      if (!result.changed) {
        continue;
      }
      options.unbindNode(nodeId);
      removedNodeIds.push(nodeId);
    }

    if (!submitted) {
      return false;
    }

    if (
      removedNodeIds.length &&
      !optionsOverride?.preserveClipboard &&
      removedNodeIds.some((nodeId) => isClipboardSourceNode(clipboard, nodeId))
    ) {
      clipboard = null;
    }

    if (removedNodeIds.length) {
      const nextSelectedNodeIds = options.selection.selectedNodeIds.filter(
        (selectedNodeId) => !removedNodeIds.includes(selectedNodeId)
      );
      options.selection.setMany(nextSelectedNodeIds);
    }

    return true;
  };

  const copyNode = (nodeId: string): boolean => {
    const nextClipboard = copyNodeToClipboard(options.graph, nodeId);
    if (!nextClipboard) {
      return false;
    }

    clipboard = nextClipboard;
    options.selection.select(nodeId);
    return true;
  };

  const copySelectedNodes = (): boolean => {
    const nextClipboard = copyNodesToClipboard(
      options.graph,
      options.selection.selectedNodeIds
    );
    if (!nextClipboard) {
      return false;
    }

    clipboard = nextClipboard;
    return true;
  };

  const pasteClipboardAt = (
    x: number,
    y: number
  ): EditorNodeCommandResult | undefined => {
    if (!clipboard) {
      return undefined;
    }

    const inputs = clipboard.entries.map((entry) =>
      createNodeInputFromSnapshot(
        entry.snapshot,
        x + entry.offsetX,
        y + entry.offsetY
      )
    );

    return createNodes(inputs);
  };

  const duplicateNode = (
    nodeId: string,
    x: number,
    y: number
  ): EditorNodeSnapshot | undefined => {
    const snapshot = options.graph.getNodeSnapshot(nodeId);
    if (!snapshot) {
      return undefined;
    }

    return createNode(createNodeInputFromSnapshot(snapshot, x, y));
  };

  const duplicateSelectedNodes = ():
    | EditorNodeCommandResult
    | undefined => {
    const selectedNodeIds = normalizeNodeIdList(options.selection.selectedNodeIds);
    if (!selectedNodeIds.length) {
      return undefined;
    }

    const selectionClipboard = copyNodesToClipboard(
      options.graph,
      selectedNodeIds
    );
    if (!selectionClipboard) {
      return undefined;
    }

    const inputs = selectionClipboard.entries.map((entry) =>
      createNodeInputFromSnapshot(
        entry.snapshot,
        selectionClipboard.anchorX + 48 + entry.offsetX,
        selectionClipboard.anchorY + 48 + entry.offsetY
      )
    );

    return createNodes(inputs);
  };

  const duplicatePrimarySelectedNode = ():
    | EditorNodeCommandResult
    | undefined => {
    const selectedNodeIds = normalizeNodeIdList(options.selection.selectedNodeIds);
    if (!selectedNodeIds.length) {
      return undefined;
    }

    if (selectedNodeIds.length > 1) {
      return duplicateSelectedNodes();
    }

    const nodeId = selectedNodeIds[0];
    const snapshot = options.graph.getNodeSnapshot(nodeId);
    if (!snapshot) {
      return undefined;
    }

    const node = duplicateNode(
      nodeId,
      snapshot.layout.x + 48,
      snapshot.layout.y + 48
    );
    return node ? [node] : undefined;
  };

  const pasteClipboardNearSelection = ():
    | EditorNodeCommandResult
    | undefined => {
    const position = resolveKeyboardPastePosition(
      options.graph,
      clipboard,
      options.selection.primarySelectedNodeId
    );
    if (!position) {
      return undefined;
    }

    return pasteClipboardAt(position.x, position.y);
  };

  const cutSelectedNodes = (): boolean => {
    const selectedNodeIds = normalizeNodeIdList(options.selection.selectedNodeIds);
    if (!selectedNodeIds.length) {
      return false;
    }

    const nextClipboard = copyNodesToClipboard(options.graph, selectedNodeIds);
    if (!nextClipboard) {
      return false;
    }

    clipboard = nextClipboard;
    return removeNodeIds(selectedNodeIds, { preserveClipboard: true });
  };

  const resetNodeSize = (nodeId: string): boolean => {
    const changed = resetNodeSizeById(options.graph, options.session, nodeId);
    if (changed) {
      options.selection.select(nodeId);
    }
    return changed;
  };

  return {
    get clipboard(): EditorNodeClipboard | null {
      return clipboard;
    },

    createNode(input: LeaferGraphCreateNodeInput) {
      return createNode(input);
    },

    removePrimarySelectedNode(): boolean {
      return removeNodeIds(options.selection.selectedNodeIds);
    },

    removeSelectedNodes(): boolean {
      return removeNodeIds(options.selection.selectedNodeIds);
    },

    isClipboardSourceNode(nodeId: string): boolean {
      return isClipboardSourceNode(clipboard, nodeId);
    },

    copyNode(nodeId: string): boolean {
      return copyNode(nodeId);
    },

    copyPrimarySelectedNode(): boolean {
      const selectedNodeIds = normalizeNodeIdList(options.selection.selectedNodeIds);
      if (!selectedNodeIds.length) {
        return false;
      }

      if (selectedNodeIds.length > 1) {
        return copySelectedNodes();
      }

      return copyNode(selectedNodeIds[0]);
    },

    copySelectedNodes(): boolean {
      return copySelectedNodes();
    },

    cutSelectedNodes(): boolean {
      return cutSelectedNodes();
    },

    pasteClipboardAt(x: number, y: number) {
      return pasteClipboardAt(x, y);
    },

    pasteClipboardNearSelection() {
      return pasteClipboardNearSelection();
    },

    duplicateNode(nodeId: string, x: number, y: number) {
      return duplicateNode(nodeId, x, y);
    },

    duplicatePrimarySelectedNode() {
      return duplicatePrimarySelectedNode();
    },

    duplicateSelectedNodes() {
      return duplicateSelectedNodes();
    },

    removeNode(nodeId: string): boolean {
      return removeNodeIds([nodeId]);
    },

    resolveResizeState(nodeId: string): EditorNodeResizeCommandState {
      return resolveNodeResizeCommandState(options.graph, nodeId);
    },

    resetNodeSize(nodeId: string): boolean {
      return resetNodeSize(nodeId);
    }
  };
}
