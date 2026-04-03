import type { NodeDefinition, NodeModule } from "@leafergraph/node";
import type { LeaferGraphWidgetEntry } from "@leafergraph/contracts";
import type { GraphDocument } from "@leafergraph/node";
import type { RuntimeBridgeArtifactData } from "./artifact.js";

/** 模块 namespace 的最小读取形状。 */
type RuntimeBridgeModuleNamespace = Record<string, unknown>;

/**
 * 把 artifact 解析成可 import 的 JS specifier。
 *
 * @param artifact - artifact 数据。
 * @returns 浏览器或 Node 可消费的模块地址。
 */
export async function createModuleSpecifierFromArtifact(
  artifact: RuntimeBridgeArtifactData
): Promise<string> {
  if (artifact.kind === "url") {
    return artifact.url;
  }

  const contentType = artifact.contentType || "text/javascript";
  return `data:${contentType};base64,${encodeBytesToBase64(artifact.bytes)}`;
}

/**
 * 加载 JS artifact。
 *
 * @param artifact - artifact 数据。
 * @returns 模块 namespace。
 */
export async function importModuleNamespaceFromArtifact(
  artifact: RuntimeBridgeArtifactData
): Promise<RuntimeBridgeModuleNamespace> {
  const specifier = await createModuleSpecifierFromArtifact(artifact);
  return (await import(
    /* @vite-ignore */ specifier
  )) as RuntimeBridgeModuleNamespace;
}

/**
 * 解析节点 artifact 导出。
 *
 * @param namespace - 模块 namespace。
 * @returns `NodeModule` 或 `NodeDefinition[]`。
 */
export function resolveNodeModuleExport(
  namespace: RuntimeBridgeModuleNamespace
): NodeModule | NodeDefinition[] {
  const candidates = collectExportCandidates(namespace);

  for (const value of candidates) {
    if (isNodeModule(value)) {
      return value;
    }

    if (isNodeDefinitionArray(value)) {
      return value;
    }
  }

  throw new Error(
    "节点 artifact 必须导出 NodeModule 或 NodeDefinition[]，不接受 plugin。"
  );
}

/**
 * 解析组件 artifact 导出。
 *
 * @param namespace - 模块 namespace。
 * @returns Widget entry 数组。
 */
export function resolveWidgetEntriesExport(
  namespace: RuntimeBridgeModuleNamespace
): LeaferGraphWidgetEntry[] {
  const candidates = collectExportCandidates(namespace);

  for (const value of candidates) {
    if (isWidgetEntryArray(value)) {
      return value;
    }
  }

  throw new Error("组件 artifact 必须导出 LeaferGraphWidgetEntry[]。");
}

/**
 * 读取 blueprint document artifact。
 *
 * @param artifact - artifact 数据。
 * @returns 解析后的正式图文档。
 */
export async function readGraphDocumentFromArtifact(
  artifact: RuntimeBridgeArtifactData
): Promise<GraphDocument> {
  if (artifact.kind === "bytes") {
    return JSON.parse(new TextDecoder().decode(artifact.bytes)) as GraphDocument;
  }

  const response = await fetch(artifact.url);
  if (!response.ok) {
    throw new Error(`读取 blueprint artifact 失败: ${response.status}`);
  }
  return (await response.json()) as GraphDocument;
}

function collectExportCandidates(
  namespace: RuntimeBridgeModuleNamespace
): unknown[] {
  const candidates: unknown[] = [];

  if ("default" in namespace) {
    candidates.push(namespace.default);
  }

  for (const [key, value] of Object.entries(namespace)) {
    if (key === "default") {
      continue;
    }
    candidates.push(value);
  }

  return candidates;
}

function isNodeModule(value: unknown): value is NodeModule {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as NodeModule).nodes)
  );
}

function isNodeDefinitionArray(value: unknown): value is NodeDefinition[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as NodeDefinition).type === "string"
    )
  );
}

function isWidgetEntryArray(value: unknown): value is LeaferGraphWidgetEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as LeaferGraphWidgetEntry).type === "string" &&
        "renderer" in (item as LeaferGraphWidgetEntry)
    )
  );
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  const globalBuffer = (globalThis as typeof globalThis & {
    Buffer?: {
      from(input: Uint8Array): { toString(encoding: "base64"): string };
    };
  }).Buffer;

  if (globalBuffer) {
    return globalBuffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  if (typeof btoa !== "function") {
    throw new Error("当前环境缺少 base64 编码能力。");
  }

  return btoa(binary);
}
