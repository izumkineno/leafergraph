import { describe, expect, test } from "bun:test";
import type { GraphDocument } from "leafergraph";

import {
  resolveRemoteAuthorityBundleProjection,
  shouldApplyRemoteAuthorityBundleProjection,
  type RemoteAuthorityBundleProjection
} from "../src/app/remote_authority_bundle_projection";
import type { ResolvedEditorRemoteAuthorityAppRuntime } from "../src/app/remote_authority_app_runtime";
import type { EditorBundleRuntimeSetup } from "../src/loader/types";

function createDocument(documentId: string): GraphDocument {
  return {
    documentId,
    revision: 1,
    appKind: "test-app",
    nodes: [],
    links: []
  };
}

function createRuntimeSetup(
  options: {
    demoActive?: boolean;
    demoDocument?: GraphDocument;
  } = {}
): EditorBundleRuntimeSetup {
  const demoDocument = options.demoDocument ?? createDocument("demo-doc");

  return {
    document: demoDocument,
    plugins: [],
    quickCreateNodeType: undefined,
    slots: {
      demo: {
        slot: "demo",
        manifest: {
          id: "@test/demo",
          name: "Test Demo Bundle",
          kind: "demo",
          document: demoDocument
        },
        fileName: "demo.iife.js",
        enabled: true,
        loading: false,
        error: null,
        persisted: false,
        restoredFromPersistence: false,
        status: "ready",
        active: options.demoActive ?? true,
        missingRequirements: []
      },
      node: {
        slot: "node",
        manifest: null,
        fileName: null,
        enabled: false,
        loading: false,
        error: null,
        persisted: false,
        restoredFromPersistence: false,
        status: "idle",
        active: false,
        missingRequirements: []
      },
      widget: {
        slot: "widget",
        manifest: null,
        fileName: null,
        enabled: false,
        loading: false,
        error: null,
        persisted: false,
        restoredFromPersistence: false,
        status: "idle",
        active: false,
        missingRequirements: []
      }
    }
  };
}

function createRuntime(label: string): ResolvedEditorRemoteAuthorityAppRuntime {
  return {
    sourceLabel: label,
    sourceDescription: label,
    client: {
      async getDocument() {
        return createDocument(`${label}-remote`);
      },
      async submitOperation() {
        return {
          accepted: true,
          changed: false,
          revision: 1
        };
      },
      subscribe() {
        return () => {};
      },
      dispose() {}
    },
    document: createDocument(`${label}-remote`),
    createDocumentSessionBinding() {
      throw new Error("not implemented in unit test");
    },
    runtimeFeedbackInlet: undefined,
    dispose() {}
  };
}

describe("remote authority bundle projection helpers", () => {
  test("应只在 demo bundle 激活时返回待投影 document", () => {
    const activeProjection = resolveRemoteAuthorityBundleProjection(
      createRuntimeSetup({
        demoActive: true,
        demoDocument: createDocument("demo-active")
      })
    );
    const inactiveProjection = resolveRemoteAuthorityBundleProjection(
      createRuntimeSetup({
        demoActive: false,
        demoDocument: createDocument("demo-inactive")
      })
    );

    expect(activeProjection).toEqual<RemoteAuthorityBundleProjection>({
      bundleId: "@test/demo",
      bundleName: "Test Demo Bundle",
      document: createDocument("demo-active")
    });
    expect(inactiveProjection).toBeNull();
  });

  test("相同 runtime + 相同 document 不应重复投影", () => {
    const runtimeA = createRuntime("runtime-a");
    const runtimeB = createRuntime("runtime-b");
    const documentA = createDocument("demo-a");
    const documentB = createDocument("demo-b");
    const projectionA: RemoteAuthorityBundleProjection = {
      bundleId: "@test/demo",
      bundleName: "Test Demo Bundle",
      document: documentA
    };
    const projectionB: RemoteAuthorityBundleProjection = {
      bundleId: "@test/demo",
      bundleName: "Test Demo Bundle",
      document: documentB
    };

    expect(
      shouldApplyRemoteAuthorityBundleProjection({
        runtime: runtimeA,
        projection: projectionA,
        checkpoint: null
      })
    ).toBe(true);
    expect(
      shouldApplyRemoteAuthorityBundleProjection({
        runtime: runtimeA,
        projection: projectionA,
        checkpoint: {
          runtime: runtimeA,
          document: documentA
        }
      })
    ).toBe(false);
    expect(
      shouldApplyRemoteAuthorityBundleProjection({
        runtime: runtimeA,
        projection: projectionB,
        checkpoint: {
          runtime: runtimeA,
          document: documentA
        }
      })
    ).toBe(true);
    expect(
      shouldApplyRemoteAuthorityBundleProjection({
        runtime: runtimeB,
        projection: projectionA,
        checkpoint: {
          runtime: runtimeA,
          document: documentA
        }
      })
    ).toBe(true);
  });
});
