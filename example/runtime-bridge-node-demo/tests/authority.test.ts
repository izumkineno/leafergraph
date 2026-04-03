import { afterEach, describe, expect, test } from "bun:test";
import type { RuntimeBridgeInboundEvent } from "@leafergraph/runtime-bridge/transport";
import {
  DEMO_FFT_ANALYZER_NODE_ENTRY_ID,
  DEMO_FREQUENCY_LAB_BLUEPRINT_ENTRY_ID,
  DEMO_FREQUENCY_STRESS_BLUEPRINT_ENTRY_ID,
  DEMO_PERF_METER_NODE_ENTRY_ID,
  DEMO_PERF_READOUT_COMPONENT_ENTRY_ID,
  DEMO_SCOPE_PLOT_COMPONENT_ENTRY_ID,
  DEMO_SCOPE_VIEW_NODE_ENTRY_ID,
  DEMO_SIGNAL_GENERATOR_NODE_ENTRY_ID,
  DEMO_SPECTRUM_BARS_COMPONENT_ENTRY_ID,
  DEMO_SPECTRUM_VIEW_NODE_ENTRY_ID
} from "../src/shared/catalog";
import { RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS } from "../src/shared/document";
import { RuntimeBridgeNodeAuthority } from "../src/server/authority";
import type { DemoStreamFrame } from "../src/shared/stream";

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

async function waitForStreamFrame(
  frames: DemoStreamFrame[],
  predicate: (frame: DemoStreamFrame) => boolean,
  timeoutMs = 2000
): Promise<DemoStreamFrame> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const found = frames.find(predicate);
    if (found) {
      return found;
    }

    await Bun.sleep(25);
  }

  throw new Error("Timed out waiting for authority stream frame.");
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

  test("frequency-lab 蓝图会自动激活依赖并替换当前文档", async () => {
    const nodeAuthority = await createAuthority();

    const result = await nodeAuthority.requestCommand({
      type: "blueprint.load",
      entryId: DEMO_FREQUENCY_LAB_BLUEPRINT_ENTRY_ID
    });

    expect(result).toMatchObject({
      type: "blueprint.load.result",
      sync: {
        currentBlueprintId: DEMO_FREQUENCY_LAB_BLUEPRINT_ENTRY_ID
      },
      document: {
        documentId: "runtime-bridge-frequency-lab"
      }
    });
    if (result.type !== "blueprint.load.result") {
      throw new Error(`Unexpected result: ${result.type}`);
    }
    expect(result.sync.activeNodeEntryIds).toEqual(
      expect.arrayContaining([
        DEMO_SIGNAL_GENERATOR_NODE_ENTRY_ID,
        DEMO_FFT_ANALYZER_NODE_ENTRY_ID,
        DEMO_SCOPE_VIEW_NODE_ENTRY_ID,
        DEMO_SPECTRUM_VIEW_NODE_ENTRY_ID,
        DEMO_PERF_METER_NODE_ENTRY_ID
      ])
    );
    expect(result.sync.activeComponentEntryIds).toEqual(
      expect.arrayContaining([
        DEMO_SCOPE_PLOT_COMPONENT_ENTRY_ID,
        DEMO_SPECTRUM_BARS_COMPONENT_ENTRY_ID,
        DEMO_PERF_READOUT_COMPONENT_ENTRY_ID
      ])
    );
  });

  test("frequency-lab play 后会持续产出 stream.frame，stop 后停止", async () => {
    const nodeAuthority = await createAuthority();
    const frames: DemoStreamFrame[] = [];
    await nodeAuthority.requestCommand({
      type: "blueprint.load",
      entryId: DEMO_FREQUENCY_LAB_BLUEPRINT_ENTRY_ID
    });
    const unsubscribe = nodeAuthority.subscribeStream((frame) => {
      frames.push(frame);
    });

    nodeAuthority.sendControl({ type: "play" });
    await waitForStreamFrame(
      frames,
      (frame) => frame.kind === "scope" || frame.kind === "spectrum" || frame.kind === "perf",
      3000
    );

    nodeAuthority.sendControl({ type: "stop" });
    await Bun.sleep(80);
    const frameCountAfterStop = frames.length;
    await Bun.sleep(180);

    unsubscribe();
    expect(frameCountAfterStop).toBeGreaterThan(0);
    expect(frames.length).toBe(frameCountAfterStop);
  });

  test("frequency-stress 蓝图可替换当前文档并进入高压运行链", async () => {
    const nodeAuthority = await createAuthority();
    const frames: DemoStreamFrame[] = [];
    const unsubscribe = nodeAuthority.subscribeStream((frame) => {
      frames.push(frame);
    });

    const result = await nodeAuthority.requestCommand({
      type: "blueprint.load",
      entryId: DEMO_FREQUENCY_STRESS_BLUEPRINT_ENTRY_ID
    });
    nodeAuthority.sendControl({ type: "play" });
    const spectrumFrame = await waitForStreamFrame(
      frames,
      (frame) => frame.kind === "spectrum",
      3000
    );
    nodeAuthority.sendControl({ type: "stop" });

    unsubscribe();
    expect(result).toMatchObject({
      type: "blueprint.load.result",
      document: {
        documentId: "runtime-bridge-frequency-stress"
      }
    });
    expect(spectrumFrame.kind).toBe("spectrum");
  });
});
