import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import type { GraphDocument } from "@leafergraph/node";
import type {
  AuthorityGraphOperation,
  AuthorityRuntimeFeedbackEvent
} from "../src/index.js";
import {
  createNodeAuthorityRuntime,
  resolveDefaultNodeBackendPackageDir
} from "../src/index.js";

function createNoopUpdateOperation(): AuthorityGraphOperation {
  return {
    type: "node.update",
    nodeId: "node-1",
    input: {},
    operationId: "authority-noop-update-node-1",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

function createNoopMoveOperation(): AuthorityGraphOperation {
  return {
    type: "node.move",
    nodeId: "node-1",
    input: {
      x: 0,
      y: 0
    },
    operationId: "authority-noop-move-node-1",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

function createNoopResizeOperation(): AuthorityGraphOperation {
  return {
    type: "node.resize",
    nodeId: "node-1",
    input: {
      width: 240,
      height: 140
    },
    operationId: "authority-noop-resize-node-1",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

function createInvalidLinkCreateOperation(): AuthorityGraphOperation {
  return {
    type: "link.create",
    input: {
      id: "invalid-link",
      source: {
        nodeId: "missing-node",
        slot: 0
      },
      target: {
        nodeId: "node-2",
        slot: 0
      }
    },
    operationId: "authority-invalid-link-create",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

function createInvalidLinkReconnectOperation(): AuthorityGraphOperation {
  return {
    type: "link.reconnect",
    linkId: "link-1",
    input: {
      target: {
        nodeId: "node-2",
        slot: -1
      }
    },
    operationId: "authority-invalid-link-reconnect",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

function createLinkRemoveOperation(): AuthorityGraphOperation {
  return {
    type: "link.remove",
    linkId: "link-1",
    operationId: "authority-remove-link-1",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

function createGeneratedNodeOperation(): AuthorityGraphOperation {
  return {
    type: "node.create",
    input: {
      type: "test/generated-node",
      x: 48,
      y: 72
    },
    operationId: `authority-generated-node-${Date.now()}`,
    timestamp: Date.now(),
    source: "editor.test"
  };
}

function createSampleAuthorityDocument(): GraphDocument {
  return {
    documentId: "node-authority-doc",
    revision: "1",
    appKind: "node-backend-demo",
    nodes: [
      {
        id: "node-1",
        type: "test/source-node",
        title: "Node 1",
        layout: {
          x: 0,
          y: 0,
          width: 240,
          height: 140
        },
        flags: {},
        properties: {},
        propertySpecs: [],
        inputs: [],
        outputs: [{ name: "Output", type: "event" }],
        widgets: [],
        data: {}
      },
      {
        id: "node-2",
        type: "test/target-node",
        title: "Node 2",
        layout: {
          x: 320,
          y: 0,
          width: 240,
          height: 140
        },
        flags: {},
        properties: {},
        propertySpecs: [],
        inputs: [{ name: "Input", type: "event" }],
        outputs: [],
        widgets: [],
        data: {}
      }
    ],
    links: [
      {
        id: "link-1",
        source: { nodeId: "node-1", slot: 0 },
        target: { nodeId: "node-2", slot: 0 }
      }
    ],
    meta: {}
  };
}

function createDocumentUpdateOperation(): AuthorityGraphOperation {
  return {
    type: "document.update",
    input: {
      appKind: "behavior-updated",
      meta: {
        mode: "patched"
      },
      capabilityProfile: {
        id: "behavior-profile",
        features: ["document-update"]
      },
      adapterBinding: {
        adapterId: "behavior-adapter",
        appKind: "behavior-updated"
      }
    },
    operationId: "authority-document-update",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

function createTemplateExecutionAuthorityDocument(): GraphDocument {
  return {
    documentId: "template-execution-doc",
    revision: "1",
    appKind: "node-backend-demo",
    nodes: [
      {
        id: "template-on-play",
        type: "system/on-play",
        title: "On Play",
        layout: {
          x: 0,
          y: 0,
          width: 220,
          height: 120
        }
      },
      {
        id: "template-execute-source",
        type: "template/execute-counter",
        title: "Counter Source",
        layout: {
          x: 280,
          y: 0,
          width: 288,
          height: 184
        },
        properties: {
          subtitle: "可由 On Play 驱动，也可从节点菜单单独起跑",
          accent: "#F97316",
          status: "READY",
          count: 0
        },
        inputs: [{ name: "Start", type: "event" }],
        outputs: [{ name: "Count", type: "number" }]
      },
      {
        id: "template-execute-display",
        type: "template/execute-display",
        title: "Display",
        layout: {
          x: 620,
          y: 0,
          width: 288,
          height: 184
        },
        properties: {
          subtitle: "等待上游执行传播",
          accent: "#0EA5E9",
          status: "WAITING"
        },
        inputs: [{ name: "Value", type: "number" }]
      }
    ],
    links: [
      {
        id: "template-link:on-play->execute-source",
        source: {
          nodeId: "template-on-play",
          slot: 0
        },
        target: {
          nodeId: "template-execute-source",
          slot: 0
        }
      },
      {
        id: "template-link:execute-source->display",
        source: {
          nodeId: "template-execute-source",
          slot: 0
        },
        target: {
          nodeId: "template-execute-display",
          slot: 0
        }
      }
    ],
    meta: {}
  };
}

function createTimerAuthorityDocument(input?: {
  immediate?: boolean;
  intervalMs?: number;
  widgetImmediate?: boolean;
  widgetIntervalMs?: number;
}): GraphDocument {
  const intervalMs = input?.intervalMs ?? 10;
  const immediate = input?.immediate ?? true;

  return {
    documentId: "timer-execution-doc",
    revision: "1",
    appKind: "node-backend-demo",
    nodes: [
      {
        id: "timer-on-play",
        type: "system/on-play",
        title: "On Play",
        layout: {
          x: 0,
          y: 0,
          width: 220,
          height: 120
        },
        outputs: [{ name: "Event", type: "event" }]
      },
      {
        id: "timer-node",
        type: "system/timer",
        title: "Timer",
        layout: {
          x: 280,
          y: 0,
          width: 260,
          height: 160
        },
        properties: {
          intervalMs,
          immediate,
          runCount: 0,
          status: "READY"
        },
        inputs: [{ name: "Start", type: "event" }],
        outputs: [{ name: "Tick", type: "event" }],
        widgets: [
          {
            type: "input",
            name: "intervalMs",
            value: input?.widgetIntervalMs ?? intervalMs,
            options: {
              label: "Interval (ms)"
            }
          },
          {
            type: "toggle",
            name: "immediate",
            value: input?.widgetImmediate ?? immediate,
            options: {
              label: "Immediate"
            }
          }
        ]
      },
      {
        id: "timer-display",
        type: "template/execute-display",
        title: "Display",
        layout: {
          x: 600,
          y: 0,
          width: 288,
          height: 184
        },
        properties: {
          subtitle: "等待上游执行传播",
          accent: "#0EA5E9",
          status: "WAITING"
        },
        inputs: [{ name: "Value", type: "number" }]
      }
    ],
    links: [
      {
        id: "timer-link:on-play->timer",
        source: {
          nodeId: "timer-on-play",
          slot: 0
        },
        target: {
          nodeId: "timer-node",
          slot: 0
        }
      },
      {
        id: "timer-link:timer->display",
        source: {
          nodeId: "timer-node",
          slot: 0
        },
        target: {
          nodeId: "timer-display",
          slot: 0
        }
      }
    ],
    meta: {}
  };
}

describe("node authority runtime behavior", () => {
  test("默认节点包目录解析应同时兼容 src 与 dist 运行目录", () => {
    const templateDir = resolve(import.meta.dir, "..");
    const expectedPackageDir = resolve(
      templateDir,
      "../../misc/backend-node-package-template/packages"
    );

    expect(
      resolveDefaultNodeBackendPackageDir(resolve(templateDir, "src/core"))
    ).toBe(expectedPackageDir);
    expect(resolveDefaultNodeBackendPackageDir(resolve(templateDir, "dist"))).toBe(
      expectedPackageDir
    );
  });

  test("默认文档应为空 authority 文档", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test"
    });

    expect(runtime.getDocument()).toMatchObject({
      documentId: "node-authority-doc",
      revision: "1",
      nodes: [],
      links: []
    });
  });

  test("默认前端 bundle 快照应返回结构化 node-json 与 demo-json", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test"
    });

    const snapshot = runtime.getFrontendBundlesSnapshot();
    const timerPackage = snapshot.packages?.find(
      (entry) => entry.packageId === "@template/timer-node-package"
    );
    const timerNodeBundle = timerPackage?.bundles.find(
      (bundle) => bundle.bundleId === "@template/timer-node-package/node"
    );
    const timerDemoBundle = timerPackage?.bundles.find(
      (bundle) => bundle.bundleId === "@template/timer-node-package/demo"
    );

    expect(snapshot.type).toBe("frontendBundles.sync");
    expect(snapshot.mode).toBe("full");
    expect(timerPackage?.version).toBe("0.1.0");
    expect(timerNodeBundle).toMatchObject({
      format: "node-json",
      slot: "node",
      fileName: "node.bundle.json",
      quickCreateNodeType: "system/timer"
    });
    expect(
      timerNodeBundle && "definition" in timerNodeBundle
        ? timerNodeBundle.definition
        : null
    ).toMatchObject({
      type: "system/timer",
      title: "Timer"
    });
    expect(timerDemoBundle).toMatchObject({
      format: "demo-json",
      slot: "demo",
      fileName: "demo.bundle.json"
    });
    expect(
      timerDemoBundle && "document" in timerDemoBundle
        ? timerDemoBundle.document
        : null
    ).toMatchObject({
      documentId: "timer-package-demo-doc"
    });
  });

  test("no-op 的 update / move / resize 不应推进 revision", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test",
      initialDocument: createSampleAuthorityDocument()
    });

    const updateResult = runtime.submitOperation(createNoopUpdateOperation());
    const moveResult = runtime.submitOperation(createNoopMoveOperation());
    const resizeResult = runtime.submitOperation(createNoopResizeOperation());

    expect(updateResult).toMatchObject({
      accepted: true,
      changed: false,
      revision: "1",
      reason: "文档无变化"
    });
    expect(moveResult).toMatchObject({
      accepted: true,
      changed: false,
      revision: "1",
      reason: "文档无变化"
    });
    expect(resizeResult).toMatchObject({
      accepted: true,
      changed: false,
      revision: "1",
      reason: "文档无变化"
    });
    expect(runtime.getDocument().revision).toBe("1");
  });

  test("非法 link.create / link.reconnect 应返回明确拒绝原因", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test",
      initialDocument: createSampleAuthorityDocument()
    });

    const createResult = runtime.submitOperation(createInvalidLinkCreateOperation());
    const reconnectResult = runtime.submitOperation(
      createInvalidLinkReconnectOperation()
    );

    expect(createResult).toMatchObject({
      accepted: false,
      changed: false,
      revision: "1",
      reason: "source 节点不存在"
    });
    expect(reconnectResult).toMatchObject({
      accepted: false,
      changed: false,
      revision: "1",
      reason: "target slot 必须是非负整数"
    });
  });

  test("link.remove 后应向两端节点补发 connections 状态反馈", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test",
      initialDocument: createSampleAuthorityDocument()
    });
    const events: AuthorityRuntimeFeedbackEvent[] = [];
    const dispose = runtime.subscribe((event) => {
      events.push(event);
    });

    const result = runtime.submitOperation(createLinkRemoveOperation());

    dispose();

    expect(result.accepted).toBe(true);
    expect(result.changed).toBe(true);
    expect(
      events.filter(
        (event) =>
          event.type === "node.state" &&
          event.event.reason === "connections" &&
          (event.event.nodeId === "node-1" || event.event.nodeId === "node-2")
      )
    ).toHaveLength(2);
  });

  test("replaceDocument 后应重置自动生成 ID 的缓存", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test"
    });
    const initialDocument = runtime.getDocument();

    const firstCreateResult = runtime.submitOperation(createGeneratedNodeOperation());
    const firstGeneratedNodeId = firstCreateResult.document?.nodes.find(
      (node) => node.id.startsWith("behavior-test-node-")
    )?.id;
    if (!firstGeneratedNodeId) {
      throw new Error("未生成预期的自动节点 ID");
    }

    runtime.replaceDocument(initialDocument);

    const secondCreateResult = runtime.submitOperation(createGeneratedNodeOperation());
    const secondGeneratedNodeId = secondCreateResult.document?.nodes.find(
      (node) => node.id.startsWith("behavior-test-node-")
    )?.id;

    expect(firstGeneratedNodeId).toBe("behavior-test-node-1");
    expect(secondGeneratedNodeId).toBe("behavior-test-node-1");
  });

  test("document.update 应 patch 文档根字段并支持 no-op", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test",
      initialDocument: {
        documentId: "behavior-doc",
        revision: "5",
        appKind: "behavior-app",
        nodes: [],
        links: [],
        meta: {
          before: true
        },
        capabilityProfile: {
          id: "before-profile",
          features: ["before"]
        },
        adapterBinding: {
          adapterId: "before-adapter",
          appKind: "behavior-app"
        }
      } satisfies GraphDocument
    });

    const updateResult = runtime.submitOperation(createDocumentUpdateOperation());

    expect(updateResult).toMatchObject({
      accepted: true,
      changed: true,
      revision: "6",
      document: {
        appKind: "behavior-updated",
        meta: {
          mode: "patched"
        },
        capabilityProfile: {
          id: "behavior-profile",
          features: ["document-update"]
        },
        adapterBinding: {
          adapterId: "behavior-adapter",
          appKind: "behavior-updated"
        }
      }
    });

    const noopResult = runtime.submitOperation(createDocumentUpdateOperation());

    expect(noopResult).toMatchObject({
      accepted: true,
      changed: false,
      revision: "6",
      reason: "文档无变化"
    });
  });

  test("没有 On Play 时，graph.step 不应直接起跑普通节点", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test"
    });
    const events: AuthorityRuntimeFeedbackEvent[] = [];
    const dispose = runtime.subscribe((event) => {
      events.push(event);
    });

    const result = runtime.controlRuntime({
      type: "graph.step"
    });

    dispose();

    expect(result).toMatchObject({
      accepted: true,
      changed: false,
      reason: "图中没有 On Play 入口节点",
      state: {
        status: "idle",
        queueSize: 0,
        stepCount: 0
      }
    });
    expect(events).toHaveLength(0);
  });

  test("graph.step 应发出图级执行反馈、节点执行和链路传播", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test",
      initialDocument: createTemplateExecutionAuthorityDocument()
    });
    const events: AuthorityRuntimeFeedbackEvent[] = [];
    const dispose = runtime.subscribe((event) => {
      events.push(event);
    });

    const result = runtime.controlRuntime({
      type: "graph.step"
    });

    dispose();

    expect(result).toMatchObject({
      accepted: true,
      changed: true,
      state: {
        status: "stepping",
        queueSize: 1,
        stepCount: 1,
        lastSource: "graph-step"
      }
    });
    expect(
      events
        .filter((event) => event.type === "graph.execution")
        .map((event) => event.event.type)
    ).toEqual(["started", "advanced"]);
    expect(
      events.some(
        (event) =>
          event.type === "node.execution" &&
          event.event.nodeId === "template-on-play" &&
          event.event.source === "graph-step"
      )
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "link.propagation" &&
          event.event.linkId === "template-link:on-play->execute-source"
      )
    ).toBe(true);
  });

  test("没有 On Play 时，graph.play 不应直接起跑普通节点", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test"
    });

    const result = runtime.controlRuntime({
      type: "graph.play"
    });

    expect(result).toMatchObject({
      accepted: true,
      changed: false,
      reason: "图中没有 On Play 入口节点",
      state: {
        status: "idle",
        queueSize: 0,
        stepCount: 0
      }
    });
  });

  test("node.play 应继续允许从普通节点直接调试起跑", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test",
      initialDocument: createTemplateExecutionAuthorityDocument()
    });

    const result = runtime.controlRuntime({
      type: "node.play",
      nodeId: "template-execute-source"
    });

    expect(result).toMatchObject({
      accepted: true,
      changed: true
    });
    expect(runtime.getDocument()).toMatchObject({
      revision: "2",
      nodes: expect.arrayContaining([
        expect.objectContaining({
          id: "template-execute-source",
          properties: expect.objectContaining({
            count: 1,
            status: "RUN 1"
          })
        }),
        expect.objectContaining({
          id: "template-execute-display",
          properties: expect.objectContaining({
            status: "VALUE 1"
          })
        })
      ])
    });
  });

  test("graph.step 应按节点逐步推进，并在后续步写回 authority 文档", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test",
      initialDocument: createTemplateExecutionAuthorityDocument()
    });
    const pushedDocuments: GraphDocument[] = [];
    const dispose = runtime.subscribeDocument((document) => {
      pushedDocuments.push(document);
    });

    const firstStepResult = runtime.controlRuntime({
      type: "graph.step"
    });
    const secondStepResult = runtime.controlRuntime({
      type: "graph.step"
    });
    const thirdStepResult = runtime.controlRuntime({
      type: "graph.step"
    });

    dispose();

    expect(firstStepResult).toMatchObject({
      accepted: true,
      changed: true,
      state: {
        status: "stepping",
        queueSize: 1,
        stepCount: 1,
        lastSource: "graph-step"
      }
    });
    expect(secondStepResult).toMatchObject({
      accepted: true,
      changed: true,
      state: {
        status: "stepping",
        queueSize: 1,
        stepCount: 2,
        lastSource: "graph-step"
      }
    });
    expect(thirdStepResult).toMatchObject({
      accepted: true,
      changed: true,
      state: {
        status: "idle",
        queueSize: 0,
        stepCount: 3,
        lastSource: "graph-step"
      }
    });
    expect(pushedDocuments).toHaveLength(2);
    expect(runtime.getDocument()).toMatchObject({
      revision: "3"
    });
    expect(runtime.getDocument().nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "template-execute-source",
          title: "Counter 1",
          properties: expect.objectContaining({
            count: 1,
            status: "RUN 1"
          })
        }),
        expect.objectContaining({
          id: "template-execute-display",
          title: "Display 1",
          properties: expect.objectContaining({
            lastValue: 1,
            status: "VALUE 1"
          })
        })
      ])
    );
    expect(pushedDocuments[0]?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "template-execute-source",
          title: "Counter 1"
        }),
        expect.objectContaining({
          id: "template-execute-display",
          title: "Display"
        })
      ])
    );
    expect(pushedDocuments[1]?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "template-execute-source",
          title: "Counter 1"
        }),
        expect.objectContaining({
          id: "template-execute-display",
          title: "Display 1"
        })
      ])
    );
  });

  test("graph.step 应单节点推进完整链后，再回到根节点重新开始", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test",
      initialDocument: createTemplateExecutionAuthorityDocument()
    });

    for (let index = 0; index < 6; index += 1) {
      expect(
        runtime.controlRuntime({
          type: "graph.step"
        })
      ).toMatchObject({
        accepted: true,
        changed: true
      });
    }

    expect(runtime.getDocument()).toMatchObject({
      revision: "5"
    });
    expect(runtime.getDocument().nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "template-execute-source",
          title: "Counter 2",
          properties: expect.objectContaining({
            count: 2,
            status: "RUN 2"
          })
        }),
        expect.objectContaining({
          id: "template-execute-display",
          title: "Display 2",
          properties: expect.objectContaining({
            lastValue: 2,
            status: "VALUE 2"
          })
        })
      ])
    );
  });

  test("graph.play 后应允许 stop，并回发 stopped 事件", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test",
      initialDocument: createTemplateExecutionAuthorityDocument()
    });
    const events: AuthorityRuntimeFeedbackEvent[] = [];
    const dispose = runtime.subscribe((event) => {
      events.push(event);
    });

    const playResult = runtime.controlRuntime({
      type: "graph.play"
    });
    const stopResult = runtime.controlRuntime({
      type: "graph.stop"
    });

    dispose();

    expect(playResult).toMatchObject({
      accepted: true,
      changed: true,
      state: {
        status: "running",
        queueSize: 1,
        stepCount: 0,
        lastSource: "graph-play"
      }
    });
    expect(stopResult).toMatchObject({
      accepted: true,
      changed: true,
      state: {
        status: "idle",
        queueSize: 0,
        lastSource: "graph-play"
      }
    });
    expect(
      events
        .filter((event) => event.type === "graph.execution")
        .map((event) => event.event.type)
    ).toEqual(["started", "stopped"]);
  });

  test("graph.play 命中 timer 后应持续运行，直到 stop", async () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test",
      initialDocument: createTimerAuthorityDocument({
        immediate: false,
        intervalMs: 10
      })
    });

    const playResult = runtime.controlRuntime({
      type: "graph.play"
    });
    expect(playResult).toMatchObject({
      accepted: true,
      changed: true,
      state: {
        status: "running"
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 55));

    const stopResult = runtime.controlRuntime({
      type: "graph.stop"
    });
    expect(stopResult).toMatchObject({
      accepted: true,
      changed: true,
      state: {
        status: "idle"
      }
    });

    const timerNode = runtime
      .getDocument()
      .nodes.find((node) => node.id === "timer-node");
    expect(Number(timerNode?.properties?.runCount ?? 0)).toBeGreaterThanOrEqual(1);
  });

  test("timer 运行期间不应插入 stopped，且 immediate 首拍应补发 timer advanced", async () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test",
      initialDocument: createTimerAuthorityDocument({
        immediate: true,
        intervalMs: 100
      })
    });
    const events: AuthorityRuntimeFeedbackEvent[] = [];
    const dispose = runtime.subscribe((event) => {
      events.push(event);
    });

    runtime.controlRuntime({
      type: "graph.play"
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    runtime.controlRuntime({
      type: "graph.stop"
    });
    dispose();

    const graphExecutionEvents = events.filter(
      (event): event is Extract<AuthorityRuntimeFeedbackEvent, { type: "graph.execution" }> =>
        event.type === "graph.execution"
    );
    expect(
      graphExecutionEvents
        .slice(0, -1)
        .some((event) => event.event.type === "stopped")
    ).toBe(false);
    expect(
      graphExecutionEvents.some(
        (event) =>
          event.event.type === "advanced" && event.event.nodeId === "timer-node"
      )
    ).toBe(true);
  });

  test("timer widget 值应优先覆盖 properties 配置", async () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test",
      initialDocument: createTimerAuthorityDocument({
        immediate: true,
        intervalMs: 1000,
        widgetImmediate: false,
        widgetIntervalMs: 80
      })
    });

    runtime.controlRuntime({
      type: "graph.play"
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const waitingNode = runtime
      .getDocument()
      .nodes.find((node) => node.id === "timer-node");
    expect(waitingNode?.properties?.intervalMs).toBe(80);
    expect(waitingNode?.properties?.immediate).toBe(false);
    expect(waitingNode?.properties?.runCount).toBe(0);
    expect(waitingNode?.properties?.status).toBe("WAIT 80ms");

    await new Promise((resolve) => setTimeout(resolve, 90));
    runtime.controlRuntime({
      type: "graph.stop"
    });

    const timerNode = runtime
      .getDocument()
      .nodes.find((node) => node.id === "timer-node");
    expect(Number(timerNode?.properties?.runCount ?? 0)).toBeGreaterThanOrEqual(1);
    expect(timerNode?.widgets?.find((widget) => widget.name === "intervalMs")?.value).toBe(
      80
    );
    expect(timerNode?.widgets?.find((widget) => widget.name === "immediate")?.value).toBe(
      false
    );
  });

  test("graph.step 命中 timer 后应升级为 running", async () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test",
      initialDocument: createTimerAuthorityDocument({
        immediate: true,
        intervalMs: 10
      })
    });

    const firstStep = runtime.controlRuntime({
      type: "graph.step"
    });
    expect(firstStep.state.status).toBe("stepping");

    const secondStep = runtime.controlRuntime({
      type: "graph.step"
    });
    expect(secondStep.state.status).toBe("running");

    await new Promise((resolve) => setTimeout(resolve, 35));
    const stopResult = runtime.controlRuntime({
      type: "graph.stop"
    });
    expect(stopResult.accepted).toBe(true);
    expect(stopResult.changed).toBe(true);
  });

  test("node.play timer 只执行一次，不进入循环", async () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test",
      initialDocument: createTimerAuthorityDocument({
        immediate: true,
        intervalMs: 10
      })
    });

    const result = runtime.controlRuntime({
      type: "node.play",
      nodeId: "timer-node"
    });
    expect(result).toMatchObject({
      accepted: true,
      changed: true
    });

    await new Promise((resolve) => setTimeout(resolve, 35));
    const timerNode = runtime
      .getDocument()
      .nodes.find((node) => node.id === "timer-node");
    expect(Number(timerNode?.properties?.runCount ?? 0)).toBe(1);
  });
});
