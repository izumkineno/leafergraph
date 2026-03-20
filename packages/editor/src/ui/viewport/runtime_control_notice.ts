import type {
  EditorRemoteAuthorityRuntimeControlRequest,
  EditorRemoteAuthorityRuntimeControlResult
} from "../../session/graph_document_authority_client";

export interface GraphViewportRemoteRuntimeControlNotice {
  tone: "info" | "error";
  message: string;
}

function toRuntimeControlErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function formatRemoteRuntimeControlActionLabel(
  request: EditorRemoteAuthorityRuntimeControlRequest
): string {
  switch (request.type) {
    case "graph.play":
      return "图运行";
    case "graph.step":
      return "图单步";
    case "graph.stop":
      return "图停止";
    case "node.play":
      return "节点运行";
    default:
      return "运行";
  }
}

export function resolveRemoteRuntimeControlNotice(options: {
  request: EditorRemoteAuthorityRuntimeControlRequest;
  result?: EditorRemoteAuthorityRuntimeControlResult;
  error?: unknown;
}): GraphViewportRemoteRuntimeControlNotice | null {
  const actionLabel = formatRemoteRuntimeControlActionLabel(options.request);

  if (options.error !== undefined) {
    return {
      tone: "error",
      message: `${actionLabel}请求失败：${toRuntimeControlErrorMessage(options.error)}`
    };
  }

  const result = options.result;
  if (!result || (result.accepted && result.changed)) {
    return null;
  }

  if (!result.accepted) {
    return {
      tone: "error",
      message: result.reason
        ? `${actionLabel}被 authority 拒绝：${result.reason}`
        : `${actionLabel}被 authority 拒绝`
    };
  }

  return {
    tone: "info",
    message: result.reason
      ? `${actionLabel}没有新的状态变化：${result.reason}`
      : `${actionLabel}没有新的状态变化`
  };
}
