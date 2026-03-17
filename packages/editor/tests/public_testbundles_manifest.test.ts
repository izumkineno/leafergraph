import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";

function executeBundleAndCaptureManifest(
  relativeBundlePath: string
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
    }
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
});
