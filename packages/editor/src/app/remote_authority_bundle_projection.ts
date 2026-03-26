/**
 * authority bundle 文档投影策略模块。
 *
 * @remarks
 * 负责在 authority-first 场景里判断“当前 demo bundle 文档是否应该作为初始整图投影到远端 authority”。
 */
import type { GraphDocument } from "leafergraph";

import type { ResolvedEditorRemoteAuthorityAppRuntime } from "../backend/authority/remote_authority_app_runtime";
import type { EditorBundleRuntimeSetup } from "../loader/types";

/** 当前 bundle setup 中可被投影到 authority 的 demo 文档快照。 */
export interface RemoteAuthorityBundleProjection {
  readonly bundleId: string;
  readonly bundleName: string;
  readonly document: GraphDocument;
}

/** 用于避免重复投影同一份 runtime + document 组合的检查点。 */
export interface RemoteAuthorityBundleProjectionCheckpoint {
  readonly runtime: ResolvedEditorRemoteAuthorityAppRuntime;
  readonly document: GraphDocument;
}

function isEmptyGraphDocument(document: GraphDocument): boolean {
  return document.nodes.length === 0 && document.links.length === 0;
}

/** 从当前 bundle 装配结果里挑出“需要投影到远端 authority”的 demo document。 */
export function resolveRemoteAuthorityBundleProjection(
  runtimeSetup: EditorBundleRuntimeSetup
): RemoteAuthorityBundleProjection | null {
  const currentDemo = runtimeSetup.currentDemo;
  const manifest = currentDemo?.manifest;

  if (!currentDemo?.active || manifest?.kind !== "demo") {
    return null;
  }

  return {
    bundleId: manifest.id,
    bundleName: manifest.name,
    document: manifest.document
  };
}

/** 判断当前这份 demo document 是否还需要重新投影到远端 authority。 */
export function shouldApplyRemoteAuthorityBundleProjection(options: {
  runtime: ResolvedEditorRemoteAuthorityAppRuntime;
  projection: RemoteAuthorityBundleProjection;
  checkpoint: RemoteAuthorityBundleProjectionCheckpoint | null;
}): boolean {
  const { runtime, projection, checkpoint } = options;
  if (runtime.bundleProjectionMode === "skip") {
    return false;
  }

  const authorityDocument = runtime.document;

  if (
    authorityDocument.documentId === projection.document.documentId ||
    !isEmptyGraphDocument(authorityDocument)
  ) {
    return false;
  }

  if (!checkpoint) {
    return true;
  }

  return (
    checkpoint.runtime !== runtime || checkpoint.document !== projection.document
  );
}
