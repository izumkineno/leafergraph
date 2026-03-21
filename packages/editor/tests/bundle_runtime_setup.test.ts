import { beforeAll, describe, expect, test } from "bun:test";
import type { GraphDocument, LeaferGraphNodePlugin } from "leafergraph";
import type { EditorBundleCatalogState } from "../src/loader/types";

let runtimeModule: typeof import("../src/loader/runtime");

beforeAll(async () => {
  const host = globalThis as Record<string, unknown>;
  host.window ??= globalThis;
  host.CanvasRenderingContext2D ??= class {};
  host.Path2D ??= class {};
  host.Image ??= class {};
  host.ImageData ??= class {};
  host.DOMMatrix ??= class {};
  host.Event ??= class {};
  host.CustomEvent ??= class {};
  host.PointerEvent ??= class {};
  host.MouseEvent ??= class {};
  host.KeyboardEvent ??= class {};
  host.FocusEvent ??= class {};
  host.WheelEvent ??= class {};
  host.DragEvent ??= class {};
  host.TouchEvent ??= class {};
  host.ClipboardEvent ??= class {};
  host.HTMLElement ??= class {};
  host.HTMLCanvasElement ??= class {};
  host.navigator ??= {
    userAgent: "bun-test"
  };
  host.requestAnimationFrame ??= ((callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 0)) as unknown;
  host.cancelAnimationFrame ??= ((handle: number) =>
    clearTimeout(handle)) as unknown;
  host.document ??= {
    createElement() {
      return {
        style: {},
        getContext() {
          return {};
        },
        append() {},
        appendChild() {},
        remove() {}
      };
    },
    documentElement: {
      style: {}
    },
    head: {
      append() {},
      appendChild() {}
    },
    body: {
      append() {},
      appendChild() {}
    },
    defaultView: globalThis,
    addEventListener() {},
    removeEventListener() {}
  };
  runtimeModule = await import("../src/loader/runtime");
});

function createDocument(
  documentId: string,
  revision: string | number
): GraphDocument {
  return {
    documentId,
    revision,
    appKind: "bundle-runtime-test",
    nodes: [
      {
        id: "node-1",
        type: "test/node",
        title: "Node 1",
        inputs: [],
        outputs: [],
        widgets: []
      }
    ],
    links: []
  };
}

function createPlugin(name: string): LeaferGraphNodePlugin {
  return {
    name,
    install() {}
  };
}

function appendRecord(
  catalog: EditorBundleCatalogState,
  slot: "demo" | "node" | "widget",
  options: {
    id: string;
    enabled?: boolean;
    requires?: string[];
    quickCreateNodeType?: string;
  }
): EditorBundleCatalogState {
  if (slot === "demo") {
    return runtimeModule.upsertEditorBundleRecord(
      catalog,
      runtimeModule.createLoadedBundleRecordState({
        slot,
        manifest: {
          id: options.id,
          name: options.id,
          kind: "demo",
          requires: options.requires,
          document: createDocument(`${options.id}-document`, 1)
        },
        fileName: `${options.id}.js`,
        enabled: options.enabled ?? false,
        persisted: false,
        restoredFromPersistence: false
      })
    );
  }

  return runtimeModule.upsertEditorBundleRecord(
    catalog,
    runtimeModule.createLoadedBundleRecordState({
      slot,
      manifest: {
        id: options.id,
        name: options.id,
        kind: slot,
        requires: options.requires,
        plugin: createPlugin(options.id),
        quickCreateNodeType: options.quickCreateNodeType
      },
      fileName: `${options.id}.js`,
      enabled: options.enabled ?? true,
      persisted: false,
      restoredFromPersistence: false
    })
  );
}

describe("resolveEditorBundleRuntimeSetup", () => {
  test("应同时累加多个 node/widget bundle，并稳定解析 quick create", () => {
    let catalog = runtimeModule.createInitialBundleCatalogState();
    catalog = appendRecord(catalog, "widget", {
      id: "@test/widget",
      quickCreateNodeType: "widget/quick"
    });
    catalog = appendRecord(catalog, "node", {
      id: "@test/node-a",
      quickCreateNodeType: "node/a"
    });
    catalog = appendRecord(catalog, "node", {
      id: "@test/node-b",
      quickCreateNodeType: "node/b"
    });
    catalog = appendRecord(catalog, "demo", {
      id: "@test/demo",
      enabled: true,
      requires: ["@test/node-a", "@test/widget"]
    });

    const setup = runtimeModule.resolveEditorBundleRuntimeSetup(catalog);

    expect(setup.plugins.map((plugin) => plugin.name)).toEqual([
      "@test/widget",
      "@test/node-a",
      "@test/node-b"
    ]);
    expect(setup.quickCreateNodeType).toBe("node/a");
    expect(setup.currentDemo?.manifest?.id).toBe("@test/demo");
  });

  test("依赖缺失时 demo 不应成为当前可运行 demo", () => {
    let catalog = runtimeModule.createInitialBundleCatalogState();
    catalog = appendRecord(catalog, "demo", {
      id: "@test/demo",
      enabled: true,
      requires: ["@test/node", "@test/widget"]
    });

    const setup = runtimeModule.resolveEditorBundleRuntimeSetup(catalog);

    expect(setup.currentDemo).toBeNull();
    expect(setup.bundles.demo[0]?.status).toBe("dependency-missing");
    expect(setup.bundles.demo[0]?.missingRequirements).toEqual([
      "@test/node",
      "@test/widget"
    ]);
  });
});

describe("bundle catalog helpers", () => {
  test("同一 kind + id 重新写入时应替换原记录", () => {
    let catalog = runtimeModule.createInitialBundleCatalogState();
    catalog = appendRecord(catalog, "node", {
      id: "@test/node",
      quickCreateNodeType: "node/old"
    });
    catalog = appendRecord(catalog, "node", {
      id: "@test/node",
      quickCreateNodeType: "node/new"
    });

    expect(catalog.node).toHaveLength(1);
    expect(catalog.node[0]?.bundleKey).toBe(
      runtimeModule.createEditorBundleRecordKey("node", "@test/node")
    );
    expect(
      catalog.node[0]?.manifest?.kind === "node"
        ? catalog.node[0].manifest.quickCreateNodeType
        : undefined
    ).toBe("node/new");
  });

  test("setCurrentDemoBundle 应保持 demo 单选", () => {
    let catalog = runtimeModule.createInitialBundleCatalogState();
    catalog = appendRecord(catalog, "demo", {
      id: "@test/demo-a",
      enabled: true
    });
    catalog = appendRecord(catalog, "demo", {
      id: "@test/demo-b",
      enabled: false
    });

    catalog = runtimeModule.setCurrentDemoBundle(
      catalog,
      runtimeModule.createEditorBundleRecordKey("demo", "@test/demo-b")
    );

    expect(catalog.demo.map((record) => record.enabled)).toEqual([false, true]);
  });
});

describe("bundle source loaders", () => {
  test("应支持从本地 node JSON 直接生成节点 bundle manifest", async () => {
    const manifest = await runtimeModule.loadEditorBundleSource(
      "node",
      JSON.stringify(
        {
          type: "system/timer",
          title: "Timer",
          inputs: [{ name: "Start", type: "event" }],
          outputs: [{ name: "Tick", type: "event" }]
        },
        null,
        2
      ),
      "node.bundle.json"
    );

    expect(manifest.kind).toBe("node");
    if (manifest.kind !== "node") {
      throw new Error("期望得到 node bundle manifest");
    }

    const registeredNodes: Array<{
      definition: Record<string, unknown>;
      overwrite: boolean;
    }> = [];
    (
      manifest.plugin.install as (ctx: {
        registerNode(
          definition: Record<string, unknown>,
          options?: { overwrite?: boolean }
        ): void;
      }) => void
    )({
      registerNode(definition, options) {
        registeredNodes.push({
          definition,
          overwrite: options?.overwrite === true
        });
      }
    });

    expect(manifest.id).toBe("system/timer");
    expect(manifest.name).toBe("Timer");
    expect(manifest.quickCreateNodeType).toBe("system/timer");
    expect(manifest.plugin.name).toBe("system/timer/plugin");
    expect(registeredNodes).toHaveLength(1);
    expect(registeredNodes[0]).toMatchObject({
      overwrite: true,
      definition: {
        type: "system/timer",
        title: "Timer"
      }
    });
  });

  test("应支持从本地 demo JSON 直接生成 demo bundle manifest", async () => {
    const manifest = await runtimeModule.loadEditorBundleSource(
      "demo",
      JSON.stringify(
        {
          documentId: "timer-demo-document",
          revision: 1,
          appKind: "timer-demo",
          nodes: [],
          links: [],
          meta: {
            owner: "bundle-runtime-test"
          }
        },
        null,
        2
      ),
      "demo.bundle.json"
    );

    expect(manifest).toMatchObject({
      id: "timer-demo-document",
      name: "timer-demo-document",
      kind: "demo"
    });
    if (manifest.kind !== "demo") {
      throw new Error("期望得到 demo bundle manifest");
    }
    expect(manifest.document.meta).toEqual({
      owner: "bundle-runtime-test"
    });
  });

  test("应支持 authority 直推 node-json 与 demo-json bundle", async () => {
    const nodeManifest = await runtimeModule.loadEditorFrontendBundleSource({
      bundleId: "@test/timer/node",
      name: "Timer Node Bundle",
      slot: "node",
      fileName: "node.bundle.json",
      version: "0.1.0",
      enabled: true,
      requires: [],
      sha256: "node-sha",
      format: "node-json",
      quickCreateNodeType: "system/timer",
      definition: {
        type: "system/timer",
        title: "Timer",
        inputs: [{ name: "Start", type: "event" }],
        outputs: [{ name: "Tick", type: "event" }]
      }
    });
    const demoManifest = await runtimeModule.loadEditorFrontendBundleSource({
      bundleId: "@test/timer/demo",
      name: "Timer Demo Bundle",
      slot: "demo",
      fileName: "demo.bundle.json",
      version: "0.1.0",
      enabled: true,
      requires: ["@test/timer/node"],
      sha256: "demo-sha",
      format: "demo-json",
      document: {
        documentId: "timer-demo-document",
        revision: 1,
        appKind: "timer-demo",
        nodes: [],
        links: []
      }
    });

    expect(nodeManifest).toMatchObject({
      id: "@test/timer/node",
      name: "Timer Node Bundle",
      kind: "node",
      quickCreateNodeType: "system/timer",
      requires: []
    });
    expect(demoManifest).toMatchObject({
      id: "@test/timer/demo",
      name: "Timer Demo Bundle",
      kind: "demo",
      requires: ["@test/timer/node"]
    });
  });
});

describe("areEditorBundleDocumentsEquivalent", () => {
  test("应忽略 documentId 和 revision，只比较文档内容", () => {
    const left = createDocument("doc-a", 1);
    const right = createDocument("doc-b", "9");

    expect(
      runtimeModule.areEditorBundleDocumentsEquivalent(left, right)
    ).toBe(true);
  });
});
