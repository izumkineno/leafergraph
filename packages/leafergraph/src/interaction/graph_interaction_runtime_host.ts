/**
 * 图交互运行时宿主模块。
 *
 * @remarks
 * 负责把拖拽、缩放、折叠、端口命中和连接预览相关能力
 * 收敛成交互层可消费的壳面。
 */

import type { NodeRuntimeState } from "@leafergraph/core/node";
import type {
  LeaferGraphInteractionRuntimeHostOptions,
  LeaferGraphInteractionRuntimeLike,
  LeaferGraphInteractionRuntimeNodeViewState,
  GraphDragNodePosition
} from "./runtime/types";
import { LeaferGraphInteractionRuntimeHostController } from "./runtime/controller";

export type {
  LeaferGraphInteractionRuntimeLike,
  LeaferGraphInteractionRuntimeNodeViewState,
  GraphDragNodePosition
};

/**
 * 交互运行时桥接宿主。
 *
 * @remarks
 * 当前专门负责把 interaction 需要的多类节点反馈与图变更入口收敛成单一壳面，
 * 避免 interaction 继续直接认识 view / shell / scene / mutation / runtime 多个宿主。
 */
export class LeaferGraphInteractionRuntimeHost<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
> extends LeaferGraphInteractionRuntimeHostController<
  TNodeState,
  TNodeViewState
> implements LeaferGraphInteractionRuntimeLike<TNodeState, TNodeViewState> {
  /**
   * 初始化 LeaferGraphInteractionRuntimeHost 实例。
   *
   * @param options - 交互运行时装配选项。
   * @returns 无返回值。
   */
  constructor(
    options: LeaferGraphInteractionRuntimeHostOptions<TNodeState, TNodeViewState>
  ) {
    super(options);
  }
}
