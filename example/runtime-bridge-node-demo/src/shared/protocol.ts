import type {
  GraphDocument,
  GraphOperation,
  GraphOperationApplyResult
} from "@leafergraph/runtime-bridge/portable";
import type {
  RuntimeBridgeCommand,
  RuntimeBridgeCommandResult,
  RuntimeBridgeInboundEvent
} from "@leafergraph/runtime-bridge/transport";
import type { DemoStreamFrameMessage } from "./stream";

export const RUNTIME_BRIDGE_NODE_DEMO_WS_HOST = "127.0.0.1";
export const RUNTIME_BRIDGE_NODE_DEMO_WS_PORT = 7788;

export type DemoBridgeClientMessage =
  | {
      type: "snapshot.request";
      requestId: string;
    }
  | {
      type: "operations.submit";
      requestId: string;
      operations: GraphOperation[];
    }
  | {
      type: "command.request";
      requestId: string;
      command: RuntimeBridgeCommand;
    };

export type DemoBridgeServerMessage =
  | {
      type: "snapshot.response";
      requestId: string;
      document: GraphDocument;
    }
  | {
      type: "operations.response";
      requestId: string;
      results: readonly GraphOperationApplyResult[];
    }
  | {
      type: "command.response";
      requestId: string;
      result: RuntimeBridgeCommandResult;
    }
  | {
      type: "bridge.event";
      event: RuntimeBridgeInboundEvent;
    }
  | DemoStreamFrameMessage
  | {
      type: "bridge.error";
      requestId?: string;
      message: string;
    };

/**
 * 解析任意 demo bridge message。
 *
 * @param value - 原始 JSON 文本或对象。
 * @returns 解析后的对象。
 */
export function parseDemoBridgeMessage(value: unknown): unknown {
  if (typeof value === "string") {
    return JSON.parse(value);
  }

  if (value instanceof ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(value));
  }

  if (ArrayBuffer.isView(value)) {
    return JSON.parse(
      new TextDecoder().decode(
        value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
      )
    );
  }

  return value;
}

/**
 * 序列化 demo bridge message。
 *
 * @param message - 待发送消息。
 * @returns JSON 文本。
 */
export function serializeDemoBridgeMessage(
  message: DemoBridgeClientMessage | DemoBridgeServerMessage
): string {
  return JSON.stringify(message);
}
