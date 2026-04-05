import { describe, expect, test } from "bun:test";

import { LeaferGraphNodeExecutionHost } from "../src/node/node_execution_host";

const INTERNAL_EXECUTION_STATE_OVERRIDE_KEY =
  "__leafergraphExecutionStateOverride";

function createRuntimeNode() {
  return {
    id: "delay-1",
    type: "events/delay",
    title: "Delay",
    layout: { x: 0, y: 0 },
    properties: {},
    propertySpecs: [],
    inputs: [],
    outputs: [],
    widgets: [],
    flags: {},
    inputValues: [],
    outputValues: [],
    data: {} as Record<string, unknown>
  };
}

function createLinkedRuntimeNode(input: {
  id: string;
  type: string;
  title: string;
  inputs?: Array<{ name: string; type?: string }>;
  outputs?: Array<{ name: string; type?: string }>;
}) {
  return {
    id: input.id,
    type: input.type,
    title: input.title,
    layout: { x: 0, y: 0 },
    properties: {},
    propertySpecs: [],
    inputs: input.inputs ?? [],
    outputs: input.outputs ?? [],
    widgets: [],
    flags: {},
    inputValues: [],
    outputValues: [],
    data: {} as Record<string, unknown>
  };
}

describe("LeaferGraphNodeExecutionHost", () => {
  test("preserves running progress when a node requests an internal running override", () => {
    const node = createRuntimeNode();
    const host = new LeaferGraphNodeExecutionHost({
      nodeRegistry: {
        getNode(type: string) {
          if (type !== "events/delay") {
            return undefined;
          }

          return {
            onAction(runtimeNode: typeof node) {
              runtimeNode.data[INTERNAL_EXECUTION_STATE_OVERRIDE_KEY] = {
                status: "running"
              };
            }
          };
        }
      } as never,
      widgetRegistry: {} as never,
      graphNodes: new Map([[node.id, node]]),
      graphLinks: new Map()
    });

    host.projectExternalNodeExecution({
      chainId: "progress-chain",
      rootNodeId: node.id,
      rootNodeType: node.type,
      rootNodeTitle: node.title,
      nodeId: node.id,
      nodeType: node.type,
      nodeTitle: node.title,
      depth: 0,
      sequence: 0,
      source: "graph-play",
      trigger: "direct",
      timestamp: 1,
      executionContext: {
        source: "graph-play",
        entryNodeId: node.id,
        startedAt: 1,
        stepIndex: 0
      },
      state: {
        status: "running",
        runCount: 1,
        progress: 0.42,
        lastExecutedAt: 1
      }
    } as never);

    const task = host.createEntryExecutionTask(node.id, {
      source: "graph-play",
      runId: "run-1",
      startedAt: 2
    });
    if (!task) {
      throw new Error("expected execution task");
    }

    task.propagated = {
      payload: "tick",
      metadata: {
        sourceNodeId: "timer-1",
        sourceSlot: 0,
        targetNodeId: node.id,
        targetSlot: 0,
        targetSlotType: "event",
        targetSlotName: "event"
      }
    } as never;

    host.executeExecutionTask(task, 0);

    expect(host.getNodeExecutionState(node.id)).toMatchObject({
      status: "running",
      progress: 0.42
    });
  });

  test("awaits async onExecute before collecting propagated tasks", async () => {
    const sourceNode = createLinkedRuntimeNode({
      id: "request-html-1",
      type: "demo/request-html",
      title: "Request HTML",
      outputs: [{ name: "html", type: "string" }]
    });
    const targetNode = createLinkedRuntimeNode({
      id: "select-dom-1",
      type: "demo/select-html-fragments",
      title: "Select DOM Fragments",
      inputs: [{ name: "html", type: "string" }]
    });
    const host = new LeaferGraphNodeExecutionHost({
      nodeRegistry: {
        getNode(type: string) {
          if (type !== "demo/request-html") {
            return undefined;
          }

          return {
            onExecute: async (_runtimeNode: typeof sourceNode, _context: unknown, api: {
              setOutputData(slot: number, data: unknown): void;
            }) => {
              await Promise.resolve();
              api.setOutputData(0, "<main>async html</main>");
            }
          };
        }
      } as never,
      widgetRegistry: {} as never,
      graphNodes: new Map([
        [sourceNode.id, sourceNode],
        [targetNode.id, targetNode]
      ]),
      graphLinks: new Map([
        [
          "link:request->select",
          {
            id: "link:request->select",
            source: {
              nodeId: sourceNode.id,
              slot: 0
            },
            target: {
              nodeId: targetNode.id,
              slot: 0
            }
          }
        ]
      ])
    });

    const task = host.createEntryExecutionTask(sourceNode.id, {
      source: "graph-play",
      runId: "run-async-1",
      startedAt: 1
    });
    if (!task) {
      throw new Error("expected async execution task");
    }

    const result = await host.executeExecutionTask(task, 0);

    expect(sourceNode.outputValues[0]).toBe("<main>async html</main>");
    expect(targetNode.inputValues[0]).toBe("<main>async html</main>");
    expect(result.nextTasks).toHaveLength(1);
    expect(result.nextTasks[0]?.nodeId).toBe(targetNode.id);
    expect(host.getNodeExecutionState(sourceNode.id)).toMatchObject({
      status: "success",
      runCount: 1
    });
  });
});
