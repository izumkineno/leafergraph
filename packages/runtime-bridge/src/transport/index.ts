import type { GraphDocument } from "@leafergraph/node";
import type {
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphHistoryEvent,
  RuntimeFeedbackEvent
} from "@leafergraph/contracts";
import type { GraphDocumentDiff } from "@leafergraph/contracts/graph-document-diff";
import type {
  RuntimeBridgeCatalogCommand,
  RuntimeBridgeCatalogCommandResult,
  RuntimeBridgeExtensionsSync
} from "../extensions/index.js";

export type RuntimeBridgeControlCommand =
  | {
      type: "play";
    }
  | {
      type: "step";
    }
  | {
      type: "stop";
    }
  | {
      type: "play-from-node";
      nodeId: string;
    };

export type RuntimeBridgeDiffMode = "diff" | "legacy";

export type RuntimeBridgeDiffCommand =
  | {
      type: "diff.mode.get";
    }
  | {
      type: "diff.mode.set";
      mode: RuntimeBridgeDiffMode;
    };

export type RuntimeBridgeDiffCommandResult = {
  type: "diff.mode.result";
  mode: RuntimeBridgeDiffMode;
};

/** transport 默认命令通道支持的正式命令集合。 */
export type RuntimeBridgeCommand =
  | RuntimeBridgeControlCommand
  | RuntimeBridgeDiffCommand
  | RuntimeBridgeCatalogCommand;

/** transport 默认命令通道可能返回的结果集合。 */
export type RuntimeBridgeCommandResult =
  | {
      type: "control.ok";
    }
  | RuntimeBridgeDiffCommandResult
  | RuntimeBridgeCatalogCommandResult;

export type RuntimeBridgeInboundEvent =
  | {
      type: "document.snapshot";
      document: GraphDocument;
    }
  | {
      type: "document.diff";
      diff: GraphDocumentDiff;
    }
  | {
      type: "runtime.feedback";
      feedback: RuntimeFeedbackEvent;
    }
  | {
      type: "history.event";
      event: LeaferGraphHistoryEvent;
    }
  | {
      type: "extensions.sync";
      sync: RuntimeBridgeExtensionsSync;
    };

export interface LeaferGraphRuntimeBridgeTransport {
  requestSnapshot(): Promise<GraphDocument>;
  submitOperations(
    operations: readonly GraphOperation[]
  ): Promise<readonly GraphOperationApplyResult[]>;
  requestCommand?(
    command: RuntimeBridgeCommand
  ): Promise<RuntimeBridgeCommandResult>;
  sendControl(command: RuntimeBridgeControlCommand): Promise<void>;
  subscribe(listener: (event: RuntimeBridgeInboundEvent) => void): () => void;
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
}
