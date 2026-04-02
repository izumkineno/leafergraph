import { afterEach, describe, expect, test } from "bun:test";
import type { RuntimeBridgeInboundEvent } from "@leafergraph/runtime-bridge/transport";
import { RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS } from "../src/shared/document";
import { RuntimeBridgeNodeAuthority } from "../src/server/authority";

let authority: RuntimeBridgeNodeAuthority | null = null;

afterEach(() => {
  authority?.destroy();
  authority = null;
});

async function createAuthority(): Promise<RuntimeBridgeNodeAuthority> {
  authority = await RuntimeBridgeNodeAuthority.create();
  return authority;
}

async function waitForEvent(
  events: RuntimeBridgeInboundEvent[],
  predicate: (event: RuntimeBridgeInboundEvent) => boolean,
  timeoutMs = 2000
): Promise<RuntimeBridgeInboundEvent> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const found = events.find(predicate);
    if (found) {
      return found;
    }

    await Bun.sleep(25);
  }

  throw new Error("Timed out waiting for authority event.");
}

describe("RuntimeBridgeNodeAuthority", () => {
  test("requestSnapshot 应返回当前正式文档", async () => {
    const nodeAuthority = await createAuthority();

    const snapshot = nodeAuthority.requestSnapshot();

    expect(snapshot.documentId).toBe("runtime-bridge-node-demo-document");
    expect(snapshot.nodes.map((node) => node.id)).toContain(
      RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS.onPlay
    );
  });

  test("submitOperations 应返回结果并广播 document.diff", async () => {
    const nodeAuthority = await createAuthority();
    const events: RuntimeBridgeInboundEvent[] = [];
    const unsubscribe = nodeAuthority.subscribe((event) => {
      events.push(event);
    });

    const results = nodeAuthority.submitOperations([
      {
        type: "node.collapse",
        nodeId: RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS.heartbeatTimer,
        collapsed: true,
        operationId: "authority-test-collapse",
        timestamp: Date.now(),
        source: "authority.test"
      }
    ]);

    unsubscribe();

    expect(results[0]).toMatchObject({
      accepted: true,
      changed: true,
      operation: {
        type: "node.collapse",
        nodeId: RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS.heartbeatTimer,
        collapsed: true
      }
    });

    const diffEvent = events.find(
      (event) => event.type === "document.diff"
    ) as Extract<RuntimeBridgeInboundEvent, { type: "document.diff" }> | undefined;
    expect(diffEvent).toBeDefined();
    expect(diffEvent?.diff.operations).toHaveLength(1);
    expect(events.some((event) => event.type === "history.event")).toBe(true);
  });

  test("play / stop / play-from-node 应进入 authority 控制链", async () => {
    const nodeAuthority = await createAuthority();
    const events: RuntimeBridgeInboundEvent[] = [];
    const unsubscribe = nodeAuthority.subscribe((event) => {
      events.push(event);
    });

    nodeAuthority.sendControl({ type: "play" });
    await waitForEvent(events, (event) => event.type === "runtime.feedback");

    nodeAuthority.sendControl({ type: "stop" });
    nodeAuthority.sendControl({
      type: "play-from-node",
      nodeId: RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS.onPlay
    });
    await waitForEvent(
      events,
      (event) =>
        event.type === "runtime.feedback" ||
        event.type === "history.event" ||
        event.type === "document.diff"
    );

    unsubscribe();
    expect(events.some((event) => event.type === "runtime.feedback")).toBe(true);
  });
});
