/**
 * runtime bridge 扩展目录使用的 artifact 抽象。
 *
 * @remarks
 * 命令通道只传递 metadata 与 opaque ref，
 * 真正的 bundle / blueprint 内容读写统一走这里，
 * 这样 transport 不会被具体上传协议绑死。
 */

/** 远端 artifact 的 opaque 引用。 */
export type RuntimeBridgeArtifactRef = string;

/**
 * artifact 读取结果。
 *
 * @remarks
 * 浏览器更适合直接消费 URL，
 * authority 或测试环境更适合直接消费 bytes。
 */
export type RuntimeBridgeArtifactData =
  | {
      kind: "url";
      url: string;
      contentType?: string;
    }
  | {
      kind: "bytes";
      bytes: Uint8Array;
      contentType?: string;
    };

/** artifact 读取器。 */
export interface RuntimeBridgeArtifactReader {
  readArtifact(ref: RuntimeBridgeArtifactRef): Promise<RuntimeBridgeArtifactData>;
}

/** artifact 写入输入。 */
export interface RuntimeBridgeArtifactWriteInput {
  bytes: Uint8Array;
  contentType: string;
  suggestedName?: string;
}

/** artifact 写入器。 */
export interface RuntimeBridgeArtifactWriter {
  writeArtifact(
    input: RuntimeBridgeArtifactWriteInput
  ): Promise<RuntimeBridgeArtifactRef>;
}

