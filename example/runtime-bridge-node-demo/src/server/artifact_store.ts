import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type {
  RuntimeBridgeArtifactData,
  RuntimeBridgeArtifactReader,
  RuntimeBridgeArtifactRef,
  RuntimeBridgeArtifactWriteInput,
  RuntimeBridgeArtifactWriter
} from "@leafergraph/runtime-bridge";

interface DemoStoredArtifactMetadata {
  ref: RuntimeBridgeArtifactRef;
  filePath: string;
  contentType: string;
  suggestedName?: string;
}

/**
 * demo 使用的文件系统 artifact store。
 *
 * @remarks
 * 首版保留“文件落地 + metadata 内存态”组合，
 * 这样上传下载链完整可跑，同时不把存储策略写死到 runtime-bridge 包里。
 */
export class DemoFileSystemArtifactStore
  implements RuntimeBridgeArtifactReader, RuntimeBridgeArtifactWriter
{
  private readonly rootDir: string;
  private readonly metadataByRef = new Map<string, DemoStoredArtifactMetadata>();

  constructor(rootDir = path.join(tmpdir(), "leafergraph-runtime-bridge-artifacts")) {
    this.rootDir = rootDir;
  }

  async writeArtifact(
    input: RuntimeBridgeArtifactWriteInput
  ): Promise<RuntimeBridgeArtifactRef> {
    await mkdir(this.rootDir, { recursive: true });
    const suggestedExtension = resolveSuggestedExtension(input.suggestedName);
    const ref = crypto.randomUUID();
    const filePath = path.join(this.rootDir, `${ref}${suggestedExtension}`);

    await writeFile(filePath, input.bytes);
    this.metadataByRef.set(ref, {
      ref,
      filePath,
      contentType: input.contentType,
      suggestedName: input.suggestedName
    });
    return ref;
  }

  async readArtifact(ref: RuntimeBridgeArtifactRef): Promise<RuntimeBridgeArtifactData> {
    const metadata = this.requireMetadata(ref);
    const bytes = await readFile(metadata.filePath);
    return {
      kind: "bytes",
      bytes: new Uint8Array(bytes),
      contentType: metadata.contentType
    };
  }

  async readArtifactResponse(
    ref: RuntimeBridgeArtifactRef
  ): Promise<{ bytes: Uint8Array; contentType: string }> {
    const metadata = this.requireMetadata(ref);
    const bytes = await readFile(metadata.filePath);
    return {
      bytes: new Uint8Array(bytes),
      contentType: metadata.contentType
    };
  }

  hasArtifact(ref: RuntimeBridgeArtifactRef): boolean {
    return this.metadataByRef.has(ref);
  }

  private requireMetadata(ref: RuntimeBridgeArtifactRef): DemoStoredArtifactMetadata {
    const metadata = this.metadataByRef.get(ref);
    if (!metadata) {
      throw new Error(`Artifact 不存在: ${ref}`);
    }
    return metadata;
  }
}

function resolveSuggestedExtension(suggestedName?: string): string {
  if (!suggestedName) {
    return "";
  }

  const extension = path.extname(suggestedName);
  return extension.replace(/[^a-zA-Z0-9.]/g, "");
}
