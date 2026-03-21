import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  GraphOperation,
  RuntimeFeedbackEvent
} from "leafergraph";
import { createDemoRemoteAuthorityService } from "../src/demo/remote_authority_demo_service";

function createResizeOperation(): GraphOperation {
  return {
    type: "node.resize",
    nodeId: "node-1",
    input: {
      width: 360,
      height: 180
    },
    operationId: "demo-worker-resize-node-1",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

function createDocumentUpdateOperation(): GraphOperation {
  return {
    type: "document.update",
    input: {
      appKind: "demo-worker-updated",
      meta: {
        mode: "patched"
      },
      capabilityProfile: {
        id: "demo-profile",
        features: ["runtime-control"]
      },
      adapterBinding: {
        adapterId: "demo-adapter",
        appKind: "demo-worker-updated"
      }
    },
    operationId: "demo-worker-document-update",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

function createTimerDemoDocument(input?: {
  immediate?: boolean;
  intervalMs?: number;
}): GraphDocument {
  return {
    documentId: "timer-demo-doc",
    revision: "1",
    appKind: "demo-worker",
    nodes: [
      {
        id: "demo-on-play",
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
        id: "demo-timer",
        type: "system/timer",
        title: "Timer",
        layout: {
          x: 280,
          y: 0,
          width: 260,
          height: 160
        },
        properties: {
          intervalMs: input?.intervalMs ?? 10,
          immediate: input?.immediate ?? true
        },
        inputs: [{ name: "Start", type: "event" }],
        outputs: [{ name: "Tick", type: "event" }]
      },
      {
        id: "demo-display",
        type: "demo.worker",
        title: "Display",
        layout: {
          x: 600,
          y: 0,
          width: 240,
          height: 140
        },
        inputs: [{ name: "Input", type: "event" }]
      }
    ],
    links: [
      {
        id: "timer-link:on-play->timer",
        source: { nodeId: "demo-on-play", slot: 0 },
        target: { nodeId: "demo-timer", slot: 0 }
      },
      {
        id: "timer-link:timer->display",
        source: { nodeId: "demo-timer", slot: 0 },
        target: { nodeId: "demo-display", slot: 0 }
      }
    ],
    meta: {}
  };
}

describe("createDemoRemoteAuthorityService", () => {
  test("应处理文档操作确认，并避免把普通文档更新误报为执行事件", async () => {
    const service = createDemoRemoteAuthorityService();
    const pushedDocumentRevisions: string[] = [];
    const disposeDocumentSubscription = service.subscribeDocument?.((document) => {
      pushedDocumentRevisions.push(String(document.revision));
    });
    const runtimeFeedbackEvents: RuntimeFeedbackEvent[] = [];
    const disposeRuntimeFeedbackSubscription = service.subscribe?.((event) => {
      runtimeFeedbackEvents.push(event);
    });

    const initialDocument = await service.getDocument();
    expect(initialDocument.documentId).toBe("demo-worker-doc");
    expect(initialDocument.revision).toBe("1");

    const submitResult = await service.submitOperation(createResizeOperation(), {
      currentDocument: initialDocument,
      pendingOperationIds: []
    });
    expect(submitResult.accepted).toBe(true);
    expect(submitResult.changed).toBe(true);
    expect(submitResult.revision).toBe("2");
    expect(
      (
        submitResult.document as GraphDocument
      ).nodes.find((node) => node.id === "node-1")?.layout.width
    ).toBe(360);
    expect(
      runtimeFeedbackEvents.some(
        (event) =>
          event.type === "node.state" &&
          event.event.nodeId === "node-1" &&
          event.event.reason === "resized"
      )
    ).toBe(true);
    expect(
      runtimeFeedbackEvents.some(
        (event) =>
          event.type === "node.execution"
      )
    ).toBe(false);
    expect(pushedDocumentRevisions).toEqual(["2"]);

    const updateResult = await service.submitOperation(createDocumentUpdateOperation(), {
      currentDocument: submitResult.document as GraphDocument,
      pendingOperationIds: []
    });
    expect(updateResult).toMatchObject({
      accepted: true,
      changed: true,
      revision: "3"
    });
    expect(updateResult.document).toMatchObject({
      appKind: "demo-worker-updated",
      meta: {
        mode: "patched"
      },
      capabilityProfile: {
        id: "demo-profile",
        features: ["runtime-control"]
      },
      adapterBinding: {
        adapterId: "demo-adapter",
        appKind: "demo-worker-updated"
      }
    });

    const noopUpdateResult = await service.submitOperation(createDocumentUpdateOperation(), {
      currentDocument: updateResult.document as GraphDocument,
      pendingOperationIds: []
    });
    expect(noopUpdateResult).toMatchObject({
      accepted: true,
      changed: false,
      revision: "3",
      reason: "文档无变化"
    });
    expect(pushedDocumentRevisions).toEqual(["2", "3"]);

    const replacedDocument = await service.replaceDocument(
      {
        documentId: "demo-worker-doc-2",
        revision: "10",
        appKind: "demo-worker",
        nodes: [],
        links: [],
        meta: {
          replaced: true
        }
      },
      {
        currentDocument: submitResult.document as GraphDocument
      }
    );
    expect(replacedDocument?.documentId).toBe("demo-worker-doc-2");
    expect(replacedDocument?.revision).toBe("10");
    expect(pushedDocumentRevisions).toEqual(["2", "3", "10"]);

    disposeDocumentSubscription?.();
    disposeRuntimeFeedbackSubscription?.();
  });

  test("应支持 graph.step 运行控制并发出图级执行反馈", async () => {
    const service = createDemoRemoteAuthorityService();
    const runtimeFeedbackEvents: RuntimeFeedbackEvent[] = [];
    const disposeRuntimeFeedbackSubscription = service.subscribe?.((event) => {
      runtimeFeedbackEvents.push(event);
    });

    if (typeof service.controlRuntime !== "function") {
      throw new Error("demo authority service 缺少 controlRuntime");
    }

    const result = await service.controlRuntime({
      type: "graph.step"
    });

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
      runtimeFeedbackEvents
        .filter((event) => event.type === "graph.execution")
        .map((event) => event.event.type)
    ).toEqual(["started", "advanced", "drained"]);
    expect(
      runtimeFeedbackEvents.some(
        (event) =>
          event.type === "node.execution" &&
          event.event.nodeId === "node-1" &&
          event.event.source === "graph-step"
      )
    ).toBe(true);
    expect(
      runtimeFeedbackEvents.some(
        (event) =>
          event.type === "link.propagation" &&
          event.event.linkId === "link-1"
      )
    ).toBe(true);

    disposeRuntimeFeedbackSubscription?.();
  });

  test("graph.play 命中 timer 后应持续推进，直到 stop", async () => {
    const service = createDemoRemoteAuthorityService({
      initialDocument: createTimerDemoDocument({
        immediate: false,
        intervalMs: 10
      })
    });

    if (typeof service.controlRuntime !== "function") {
      throw new Error("demo authority service 缺少 controlRuntime");
    }

    const playResult = await service.controlRuntime({
      type: "graph.play"
    });
    expect(playResult.state.status).toBe("running");

    await new Promise((resolve) => setTimeout(resolve, 60));
    const stopResult = await service.controlRuntime({
      type: "graph.stop"
    });
    expect(stopResult).toMatchObject({
      accepted: true,
      changed: true,
      state: {
        status: "idle"
      }
    });
  });

  test("timer immediate 首拍应补发 timer advanced，运行中不应插入 stopped", async () => {
    const service = createDemoRemoteAuthorityService({
      initialDocument: createTimerDemoDocument({
        immediate: true,
        intervalMs: 100
      })
    });
    const runtimeFeedbackEvents: RuntimeFeedbackEvent[] = [];
    const disposeRuntimeFeedbackSubscription = service.subscribe?.(
      (event) => {
        runtimeFeedbackEvents.push(event);
      }
    );

    if (typeof service.controlRuntime !== "function") {
      throw new Error("demo authority service 缺少 controlRuntime");
    }

    await service.controlRuntime({
      type: "graph.play"
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await service.controlRuntime({
      type: "graph.stop"
    });

    expect(
      runtimeFeedbackEvents
        .filter((event): event is Extract<RuntimeFeedbackEvent, { type: "graph.execution" }> =>
          event.type === "graph.execution"
        )
        .slice(0, -1)
        .some((event) => event.event.type === "stopped")
    ).toBe(false);
    expect(
      runtimeFeedbackEvents.some(
        (event) =>
          event.type === "graph.execution" &&
          event.event.type === "advanced" &&
          event.event.nodeId === "demo-timer"
      )
    ).toBe(true);

    disposeRuntimeFeedbackSubscription?.();
  });

  test("graph.step 命中 timer 后应升级为 running", async () => {
    const service = createDemoRemoteAuthorityService({
      initialDocument: createTimerDemoDocument({
        immediate: true,
        intervalMs: 10
      })
    });

    if (typeof service.controlRuntime !== "function") {
      throw new Error("demo authority service 缺少 controlRuntime");
    }

    const firstStep = await service.controlRuntime({
      type: "graph.step"
    });
    expect(firstStep.state.status).toBe("running");

    await new Promise((resolve) => setTimeout(resolve, 35));
    const stopResult = await service.controlRuntime({
      type: "graph.stop"
    });
    expect(stopResult.accepted).toBe(true);
    expect(stopResult.changed).toBe(true);
  });
});
