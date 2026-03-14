import type {
  LeaferGraph,
  LeaferGraphContextMenuContext
} from "leafergraph";
import type {
  EditorNodeCommandController,
  EditorNodeCommandResult
} from "./node_commands";
import { createQuickCreateDemoNodeInput } from "../demo/demo-setup";

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
  /** 在指定画布位置快速创建节点。 */
  createNodeAt(
    context: LeaferGraphContextMenuContext
  ): ReturnType<LeaferGraph["createNode"]> | null;
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
  /** 快捷创建节点的起始序号。 */
  startIndex?: number;
  /** 视口发生变化后的回调，用于同步鼠标坐标等外部状态。 */
  onAfterFitView?: () => void;
}

/**
 * 创建 editor 画布命令控制器。
 * 这层只做“画布语义”，不关心节点内部细节。
 */
export function createEditorCanvasCommandController(
  options: CreateEditorCanvasCommandControllerOptions
): EditorCanvasCommandController {
  let quickCreateIndex = Math.max(options.startIndex ?? 1, 1);

  const createNodeAt = (
    context: LeaferGraphContextMenuContext
  ): ReturnType<LeaferGraph["createNode"]> | null => {
    const node = options.nodeCommands.createNode(
      createQuickCreateDemoNodeInput(context, quickCreateIndex)
    );
    quickCreateIndex += 1;
    return node;
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
    createNodeAt,
    pasteClipboardAt,
    fitView
  };
}
