import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "@leafergraph/node";
import type {
  AuthorityGraphOperation,
  AuthorityRuntimeFeedbackEvent
} from "../src/index.js";
import { createNodeAuthorityRuntime } from "../src/index.js";

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
      type: "demo.pending",
      x: 48,
      y: 72
    },
    operationId: `authority-generated-node-${Date.now()}`,
    timestamp: Date.now(),
    source: "editor.test"
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
    appKind: "node-authority-demo",
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

describe("node authority runtime behavior", () => {
  test("默认文档应提供基础双节点链", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test"
    });

    expect(runtime.getDocument()).toMatchObject({
      documentId: "node-authority-doc",
      revision: "1",
      nodes: [
        {
          id: "node-1",
          outputs: [{ name: "Output", type: "event" }]
        },
        {
          id: "node-2",
          inputs: [{ name: "Input", type: "event" }]
        }
      ],
      links: [
        {
          id: "link-1",
          source: { nodeId: "node-1", slot: 0 },
          target: { nodeId: "node-2", slot: 0 }
        }
      ]
    });
  });

  test("no-op 的 update / move / resize 不应推进 revision", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test"
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
      authorityName: "behavior-test"
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
      authorityName: "behavior-test"
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
      authorityName: "behavior-test"
    });

    const result = runtime.controlRuntime({
      type: "node.play",
      nodeId: "node-1"
    });

    expect(result).toMatchObject({
      accepted: true,
      changed: true
    });
    expect(runtime.getDocument()).toMatchObject({
      revision: "2",
      nodes: expect.arrayContaining([
        expect.objectContaining({
          id: "node-1",
          properties: expect.objectContaining({
            runCount: 1,
            status: "RUN 1"
          })
        }),
        expect.objectContaining({
          id: "node-2",
          properties: expect.objectContaining({
            status: "VALUE OBJECT"
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
});
