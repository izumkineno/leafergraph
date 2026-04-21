/**
 * LeaferGraph 撤销重做扩展的图宿主契约模块。
 *
 * @remarks
 * 负责定义图宿主需要提供的历史事件源和正式图操作入口，
 * 以便把通用撤销重做控制器接到 LeaferGraph 上。
 */

import type {
  LeaferGraphGraphHistoryConfig,
  NormalizedLeaferGraphGraphHistoryConfig
} from "@leafergraph/core/config";
import type {
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphHistoryEvent
} from "@leafergraph/core/contracts";
import type { GraphDocument } from "@leafergraph/core/node";
import type { UndoRedoController } from "../core/types";

/**
 * 图撤销重做扩展依赖的最小宿主能力。
 */
export interface LeaferGraphUndoRedoHost {
  /** 订阅图历史事件流。 */
  subscribeHistory(
    listener: (event: LeaferGraphHistoryEvent) => void
  ): () => void;
  /** 应用一条正式图操作。 */
  applyGraphOperation(operation: GraphOperation): GraphOperationApplyResult;
  /** 用整图替换结果回写当前文档。 */
  replaceGraphDocument(document: GraphDocument): void;
}

/**
 * 绑定图撤销重做扩展时使用的输入选项。
 */
export interface BindLeaferGraphUndoRedoOptions {
  /** 图宿主能力。 */
  host: LeaferGraphUndoRedoHost;
  /** 图历史配置。 */
  config?: LeaferGraphGraphHistoryConfig;
}

/**
 * 图撤销重做扩展绑定后的返回对象。
 */
export interface BoundLeaferGraphUndoRedo {
  /** 实际承担历史栈逻辑的控制器。 */
  controller: UndoRedoController;
  /** 已归一化的图历史配置。 */
  config: NormalizedLeaferGraphGraphHistoryConfig;
  /** 释放订阅和控制器资源。 */
  destroy(): void;
}
