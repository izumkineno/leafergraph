import { describe, expect, test } from "bun:test";

import type { GraphDocument, NodeDefinition } from "@leafergraph/node";
import type { LeaferGraphWidgetEntry } from "@leafergraph/contracts";
import {
  createModuleSpecifierFromArtifact,
  importModuleNamespaceFromArtifact,
  registerRuntimeBridgeModuleDependency,
  RuntimeBridgeAuthorityExtensionManager,
  RuntimeBridgeBrowserExtensionManager
} from "../src/extensions/index.js";
import type {
  RuntimeBridgeArtifactReader,
  RuntimeBridgeArtifactData,
  RuntimeBridgeCatalogEntry,
  RuntimeBridgeCatalogStore,
  RuntimeBridgeSessionExtensionState,
  RuntimeBridgeSessionExtensionStore
} from "../src/extensions/index.js";

class MemoryArtifactReader implements RuntimeBridgeArtifactReader {
  private readonly data = new Map<string, RuntimeBridgeArtifactData>();

  set(ref: string, sourceText: string, contentType = "text/javascript"): void {
    this.data.set(ref, {
      kind: "bytes",
      bytes: new TextEncoder().encode(sourceText),
      contentType
    });
  }

  async readArtifact(ref: string): Promise<RuntimeBridgeArtifactData> {
    const artifact = this.data.get(ref);
    if (!artifact) {
      throw new Error(`Missing artifact: ${ref}`);
    }
    return artifact;
  }
}

class MemoryCatalogStore implements RuntimeBridgeCatalogStore {
  private readonly entries = new Map<string, RuntimeBridgeCatalogEntry>();

  async listEntries(): Promise<readonly RuntimeBridgeCatalogEntry[]> {
    return [...this.entries.values()].map((entry) => structuredClone(entry));
  }

  async getEntry(entryId: string): Promise<RuntimeBridgeCatalogEntry | undefined> {
    const entry = this.entries.get(entryId);
    return entry ? structuredClone(entry) : undefined;
  }

  async putEntry(entry: RuntimeBridgeCatalogEntry): Promise<void> {
    this.entries.set(entry.entryId, structuredClone(entry));
  }

  async deleteEntry(entryId: string): Promise<void> {
    this.entries.delete(entryId);
  }
}

class MemorySessionStore implements RuntimeBridgeSessionExtensionStore {
  state: RuntimeBridgeSessionExtensionState = {
    activeNodeEntryIds: [],
    activeComponentEntryIds: [],
    currentBlueprintId: null
  };

  async getSessionState(): Promise<RuntimeBridgeSessionExtensionState> {
    return structuredClone(this.state);
  }

  async setSessionState(
    _sessionId: string,
    state: RuntimeBridgeSessionExtensionState
  ): Promise<void> {
    this.state = structuredClone(state);
  }
}

function createGraphDocument(nodeType = "system/on-play"): GraphDocument {
  return {
    documentId: "runtime-bridge-test-doc",
    revision: 1,
    appKind: "runtime-bridge-test",
    nodes: [
      {
        id: "node-1",
        type: nodeType,
        layout: {
          x: 0,
          y: 0
        }
      }
    ],
    links: []
  };
}

function createFakeAuthorityGraph() {
  const nodes = new Map<string, NodeDefinition>();
  const widgets = new Map<string, LeaferGraphWidgetEntry>();
  let currentDocument = createGraphDocument();

  return {
    graph: {
      getGraphDocument() {
        return structuredClone(currentDocument);
      },
      installModule(module: { nodes?: NodeDefinition[] }) {
        for (const definition of module.nodes ?? []) {
          nodes.set(definition.type, structuredClone(definition));
        }
      },
      listNodes() {
        return [...nodes.values()].map((definition) => structuredClone(definition));
      },
      listWidgets() {
        return [...widgets.values()];
      },
      registerNode(definition: NodeDefinition) {
        nodes.set(definition.type, structuredClone(definition));
      },
      registerWidget(entry: LeaferGraphWidgetEntry) {
        widgets.set(entry.type, entry);
      },
      replaceGraphDocument(document: GraphDocument) {
        currentDocument = structuredClone(document);
      },
      unregisterNode(type: string) {
        nodes.delete(type);
      },
      unregisterWidget(type: string) {
        widgets.delete(type);
      }
    },
    getDocument() {
      return currentDocument;
    }
  };
}

function createFakeBrowserGraph() {
  const actions: string[] = [];
  const nodes = new Map<string, NodeDefinition>();
  const widgets = new Map<string, LeaferGraphWidgetEntry>();

  return {
    actions,
    graph: {
      installModule(module: { nodes?: NodeDefinition[] }) {
        actions.push("installModule");
        for (const definition of module.nodes ?? []) {
          nodes.set(definition.type, structuredClone(definition));
        }
      },
      listNodes() {
        return [...nodes.values()].map((definition) => structuredClone(definition));
      },
      listWidgets() {
        return [...widgets.values()];
      },
      registerNode(definition: NodeDefinition) {
        actions.push(`registerNode:${definition.type}`);
        nodes.set(definition.type, structuredClone(definition));
      },
      registerWidget(entry: LeaferGraphWidgetEntry) {
        actions.push(`registerWidget:${entry.type}`);
        widgets.set(entry.type, entry);
      },
      unregisterNode(type: string) {
        actions.push(`unregisterNode:${type}`);
        nodes.delete(type);
      },
      unregisterWidget(type: string) {
        actions.push(`unregisterWidget:${type}`);
        widgets.delete(type);
      }
    }
  };
}

const COMPONENT_ENTRY = {
  entryId: "demo/component",
  entryKind: "component-entry" as const,
  name: "Demo Component",
  widgetTypes: ["demo/widget"],
  browserArtifactRef: "component.browser"
};

const NODE_ENTRY = {
  entryId: "demo/node",
  entryKind: "node-entry" as const,
  name: "Demo Node",
  nodeTypes: ["demo/node-type"],
  componentEntryIds: [COMPONENT_ENTRY.entryId],
  authorityArtifactRef: "node.authority",
  browserArtifactRef: "node.browser"
};

const BLUEPRINT_ENTRY = {
  entryId: "demo/blueprint",
  entryKind: "blueprint-entry" as const,
  name: "Demo Blueprint",
  nodeEntryIds: [NODE_ENTRY.entryId],
  componentEntryIds: [COMPONENT_ENTRY.entryId],
  documentArtifactRef: "blueprint.json"
};

describe("extension managers", () => {
  test("authority manager 应处理注册、会话激活、蓝图替换与引用阻断", async () => {
    const artifactReader = new MemoryArtifactReader();
    artifactReader.set(
      COMPONENT_ENTRY.browserArtifactRef,
      `
export default [
  {
    type: "demo/widget",
    renderer() {
      return {};
    }
  }
];
`.trim()
    );
    artifactReader.set(
      NODE_ENTRY.authorityArtifactRef,
      `
export default [
  {
    type: "demo/node-type",
    title: "Demo"
  }
];
`.trim()
    );
    artifactReader.set(
      NODE_ENTRY.browserArtifactRef,
      `
export default [
  {
    type: "demo/node-type",
    title: "Demo"
  }
];
`.trim()
    );
    artifactReader.set(
      BLUEPRINT_ENTRY.documentArtifactRef,
      JSON.stringify(createGraphDocument("demo/node-type")),
      "application/json"
    );

    const catalogStore = new MemoryCatalogStore();
    const sessionStore = new MemorySessionStore();
    const { graph, getDocument } = createFakeAuthorityGraph();
    const manager = new RuntimeBridgeAuthorityExtensionManager({
      graph,
      artifactReader,
      catalogStore,
      sessionStore,
      sessionId: "session-a"
    });

    await manager.executeCommand({ type: "entry.register", entry: COMPONENT_ENTRY });
    await manager.executeCommand({ type: "entry.register", entry: NODE_ENTRY });
    await manager.executeCommand({ type: "entry.register", entry: BLUEPRINT_ENTRY });

    const loadNodeResult = await manager.executeCommand({
      type: "entry.load",
      entryId: NODE_ENTRY.entryId
    });
    expect(loadNodeResult.type).toBe("entry.load.result");
    expect(loadNodeResult.sync.activeNodeEntryIds).toContain(NODE_ENTRY.entryId);
    expect(loadNodeResult.sync.activeComponentEntryIds).toContain(
      COMPONENT_ENTRY.entryId
    );
    expect(graph.listNodes().map((node) => node.type)).toContain("demo/node-type");

    await expect(
      manager.executeCommand({
        type: "entry.unload",
        entryId: COMPONENT_ENTRY.entryId
      })
    ).rejects.toThrow("依赖");

    const blueprintResult = await manager.executeCommand({
      type: "blueprint.load",
      entryId: BLUEPRINT_ENTRY.entryId
    });
    expect(blueprintResult.type).toBe("blueprint.load.result");
    expect(blueprintResult.sync.currentBlueprintId).toBe(BLUEPRINT_ENTRY.entryId);
    expect(getDocument().nodes[0]?.type).toBe("demo/node-type");

    await expect(
      manager.executeCommand({
        type: "entry.unload",
        entryId: NODE_ENTRY.entryId
      })
    ).rejects.toThrow("文档中使用");

    await manager.executeCommand({ type: "blueprint.unload" });
    const unloadNodeResult = await manager.executeCommand({
      type: "entry.unload",
      entryId: NODE_ENTRY.entryId
    });
    expect(unloadNodeResult.type).toBe("entry.unload.result");
    expect(unloadNodeResult.sync.activeNodeEntryIds).not.toContain(NODE_ENTRY.entryId);
  });

  test("browser manager 应先装组件再装节点，并在失活后卸载", async () => {
    const artifactReader = new MemoryArtifactReader();
    artifactReader.set(
      COMPONENT_ENTRY.browserArtifactRef,
      `
export default [
  {
    type: "demo/widget",
    renderer() {
      return {};
    }
  }
];
`.trim()
    );
    artifactReader.set(
      NODE_ENTRY.browserArtifactRef,
      `
export default [
  {
    type: "demo/node-type",
    title: "Demo"
  }
];
`.trim()
    );

    const { actions, graph } = createFakeBrowserGraph();
    const manager = new RuntimeBridgeBrowserExtensionManager({
      graph,
      artifactReader
    });

    await manager.sync({
      entries: [COMPONENT_ENTRY, NODE_ENTRY],
      activeNodeEntryIds: [NODE_ENTRY.entryId],
      activeComponentEntryIds: [COMPONENT_ENTRY.entryId],
      currentBlueprintId: null,
      emittedAt: Date.now()
    });

    expect(actions).toEqual([
      "registerWidget:demo/widget",
      "registerNode:demo/node-type"
    ]);

    await manager.sync({
      entries: [COMPONENT_ENTRY, NODE_ENTRY],
      activeNodeEntryIds: [],
      activeComponentEntryIds: [],
      currentBlueprintId: null,
      emittedAt: Date.now()
    });

    expect(actions.slice(-2)).toEqual([
      "unregisterNode:demo/node-type",
      "unregisterWidget:demo/widget"
    ]);
  });

  test("authority manager 应拒绝 metadata 与组件 artifact 导出不一致的条目", async () => {
    const artifactReader = new MemoryArtifactReader();
    artifactReader.set(
      COMPONENT_ENTRY.browserArtifactRef,
      `
export default [
  {
    type: "demo/other-widget",
    renderer() {
      return {};
    }
  }
];
`.trim()
    );

    const manager = new RuntimeBridgeAuthorityExtensionManager({
      graph: createFakeAuthorityGraph().graph,
      artifactReader,
      catalogStore: new MemoryCatalogStore(),
      sessionStore: new MemorySessionStore(),
      sessionId: "session-b"
    });

    await expect(
      manager.executeCommand({ type: "entry.register", entry: COMPONENT_ENTRY })
    ).rejects.toThrow("metadata 与 artifact 导出不一致");
  });

  test("authority manager 应拒绝节点 artifact 使用了未声明组件依赖的 widget type", async () => {
    const artifactReader = new MemoryArtifactReader();
    artifactReader.set(
      COMPONENT_ENTRY.browserArtifactRef,
      `
export default [
  {
    type: "demo/widget",
    renderer() {
      return {};
    }
  }
];
`.trim()
    );
    artifactReader.set(
      NODE_ENTRY.authorityArtifactRef,
      `
export default [
  {
    type: "demo/node-type",
    title: "Demo"
  }
];
`.trim()
    );
    artifactReader.set(
      NODE_ENTRY.browserArtifactRef,
      `
export default [
  {
    type: "demo/node-type",
    title: "Demo",
    widgets: [
      {
        type: "demo/missing-widget",
        name: "missing"
      }
    ]
  }
];
`.trim()
    );

    const catalogStore = new MemoryCatalogStore();
    const sessionStore = new MemorySessionStore();
    const manager = new RuntimeBridgeAuthorityExtensionManager({
      graph: createFakeAuthorityGraph().graph,
      artifactReader,
      catalogStore,
      sessionStore,
      sessionId: "session-c"
    });

    await manager.executeCommand({ type: "entry.register", entry: COMPONENT_ENTRY });
    await expect(
      manager.executeCommand({ type: "entry.register", entry: NODE_ENTRY })
    ).rejects.toThrow("缺少组件类型依赖");
  });

  test("authority manager 应允许节点 artifact 使用宿主内建 widget type", async () => {
    const artifactReader = new MemoryArtifactReader();
    artifactReader.set(
      NODE_ENTRY.authorityArtifactRef,
      `
export default [
  {
    type: "demo/node-type",
    title: "Demo"
  }
];
`.trim()
    );
    artifactReader.set(
      NODE_ENTRY.browserArtifactRef,
      `
export default [
  {
    type: "demo/node-type",
    title: "Demo",
    widgets: [
      {
        type: "select",
        name: "mode"
      }
    ]
  }
];
`.trim()
    );

    const { graph } = createFakeAuthorityGraph();
    graph.registerWidget({
      type: "select",
      renderer() {
        return {};
      }
    });

    const manager = new RuntimeBridgeAuthorityExtensionManager({
      graph,
      artifactReader,
      catalogStore: new MemoryCatalogStore(),
      sessionStore: new MemorySessionStore(),
      sessionId: "session-host-widget"
    });

    const result = await manager.executeCommand({
      type: "entry.register",
      entry: {
        ...NODE_ENTRY,
        componentEntryIds: []
      }
    });
    expect(result.type).toBe("entry.register.result");
  });

  test("extension managers 应支持 authoring-like module 自动解析 nodes/widgets", async () => {
    const artifactReader = new MemoryArtifactReader();
    const authoringLikeSource = `
const DemoNode = class DemoNode {};
DemoNode.meta = {
  type: "demo/authoring-node",
  title: "Authoring Node",
  widgets: [
    {
      type: "demo/authoring-widget",
      name: "status"
    }
  ]
};

const DemoWidget = {
  type: "demo/authoring-widget",
  renderer() {
    return {};
  }
};

export const authoringModule = {
  nodes: [DemoNode],
  widgets: [DemoWidget]
};

export default authoringModule;
`.trim();

    artifactReader.set(COMPONENT_ENTRY.browserArtifactRef, authoringLikeSource);
    artifactReader.set(NODE_ENTRY.authorityArtifactRef, authoringLikeSource);
    artifactReader.set(NODE_ENTRY.browserArtifactRef, authoringLikeSource);

    const componentEntry = {
      ...COMPONENT_ENTRY,
      widgetTypes: ["demo/authoring-widget"]
    };
    const nodeEntry = {
      ...NODE_ENTRY,
      nodeTypes: ["demo/authoring-node"],
      componentEntryIds: [componentEntry.entryId]
    };

    const catalogStore = new MemoryCatalogStore();
    const sessionStore = new MemorySessionStore();
    const { graph: authorityGraph } = createFakeAuthorityGraph();
    const authorityManager = new RuntimeBridgeAuthorityExtensionManager({
      graph: authorityGraph,
      artifactReader,
      catalogStore,
      sessionStore,
      sessionId: "session-authoring-like"
    });

    await authorityManager.executeCommand({
      type: "entry.register",
      entry: componentEntry
    });
    await authorityManager.executeCommand({
      type: "entry.register",
      entry: nodeEntry
    });
    const loadResult = await authorityManager.executeCommand({
      type: "entry.load",
      entryId: nodeEntry.entryId
    });
    expect(loadResult.type).toBe("entry.load.result");

    const { graph: browserGraph, actions } = createFakeBrowserGraph();
    const browserManager = new RuntimeBridgeBrowserExtensionManager({
      graph: browserGraph,
      artifactReader
    });
    await browserManager.sync({
      entries: [componentEntry, nodeEntry],
      activeNodeEntryIds: [nodeEntry.entryId],
      activeComponentEntryIds: [componentEntry.entryId],
      currentBlueprintId: null,
      emittedAt: Date.now()
    });
    expect(actions).toEqual([
      "registerWidget:demo/authoring-widget",
      "registerNode:demo/authoring-node"
    ]);
  });

  test("authority manager 应拒绝蓝图文档使用未声明依赖的 type", async () => {
    const artifactReader = new MemoryArtifactReader();
    artifactReader.set(
      COMPONENT_ENTRY.browserArtifactRef,
      `
export default [
  {
    type: "demo/widget",
    renderer() {
      return {};
    }
  }
];
`.trim()
    );
    artifactReader.set(
      NODE_ENTRY.authorityArtifactRef,
      `
export default [
  {
    type: "demo/node-type",
    title: "Demo"
  }
];
`.trim()
    );
    artifactReader.set(
      NODE_ENTRY.browserArtifactRef,
      `
export default [
  {
    type: "demo/node-type",
    title: "Demo"
  }
];
`.trim()
    );
    artifactReader.set(
      BLUEPRINT_ENTRY.documentArtifactRef,
      JSON.stringify({
        ...createGraphDocument("demo/unknown-node"),
        nodes: [
          {
            id: "node-1",
            type: "demo/unknown-node",
            layout: {
              x: 0,
              y: 0
            },
            widgets: [
              {
                type: "demo/unknown-widget",
                name: "status"
              }
            ]
          }
        ]
      }),
      "application/json"
    );

    const catalogStore = new MemoryCatalogStore();
    const sessionStore = new MemorySessionStore();
    const manager = new RuntimeBridgeAuthorityExtensionManager({
      graph: createFakeAuthorityGraph().graph,
      artifactReader,
      catalogStore,
      sessionStore,
      sessionId: "session-d"
    });

    await manager.executeCommand({ type: "entry.register", entry: COMPONENT_ENTRY });
    await manager.executeCommand({
      type: "entry.register",
      entry: {
        ...NODE_ENTRY,
        componentEntryIds: []
      }
    });
    await expect(
      manager.executeCommand({ type: "entry.register", entry: BLUEPRINT_ENTRY })
    ).rejects.toThrow(/缺少(节点|组件)类型依赖/);
  });
});

test("loader 应聚合同一 artifact 里的多个节点导出", async () => {
  const artifactReader = new MemoryArtifactReader();
  const multiNodeSource = `
const AlertNode = class AlertNode {};
AlertNode.meta = {
  type: "base/io/alert",
  title: "Alert"
};

const ConfirmNode = class ConfirmNode {};
ConfirmNode.meta = {
  type: "base/io/confirm",
  title: "Confirm"
};

export { AlertNode, ConfirmNode };
export default {
  nodes: [AlertNode, ConfirmNode]
};
`.trim();

  artifactReader.set(NODE_ENTRY.authorityArtifactRef, multiNodeSource);
  artifactReader.set(NODE_ENTRY.browserArtifactRef, multiNodeSource);

  const manager = new RuntimeBridgeAuthorityExtensionManager({
    graph: createFakeAuthorityGraph().graph,
    artifactReader,
    catalogStore: new MemoryCatalogStore(),
    sessionStore: new MemorySessionStore(),
    sessionId: "session-multi-node"
  });

  const result = await manager.executeCommand({
    type: "entry.register",
    entry: {
      ...NODE_ENTRY,
      nodeTypes: ["base/io/alert", "base/io/confirm"],
      componentEntryIds: []
    }
  });

  expect(result.type).toBe("entry.register.result");
});

test("loader 应在服务端环境生成可导入的 module specifier", async () => {
  const specifier = await createModuleSpecifierFromArtifact({
    kind: "bytes",
    bytes: new TextEncoder().encode(`export const answer = 42;`),
    contentType: "text/javascript"
  });

  if (typeof window === "undefined" || typeof document === "undefined") {
    expect(specifier.startsWith("file:")).toBe(true);
    return;
  }

  expect(specifier.startsWith("data:text/javascript;base64,")).toBe(true);
});

test("loader 应能在服务端通过临时模块导入重写后的依赖", async () => {
  const dependencySpecifier = `@demo/runtime/${Date.now()}`;
  registerRuntimeBridgeModuleDependency(dependencySpecifier, {
    demoValue: "from-runtime-dependency"
  });

  const namespace = await importModuleNamespaceFromArtifact({
    kind: "bytes",
    bytes: new TextEncoder().encode(`
import { demoValue } from "${dependencySpecifier}";

export const resolvedValue = demoValue;
export default [
  {
    type: "demo/rewrite-node",
    title: demoValue
  }
];
`.trim()),
    contentType: "text/javascript"
  });

  expect(namespace.resolvedValue).toBe("from-runtime-dependency");
});
