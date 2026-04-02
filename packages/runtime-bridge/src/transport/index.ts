import type { GraphDocument } from "@leafergraph/node";
import type {
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphHistoryEvent,
  RuntimeFeedbackEvent
} from "@leafergraph/contracts";
import type { GraphDocumentDiff } from "@leafergraph/contracts/graph-document-diff";

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
    };

export interface LeaferGraphRuntimeBridgeTransport {
  requestSnapshot(): Promise<GraphDocument>;
  submitOperations(
    operations: readonly GraphOperation[]
  ): Promise<readonly GraphOperationApplyResult[]>;
  sendControl(command: RuntimeBridgeControlCommand): Promise<void>;
  subscribe(listener: (event: RuntimeBridgeInboundEvent) => void): () => void;
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
}
