import { describe, expect, test } from "bun:test";

import type { GraphDocument, NodeDefinition } from "@leafergraph/node";
import type { LeaferGraphWidgetEntry } from "@leafergraph/contracts";
import {
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
});
