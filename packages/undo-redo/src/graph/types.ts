import type {
  LeaferGraphGraphHistoryConfig,
  NormalizedLeaferGraphGraphHistoryConfig
} from "@leafergraph/config/graph";
import type {
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphHistoryEvent
} from "@leafergraph/contracts";
import type { GraphDocument } from "@leafergraph/node";
import type { UndoRedoController } from "../core/types";

export interface LeaferGraphUndoRedoHost {
  subscribeHistory(
    listener: (event: LeaferGraphHistoryEvent) => void
  ): () => void;
  applyGraphOperation(operation: GraphOperation): GraphOperationApplyResult;
  replaceGraphDocument(document: GraphDocument): void;
}

export interface BindLeaferGraphUndoRedoOptions {
  host: LeaferGraphUndoRedoHost;
  config?: LeaferGraphGraphHistoryConfig;
}

export interface BoundLeaferGraphUndoRedo {
  controller: UndoRedoController;
  config: NormalizedLeaferGraphGraphHistoryConfig;
  destroy(): void;
}
