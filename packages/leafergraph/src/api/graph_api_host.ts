/**
 * 主包公共 API 宿主模块。
 *
 * @remarks
 * 负责把内部运行时壳面收敛成对外可调用的图、节点、连线和主题接口。
 */

import type {
  LeaferGraphApiHostOptions,
  LeaferGraphApiLinkViewState,
  LeaferGraphApiNodeViewState,
  LeaferGraphApiRuntime
} from "./host/types";
import { LeaferGraphApiHostController } from "./host/controller";
import type { LeaferGraphRenderableNodeState } from "../graph/types";

export type { LeaferGraphApiRuntime };

/**
 * 主包公共 API facade。
 *
 * @remarks
 * 当前集中承接插件注册、视图查询、正式变更和订阅桥接等公共入口，
 * 真实实现下沉到 `api/host/*` 子目录。
 */
export class LeaferGraphApiHost<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState = LeaferGraphApiLinkViewState
> extends LeaferGraphApiHostController<
  TNodeState,
  TNodeViewState,
  TLinkViewState
> {
  /**
   * 初始化 LeaferGraphApiHost 实例。
   *
   * @param options - API 宿主装配选项。
   * @returns 无返回值。
   */
  constructor(
    options: LeaferGraphApiHostOptions<TNodeState, TNodeViewState, TLinkViewState>
  ) {
    super(options);
  }
}
