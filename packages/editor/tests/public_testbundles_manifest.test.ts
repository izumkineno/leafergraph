import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
import * as LeaferGraphAuthoring from "@leafergraph/authoring";

function executeBundleAndCaptureManifest(
  relativeBundlePath: string,
  extraContext: Record<string, unknown> = {}
): Record<string, unknown> {
  const bundleUrl = new URL(relativeBundlePath, import.meta.url);
  const bundleCode = readFileSync(bundleUrl, "utf8");
  let capturedManifest: Record<string, unknown> | null = null;

  const context = createContext({});
  Object.assign(context, {
    globalThis: context,
    LeaferGraphEditorBundleBridge: {
      registerBundle(manifest: Record<string, unknown>) {
        capturedManifest = manifest;
      }
    },
    ...extraContext
  });

  new Script(bundleCode, {
    filename: bundleUrl.pathname
  }).runInContext(context);

  if (!capturedManifest) {
    throw new Error("bundle 没有调用 registerBundle(...)");
  }

  return capturedManifest;
}

test("editor 内置 demo bundle 应注册 document manifest", () => {
  const manifest = executeBundleAndCaptureManifest(
    "../public/__testbundles/demo.iife.js"
  );

  expect(manifest.kind).toBe("demo");
  expect("document" in manifest).toBe(true);
  expect("graph" in manifest).toBe(false);
  expect(manifest.name).toBe("Template Demo Document");

  const document =
    "document" in manifest && typeof manifest.document === "object"
      ? (manifest.document as Record<string, unknown>)
      : null;

  expect(document?.documentId).toBe("template-demo-document");
  expect(Array.isArray(document?.nodes)).toBe(true);
  expect(Array.isArray(document?.links)).toBe(true);
  expect(manifest.requires).toEqual([
    "@template/node-widget-demo/node",
    "@template/node-widget-demo/widget"
  ]);
});

test("editor 内置备用 demo bundle 应注册独立 document manifest", () => {
  const manifest = executeBundleAndCaptureManifest(
    "../public/__testbundles/demo-alt.iife.js"
  );

  expect(manifest.kind).toBe("demo");
  expect(manifest.name).toBe("Template Alternate Demo Document");

  const document =
    "document" in manifest && typeof manifest.document === "object"
      ? (manifest.document as Record<string, unknown>)
      : null;

  expect(document?.documentId).toBe("template-demo-document-alt");
  expect(Array.isArray(document?.nodes)).toBe(true);
  expect(Array.isArray(document?.links)).toBe(true);
});

test("editor authoring widget bundle 应注册 widget manifest", () => {
  const manifest = executeBundleAndCaptureManifest(
    "../public/__testbundles/authoring-widget.iife.js",
    {
      LeaferGraphAuthoring
    }
  );

  expect(manifest).toMatchObject({
    id: "@editor/authoring-experiment/widget",
    name: "Authoring Widget Bundle",
    kind: "widget"
  });
  expect(typeof manifest.plugin).toBe("object");
});

test("editor authoring node bundle 应注册带依赖的 node manifest", () => {
  const manifest = executeBundleAndCaptureManifest(
    "../public/__testbundles/authoring-node.iife.js",
    {
      LeaferGraphAuthoring
    }
  );

  expect(manifest).toMatchObject({
    id: "@editor/authoring-experiment/node",
    name: "Authoring Node Bundle",
    kind: "node",
    quickCreateNodeType: "editor/authoring-status-node",
    requires: ["@editor/authoring-experiment/widget"]
  });
  expect(typeof manifest.plugin).toBe("object");
});

test("editor authoring demo bundle 应注册依赖 node/widget 的 document manifest", () => {
  const manifest = executeBundleAndCaptureManifest(
    "../public/__testbundles/authoring-demo.iife.js"
  );

  expect(manifest).toMatchObject({
    id: "@editor/authoring-experiment/demo",
    name: "Authoring Demo Bundle",
    kind: "demo",
    requires: [
      "@editor/authoring-experiment/widget",
      "@editor/authoring-experiment/node"
    ]
  });

  const document =
    "document" in manifest && typeof manifest.document === "object"
      ? (manifest.document as Record<string, unknown>)
      : null;

  expect(document?.documentId).toBe("editor-authoring-demo-document");
  expect(Array.isArray(document?.nodes)).toBe(true);
  expect(Array.isArray(document?.links)).toBe(true);
});
