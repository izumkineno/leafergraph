import type {
  LeaferGraph,
  LeaferGraphCreateNodeInput,
  LeaferGraphContextMenuContext
} from "leafergraph";
import type {
  EditorNodeCommandController,
  EditorNodeCommandResult
} from "./node_commands";

/**
 * editor 画布命令控制器。
 *
 * 这一层负责把“画布级动作”从 GraphViewport 中剥离出来：
 * - 右键画布菜单
 * - 键盘粘贴 / 适配视图
 * - 画布级快捷创建节点
 *
 * 这样后续要接入历史记录或命令系统时，只需替换这一层，
 * 不需要再去改 GraphViewport 的事件绑定。
 */
export interface EditorCanvasCommandController {
  /** 当前是否存在可粘贴的剪贴板内容。 */
  readonly canPaste: boolean;
  /** 读取当前“快速创建节点”命令是否可用。 */
  resolveCreateNodeState(nodeType?: string): EditorCanvasCreateNodeState;
  /** 在指定画布位置快速创建节点。 */
  createNodeAt(
    context: LeaferGraphContextMenuContext,
    nodeType?: string
  ): EditorNodeCommandResult | undefined;
  /** 将剪贴板节点粘贴到指定位置；若未提供坐标则回退到选区附近。 */
  pasteClipboardAt(
    point: { x: number; y: number } | null
  ): EditorNodeCommandResult | undefined;
  /** 让画布内容适配视图。 */
  fitView(): boolean;
}

/**
 * 画布命令控制器创建参数。
 * 画布命令并不重复实现节点命令，而是委托给 NodeCommandController。
 */
export interface CreateEditorCanvasCommandControllerOptions {
  graph: LeaferGraph;
  nodeCommands: EditorNodeCommandController;
  /** editor 优先希望创建的节点类型。 */
  quickCreateNodeType?: string;
  /** 视口发生变化后的回调，用于同步鼠标坐标等外部状态。 */
  onAfterFitView?: () => void;
}

/** editor 画布“快速创建节点”命令的最小状态。 */
export interface EditorCanvasCreateNodeState {
  disabled: boolean;
  description: string;
}

/** 创建一个最小的快速建节点输入。 */
function createQuickCreateNodeInput(
  context: LeaferGraphContextMenuContext,
  type: string
): LeaferGraphCreateNodeInput {
  return {
    type,
    x: Math.round(context.pagePoint.x),
    y: Math.round(context.pagePoint.y)
  };
}

/** 解析当前真正应使用的快速创建节点类型。 */
function resolveQuickCreateNodeType(
  graph: LeaferGraph,
  preferredType?: string
): string | undefined {
  const definitions = graph.listNodes();
  if (preferredType && definitions.some((definition) => definition.type === preferredType)) {
    return preferredType;
  }

  return definitions[0]?.type;
}

/** 解析一个显式节点类型是否已注册；未提供时回退到快速创建节点类型。 */
function resolveRequestedNodeType(
  graph: LeaferGraph,
  preferredType?: string,
  explicitType?: string
): string | undefined {
  const definitions = graph.listNodes();
  if (
    explicitType &&
    definitions.some((definition) => definition.type === explicitType)
  ) {
    return explicitType;
  }

  return resolveQuickCreateNodeType(graph, preferredType);
}

/**
 * 创建 editor 画布命令控制器。
 * 这层只做“画布语义”，不关心节点内部细节。
 */
export function createEditorCanvasCommandController(
  options: CreateEditorCanvasCommandControllerOptions
): EditorCanvasCommandController {
  const resolveCreateNodeState = (
    explicitType?: string
  ): EditorCanvasCreateNodeState => {
    const nodeType = resolveRequestedNodeType(
      options.graph,
      options.quickCreateNodeType,
      explicitType
    );

    if (!nodeType) {
      return {
        disabled: true,
        description: "当前没有可用的节点类型，请先加载 node 或 widget bundle"
      };
    }

    return {
      disabled: false,
      description: `将在当前位置创建 ${nodeType}`
    };
  };

  const createNodeAt = (
    context: LeaferGraphContextMenuContext,
    explicitType?: string
  ): EditorNodeCommandResult | undefined => {
    const nodeType = resolveRequestedNodeType(
      options.graph,
      options.quickCreateNodeType,
      explicitType
    );
    if (!nodeType) {
      return undefined;
    }

    const node = options.nodeCommands.createNode(
      createQuickCreateNodeInput(context, nodeType)
    );
    return node ? [node] : undefined;
  };

  const pasteClipboardAt = (
    point: { x: number; y: number } | null
  ): EditorNodeCommandResult | undefined => {
    if (!options.nodeCommands.clipboard) {
      return undefined;
    }

    if (point) {
      return options.nodeCommands.pasteClipboardAt(point.x, point.y);
    }

    return options.nodeCommands.pasteClipboardNearSelection();
  };

  const fitView = (): boolean => {
    const changed = options.graph.fitView();
    if (changed) {
      options.onAfterFitView?.();
    }
    return changed;
  };

  return {
    get canPaste(): boolean {
      return Boolean(options.nodeCommands.clipboard);
    },
    resolveCreateNodeState,
    createNodeAt,
    pasteClipboardAt,
    fitView
  };
}
