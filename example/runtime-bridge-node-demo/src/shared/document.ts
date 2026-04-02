import type { GraphDocument } from "@leafergraph/runtime-bridge/portable";

export const RUNTIME_BRIDGE_NODE_DEMO_DOCUMENT_ID =
  "runtime-bridge-node-demo-document";

export const RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS = {
  onPlay: "demo-on-play",
  heartbeatTimer: "demo-heartbeat-timer",
  slowTimer: "demo-slow-timer"
} as const;

const runtimeBridgeNodeDemoDocumentTemplate: GraphDocument = {
  documentId: RUNTIME_BRIDGE_NODE_DEMO_DOCUMENT_ID,
  revision: 1,
  appKind: "runtime-bridge-node-demo",
  nodes: [
    {
      id: RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS.onPlay,
      type: "system/on-play",
      title: "Authority Start",
      layout: {
        x: 84,
        y: 204
      }
    },
    {
      id: RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS.heartbeatTimer,
      type: "system/timer",
      title: "Heartbeat",
      layout: {
        x: 352,
        y: 88
      },
      properties: {
        intervalMs: 700,
        immediate: true,
        runCount: 0,
        status: "READY"
      },
      widgets: [
        {
          type: "input",
          name: "intervalMs",
          value: 700,
          options: {
            label: "Interval (ms)",
            placeholder: "700"
          }
        },
        {
          type: "toggle",
          name: "immediate",
          value: true,
          options: {
            label: "Immediate",
            onText: "ON",
            offText: "WAIT"
          }
        }
      ]
    },
    {
      id: RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS.slowTimer,
      type: "system/timer",
      title: "Slow Pulse",
      layout: {
        x: 352,
        y: 320
      },
      properties: {
        intervalMs: 2200,
        immediate: false,
        runCount: 0,
        status: "READY"
      },
      widgets: [
        {
          type: "input",
          name: "intervalMs",
          value: 2200,
          options: {
            label: "Interval (ms)",
            placeholder: "2200"
          }
        },
        {
          type: "toggle",
          name: "immediate",
          value: false,
          options: {
            label: "Immediate",
            onText: "ON",
            offText: "WAIT"
          }
        }
      ]
    }
  ],
  links: [
    {
      id: "demo-link:on-play->heartbeat",
      source: {
        nodeId: RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS.onPlay,
        slot: 0
      },
      target: {
        nodeId: RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS.heartbeatTimer,
        slot: 0
      }
    },
    {
      id: "demo-link:on-play->slow",
      source: {
        nodeId: RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS.onPlay,
        slot: 0
      },
      target: {
        nodeId: RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS.slowTimer,
        slot: 0
      }
    }
  ]
};

/**
 * 创建 demo 使用的正式图文档。
 *
 * @returns 当前 demo 的图文档副本。
 */
export function createRuntimeBridgeNodeDemoDocument(): GraphDocument {
  return structuredClone(runtimeBridgeNodeDemoDocumentTemplate);
}
