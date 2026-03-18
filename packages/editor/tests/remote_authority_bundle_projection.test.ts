import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "leafergraph";
import type { ResolvedEditorRemoteAuthorityAppRuntime } from "../src/app/remote_authority_app_runtime";
import {
  shouldApplyRemoteAuthorityBundleProjection,
  type RemoteAuthorityBundleProjection
} from "../src/app/remote_authority_bundle_projection";

function createDocument(options: {
  documentId: string;
  revision?: string;
  nodeCount?: number;
}): GraphDocument {
  const nodeCount = options.nodeCount ?? 0;

  return {
    documentId: options.documentId,
    revision: options.revision ?? "1",
    appKind: "bundle-projection-test",
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `node-${index + 1}`,
      type: "test/node",
      title: `Node ${index + 1}`,
      x: index * 24,
      y: index * 16,
      inputs: [],
      outputs: [],
      widgets: []
    })),
    links: [],
    meta: {}
  };
}

function createRuntime(
  document: GraphDocument
): ResolvedEditorRemoteAuthorityAppRuntime {
  return {
    sourceLabel: "test-runtime",
    client: {
      async getDocument() {
        return document;
      }
    },
    document,
    createDocumentSessionBinding() {
      throw new Error("not implemented");
    },
    getConnectionStatus() {
      return "connected";
    },
    subscribeConnectionStatus() {
      return () => {};
    },
    dispose() {}
  };
}

function createProjection(document: GraphDocument): RemoteAuthorityBundleProjection {
  return {
    bundleId: "demo-bundle",
    bundleName: "Demo Bundle",
    document
  };
}

describe("shouldApplyRemoteAuthorityBundleProjection", () => {
  test("空白 authority 文档首次接入时应允许投影 demo document", () => {
    const runtime = createRuntime(
      createDocument({
        documentId: "node-authority-doc"
      })
    );
    const projection = createProjection(
      createDocument({
        documentId: "template-demo-document",
        nodeCount: 2
      })
    );

    expect(
      shouldApplyRemoteAuthorityBundleProjection({
        runtime,
        projection,
        checkpoint: null
      })
    ).toBe(true);
  });

  test("远端已经持有同一份 documentId 时不应重复覆盖", () => {
    const runtime = createRuntime(
      createDocument({
        documentId: "template-demo-document",
        revision: "7",
        nodeCount: 3
      })
    );
    const projection = createProjection(
      createDocument({
        documentId: "template-demo-document",
        revision: "1",
        nodeCount: 2
      })
    );

    expect(
      shouldApplyRemoteAuthorityBundleProjection({
        runtime,
        projection,
        checkpoint: null
      })
    ).toBe(false);
  });

  test("远端已存在非空文档时不应再用 demo bundle 回写 authority", () => {
    const runtime = createRuntime(
      createDocument({
        documentId: "persisted-remote-document",
        revision: "9",
        nodeCount: 4
      })
    );
    const projection = createProjection(
      createDocument({
        documentId: "template-demo-document",
        revision: "1",
        nodeCount: 2
      })
    );

    expect(
      shouldApplyRemoteAuthorityBundleProjection({
        runtime,
        projection,
        checkpoint: null
      })
    ).toBe(false);
  });

  test("同一 runtime 已记录过相同投影时不应重复提交 replaceDocument", () => {
    const runtime = createRuntime(
      createDocument({
        documentId: "node-authority-doc"
      })
    );
    const projection = createProjection(
      createDocument({
        documentId: "template-demo-document",
        nodeCount: 2
      })
    );

    expect(
      shouldApplyRemoteAuthorityBundleProjection({
        runtime,
        projection,
        checkpoint: {
          runtime,
          document: projection.document
        }
      })
    ).toBe(false);
  });
});
