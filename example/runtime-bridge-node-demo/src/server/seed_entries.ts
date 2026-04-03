import type {
  RuntimeBridgeCatalogEntry
} from "@leafergraph/runtime-bridge";
import {
  DEMO_REMOTE_BLUEPRINT_ENTRY_ID,
  DEMO_REMOTE_COMPONENT_ENTRY_ID,
  DEMO_REMOTE_NODE_ENTRY_ID
} from "../shared/catalog";
import { createRuntimeBridgeNodeDemoDocument } from "../shared/document";
import type { DemoFileSystemArtifactStore } from "./artifact_store";
import { createFrequencyCatalogEntries } from "./frequency_seed_entries";

/**
 * 初始化 demo 默认远端条目。
 *
 * @param artifactStore - artifact store。
 * @returns 可直接注册的目录条目。
 */
export async function createSeedCatalogEntries(
  artifactStore: DemoFileSystemArtifactStore
): Promise<RuntimeBridgeCatalogEntry[]> {
  const componentBrowserArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(createComponentBrowserArtifactSource()),
    contentType: "text/javascript",
    suggestedName: "demo-status-badge.browser.mjs"
  });
  const nodeArtifactBytes = new TextEncoder().encode(createNodeArtifactSource());
  const authorityArtifactRef = await artifactStore.writeArtifact({
    bytes: nodeArtifactBytes,
    contentType: "text/javascript",
    suggestedName: "demo-status-node.authority.mjs"
  });
  const browserArtifactRef = await artifactStore.writeArtifact({
    bytes: nodeArtifactBytes,
    contentType: "text/javascript",
    suggestedName: "demo-status-node.browser.mjs"
  });
  const blueprintDocument = createSeedBlueprintDocument();
  const documentArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(JSON.stringify(blueprintDocument, null, 2)),
    contentType: "application/json",
    suggestedName: "demo-status-blueprint.json"
  });

  const statusEntries: RuntimeBridgeCatalogEntry[] = [
    {
      entryId: DEMO_REMOTE_COMPONENT_ENTRY_ID,
      entryKind: "component-entry",
      name: "远端状态组件",
      description: "一个纯浏览器侧加载的彩色状态徽章 Widget。",
      widgetTypes: ["demo/status-badge"],
      browserArtifactRef: componentBrowserArtifactRef
    },
    {
      entryId: DEMO_REMOTE_NODE_ENTRY_ID,
      entryKind: "node-entry",
      name: "远端状态节点",
      description: "带有自定义状态徽章 Widget 的远端节点示例。",
      nodeTypes: ["demo/status-emitter"],
      componentEntryIds: [DEMO_REMOTE_COMPONENT_ENTRY_ID],
      authorityArtifactRef,
      browserArtifactRef
    },
    {
      entryId: DEMO_REMOTE_BLUEPRINT_ENTRY_ID,
      entryKind: "blueprint-entry",
      name: "远端状态蓝图",
      description: "使用远端节点/组件的整图蓝图。",
      nodeEntryIds: [DEMO_REMOTE_NODE_ENTRY_ID],
      componentEntryIds: [DEMO_REMOTE_COMPONENT_ENTRY_ID],
      documentArtifactRef
    }
  ];

  const frequencyEntries = await createFrequencyCatalogEntries(artifactStore);
  return [...statusEntries, ...frequencyEntries];
}

function createComponentBrowserArtifactSource(): string {
  return `
const STATUS_COLORS = {
  READY: "#0f766e",
  RUNNING: "#2563eb",
  WARN: "#d97706",
  ERROR: "#dc2626"
};

function createStatusWidgetRenderer(context) {
  const { ui, group, bounds, value } = context;
  const background = new ui.Rect({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    cornerRadius: Math.min(bounds.height / 2, 14),
    fill: STATUS_COLORS[String(value || "READY")] || "#475569",
    stroke: "#ffffff",
    strokeWidth: 1,
    opacity: 0.92
  });
  const label = new ui.Text({
    x: bounds.x + 12,
    y: bounds.y + 8,
    text: String(value || "READY"),
    fill: "#ffffff",
    fontSize: 12,
    fontWeight: "bold"
  });
  group.addMany(background, label);

  return {
    update(nextValue) {
      const nextText = String(nextValue || "READY");
      background.fill = STATUS_COLORS[nextText] || "#475569";
      label.text = nextText;
      context.requestRender();
    },
    destroy() {
      group.removeAll();
    }
  };
}

export default [
  {
    type: "demo/status-badge",
    title: "Status Badge",
    renderer: createStatusWidgetRenderer
  }
];
`.trim();
}

function createNodeArtifactSource(): string {
  return `
function syncStatus(node, status) {
  const nextStatus = String(status || "READY");
  if (!node.widgets || node.widgets.length === 0) {
    return;
  }
  node.widgets[0].value = nextStatus;
}

export default [
  {
    type: "demo/status-emitter",
    title: "Remote Status",
    category: "demo/remote",
    description: "远端加载的状态节点。",
    inputs: [
      { name: "tick", type: "event" }
    ],
    outputs: [
      { name: "done", type: "event" }
    ],
    properties: [
      { name: "status", type: "string", default: "READY" }
    ],
    widgets: [
      {
        type: "demo/status-badge",
        name: "status",
        value: "READY"
      }
    ],
    size: [240, 116],
    onCreate(node) {
      if (!node.properties) {
        node.properties = {};
      }
      if (!node.properties.status) {
        node.properties.status = "READY";
      }
      syncStatus(node, node.properties.status);
    },
    onAction(node, action, payload, options, api) {
      if (action !== "tick") {
        return;
      }

      const current = String(node.properties?.status || "READY");
      const next =
        current === "READY" ? "RUNNING" : current === "RUNNING" ? "WARN" : "READY";
      node.properties = {
        ...node.properties,
        status: next
      };
      syncStatus(node, next);
      api.setOutputData(0, {
        status: next,
        payload
      });
    }
  }
];
`.trim();
}

function createSeedBlueprintDocument() {
  const document = createRuntimeBridgeNodeDemoDocument();
  document.documentId = "runtime-bridge-remote-blueprint";
  document.revision = 1;
  document.nodes = [
    {
      id: "remote-status-node",
      type: "demo/status-emitter",
      title: "Remote Status",
      layout: {
        x: 240,
        y: 220,
        width: 240,
        height: 116
      },
      properties: {
        status: "READY"
      },
      widgets: [
        {
          type: "demo/status-badge",
          name: "status",
          value: "READY"
        }
      ]
    }
  ];
  document.links = [];
  return document;
}
