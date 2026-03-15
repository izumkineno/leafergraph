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
  LeaferGraphContextMenuContext
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
  | EditorNodeCommandResult
  | boolean
  | null
  | undefined;

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

/** 判断命令结果中是否真的创建出了节点。 */
function hasCreatedNodes(result: EditorCommandResultValue): boolean {
  if (Array.isArray(result)) {
    return result.length > 0;
  }

  return Boolean(result);
}

/** 为命令执行生成最小摘要文本。 */
function resolveCommandSummary(request: EditorCommandRequest): string {
  switch (request.type) {
    case "canvas.create-node":
      return "在画布创建节点";
    case "canvas.fit-view":
      return "适配画布视图";
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
      "success" | "changed" | "recordable"
    >
  ): EditorCommandExecution =>
    commitExecution({
      request,
      result,
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
        success: false,
        changed: false,
        recordable: false
      });
    }

    switch (request.type) {
      case "canvas.create-node": {
        const result = canvasCommands.createNodeAt(request.context);
        return createExecution(request, result, {
          success: hasCreatedNodes(result),
          changed: hasCreatedNodes(result),
          recordable: true
        });
      }
      case "canvas.fit-view": {
        const result = canvasCommands.fitView();
        return createExecution(request, result, {
          success: true,
          changed: result,
          recordable: false
        });
      }
      case "clipboard.copy-node": {
        const result = nodeCommands.copyNode(request.nodeId);
        return createExecution(request, result, {
          success: result,
          changed: result,
          recordable: false
        });
      }
      case "clipboard.copy-selection":
      case "selection.copy": {
        const result = nodeCommands.copySelectedNodes();
        return createExecution(request, result, {
          success: result,
          changed: result,
          recordable: false
        });
      }
      case "clipboard.cut-selection": {
        const result = nodeCommands.cutSelectedNodes();
        return createExecution(request, result, {
          success: result,
          changed: result,
          recordable: true
        });
      }
      case "clipboard.paste": {
        const result = canvasCommands.pasteClipboardAt(request.point);
        return createExecution(request, result, {
          success: hasCreatedNodes(result),
          changed: hasCreatedNodes(result),
          recordable: true
        });
      }
      case "node.duplicate": {
        const result = nodeCommands.duplicateNode(
          request.nodeId,
          request.x,
          request.y
        );
        return createExecution(request, result, {
          success: hasCreatedNodes(result),
          changed: hasCreatedNodes(result),
          recordable: true
        });
      }
      case "node.remove": {
        const result = nodeCommands.removeNode(request.nodeId);
        return createExecution(request, result, {
          success: result,
          changed: result,
          recordable: true
        });
      }
      case "node.reset-size": {
        const result = nodeCommands.resetNodeSize(request.nodeId);
        return createExecution(request, result, {
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
          success: true,
          changed,
          recordable: false
        });
      }
      case "selection.duplicate": {
        const result = nodeCommands.duplicateSelectedNodes();
        return createExecution(request, result, {
          success: hasCreatedNodes(result),
          changed: hasCreatedNodes(result),
          recordable: true
        });
      }
      case "selection.remove": {
        const result = nodeCommands.removeSelectedNodes();
        return createExecution(request, result, {
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
