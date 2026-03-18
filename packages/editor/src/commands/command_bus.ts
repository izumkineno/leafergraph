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
  GraphLink,
  GraphOperation,
  LeaferGraph,
  LeaferGraphCreateLinkInput,
  LeaferGraphContextMenuContext,
  LeaferGraphUpdateNodeInput
} from "leafergraph";
import {
  createEditorCanvasCommandController,
  type EditorCanvasCreatePlacement,
  type CreateEditorCanvasCommandControllerOptions,
  type EditorCanvasCreateNodeState
} from "./canvas_commands";
import {
  createEditorNodeCommandController,
  type CreateEditorNodeCommandControllerOptions,
  type EditorNodeClipboard,
  type EditorNodeCommandResult,
  type EditorNodeSnapshot,
  type EditorNodeResizeCommandState
} from "./node_commands";
import {
  createEditorLinkCommandController,
  type EditorLinkReconnectInput
} from "./link_commands";
import {
  createLinkCreateOperation,
  createLinkReconnectOperation,
  createLinkRemoveOperation,
  createNodeCreateOperationFromSnapshot,
  createNodeRemoveOperation,
  createNodeResizeOperation,
  type EditorGraphNodeSnapshot
} from "./graph_operation_utils";
import type { EditorNodeSelectionController } from "../state/selection";
import type { EditorGraphOperationAuthorityConfirmation } from "../session/graph_document_session";

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
      type: "canvas.create-node-by-type";
      context: LeaferGraphContextMenuContext;
      nodeType: string;
    }
  | {
      type: "canvas.create-node-from-workspace";
      nodeType: string;
      placement: EditorCanvasCreatePlacement;
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
      type: "node.play";
      nodeId: string;
    }
  | {
      type: "node.reset-size";
      nodeId: string;
    }
  | {
      type: "interaction.move";
      nodeIds: readonly string[];
    }
  | {
      type: "interaction.resize";
      nodeId: string;
    }
  | {
      type: "interaction.collapse";
      nodeId: string;
      collapsed: boolean;
    }
  | {
      type: "interaction.widget-commit";
      nodeId: string;
      widgetIndex: number;
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
  | GraphLink
  | EditorNodeSnapshot
  | EditorNodeCommandResult
  | boolean
  | null
  | undefined;

/** editor 命令历史负载中复用的正式节点快照类型。 */
export type EditorCommandNodeSnapshot = EditorGraphNodeSnapshot;

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
      links: GraphLink[];
    }
  | {
      kind: "move-nodes";
      positions: Array<{
        nodeId: string;
        beforePosition: {
          x: number;
          y: number;
        };
        afterPosition: {
          x: number;
          y: number;
        };
      }>;
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
      kind: "update-node";
      nodeId: string;
      beforeInput: LeaferGraphUpdateNodeInput;
      afterInput: LeaferGraphUpdateNodeInput;
    }
  | {
      kind: "create-links";
      links: GraphLink[];
    }
  | {
      kind: "remove-links";
      links: GraphLink[];
    }
  | {
      kind: "reconnect-link";
      beforeLink: GraphLink;
      afterLink: GraphLink;
    };

/** editor 命令 authority 状态。 */
export type EditorCommandAuthorityStatus =
  | "not-applicable"
  | "pending"
  | "confirmed"
  | "rejected";

/** 一次命令执行对应的 authority 状态快照。 */
export interface EditorCommandAuthorityState {
  /** 当前 authority 状态。 */
  status: EditorCommandAuthorityStatus;
  /** 相关操作 ID。 */
  operationIds: string[];
  /** 当前状态附带的原因。 */
  reason?: string;
  /** 当前 pending 操作 ID。 */
  pendingOperationIds?: string[];
  /** authority 最终确认；仅在 `pending` 时存在。 */
  confirmation?: Promise<EditorGraphOperationAuthorityConfirmation[]>;
}

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
  /** 本次执行对外暴露的正式图操作列表。 */
  operations?: GraphOperation[];
  /** 本次执行是否已经在 session 内完成文档回填。 */
  documentRecorded?: boolean;
  /** 本次执行可供历史记录消费的最小前后状态。 */
  historyPayload?: EditorCommandHistoryPayload;
  /** 本次执行对应的 authority 状态。 */
  authority: EditorCommandAuthorityState;
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
 * editor 命令展示状态。
 *
 * @remarks
 * 这一层专门给右键菜单、快捷键提示和未来工具栏复用：
 * - `disabled` 统一表达当前命令能否从交互入口发起
 * - `description` 给菜单说明、按钮 tooltip 和后续命令面板使用
 * - `shortcut` / `danger` 让不同 UI 入口共享同一份展示元数据
 */
export interface EditorCommandState {
  /** 当前命令是否处于禁用态。 */
  disabled: boolean;
  /** 当前命令对用户可见的最小说明文案。 */
  description: string;
  /** 当前命令的默认快捷键提示。 */
  shortcut?: string;
  /** 当前命令是否属于危险动作。 */
  danger?: boolean;
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
  /** 读取某个命令当前的统一展示状态。 */
  resolveCommandState(request: EditorCommandRequest): EditorCommandState;
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
    Pick<
      CreateEditorCanvasCommandControllerOptions,
      | "quickCreateNodeType"
      | "onAfterFitView"
      | "resolveLastPointerPagePoint"
      | "resolveViewportCenterPagePoint"
    > {
  /** 命令真正执行完成后的订阅入口，供未来历史记录与调试面板复用。 */
  onDidExecute?(execution: EditorCommandExecution): void;
  /** 当前图运行时是否已经准备完成。 */
  isRuntimeReady?(): boolean;
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
function cloneLinkSnapshot(link: GraphLink): GraphLink {
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
): GraphLink[] {
  const linkMap = new Map<string, GraphLink>();

  for (const nodeId of nodeIds) {
    for (const link of graph.findLinksByNode(nodeId)) {
      if (!linkMap.has(link.id)) {
        linkMap.set(link.id, cloneLinkSnapshot(link));
      }
    }
  }

  return [...linkMap.values()];
}

/** 等待一组操作完成 authority 确认。 */
function waitForOperationConfirmations(
  session: CreateEditorCommandBusOptions["session"],
  operationIds: readonly string[]
): Promise<EditorGraphOperationAuthorityConfirmation[]> {
  if (!operationIds.length) {
    return Promise.resolve([]);
  }

  return new Promise<EditorGraphOperationAuthorityConfirmation[]>((resolve) => {
    const pendingOperationIds = new Set(operationIds);
    const confirmations = new Map<string, EditorGraphOperationAuthorityConfirmation>();

    const unsubscribe = session.subscribeOperationConfirmation((confirmation) => {
      if (!pendingOperationIds.has(confirmation.operationId)) {
        return;
      }

      pendingOperationIds.delete(confirmation.operationId);
      confirmations.set(confirmation.operationId, confirmation);

      if (pendingOperationIds.size > 0) {
        return;
      }

      unsubscribe();
      resolve(
        operationIds
          .map((operationId) => confirmations.get(operationId))
          .filter(
            (
              confirmation
            ): confirmation is EditorGraphOperationAuthorityConfirmation =>
              Boolean(confirmation)
          )
      );
    });
  });
}

/** 把一组正式节点快照映射成 `node.create` 操作。 */
function createNodeCreateOperations(
  nodeSnapshots: readonly EditorCommandNodeSnapshot[],
  source = "editor"
): GraphOperation[] {
  return nodeSnapshots.map((snapshot) =>
    createNodeCreateOperationFromSnapshot(snapshot, source)
  );
}

/** 把一组节点 ID 映射成 `node.remove` 操作。 */
function createNodeRemoveOperations(
  nodeIds: readonly string[],
  source = "editor"
): GraphOperation[] {
  return nodeIds.map((nodeId) => createNodeRemoveOperation(nodeId, source));
}

/** 从“创建节点”类命令结果里提取正式节点快照。 */
function captureCreatedNodeSnapshots(
  result: EditorCommandResultValue
): EditorCommandNodeSnapshot[] {
  if (!result || typeof result === "boolean") {
    return [];
  }

  const createdNodes = Array.isArray(result) ? result : [result];

  return createdNodes
    .filter(
      (snapshot): snapshot is EditorNodeSnapshot =>
        Boolean(
          snapshot &&
            typeof snapshot === "object" &&
            "id" in snapshot &&
            "layout" in snapshot &&
            "type" in snapshot
        )
    )
    .map(cloneNodeSnapshot);
}

/** 判断这组节点快照是否已经真实投影到当前 graph。 */
function areNodeSnapshotsProjected(
  graph: LeaferGraph,
  nodeSnapshots: readonly EditorCommandNodeSnapshot[]
): boolean {
  return (
    nodeSnapshots.length > 0 &&
    nodeSnapshots.every((snapshot) => Boolean(graph.getNodeSnapshot(snapshot.id)))
  );
}

/** 判断某条连线是否已经真实投影到当前 graph。 */
function isLinkProjected(
  graph: LeaferGraph,
  link: GraphLink | undefined
): boolean {
  return Boolean(link?.id && graph.getLink(link.id));
}

/** 判断一组节点是否已经从当前 graph 中移除。 */
function areNodeIdsRemoved(
  graph: LeaferGraph,
  nodeIds: readonly string[]
): boolean {
  return (
    nodeIds.length > 0 &&
    nodeIds.every((nodeId) => !graph.getNodeSnapshot(nodeId))
  );
}

/** 判断当前节点尺寸是否已经投影到 graph。 */
function isNodeSizeProjected(
  graph: LeaferGraph,
  nodeId: string,
  size: { width: number; height: number }
): boolean {
  const snapshot = graph.getNodeSnapshot(nodeId);
  if (!snapshot) {
    return false;
  }

  return (
    Math.round(snapshot.layout.width ?? 0) === Math.round(size.width) &&
    Math.round(snapshot.layout.height ?? 0) === Math.round(size.height)
  );
}

/** 判断当前连线端点是否已经投影到 graph。 */
function isLinkEndpointProjected(
  graph: LeaferGraph,
  link: GraphLink | undefined
): boolean {
  if (!link) {
    return false;
  }

  const currentLink = graph.getLink(link.id);
  return Boolean(currentLink && JSON.stringify(currentLink) === JSON.stringify(link));
}

/** 为命令执行生成最小摘要文本。 */
function resolveCommandSummary(request: EditorCommandRequest): string {
  switch (request.type) {
    case "canvas.create-node":
      return "在画布创建节点";
    case "canvas.create-node-by-type":
      return `创建节点 ${request.nodeType}`;
    case "canvas.create-node-from-workspace":
      return `从节点库创建 ${request.nodeType}`;
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
    case "node.play":
      return `从节点 ${request.nodeId} 开始运行`;
    case "node.reset-size":
      return `重置节点 ${request.nodeId} 尺寸`;
    case "interaction.move":
      return request.nodeIds.length > 1
        ? `移动 ${request.nodeIds.length} 个节点`
        : `移动节点 ${request.nodeIds[0] ?? ""}`;
    case "interaction.resize":
      return `调整节点 ${request.nodeId} 尺寸`;
    case "interaction.collapse":
      return `${request.collapsed ? "折叠" : "展开"}节点 ${request.nodeId}`;
    case "interaction.widget-commit":
      return `提交节点 ${request.nodeId} 的 Widget ${request.widgetIndex}`;
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
    session: options.session,
    selection: options.selection,
    bindNode: options.bindNode,
    unbindNode: options.unbindNode
  });
  const linkCommands = createEditorLinkCommandController({
    graph: options.graph,
    session: options.session
  });
  const canvasCommands = createEditorCanvasCommandController({
    graph: options.graph,
    nodeCommands,
    quickCreateNodeType: options.quickCreateNodeType,
    onAfterFitView: options.onAfterFitView,
    resolveLastPointerPagePoint: options.resolveLastPointerPagePoint,
    resolveViewportCenterPagePoint: options.resolveViewportCenterPagePoint
  });

  const hasSelection = (selection: EditorNodeSelectionController): boolean =>
    Boolean(selection.primarySelectedNodeId);
  const isRuntimeReady = (): boolean => options.isRuntimeReady?.() ?? true;
  let lastExecution: EditorCommandExecution | null = null;

  const commitExecution = (
    execution: EditorCommandExecution
  ): EditorCommandExecution => {
    lastExecution = execution;
    options.onDidExecute?.(execution);
    return execution;
  };

  const resolveExecutionAuthorityState = (
    executionState: Pick<
      EditorCommandExecution,
      "success" | "changed" | "operations"
    >,
    pendingOperationIdsBefore: ReadonlySet<string>
  ): EditorCommandAuthorityState => {
    const pendingOperationIdsAfter = new Set(options.session.pendingOperationIds);
    const pendingOperationIds = [...pendingOperationIdsAfter].filter(
      (operationId) => !pendingOperationIdsBefore.has(operationId)
    );
    const operationIds = [
      ...new Set([
        ...(executionState.operations?.map((operation) => operation.operationId) ?? []),
        ...pendingOperationIds
      ])
    ];

    if (pendingOperationIds.length > 0) {
      return {
        status: "pending",
        operationIds,
        pendingOperationIds,
        reason: "等待 authority 确认",
        confirmation: waitForOperationConfirmations(
          options.session,
          pendingOperationIds
        )
      };
    }

    if (!operationIds.length) {
      return {
        status: "not-applicable",
        operationIds: []
      };
    }

    if (executionState.success && executionState.changed) {
      return {
        status: "confirmed",
        operationIds
      };
    }

    if (executionState.success) {
      return {
        status: "confirmed",
        operationIds,
        reason: "操作已接受，但没有产生状态变化"
      };
    }

    return {
      status: "rejected",
      operationIds,
      reason: "命令执行未被 authority 接受"
    };
  };

  const createExecution = (
    request: EditorCommandRequest,
    result: EditorCommandResultValue,
    executionState: Pick<
      EditorCommandExecution,
      | "success"
      | "changed"
      | "recordable"
      | "historyPayload"
      | "operations"
      | "documentRecorded"
    >,
    pendingOperationIdsBefore: ReadonlySet<string>
  ): EditorCommandExecution =>
    commitExecution({
      request,
      result,
      operations: executionState.operations,
      documentRecorded: executionState.documentRecorded,
      historyPayload: executionState.historyPayload,
      authority: resolveExecutionAuthorityState(
        executionState,
        pendingOperationIdsBefore
      ),
      success: executionState.success,
      changed: executionState.changed,
      recordable: executionState.recordable,
      summary: resolveCommandSummary(request),
      timestamp: Date.now()
    });

  const requiresRuntimeReady = (request: EditorCommandRequest): boolean => {
    switch (request.type) {
      case "canvas.create-node":
      case "canvas.create-node-from-workspace":
      case "canvas.fit-view":
      case "clipboard.paste":
      case "link.create":
      case "link.remove":
      case "link.reconnect":
      case "node.play":
      case "node.reset-size":
        return true;
      default:
        return false;
    }
  };

  const resolveCommandDisabled = (request: EditorCommandRequest): boolean => {
    if (requiresRuntimeReady(request) && !isRuntimeReady()) {
      return true;
    }

    switch (request.type) {
      case "canvas.create-node":
        return canvasCommands.resolveCreateNodeState().disabled;
      case "canvas.create-node-by-type":
      case "canvas.create-node-from-workspace":
        return canvasCommands.resolveCreateNodeState(request.nodeType).disabled;
      case "canvas.fit-view":
        return false;
      case "link.create":
        return false;
      case "link.remove":
        return !linkCommands.hasLink(request.linkId);
      case "link.reconnect":
        return !linkCommands.hasLink(request.linkId);
      case "clipboard.copy-node":
        return !Boolean(options.graph.getNodeSnapshot(request.nodeId));
      case "clipboard.copy-selection":
      case "clipboard.cut-selection":
      case "selection.copy":
      case "selection.duplicate":
      case "selection.remove":
        return !hasSelection(options.selection);
      case "clipboard.paste":
        return !Boolean(nodeCommands.clipboard);
      case "node.duplicate":
        return !Boolean(options.graph.getNodeSnapshot(request.nodeId));
      case "node.remove":
        return !Boolean(options.graph.getNodeSnapshot(request.nodeId));
      case "node.play":
        return !Boolean(options.graph.getNodeSnapshot(request.nodeId));
      case "node.reset-size":
        return nodeCommands.resolveResizeState(request.nodeId).disabled;
      case "selection.clear":
        return options.selection.selectedNodeIds.length === 0;
      case "selection.select-all":
        return request.nodeIds.length === 0;
      default:
        return true;
    }
  };

  const canExecute = (request: EditorCommandRequest): boolean =>
    !resolveCommandDisabled(request);

  const resolveCommandState = (
    request: EditorCommandRequest
  ): EditorCommandState => {
    const disabled = resolveCommandDisabled(request);

    switch (request.type) {
      case "canvas.create-node": {
        if (!isRuntimeReady()) {
          return {
            disabled,
            description: "图初始化完成后可用"
          };
        }

        return {
          disabled,
          description: canvasCommands.resolveCreateNodeState().description
        };
      }
      case "canvas.create-node-by-type": {
        if (!isRuntimeReady()) {
          return {
            disabled,
            description: "图初始化完成后可用"
          };
        }

        return {
          disabled,
          description: canvasCommands.resolveCreateNodeState(request.nodeType)
            .description
        };
      }
      case "canvas.create-node-from-workspace": {
        if (!isRuntimeReady()) {
          return {
            disabled,
            description: "图初始化完成后可用"
          };
        }

        return {
          disabled,
          description:
            request.placement === "last-pointer"
              ? `${canvasCommands.resolveCreateNodeState(request.nodeType).description}，优先落在最近鼠标位置`
              : `${canvasCommands.resolveCreateNodeState(request.nodeType).description}，落在当前视口中心`
        };
      }
      case "canvas.fit-view":
        return {
          disabled,
          description: isRuntimeReady()
            ? "已接入 @leafer-in/view 的 fitView()"
            : "图初始化完成后可用",
          shortcut: "Shift+1"
        };
      case "link.create":
        return {
          disabled,
          description: isRuntimeReady()
            ? "创建一条正式连线"
            : "图初始化完成后可用"
        };
      case "link.remove":
        return {
          disabled,
          description: isRuntimeReady()
            ? "删除当前正式连线"
            : "图初始化完成后可用",
          shortcut: "Delete",
          danger: true
        };
      case "link.reconnect":
        return {
          disabled,
          description: isRuntimeReady()
            ? "从当前输出端口重新选择目标输入端口，按 Esc 可取消"
            : "图初始化完成后可用"
        };
      case "clipboard.copy-node":
        return {
          disabled,
          description: nodeCommands.isClipboardSourceNode(request.nodeId)
            ? "当前节点已经在剪贴板中，再次复制会刷新快照"
            : "保存当前节点快照，供画布菜单粘贴使用",
          shortcut: "Ctrl+C"
        };
      case "clipboard.copy-selection":
      case "selection.copy":
        return {
          disabled,
          description: "把当前多选节点整体写入剪贴板，并保留相对布局",
          shortcut: "Ctrl+C"
        };
      case "clipboard.cut-selection":
        return {
          disabled,
          description:
            options.selection.selectedNodeIds.length > 1
              ? "把当前多选节点写入剪贴板后，从画布中批量移除"
              : "把当前节点写入剪贴板后，从画布中移除",
          shortcut: "Ctrl+X"
        };
      case "clipboard.paste":
        return {
          disabled,
          description: isRuntimeReady()
            ? `把最近复制的节点放到当前画布位置${
                options.selection.primarySelectedNodeId ? "，并切换选中态" : ""
              }`
            : "图初始化完成后可用",
          shortcut: "Ctrl+V"
        };
      case "node.duplicate":
        return {
          disabled,
          description: "基于当前节点快照创建一个偏移副本",
          shortcut: "Ctrl+D"
        };
      case "node.remove": {
        const isSelected = options.selection.isSelected(request.nodeId);
        const isMultipleSelected = options.selection.hasMultipleSelected();
        const isCopiedSource = nodeCommands.isClipboardSourceNode(request.nodeId);

        return {
          disabled,
          description:
            (isSelected && isMultipleSelected) || isCopiedSource
              ? "删除时会同步更新当前多选态和复制态"
              : isSelected
                ? "删除时会同步清理当前节点的选中态和复制态"
                : "已接入主包 removeNode(...)",
          shortcut: "Delete",
          danger: true
        };
      }
      case "node.play": {
        if (!isRuntimeReady()) {
          return {
            disabled,
            description: "图初始化完成后可用"
          };
        }

        const executionState = options.graph.getNodeExecutionState(request.nodeId);
        if (!executionState || executionState.status === "idle") {
          return {
            disabled,
            description:
              "从当前节点开始运行正式执行链；若节点未实现 onExecute(...) 则不会产生运行结果"
          };
        }

        if (executionState.status === "running") {
          return {
            disabled,
            description: `节点正在执行中，当前累计执行 ${executionState.runCount} 次`
          };
        }

        if (executionState.status === "success") {
          return {
            disabled,
            description: `最近一次执行成功，当前累计执行 ${executionState.runCount} 次`
          };
        }

        return {
          disabled,
          description: executionState.lastErrorMessage
            ? `最近一次执行失败：${executionState.lastErrorMessage}`
            : "最近一次执行失败，请查看节点信号灯或控制台日志"
        };
      }
      case "node.reset-size":
        return {
          disabled,
          description: isRuntimeReady()
            ? nodeCommands.resolveResizeState(request.nodeId).description
            : "图初始化完成后可用"
        };
      case "selection.clear":
        return {
          disabled,
          description: "清空当前选区"
        };
      case "selection.duplicate":
        return {
          disabled,
          description: "按当前多选节点的相对布局创建一组偏移副本",
          shortcut: "Ctrl+D"
        };
      case "selection.remove":
        return {
          disabled,
          description: "删除当前选区，并同步更新选中态和复制态",
          shortcut: "Delete",
          danger: true
        };
      case "selection.select-all":
        return {
          disabled,
          description: `选中当前 ${request.nodeIds.length} 个节点`,
          shortcut: "Ctrl+A"
        };
      default:
        return {
          disabled,
          description: "执行 editor 命令"
        };
    }
  };

  const execute = (
    request: EditorCommandRequest
  ): EditorCommandExecution => {
    const pendingOperationIdsBefore = new Set(options.session.pendingOperationIds);

    if (!canExecute(request)) {
      return createExecution(request, undefined, {
        operations: undefined,
        documentRecorded: undefined,
        historyPayload: undefined,
        success: false,
        changed: false,
        recordable: false
      }, pendingOperationIdsBefore);
    }

    switch (request.type) {
      case "canvas.create-node": {
        const result = canvasCommands.createNodeAt(request.context);
        const nodeSnapshots = captureCreatedNodeSnapshots(result);
        return createExecution(request, result, {
          operations: nodeSnapshots.length
            ? createNodeCreateOperations(nodeSnapshots)
            : undefined,
          documentRecorded: areNodeSnapshotsProjected(options.graph, nodeSnapshots),
          historyPayload: nodeSnapshots.length
            ? {
                kind: "create-nodes",
                nodeSnapshots
              }
            : undefined,
          success: nodeSnapshots.length > 0,
          changed: nodeSnapshots.length > 0,
          recordable: true
        }, pendingOperationIdsBefore);
      }
      case "canvas.create-node-by-type": {
        const result = canvasCommands.createNodeAt(
          request.context,
          request.nodeType
        );
        const nodeSnapshots = captureCreatedNodeSnapshots(result);
        return createExecution(request, result, {
          operations: nodeSnapshots.length
            ? createNodeCreateOperations(nodeSnapshots)
            : undefined,
          documentRecorded: areNodeSnapshotsProjected(options.graph, nodeSnapshots),
          historyPayload: nodeSnapshots.length
            ? {
                kind: "create-nodes",
                nodeSnapshots
              }
            : undefined,
          success: nodeSnapshots.length > 0,
          changed: nodeSnapshots.length > 0,
          recordable: true
        }, pendingOperationIdsBefore);
      }
      case "canvas.create-node-from-workspace": {
        const result = canvasCommands.createNodeForWorkspace(
          request.nodeType,
          request.placement
        );
        const nodeSnapshots = captureCreatedNodeSnapshots(result);
        return createExecution(request, result, {
          operations: nodeSnapshots.length
            ? createNodeCreateOperations(nodeSnapshots)
            : undefined,
          documentRecorded: areNodeSnapshotsProjected(options.graph, nodeSnapshots),
          historyPayload: nodeSnapshots.length
            ? {
                kind: "create-nodes",
                nodeSnapshots
              }
            : undefined,
          success: nodeSnapshots.length > 0,
          changed: nodeSnapshots.length > 0,
          recordable: true
        }, pendingOperationIdsBefore);
      }
      case "canvas.fit-view": {
        const result = canvasCommands.fitView();
        return createExecution(request, result, {
          operations: undefined,
          documentRecorded: undefined,
          historyPayload: undefined,
          success: true,
          changed: result,
          recordable: false
        }, pendingOperationIdsBefore);
      }
      case "link.create": {
        const result = linkCommands.createLink(request.input);
        return createExecution(request, result, {
          operations: [createLinkCreateOperation(result)],
          documentRecorded: isLinkProjected(options.graph, result),
          historyPayload: {
            kind: "create-links",
            links: [structuredClone(result)]
          },
          success: true,
          changed: true,
          recordable: true
        }, pendingOperationIdsBefore);
      }
      case "link.remove": {
        const link = linkCommands.getLink(request.linkId);
        const result = linkCommands.removeLink(request.linkId);
        return createExecution(request, result, {
          operations: result
            ? [createLinkRemoveOperation(request.linkId)]
            : undefined,
          documentRecorded: result ? !linkCommands.hasLink(request.linkId) : undefined,
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
        }, pendingOperationIdsBefore);
      }
      case "link.reconnect": {
        const beforeLink = linkCommands.getLink(request.linkId);
        const result = linkCommands.reconnectLink(request.linkId, request.input);
        return createExecution(request, result, {
          operations: result
            ? [
                createLinkReconnectOperation(
                  request.linkId,
                  structuredClone(request.input)
                )
              ]
            : undefined,
          documentRecorded: isLinkEndpointProjected(options.graph, result),
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
        }, pendingOperationIdsBefore);
      }
      case "clipboard.copy-node": {
        const result = nodeCommands.copyNode(request.nodeId);
        return createExecution(request, result, {
          operations: undefined,
          documentRecorded: undefined,
          historyPayload: undefined,
          success: result,
          changed: result,
          recordable: false
        }, pendingOperationIdsBefore);
      }
      case "clipboard.copy-selection":
      case "selection.copy": {
        const result = nodeCommands.copySelectedNodes();
        return createExecution(request, result, {
          operations: undefined,
          documentRecorded: undefined,
          historyPayload: undefined,
          success: result,
          changed: result,
          recordable: false
        }, pendingOperationIdsBefore);
      }
      case "clipboard.cut-selection": {
        const selectedNodeIds = [...options.selection.selectedNodeIds];
        const nodeSnapshots = captureNodeSnapshots(options.graph, selectedNodeIds);
        const links = captureRelatedLinks(options.graph, selectedNodeIds);
        const result = nodeCommands.cutSelectedNodes();
        return createExecution(request, result, {
          operations:
            result && selectedNodeIds.length
              ? createNodeRemoveOperations(selectedNodeIds)
              : undefined,
          documentRecorded: result
            ? areNodeIdsRemoved(options.graph, selectedNodeIds)
            : undefined,
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
        }, pendingOperationIdsBefore);
      }
      case "clipboard.paste": {
        const result = canvasCommands.pasteClipboardAt(request.point);
        const nodeSnapshots = captureCreatedNodeSnapshots(result);
        return createExecution(request, result, {
          operations: nodeSnapshots.length
            ? createNodeCreateOperations(nodeSnapshots)
            : undefined,
          documentRecorded: areNodeSnapshotsProjected(options.graph, nodeSnapshots),
          historyPayload: nodeSnapshots.length
            ? {
                kind: "create-nodes",
                nodeSnapshots
              }
            : undefined,
          success: nodeSnapshots.length > 0,
          changed: nodeSnapshots.length > 0,
          recordable: true
        }, pendingOperationIdsBefore);
      }
      case "node.duplicate": {
        const result = nodeCommands.duplicateNode(
          request.nodeId,
          request.x,
          request.y
        );
        const nodeSnapshots = captureCreatedNodeSnapshots(result);
        return createExecution(request, result, {
          operations: nodeSnapshots.length
            ? createNodeCreateOperations(nodeSnapshots)
            : undefined,
          documentRecorded: areNodeSnapshotsProjected(options.graph, nodeSnapshots),
          historyPayload: nodeSnapshots.length
            ? {
                kind: "create-nodes",
                nodeSnapshots
              }
            : undefined,
          success: nodeSnapshots.length > 0,
          changed: nodeSnapshots.length > 0,
          recordable: true
        }, pendingOperationIdsBefore);
      }
      case "node.remove": {
        const nodeSnapshots = captureNodeSnapshots(options.graph, [request.nodeId]);
        const links = captureRelatedLinks(options.graph, [request.nodeId]);
        const result = nodeCommands.removeNode(request.nodeId);
        return createExecution(request, result, {
          operations: result
            ? [createNodeRemoveOperation(request.nodeId)]
            : undefined,
          documentRecorded: result
            ? areNodeIdsRemoved(options.graph, [request.nodeId])
            : undefined,
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
        }, pendingOperationIdsBefore);
      }
      case "node.play": {
        const result = options.graph.playFromNode(request.nodeId);
        return createExecution(request, result, {
          operations: undefined,
          documentRecorded: undefined,
          historyPayload: undefined,
          success: result,
          changed: result,
          recordable: false
        }, pendingOperationIdsBefore);
      }
      case "node.reset-size": {
        const beforeSnapshot = options.graph.getNodeSnapshot(request.nodeId);
        const resizeConstraint = options.graph.getNodeResizeConstraint(request.nodeId);
        const result = nodeCommands.resetNodeSize(request.nodeId);
        const targetSize = resizeConstraint
          ? {
              width: resizeConstraint.defaultWidth,
              height: resizeConstraint.defaultHeight
            }
          : null;
        return createExecution(request, result, {
          operations:
            result && targetSize
              ? [
                  createNodeResizeOperation(request.nodeId, {
                    width: targetSize.width,
                    height: targetSize.height
                  })
                ]
              : undefined,
          documentRecorded:
            result && targetSize
              ? isNodeSizeProjected(options.graph, request.nodeId, targetSize)
              : undefined,
          historyPayload:
            result && beforeSnapshot && targetSize
              ? {
                  kind: "resize-node",
                  nodeId: request.nodeId,
                  beforeSize: {
                    width: beforeSnapshot.layout.width ?? 0,
                    height: beforeSnapshot.layout.height ?? 0
                  },
                  afterSize: {
                    width: targetSize.width,
                    height: targetSize.height
                  }
                }
              : undefined,
          success: result,
          changed: result,
          recordable: true
        }, pendingOperationIdsBefore);
      }
      case "selection.clear": {
        const prevSelectedNodeIds = [...options.selection.selectedNodeIds];
        options.selection.clear();
        const changed = prevSelectedNodeIds.length > 0;
        return createExecution(request, changed, {
          operations: undefined,
          documentRecorded: undefined,
          historyPayload: undefined,
          success: true,
          changed,
          recordable: false
        }, pendingOperationIdsBefore);
      }
      case "selection.duplicate": {
        const result = nodeCommands.duplicateSelectedNodes();
        const nodeSnapshots = captureCreatedNodeSnapshots(result);
        return createExecution(request, result, {
          operations: nodeSnapshots.length
            ? createNodeCreateOperations(nodeSnapshots)
            : undefined,
          documentRecorded: areNodeSnapshotsProjected(options.graph, nodeSnapshots),
          historyPayload: nodeSnapshots.length
            ? {
                kind: "create-nodes",
                nodeSnapshots
              }
            : undefined,
          success: nodeSnapshots.length > 0,
          changed: nodeSnapshots.length > 0,
          recordable: true
        }, pendingOperationIdsBefore);
      }
      case "selection.remove": {
        const selectedNodeIds = [...options.selection.selectedNodeIds];
        const nodeSnapshots = captureNodeSnapshots(options.graph, selectedNodeIds);
        const links = captureRelatedLinks(options.graph, selectedNodeIds);
        const result = nodeCommands.removeSelectedNodes();
        return createExecution(request, result, {
          operations:
            result && selectedNodeIds.length
              ? createNodeRemoveOperations(selectedNodeIds)
              : undefined,
          documentRecorded: result
            ? areNodeIdsRemoved(options.graph, selectedNodeIds)
            : undefined,
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
        }, pendingOperationIdsBefore);
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
          operations: undefined,
          documentRecorded: undefined,
          historyPayload: undefined,
          success: true,
          changed,
          recordable: false
        }, pendingOperationIdsBefore);
      }
      default:
        return createExecution(request, undefined, {
          operations: undefined,
          documentRecorded: undefined,
          historyPayload: undefined,
          success: false,
          changed: false,
          recordable: false
        }, pendingOperationIdsBefore);
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

    resolveCommandState(request: EditorCommandRequest): EditorCommandState {
      return resolveCommandState(request);
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
