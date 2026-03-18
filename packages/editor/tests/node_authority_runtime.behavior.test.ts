import { describe, expect, test } from "bun:test";

import type { GraphOperation, RuntimeFeedbackEvent } from "leafergraph";
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
});
