/**
 * editor 统一命令总线模块。
 *
 * @remarks
 * 当前阶段先把节点命令、画布命令和少量选区动作收口到同一执行入口，
 * 让右键菜单、快捷键和后续工具栏可以共享同一组命令分发逻辑。
 *
 * 这一版先不直接实现历史记录，
 * 但会把命令入口整理成适合后续补事务和 undo / redo 的结构。
 */

import type {
  LeaferGraph,
  LeaferGraphCreateLinkInput,
  LeaferGraphContextMenuContext,
  LeaferGraphLinkData
} from "leafergraph";
import {
  createEditorCanvasCommandController,
  type CreateEditorCanvasCommandControllerOptions,
  type EditorCanvasCreateNodeState
} from "./canvas_commands";
import {
  createEditorNodeCommandController,
  type CreateEditorNodeCommandControllerOptions,
  type EditorNodeClipboard,
  type EditorNodeCommandResult,
  type EditorNodeResizeCommandState
} from "./node_commands";
import {
  createEditorLinkCommandController,
  type EditorLinkReconnectInput
} from "./link_commands";
import type { EditorNodeSelectionController } from "../state/selection";

/**
 * editor 当前支持的统一命令请求。
 *
 * @remarks
 * 这里使用显式联合类型，而不是散落的字符串常量和随意 payload，
 * 这样后续补历史记录、埋点或权限判断时更容易保持类型稳定。
 */
export type EditorCommandRequest =
  | {
      type: "canvas.create-node";
      context: LeaferGraphContextMenuContext;
    }
  | {
      type: "canvas.fit-view";
    }
  | {
      type: "link.create";
      input: LeaferGraphCreateLinkInput;
    }
  | {
      type: "link.remove";
      linkId: string;
    }
  | {
      type: "link.reconnect";
      linkId: string;
      input: EditorLinkReconnectInput;
    }
  | {
      type: "clipboard.copy-node";
      nodeId: string;
    }
  | {
      type: "clipboard.copy-selection";
    }
  | {
      type: "clipboard.cut-selection";
    }
  | {
      type: "clipboard.paste";
      point: { x: number; y: number } | null;
    }
  | {
      type: "node.duplicate";
      nodeId: string;
      x: number;
      y: number;
    }
  | {
      type: "node.remove";
      nodeId: string;
    }
  | {
      type: "node.execute";
      nodeId: string;
    }
  | {
      type: "node.reset-size";
      nodeId: string;
    }
  | {
      type: "selection.clear";
    }
  | {
      type: "selection.copy";
    }
  | {
      type: "selection.duplicate";
    }
  | {
      type: "selection.remove";
    }
  | {
      type: "selection.select-all";
      nodeIds: readonly string[];
    };

/**
 * editor 命令原始结果值。
 *
 * @remarks
 * 当前命令底层仍复用既有 node / canvas controller，
 * 它们的返回值形态并不一致，因此先保留一层联合类型用于承接原始结果。
 */
export type EditorCommandResultValue =
  | ReturnType<LeaferGraph["createNode"]>
  | LeaferGraphLinkData
  | EditorNodeCommandResult
  | boolean
  | null
  | undefined;

/** editor 命令历史负载中复用的正式节点快照类型。 */
export type EditorCommandNodeSnapshot = NonNullable<
  ReturnType<LeaferGraph["getNodeSnapshot"]>
>;

/**
 * editor 命令历史负载。
 *
 * @remarks
 * 命令总线只负责在“命令执行当下”捕获足够的前后状态，
 * 让后续历史记录层可以独立决定如何组织 undo / redo 栈。
 */
export type EditorCommandHistoryPayload =
  | {
      kind: "create-nodes";
      nodeSnapshots: EditorCommandNodeSnapshot[];
    }
  | {
      kind: "remove-nodes";
      nodeSnapshots: EditorCommandNodeSnapshot[];
      links: LeaferGraphLinkData[];
    }
  | {
      kind: "resize-node";
      nodeId: string;
      beforeSize: {
        width: number;
        height: number;
      };
      afterSize: {
        width: number;
        height: number;
      };
    }
  | {
      kind: "create-links";
      links: LeaferGraphLinkData[];
    }
  | {
      kind: "remove-links";
      links: LeaferGraphLinkData[];
    }
  | {
      kind: "reconnect-link";
      beforeLink: LeaferGraphLinkData;
      afterLink: LeaferGraphLinkData;
    };

/**
 * editor 单次命令执行记录。
 *
 * @remarks
 * 这是当前阶段的“最小事务包裹结构”：
 * 1. `request` 保留原始命令请求，便于后续接历史记录和埋点
 * 2. `result` 保留底层命令控制器返回值，避免现阶段提前抹平细节
 * 3. `success / changed` 把“命令是否执行成功”和“是否真的改动状态”拆开
 * 4. `recordable` 用来标记这条执行是否值得进入未来的撤销 / 重做系统
 */
export interface EditorCommandExecution {
  /** 本次执行对应的原始命令请求。 */
  request: EditorCommandRequest;
  /** 命令控制器返回的原始结果。 */
  result: EditorCommandResultValue;
  /** 本次执行可供历史记录消费的最小前后状态。 */
  historyPayload?: EditorCommandHistoryPayload;
  /** 命令是否成功进入真实执行路径。 */
  success: boolean;
  /** 命令是否真的对 editor / graph 状态产生了变更。 */
  changed: boolean;
  /** 这条命令是否应进入未来的历史记录系统。 */
  recordable: boolean;
  /** 给日志、调试面板和未来历史记录列表使用的最小摘要。 */
  summary: string;
  /** 执行时间戳。 */
  timestamp: number;
}

/**
 * editor 统一命令总线。
 *
 * @remarks
 * 它对外隐藏 node / canvas 两套控制器实现，
 * 同时补一层 `canExecute(...)` 和状态查询，
 * 让调用方不需要知道动作最终落在哪个控制器里。
 */
export interface EditorCommandBus {
  /** 当前节点剪贴板；没有复制内容时返回 `null`。 */
  readonly clipboard: EditorNodeClipboard | null;
  /** 最近一次命令执行记录；还未执行任何命令时返回 `null`。 */
  readonly lastExecution: EditorCommandExecution | null;
  /** 判断某个命令当前是否可执行。 */
  canExecute(request: EditorCommandRequest): boolean;
  /** 执行一条命令。 */
  execute(request: EditorCommandRequest): EditorCommandExecution;
  /** 读取“快速创建节点”命令状态。 */
  resolveCreateNodeState(): EditorCanvasCreateNodeState;
  /** 读取“重置节点尺寸”命令状态。 */
  resolveResizeState(nodeId: string): EditorNodeResizeCommandState;
  /** 判断当前剪贴板是否来自某个节点。 */
  isClipboardSourceNode(nodeId: string): boolean;
}

/**
 * editor 命令总线创建参数。
 *
 * @remarks
 * 这层直接复用既有 node / canvas controller 的创建参数，
 * 只是在外层再包一层统一命令入口。
 */
export interface CreateEditorCommandBusOptions
  extends CreateEditorNodeCommandControllerOptions,
    Pick<CreateEditorCanvasCommandControllerOptions, "quickCreateNodeType" | "onAfterFitView"> {
  /** 命令真正执行完成后的订阅入口，供未来历史记录与调试面板复用。 */
  onDidExecute?(execution: EditorCommandExecution): void;
}

/** 判断两份节点 ID 列表是否表达了同一组选区。 */
function isSameNodeIdList(
  leftNodeIds: readonly string[],
  rightNodeIds: readonly string[]
): boolean {
  if (leftNodeIds.length !== rightNodeIds.length) {
    return false;
  }

  return leftNodeIds.every((nodeId, index) => nodeId === rightNodeIds[index]);
}

/** 深拷贝正式节点快照，避免历史记录和运行时共享引用。 */
function cloneNodeSnapshot(
  snapshot: EditorCommandNodeSnapshot
): EditorCommandNodeSnapshot {
  return structuredClone(snapshot);
}

/** 深拷贝正式连线快照。 */
function cloneLinkSnapshot(link: LeaferGraphLinkData): LeaferGraphLinkData {
  return structuredClone(link);
}

/** 按给定节点 ID 顺序抓取当前图中的正式节点快照。 */
function captureNodeSnapshots(
  graph: LeaferGraph,
  nodeIds: readonly string[]
): EditorCommandNodeSnapshot[] {
  return nodeIds
    .map((nodeId) => graph.getNodeSnapshot(nodeId))
    .filter((snapshot): snapshot is EditorCommandNodeSnapshot => Boolean(snapshot))
    .map(cloneNodeSnapshot);
}

/** 抓取一组节点关联的正式连线快照，并按连线 ID 去重。 */
function captureRelatedLinks(
  graph: LeaferGraph,
  nodeIds: readonly string[]
): LeaferGraphLinkData[] {
  const linkMap = new Map<string, LeaferGraphLinkData>();

  for (const nodeId of nodeIds) {
    for (const link of graph.findLinksByNode(nodeId)) {
      if (!linkMap.has(link.id)) {
        linkMap.set(link.id, cloneLinkSnapshot(link));
      }
    }
  }

  return [...linkMap.values()];
}

/** 从“创建节点”类命令结果里提取正式节点快照。 */
function captureCreatedNodeSnapshots(
  graph: LeaferGraph,
  result: EditorCommandResultValue
): EditorCommandNodeSnapshot[] {
  if (!result || typeof result === "boolean") {
    return [];
  }

  const createdNodes = Array.isArray(result) ? result : [result];

  return createdNodes
    .map((node) => graph.getNodeSnapshot(node.id))
    .filter((snapshot): snapshot is EditorCommandNodeSnapshot => Boolean(snapshot))
    .map(cloneNodeSnapshot);
}

/** 为命令执行生成最小摘要文本。 */
function resolveCommandSummary(request: EditorCommandRequest): string {
  switch (request.type) {
    case "canvas.create-node":
      return "在画布创建节点";
    case "canvas.fit-view":
      return "适配画布视图";
    case "link.create":
      return "创建连线";
    case "link.remove":
      return `删除连线 ${request.linkId}`;
    case "link.reconnect":
      return `重连连线 ${request.linkId}`;
    case "clipboard.copy-node":
      return `复制节点 ${request.nodeId}`;
    case "clipboard.copy-selection":
    case "selection.copy":
      return "复制当前选区";
    case "clipboard.cut-selection":
      return "剪切当前选区";
    case "clipboard.paste":
      return "粘贴剪贴板节点";
    case "node.duplicate":
      return `复制节点 ${request.nodeId}`;
    case "node.remove":
      return `删除节点 ${request.nodeId}`;
    case "node.execute":
      return `执行节点 ${request.nodeId}`;
    case "node.reset-size":
      return `重置节点 ${request.nodeId} 尺寸`;
    case "selection.clear":
      return "清空当前选区";
    case "selection.duplicate":
      return "复制当前选区副本";
    case "selection.remove":
      return "删除当前选区";
    case "selection.select-all":
      return `全选 ${request.nodeIds.length} 个节点`;
    default:
      return "执行 editor 命令";
  }
}

/**
 * 创建 editor 当前阶段的统一命令总线。
 *
 * @param options - 命令总线依赖项。
 * @returns 已接线完成的 editor 命令总线。
 */
export function createEditorCommandBus(
  options: CreateEditorCommandBusOptions
): EditorCommandBus {
  const nodeCommands = createEditorNodeCommandController({
    graph: options.graph,
    selection: options.selection,
    bindNode: options.bindNode,
    unbindNode: options.unbindNode
  });
  const linkCommands = createEditorLinkCommandController(options.graph);
  const canvasCommands = createEditorCanvasCommandController({
    graph: options.graph,
    nodeCommands,
    quickCreateNodeType: options.quickCreateNodeType,
    onAfterFitView: options.onAfterFitView
  });

  const hasSelection = (selection: EditorNodeSelectionController): boolean =>
    Boolean(selection.primarySelectedNodeId);
  let lastExecution: EditorCommandExecution | null = null;

  const commitExecution = (
    execution: EditorCommandExecution
  ): EditorCommandExecution => {
    lastExecution = execution;
    options.onDidExecute?.(execution);
    return execution;
  };

  const createExecution = (
    request: EditorCommandRequest,
    result: EditorCommandResultValue,
    executionState: Pick<
      EditorCommandExecution,
      "success" | "changed" | "recordable" | "historyPayload"
    >
  ): EditorCommandExecution =>
    commitExecution({
      request,
      result,
      historyPayload: executionState.historyPayload,
      success: executionState.success,
      changed: executionState.changed,
      recordable: executionState.recordable,
      summary: resolveCommandSummary(request),
      timestamp: Date.now()
    });

  const canExecute = (request: EditorCommandRequest): boolean => {
    switch (request.type) {
      case "canvas.create-node":
        return !canvasCommands.resolveCreateNodeState().disabled;
      case "canvas.fit-view":
        return true;
      case "link.create":
        return true;
      case "link.remove":
        return linkCommands.hasLink(request.linkId);
      case "link.reconnect":
        return linkCommands.hasLink(request.linkId);
      case "clipboard.copy-node":
        return Boolean(options.graph.getNodeSnapshot(request.nodeId));
      case "clipboard.copy-selection":
      case "clipboard.cut-selection":
      case "selection.copy":
      case "selection.duplicate":
      case "selection.remove":
        return hasSelection(options.selection);
      case "clipboard.paste":
        return Boolean(nodeCommands.clipboard);
      case "node.duplicate":
        return Boolean(options.graph.getNodeSnapshot(request.nodeId));
      case "node.remove":
        return Boolean(options.graph.getNodeSnapshot(request.nodeId));
      case "node.execute":
        return Boolean(options.graph.getNodeSnapshot(request.nodeId));
      case "node.reset-size":
        return !nodeCommands.resolveResizeState(request.nodeId).disabled;
      case "selection.clear":
        return options.selection.selectedNodeIds.length > 0;
      case "selection.select-all":
        return request.nodeIds.length > 0;
      default:
        return false;
    }
  };

  const execute = (
    request: EditorCommandRequest
  ): EditorCommandExecution => {
    if (!canExecute(request)) {
      return createExecution(request, undefined, {
        historyPayload: undefined,
        success: false,
        changed: false,
        recordable: false
      });
    }

    switch (request.type) {
      case "canvas.create-node": {
        const result = canvasCommands.createNodeAt(request.context);
        const nodeSnapshots = captureCreatedNodeSnapshots(options.graph, result);
        return createExecution(request, result, {
          historyPayload: nodeSnapshots.length
            ? {
                kind: "create-nodes",
                nodeSnapshots
              }
            : undefined,
          success: nodeSnapshots.length > 0,
          changed: nodeSnapshots.length > 0,
          recordable: true
        });
      }
      case "canvas.fit-view": {
        const result = canvasCommands.fitView();
        return createExecution(request, result, {
          historyPayload: undefined,
          success: true,
          changed: result,
          recordable: false
        });
      }
      case "link.create": {
        const result = linkCommands.createLink(request.input);
        return createExecution(request, result, {
          historyPayload: {
            kind: "create-links",
            links: [structuredClone(result)]
          },
          success: true,
          changed: true,
          recordable: true
        });
      }
      case "link.remove": {
        const link = linkCommands.getLink(request.linkId);
        const result = linkCommands.removeLink(request.linkId);
        return createExecution(request, result, {
          historyPayload:
            result && link
              ? {
                  kind: "remove-links",
                  links: [structuredClone(link)]
                }
              : undefined,
          success: result,
          changed: result,
          recordable: true
        });
      }
      case "link.reconnect": {
        const beforeLink = linkCommands.getLink(request.linkId);
        const result = linkCommands.reconnectLink(request.linkId, request.input);
        return createExecution(request, result, {
          historyPayload:
            beforeLink && result
              ? {
                  kind: "reconnect-link",
                  beforeLink: structuredClone(beforeLink),
                  afterLink: structuredClone(result)
                }
              : undefined,
          success: Boolean(result),
          changed:
            Boolean(beforeLink && result) &&
            JSON.stringify(beforeLink) !== JSON.stringify(result),
          recordable: Boolean(beforeLink && result)
        });
      }
      case "clipboard.copy-node": {
        const result = nodeCommands.copyNode(request.nodeId);
        return createExecution(request, result, {
          historyPayload: undefined,
          success: result,
          changed: result,
          recordable: false
        });
      }
      case "clipboard.copy-selection":
      case "selection.copy": {
        const result = nodeCommands.copySelectedNodes();
        return createExecution(request, result, {
          historyPayload: undefined,
          success: result,
          changed: result,
          recordable: false
        });
      }
      case "clipboard.cut-selection": {
        const selectedNodeIds = [...options.selection.selectedNodeIds];
        const nodeSnapshots = captureNodeSnapshots(options.graph, selectedNodeIds);
        const links = captureRelatedLinks(options.graph, selectedNodeIds);
        const result = nodeCommands.cutSelectedNodes();
        return createExecution(request, result, {
          historyPayload:
            result && nodeSnapshots.length
              ? {
                  kind: "remove-nodes",
                  nodeSnapshots,
                  links
                }
              : undefined,
          success: result,
          changed: result,
          recordable: true
        });
      }
      case "clipboard.paste": {
        const result = canvasCommands.pasteClipboardAt(request.point);
        const nodeSnapshots = captureCreatedNodeSnapshots(options.graph, result);
        return createExecution(request, result, {
          historyPayload: nodeSnapshots.length
            ? {
                kind: "create-nodes",
                nodeSnapshots
              }
            : undefined,
          success: nodeSnapshots.length > 0,
          changed: nodeSnapshots.length > 0,
          recordable: true
        });
      }
      case "node.duplicate": {
        const result = nodeCommands.duplicateNode(
          request.nodeId,
          request.x,
          request.y
        );
        const nodeSnapshots = captureCreatedNodeSnapshots(options.graph, result);
        return createExecution(request, result, {
          historyPayload: nodeSnapshots.length
            ? {
                kind: "create-nodes",
                nodeSnapshots
              }
            : undefined,
          success: nodeSnapshots.length > 0,
          changed: nodeSnapshots.length > 0,
          recordable: true
        });
      }
      case "node.remove": {
        const nodeSnapshots = captureNodeSnapshots(options.graph, [request.nodeId]);
        const links = captureRelatedLinks(options.graph, [request.nodeId]);
        const result = nodeCommands.removeNode(request.nodeId);
        return createExecution(request, result, {
          historyPayload:
            result && nodeSnapshots.length
              ? {
                  kind: "remove-nodes",
                  nodeSnapshots,
                  links
                }
              : undefined,
          success: result,
          changed: result,
          recordable: true
        });
      }
      case "node.execute": {
        const result = options.graph.executeNode(request.nodeId);
        return createExecution(request, result, {
          historyPayload: undefined,
          success: result,
          changed: result,
          recordable: false
        });
      }
      case "node.reset-size": {
        const beforeSnapshot = options.graph.getNodeSnapshot(request.nodeId);
        const result = nodeCommands.resetNodeSize(request.nodeId);
        const afterSnapshot = options.graph.getNodeSnapshot(request.nodeId);
        return createExecution(request, result, {
          historyPayload:
            result && beforeSnapshot && afterSnapshot
              ? {
                  kind: "resize-node",
                  nodeId: request.nodeId,
                  beforeSize: {
                    width: beforeSnapshot.layout.width ?? 0,
                    height: beforeSnapshot.layout.height ?? 0
                  },
                  afterSize: {
                    width: afterSnapshot.layout.width ?? 0,
                    height: afterSnapshot.layout.height ?? 0
                  }
                }
              : undefined,
          success: result,
          changed: result,
          recordable: true
        });
      }
      case "selection.clear": {
        const prevSelectedNodeIds = [...options.selection.selectedNodeIds];
        options.selection.clear();
        const changed = prevSelectedNodeIds.length > 0;
        return createExecution(request, changed, {
          historyPayload: undefined,
          success: true,
          changed,
          recordable: false
        });
      }
      case "selection.duplicate": {
        const result = nodeCommands.duplicateSelectedNodes();
        const nodeSnapshots = captureCreatedNodeSnapshots(options.graph, result);
        return createExecution(request, result, {
          historyPayload: nodeSnapshots.length
            ? {
                kind: "create-nodes",
                nodeSnapshots
              }
            : undefined,
          success: nodeSnapshots.length > 0,
          changed: nodeSnapshots.length > 0,
          recordable: true
        });
      }
      case "selection.remove": {
        const selectedNodeIds = [...options.selection.selectedNodeIds];
        const nodeSnapshots = captureNodeSnapshots(options.graph, selectedNodeIds);
        const links = captureRelatedLinks(options.graph, selectedNodeIds);
        const result = nodeCommands.removeSelectedNodes();
        return createExecution(request, result, {
          historyPayload:
            result && nodeSnapshots.length
              ? {
                  kind: "remove-nodes",
                  nodeSnapshots,
                  links
                }
              : undefined,
          success: result,
          changed: result,
          recordable: true
        });
      }
      case "selection.select-all": {
        const prevSelectedNodeIds = [...options.selection.selectedNodeIds];
        options.selection.setMany(request.nodeIds);
        const nextSelectedNodeIds = options.selection.selectedNodeIds;
        const changed = !isSameNodeIdList(
          prevSelectedNodeIds,
          nextSelectedNodeIds
        );
        return createExecution(request, changed, {
          historyPayload: undefined,
          success: true,
          changed,
          recordable: false
        });
      }
    }
  };

  return {
    get clipboard(): EditorNodeClipboard | null {
      return nodeCommands.clipboard;
    },

    get lastExecution(): EditorCommandExecution | null {
      return lastExecution;
    },

    canExecute(request: EditorCommandRequest): boolean {
      return canExecute(request);
    },

    execute(request: EditorCommandRequest): EditorCommandExecution {
      return execute(request);
    },

    resolveCreateNodeState(): EditorCanvasCreateNodeState {
      return canvasCommands.resolveCreateNodeState();
    },

    resolveResizeState(nodeId: string): EditorNodeResizeCommandState {
      return nodeCommands.resolveResizeState(nodeId);
    },

    isClipboardSourceNode(nodeId: string): boolean {
      return nodeCommands.isClipboardSourceNode(nodeId);
    }
  };
}
