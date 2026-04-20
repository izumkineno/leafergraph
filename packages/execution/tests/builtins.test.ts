import { describe, expect, it } from "bun:test";

import { createRuntimeNode, createNodeRegistry } from "./test_helpers";
import {
  LEAFER_GRAPH_TIMER_DEFAULT_INTERVAL_MS,
  LEAFER_GRAPH_TIMER_NODE_TYPE,
  leaferGraphOnPlayNodeDefinition,
  leaferGraphTimerNodeDefinition
} from "../src";

describe("@leafergraph/execution builtins", () => {
  it("system/on-play 会把执行上下文直接写到 Start 输出", () => {
    const outputs: unknown[] = [];

    leaferGraphOnPlayNodeDefinition.onExecute?.(
      {
        id: "on-play-1",
        type: "system/on-play",
        title: "Start Event",
        layout: { x: 0, y: 0 },
        properties: {},
        propertySpecs: [],
        inputs: [],
        outputs: [{ name: "Start", type: "event" }],
        widgets: [],
        flags: {},
        inputValues: [],
        outputValues: []
      },
      {
        source: "graph-play",
        runId: "run-1",
        entryNodeId: "on-play-1",
        stepIndex: 0,
        startedAt: 1
      },
      {
        addInput() {
          throw new Error("unused");
        },
        addOutput() {
          throw new Error("unused");
        },
        removeInput() {},
        removeOutput() {},
        addProperty() {},
        addWidget() {},
        getInputData() {
          return undefined;
        },
        setOutputData(slot, data) {
          outputs[slot] = data;
        },
        findInputSlot() {
          return -1;
        },
        findOutputSlot() {
          return -1;
        }
      }
    );

    expect(outputs[0]).toEqual({
      source: "graph-play",
      runId: "run-1",
      entryNodeId: "on-play-1",
      stepIndex: 0,
      startedAt: 1
    });
  });

  it("system/timer 在 graph-play + immediate=false 时会进入 WAIT 状态并注册定时器", () => {
    const registry = createNodeRegistry([leaferGraphTimerNodeDefinition]);
    const node = createRuntimeNode(registry, {
      id: "timer-1",
      type: LEAFER_GRAPH_TIMER_NODE_TYPE
    });
    const registrations: unknown[] = [];
    let emitted: unknown;

    node.properties.intervalMs = -10;
    node.properties.immediate = "nope";
    node.widgets[0]!.value = "  0  ";
    node.widgets[1]!.value = false;

    leaferGraphTimerNodeDefinition.onExecute?.(
      node,
      {
        source: "graph-play",
        runId: "run-1",
        entryNodeId: node.id,
        stepIndex: 0,
        startedAt: 100,
        payload: {
          registerGraphTimer(input: unknown) {
            registrations.push(input);
          }
        }
      },
      {
        addInput() {
          throw new Error("unused");
        },
        addOutput() {
          throw new Error("unused");
        },
        removeInput() {},
        removeOutput() {},
        addProperty() {},
        addWidget() {},
        getInputData() {
          return undefined;
        },
        setOutputData(_slot, data) {
          emitted = data;
        },
        findInputSlot() {
          return -1;
        },
        findOutputSlot() {
          return -1;
        }
      }
    );

    expect(registrations).toEqual([
      {
        nodeId: "timer-1",
        runId: "run-1",
        source: "graph-play",
        startedAt: 100,
        intervalMs: LEAFER_GRAPH_TIMER_DEFAULT_INTERVAL_MS,
        immediate: false
      }
    ]);
    expect(emitted).toBeUndefined();
    expect(node.properties.intervalMs).toBe(LEAFER_GRAPH_TIMER_DEFAULT_INTERVAL_MS);
    expect(node.properties.immediate).toBe(false);
    expect(node.properties.status).toBe(
      `WAIT ${LEAFER_GRAPH_TIMER_DEFAULT_INTERVAL_MS}ms`
    );
    expect(node.title).toBe("Timer");
    expect(node.widgets[0]?.value).toBe(LEAFER_GRAPH_TIMER_DEFAULT_INTERVAL_MS);
    expect(node.widgets[1]?.value).toBe(false);
  });

  it("system/timer 在 node-play 或定时回调里会输出 Tick 并累计 runCount", () => {
    const registry = createNodeRegistry([leaferGraphTimerNodeDefinition]);
    const node = createRuntimeNode(registry, {
      id: "timer-2",
      type: LEAFER_GRAPH_TIMER_NODE_TYPE
    });
    const emissions: unknown[] = [];

    leaferGraphTimerNodeDefinition.onExecute?.(
      node,
      {
        source: "node-play",
        entryNodeId: node.id,
        stepIndex: 0,
        startedAt: 1
      },
      {
        addInput() {
          throw new Error("unused");
        },
        addOutput() {
          throw new Error("unused");
        },
        removeInput() {},
        removeOutput() {},
        addProperty() {},
        addWidget() {},
        getInputData() {
          return undefined;
        },
        setOutputData(_slot, data) {
          emissions.push(data);
        },
        findInputSlot() {
          return -1;
        },
        findOutputSlot() {
          return -1;
        }
      }
    );

    leaferGraphTimerNodeDefinition.onExecute?.(
      node,
      {
        source: "graph-play",
        runId: "run-2",
        entryNodeId: node.id,
        stepIndex: 1,
        startedAt: 2,
        payload: {
          timerTickNodeId: node.id,
          timerTickTimerId: "default",
          timerTickMode: "interval"
        }
      },
      {
        addInput() {
          throw new Error("unused");
        },
        addOutput() {
          throw new Error("unused");
        },
        removeInput() {},
        removeOutput() {},
        addProperty() {},
        addWidget() {},
        getInputData() {
          return undefined;
        },
        setOutputData(_slot, data) {
          emissions.push(data);
        },
        findInputSlot() {
          return -1;
        },
        findOutputSlot() {
          return -1;
        }
      }
    );

    expect(emissions).toHaveLength(2);
    expect(node.properties.runCount).toBe(2);
    expect(node.properties.status).toBe("TICK 2");
    expect(node.title).toBe("Timer 2");
  });
});
