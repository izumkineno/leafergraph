import { describe, expect, it } from "bun:test";

import type { LeaferGraphLongTaskController } from "@leafergraph/execution";
import type { NodeRuntimeState } from "@leafergraph/node";
import {
  LEAFER_GRAPH_TIMER_NODE_TYPE,
  LeaferGraphNodeExecutionHost,
  leaferGraphTimerNodeDefinition
} from "../src";
import {
  createGraphLinks,
  createNodeRegistry,
  createRuntimeNode
} from "./test_helpers";

describe("@leafergraph/execution LeaferGraphNodeExecutionHost", () => {
  it("长任务可以在运行中持续更新进度，并在完成时收口", () => {
    let controller: LeaferGraphLongTaskController | undefined;
    const registry = createNodeRegistry([
      {
        type: "demo/long-task",
        onExecute(_node, context) {
          controller = context?.startLongTask();
        }
      }
    ]);
    const node = createRuntimeNode(registry, {
      id: "task-1",
      type: "demo/long-task",
      properties: {
        progressMode: "determinate"
      }
    });
    const host = new LeaferGraphNodeExecutionHost({
      nodeRegistry: registry,
      widgetRegistry: registry.widgetDefinitions,
      graphNodes: new Map<string, NodeRuntimeState>([[node.id, node]]),
      graphLinks: new Map()
    });
    const events: Array<{ status: string; progress?: number }> = [];
    host.subscribeNodeExecution((event) => {
      events.push({
        status: event.state.status,
        progress: event.state.progress
      });
    });

    const task = host.createEntryExecutionTask(node.id, {
      source: "node-play",
      startedAt: 1
    })!;
    const result = host.executeExecutionTask(task, 0);

    expect(result.handled).toBe(true);
    expect(host.getNodeExecutionState(node.id)).toMatchObject({
      status: "running",
      runCount: 1,
      progress: 0
    });

    controller?.setProgress(0.35);
    expect(host.getNodeExecutionState(node.id)).toMatchObject({
      status: "running",
      progress: 0.35
    });

    controller?.complete();
    expect(host.getNodeExecutionState(node.id)).toMatchObject({
      status: "success",
      runCount: 1
    });
    expect(host.getNodeExecutionState(node.id)?.progress).toBeUndefined();
    expect(events.map((event) => event.status)).toEqual([
      "running",
      "running",
      "success"
    ]);
  });

  it("直接执行节点时会传播数据，并对同一目标节点做普通数据去重", () => {
    const registry = createNodeRegistry([
      {
        type: "demo/source",
        outputs: [{ name: "Out", type: "string" }],
        onExecute(_node, _context, api) {
          api?.setOutputData(0, { value: 42 });
        }
      },
      {
        type: "demo/sink",
        inputs: [{ name: "A", type: "string" }, { name: "B", type: "string" }],
        onExecute(node, _context, api) {
          node.data = {
            received: [api?.getInputData(0), api?.getInputData(1)]
          };
        }
      }
    ]);
    const source = createRuntimeNode(registry, {
      id: "source-1",
      type: "demo/source"
    });
    const sink = createRuntimeNode(registry, {
      id: "sink-1",
      type: "demo/sink"
    });
    const host = new LeaferGraphNodeExecutionHost({
      nodeRegistry: registry,
      widgetRegistry: registry.widgetDefinitions,
      graphNodes: new Map<string, NodeRuntimeState>([
        [source.id, source],
        [sink.id, sink]
      ]),
      graphLinks: createGraphLinks([
        {
          id: "link-a",
          source: { nodeId: source.id, slot: 0 },
          target: { nodeId: sink.id, slot: 0 }
        },
        {
          id: "link-b",
          source: { nodeId: source.id, slot: 0 },
          target: { nodeId: sink.id, slot: 1 }
        }
      ])
    });
    const propagationEvents: unknown[] = [];
    host.subscribeLinkPropagation((event) => propagationEvents.push(event));

    const task = host.createEntryExecutionTask(source.id, {
      source: "node-play",
      startedAt: 1
    });

    expect(task).toBeDefined();

    const sourceResult = host.executeExecutionTask(task!, 0);
    expect(sourceResult.handled).toBe(true);
    expect(sourceResult.nextTasks).toHaveLength(1);
    expect(source.outputValues[0]).toEqual({ value: 42 });
    expect(sink.inputValues).toEqual([{ value: 42 }, { value: 42 }]);
    expect(propagationEvents).toHaveLength(2);

    const sinkResult = host.executeExecutionTask(sourceResult.nextTasks[0]!, 1);
    expect(sinkResult.handled).toBe(true);
    expect(sink.data).toEqual({
      received: [{ value: 42 }, { value: 42 }]
    });
    expect(host.getNodeExecutionState(source.id)).toMatchObject({
      status: "success",
      runCount: 1
    });
    expect(host.getNodeExecutionState(sink.id)).toMatchObject({
      status: "success",
      runCount: 1
    });
  });

  it("事件槽传播会走 onAction，并携带 propagation 元信息", () => {
    const registry = createNodeRegistry([
      {
        type: "demo/trigger",
        outputs: [{ name: "Run", type: "event" }],
        onExecute(_node, _context, api) {
          api?.setOutputData(0, "PING");
        }
      },
      {
        type: "demo/action",
        inputs: [{ name: "Start", type: "event" }],
        onAction(node, action, param, options) {
          node.data = {
            action,
            param,
            trigger: options?.trigger,
            sourceNodeType: options?.propagation?.sourceNodeType,
            targetSlotName: options?.propagation?.targetSlotName
          };
        }
      }
    ]);
    const source = createRuntimeNode(registry, {
      id: "trigger-1",
      type: "demo/trigger"
    });
    const target = createRuntimeNode(registry, {
      id: "action-1",
      type: "demo/action"
    });
    const host = new LeaferGraphNodeExecutionHost({
      nodeRegistry: registry,
      widgetRegistry: registry.widgetDefinitions,
      graphNodes: new Map<string, NodeRuntimeState>([
        [source.id, source],
        [target.id, target]
      ]),
      graphLinks: createGraphLinks([
        {
          id: "link-run",
          source: { nodeId: source.id, slot: 0 },
          target: { nodeId: target.id, slot: 0 }
        }
      ])
    });

    const task = host.createEntryExecutionTask(source.id, {
      source: "graph-play",
      runId: "run-1",
      startedAt: 10
    });
    const sourceResult = host.executeExecutionTask(task!, 0);

    expect(sourceResult.nextTasks).toHaveLength(1);
    expect(sourceResult.nextTasks[0]?.trigger).toBe("propagated");

    const actionResult = host.executeExecutionTask(sourceResult.nextTasks[0]!, 1);

    expect(actionResult.handled).toBe(true);
    expect(target.data).toEqual({
      action: "Start",
      param: "PING",
      trigger: "propagated",
      sourceNodeType: "demo/trigger",
      targetSlotName: "Start"
    });
  });

  it("遇到已在 activeNodeIds 中的节点时会阻断环路执行", () => {
    const registry = createNodeRegistry([
      {
        type: "demo/loop",
        onExecute() {
          throw new Error("should not run");
        }
      }
    ]);
    const loopNode = createRuntimeNode(registry, {
      id: "loop-1",
      type: "demo/loop"
    });
    const host = new LeaferGraphNodeExecutionHost({
      nodeRegistry: registry,
      widgetRegistry: registry.widgetDefinitions,
      graphNodes: new Map<string, NodeRuntimeState>([[loopNode.id, loopNode]]),
      graphLinks: new Map()
    });

    const task = host.createEntryExecutionTask(loopNode.id, {
      source: "node-play",
      startedAt: 1
    })!;
    task.activeNodeIds = new Set([loopNode.id]);

    expect(host.executeExecutionTask(task, 0)).toEqual({
      handled: false,
      nextTasks: []
    });
  });

  it("支持投影外部执行与传播事件，并同步本地缓存", () => {
    const registry = createNodeRegistry([
      {
        type: "demo/source",
        outputs: [{ name: "Out", type: "string" }]
      },
      {
        type: "demo/sink",
        inputs: [{ name: "In", type: "string" }]
      }
    ]);
    const source = createRuntimeNode(registry, {
      id: "source-2",
      type: "demo/source",
      title: "Source"
    });
    const sink = createRuntimeNode(registry, {
      id: "sink-2",
      type: "demo/sink",
      title: "Sink"
    });
    const host = new LeaferGraphNodeExecutionHost({
      nodeRegistry: registry,
      widgetRegistry: registry.widgetDefinitions,
      graphNodes: new Map<string, NodeRuntimeState>([
        [source.id, source],
        [sink.id, sink]
      ]),
      graphLinks: new Map()
    });
    const nodeEvents: unknown[] = [];
    const propagationEvents: unknown[] = [];
    host.subscribeNodeExecution((event) => nodeEvents.push(event));
    host.subscribeLinkPropagation((event) => propagationEvents.push(event));

    host.projectExternalNodeExecution({
      chainId: "chain-1",
      rootNodeId: source.id,
      rootNodeType: source.type,
      rootNodeTitle: "External Source",
      nodeId: source.id,
      nodeType: source.type,
      nodeTitle: "Projected Source",
      depth: 0,
      sequence: 0,
      source: "graph-play",
      trigger: "direct",
      timestamp: 20,
      executionContext: {
        source: "graph-play",
        runId: "run-1",
        entryNodeId: source.id,
        stepIndex: 0,
        startedAt: 10,
        startLongTask() {
          return {
            setProgress() {},
            complete() {},
            fail() {}
          };
        }
      },
      state: {
        status: "success",
        runCount: 3,
        lastExecutedAt: 20,
        lastSucceededAt: 20
      }
    });

    host.projectExternalLinkPropagation({
      linkId: "external-link",
      chainId: "chain-1",
      sourceNodeId: source.id,
      sourceSlot: 0,
      targetNodeId: sink.id,
      targetSlot: 0,
      payload: { result: "ok" },
      timestamp: 21
    });

    expect(host.getNodeExecutionState(source.id)).toMatchObject({
      status: "success",
      runCount: 3
    });
    expect(source.title).toBe("Projected Source");
    expect(source.outputValues[0]).toEqual({ result: "ok" });
    expect(sink.inputValues[0]).toEqual({ result: "ok" });
    expect(nodeEvents).toHaveLength(1);
    expect(propagationEvents).toHaveLength(1);
  });

  it("长任务运行中会丢弃后续输入传播", () => {
    let targetController: LeaferGraphLongTaskController | undefined;
    const registry = createNodeRegistry([
      {
        type: "demo/source",
        outputs: [{ name: "Out", type: "string" }],
        onExecute(_node, _context, api) {
          api?.setOutputData(0, { value: "fresh" });
        }
      },
      {
        type: "demo/target",
        inputs: [{ name: "In", type: "string" }],
        onExecute(_node, context) {
          targetController = context?.startLongTask();
        }
      }
    ]);
    const source = createRuntimeNode(registry, {
      id: "source-3",
      type: "demo/source"
    });
    const target = createRuntimeNode(registry, {
      id: "target-3",
      type: "demo/target",
      properties: {
        progressMode: "indeterminate"
      }
    });
    const host = new LeaferGraphNodeExecutionHost({
      nodeRegistry: registry,
      widgetRegistry: registry.widgetDefinitions,
      graphNodes: new Map<string, NodeRuntimeState>([
        [source.id, source],
        [target.id, target]
      ]),
      graphLinks: createGraphLinks([
        {
          id: "link-drop",
          source: { nodeId: source.id, slot: 0 },
          target: { nodeId: target.id, slot: 0 }
        }
      ])
    });

    const targetTask = host.createEntryExecutionTask(target.id, {
      source: "node-play",
      startedAt: 1
    })!;
    host.executeExecutionTask(targetTask, 0);
    expect(host.getNodeExecutionState(target.id)?.status).toBe("running");

    const sourceTask = host.createEntryExecutionTask(source.id, {
      source: "node-play",
      startedAt: 2
    })!;
    const sourceResult = host.executeExecutionTask(sourceTask, 0);

    expect(sourceResult.handled).toBe(true);
    expect(sourceResult.nextTasks).toHaveLength(0);
    expect(target.inputValues[0]).toBeUndefined();
    targetController?.complete();
  });

  it("长任务运行中的 timer tick 可以重新进入并在 tick 时收口", () => {
    const registry = createNodeRegistry([
      {
        type: "demo/timer-long",
        outputs: [{ name: "Tick", type: "event" }],
        onExecute(node, context, api) {
          const payload = context?.payload as
            | { timerTickNodeId?: string; timerTickMode?: string }
            | undefined;

          if (payload?.timerTickNodeId === node.id) {
            api?.setOutputData(0, payload.timerTickMode ?? "tick");
            context?.startLongTask()?.complete();
            return;
          }

          context?.startLongTask();
        }
      }
    ]);
    const node = createRuntimeNode(registry, {
      id: "timer-long-1",
      type: "demo/timer-long",
      properties: {
        progressMode: "indeterminate"
      }
    });
    const host = new LeaferGraphNodeExecutionHost({
      nodeRegistry: registry,
      widgetRegistry: registry.widgetDefinitions,
      graphNodes: new Map<string, NodeRuntimeState>([[node.id, node]]),
      graphLinks: new Map()
    });
    const events: string[] = [];
    host.subscribeNodeExecution((event) => {
      events.push(event.state.status);
    });

    const firstTask = host.createEntryExecutionTask(node.id, {
      source: "graph-play",
      runId: "run-1",
      startedAt: 1
    })!;
    const firstResult = host.executeExecutionTask(firstTask, 0);

    expect(firstResult.handled).toBe(true);
    expect(host.getNodeExecutionState(node.id)).toMatchObject({
      status: "running",
      runCount: 1,
      progress: 0
    });

    const tickTask = host.createEntryExecutionTask(node.id, {
      source: "graph-play",
      runId: "run-1",
      startedAt: 2,
      payload: {
        timerTickNodeId: node.id,
        timerTickMode: "timeout"
      }
    })!;
    const tickResult = host.executeExecutionTask(tickTask, 1);

    expect(tickResult.handled).toBe(true);
    expect(host.getNodeExecutionState(node.id)).toMatchObject({
      status: "success",
      runCount: 2
    });
    expect(host.getNodeExecutionState(node.id)?.progress).toBeUndefined();
    expect(events).toEqual(["running", "running", "success"]);
  });

  it("system/timer 的 graph-play 周期 tick 会在输出后保持 running 状态", () => {
    const registry = createNodeRegistry([leaferGraphTimerNodeDefinition]);
    const node = createRuntimeNode(registry, {
      id: "timer-running-1",
      type: LEAFER_GRAPH_TIMER_NODE_TYPE,
      properties: {
        immediate: false,
        progressMode: "indeterminate"
      }
    });
    node.widgets[1]!.value = false;
    const host = new LeaferGraphNodeExecutionHost({
      nodeRegistry: registry,
      widgetRegistry: registry.widgetDefinitions,
      graphNodes: new Map<string, NodeRuntimeState>([[node.id, node]]),
      graphLinks: new Map()
    });
    const events: string[] = [];

    host.subscribeNodeExecution((event) => {
      events.push(event.state.status);
    });

    const waitTask = host.createEntryExecutionTask(node.id, {
      source: "graph-play",
      runId: "run-1",
      startedAt: 1,
      payload: {
        registerGraphTimer() {}
      }
    })!;
    const waitResult = host.executeExecutionTask(waitTask, 0);

    expect(waitResult.handled).toBe(true);
    expect(host.getNodeExecutionState(node.id)).toMatchObject({
      status: "running",
      runCount: 1,
      progress: 0
    });

    const tickTask = host.createEntryExecutionTask(node.id, {
      source: "graph-play",
      runId: "run-1",
      startedAt: 2,
      payload: {
        registerGraphTimer() {},
        timerTickNodeId: node.id,
        timerTickTimerId: "default",
        timerTickMode: "interval"
      }
    })!;
    const tickResult = host.executeExecutionTask(tickTask, 1);

    expect(tickResult.handled).toBe(true);
    expect(host.getNodeExecutionState(node.id)).toMatchObject({
      status: "running",
      runCount: 2,
      progress: 0
    });
    expect(events).toEqual(["running", "running"]);
  });
});
