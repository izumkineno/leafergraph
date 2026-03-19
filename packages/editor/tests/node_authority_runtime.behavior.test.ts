import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  GraphOperation,
  RuntimeFeedbackEvent
} from "leafergraph";
import { createNodeAuthorityRuntime } from "@leafergraph/node/authority";

function createNoopUpdateOperation(): GraphOperation {
  return {
    type: "node.update",
    nodeId: "node-1",
    input: {},
    operationId: "authority-noop-update-node-1",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

function createNoopMoveOperation(): GraphOperation {
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

function createNoopResizeOperation(): GraphOperation {
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

function createInvalidLinkCreateOperation(): GraphOperation {
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

function createInvalidLinkReconnectOperation(): GraphOperation {
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

function createLinkRemoveOperation(): GraphOperation {
  return {
    type: "link.remove",
    linkId: "link-1",
    operationId: "authority-remove-link-1",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

function createGeneratedNodeOperation(): GraphOperation {
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

function createDocumentUpdateOperation(): GraphOperation {
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

describe("node authority runtime behavior", () => {
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
    const events: RuntimeFeedbackEvent[] = [];
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

  test("graph.step 应发出图级执行反馈、节点执行和链路传播", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test"
    });
    const events: RuntimeFeedbackEvent[] = [];
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
        status: "idle",
        queueSize: 0,
        stepCount: 1,
        lastSource: "graph-step"
      }
    });
    expect(
      events
        .filter((event) => event.type === "graph.execution")
        .map((event) => event.event.type)
    ).toEqual(["started", "advanced", "drained"]);
    expect(
      events.some(
        (event) =>
          event.type === "node.execution" &&
          event.event.nodeId === "node-1" &&
          event.event.source === "graph-step"
      )
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "link.propagation" &&
          event.event.linkId === "link-1"
      )
    ).toBe(true);
  });

  test("graph.play 后应允许 stop，并回发 stopped 事件", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "behavior-test"
    });
    const events: RuntimeFeedbackEvent[] = [];
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
        queueSize: 2,
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
