import type {
  RuntimeBridgeArtifactReader,
  RuntimeBridgeArtifactRef,
  RuntimeBridgeArtifactWriteInput,
  RuntimeBridgeArtifactWriter
} from "@leafergraph/runtime-bridge";

export interface DemoHttpArtifactClientOptions {
  baseUrl: string;
}

/**
 * demo 浏览器侧 artifact 读写器。
 *
 * @remarks
 * 上传走 HTTP POST，下载返回可直接 import / fetch 的 URL。
 */
export class DemoHttpArtifactClient
  implements RuntimeBridgeArtifactReader, RuntimeBridgeArtifactWriter
{
  private readonly baseUrl: string;

  constructor(options: DemoHttpArtifactClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
  }

  async readArtifact(ref: RuntimeBridgeArtifactRef) {
    return {
      kind: "url" as const,
      url: `${this.baseUrl}/artifacts/${encodeURIComponent(ref)}`
    };
  }

  async writeArtifact(
    input: RuntimeBridgeArtifactWriteInput
  ): Promise<RuntimeBridgeArtifactRef> {
    const response = await fetch(`${this.baseUrl}/artifacts`, {
      method: "POST",
      headers: {
        "content-type": input.contentType,
        ...(input.suggestedName
          ? {
              "x-demo-filename": input.suggestedName
            }
          : {})
      },
      body: input.bytes
    });

    if (!response.ok) {
      throw new Error(`上传 artifact 失败: ${response.status}`);
    }

    const payload = (await response.json()) as { ref?: string };
    if (!payload.ref) {
      throw new Error("上传 artifact 缺少 ref。");
    }

    return payload.ref;
  }
}

/**
 * 根据 WebSocket URL 推导 demo HTTP 基地址。
 *
 * @param websocketUrl - 当前 bridge WebSocket 地址。
 * @returns 对应 HTTP 基地址。
 */
export function resolveRuntimeBridgeDemoHttpBaseUrl(
  websocketUrl: string
): string {
  const parsed = new URL(websocketUrl);
  parsed.protocol = parsed.protocol === "wss:" ? "https:" : "http:";
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}
