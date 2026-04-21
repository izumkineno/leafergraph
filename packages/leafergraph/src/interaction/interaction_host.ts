/**
 * 图交互宿主模块。
 *
 * @remarks
 * 负责节点拖拽、节点缩放、折叠按钮和窗口级指针生命周期管理。
 */

import type { NodeRuntimeState } from "@leafergraph/core/node";
import type {
  LeaferGraphInteractiveNodeViewState,
  LeaferGraphInteractionHostOptions
} from "./host/types";
import { LeaferGraphInteractionHostController } from "./host/controller";

export type {
  LeaferGraphInteractiveNodeViewState
};

/**
 * 节点交互宿主。
 *
 * @remarks
 * 当前集中收口：
 * 1. 节点拖拽
 * 2. 节点 resize
 * 3. 节点折叠按钮
 * 4. 窗口级 pointer 生命周期
 */
export class LeaferGraphInteractionHost<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
> extends LeaferGraphInteractionHostController<
  TNodeState,
  TNodeViewState
> {
  /**
   * 初始化 LeaferGraphInteractionHost 实例。
   *
   * @param options - 图交互宿主初始化选项。
   * @returns 无返回值。
   */
  constructor(
    options: LeaferGraphInteractionHostOptions<TNodeState, TNodeViewState>
  ) {
    super(options);
  }
}
