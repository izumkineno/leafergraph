import { afterEach, describe, expect, test } from "bun:test";

import { Group } from "leafer-ui";
import type { GraphLink } from "@leafergraph/core/node";
import type { LeaferGraphLinkPropagationEvent } from "@leafergraph/core/contracts";
import {
  NODE_SHELL_LAYOUT_METRICS,
  createDefaultDataFlowAnimationStyleConfig
} from "@leafergraph/core/theme";
import {
  LeaferGraphLinkDataFlowAnimationHost,
  type LeaferGraphLinkAnimationNodeState
} from "../src/index";

const originalMatchMedia = window.matchMedia;
const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;

function installRequestAnimationFrameStub(): void {
  let nextFrameId = 1;
  const pendingFrames = new Map<number, FrameRequestCallback>();

  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    const frameId = nextFrameId++;
    pendingFrames.set(frameId, callback);
    return frameId;
  }) as typeof window.requestAnimationFrame;

  window.cancelAnimationFrame = ((frameId: number) => {
    pendingFrames.delete(frameId);
  }) as typeof window.cancelAnimationFrame;

  (window as typeof window & {
    __runAnimationFrame(frameId?: number, timestamp?: number): void;
  }).__runAnimationFrame = (frameId?: number, timestamp = 16) => {
    const targetFrameId = frameId ?? pendingFrames.keys().next().value;
    if (!targetFrameId) {
      return;
    }

    const callback = pendingFrames.get(targetFrameId);
    if (!callback) {
      return;
    }

    pendingFrames.delete(targetFrameId);
    callback(timestamp);
  };
}

function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

function createLinkNodeState(
  x: number,
  y: number,
  direction: "source" | "target"
): LeaferGraphLinkAnimationNodeState {
  return {
    layout: {
      x,
      y,
      width: 180,
      height: 96
    },
    inputs:
      direction === "target"
        ? [{ name: "in", label: "In", type: "number" }]
        : [],
    outputs:
      direction === "source"
        ? [{ name: "out", label: "Out", type: "number" }]
        : [],
    flags: {
      collapsed: false,
      selected: false
    }
  };
}

function createPropagationEvent(
  linkId: string,
  sourceNodeId: string,
  targetNodeId: string
): LeaferGraphLinkPropagationEvent {
  return {
    linkId,
    chainId: `chain:${linkId}`,
    sourceNodeId,
    sourceSlot: 0,
    targetNodeId,
    targetSlot: 0,
    payload: { ok: true },
    timestamp: Date.now()
  };
}

function createMatchMedia(matches: boolean): typeof window.matchMedia {
  return ((query: string) =>
    ({
      media: query,
      matches,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return true;
      }
    }) as MediaQueryList) as typeof window.matchMedia;
}

function buildCurve(
  sourceNode: LeaferGraphLinkAnimationNodeState,
  targetNode: LeaferGraphLinkAnimationNodeState
) {
  const startX =
    sourceNode.layout.x +
    (sourceNode.layout.width ?? NODE_SHELL_LAYOUT_METRICS.defaultNodeWidth) +
    NODE_SHELL_LAYOUT_METRICS.portSize / 2;
  const startY =
    sourceNode.layout.y +
    NODE_SHELL_LAYOUT_METRICS.headerHeight +
    NODE_SHELL_LAYOUT_METRICS.slotGap / 2;
  const endX = targetNode.layout.x - NODE_SHELL_LAYOUT_METRICS.portSize / 2;
  const endY =
    targetNode.layout.y +
    NODE_SHELL_LAYOUT_METRICS.headerHeight +
    NODE_SHELL_LAYOUT_METRICS.slotGap / 2;
  const handle = Math.min(
    160,
    Math.max(24, Math.hypot(endX - startX, endY - startY) * 0.25)
  );

  return {
    path: `M ${startX} ${startY} C ${startX + handle} ${startY}, ${endX - handle} ${endY}, ${endX} ${endY}`,
    samplePoint(progress: number): readonly [number, number] {
      const safeProgress = Math.min(Math.max(progress, 0), 1);
      const inverse = 1 - safeProgress;
      const control1X = startX + handle;
      const control1Y = startY;
      const control2X = endX - handle;
      const control2Y = endY;
      const x =
        inverse * inverse * inverse * startX +
        3 * inverse * inverse * safeProgress * control1X +
        3 * inverse * safeProgress * safeProgress * control2X +
        safeProgress * safeProgress * safeProgress * endX;
      const y =
        inverse * inverse * inverse * startY +
        3 * inverse * inverse * safeProgress * control1Y +
        3 * inverse * safeProgress * safeProgress * control2Y +
        safeProgress * safeProgress * safeProgress * endY;

      return [x, y];
    }
  };
}

function createHostHarness(
  styleOverrides?: Partial<ReturnType<typeof createDefaultDataFlowAnimationStyleConfig>>,
  hostOptions?: {
    respectReducedMotion?: boolean;
  }
) {
  const container = createContainer();
  const linkLayer = new Group();
  const graphNodes = new Map<string, LeaferGraphLinkAnimationNodeState>([
    ["source-a", createLinkNodeState(0, 0, "source")],
    ["source-b", createLinkNodeState(0, 180, "source")],
    ["source-c", createLinkNodeState(0, 360, "source")],
    ["target-a", createLinkNodeState(320, 0, "target")],
    ["target-b", createLinkNodeState(320, 180, "target")],
    ["target-c", createLinkNodeState(320, 360, "target")]
  ]);
  const graphLinks = new Map<string, GraphLink>([
    [
      "link-a",
      {
        id: "link-a",
        source: { nodeId: "source-a", slot: 0 },
        target: { nodeId: "target-a", slot: 0 }
      } as GraphLink
    ],
    [
      "link-b",
      {
        id: "link-b",
        source: { nodeId: "source-b", slot: 0 },
        target: { nodeId: "target-b", slot: 0 }
      } as GraphLink
    ],
    [
      "link-c",
      {
        id: "link-c",
        source: { nodeId: "source-c", slot: 0 },
        target: { nodeId: "target-c", slot: 0 }
      } as GraphLink
    ]
  ]);

  let propagationListener:
    | ((event: LeaferGraphLinkPropagationEvent) => void)
    | undefined;
  let requestRenderCount = 0;
  const host = new LeaferGraphLinkDataFlowAnimationHost({
    container,
    linkLayer,
    layoutMetrics: NODE_SHELL_LAYOUT_METRICS,
    defaultNodeWidth: NODE_SHELL_LAYOUT_METRICS.defaultNodeWidth,
    portSize: NODE_SHELL_LAYOUT_METRICS.portSize,
    resolveStyle: () => ({
      ...createDefaultDataFlowAnimationStyleConfig("expressive"),
      ...styleOverrides
    }),
    respectReducedMotion: hostOptions?.respectReducedMotion ?? true,
    getThemeMode: () => "light",
    requestRender() {
      requestRenderCount += 1;
    },
    subscribeLinkPropagation(listener) {
      propagationListener = listener;
      return () => {
        propagationListener = undefined;
      };
    },
    resolveAnimatedLink(linkId, sourceSlotOverride) {
      const link = graphLinks.get(linkId);
      if (!link) {
        return null;
      }

      const sourceNode = graphNodes.get(link.source.nodeId);
      const targetNode = graphNodes.get(link.target.nodeId);
      if (!sourceNode || !targetNode) {
        return null;
      }

      const sourceSlot = Math.max(
        0,
        Math.floor(sourceSlotOverride ?? link.source.slot ?? 0)
      );
      const targetSlot = Math.max(0, Math.floor(link.target.slot ?? 0));
      const curve = buildCurve(sourceNode, targetNode);

      return {
        link,
        sourceNode,
        targetNode,
        sourceSlot,
        targetSlot,
        color: "#22c55e",
        path: curve.path,
        samplePoint: curve.samplePoint
      };
    }
  });

  return {
    linkLayer,
    host,
    emit(event: LeaferGraphLinkPropagationEvent) {
      propagationListener?.(event);
    },
    getRenderCounts() {
      return {
        requestRenderCount
      };
    }
  };
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  window.requestAnimationFrame = originalRequestAnimationFrame;
  window.cancelAnimationFrame = originalCancelAnimationFrame;
  document.body.innerHTML = "";
});

describe("link_animation_host", () => {
  test("同一条 link 的 pulse 会被复用而不是重复堆叠", () => {
    window.matchMedia = createMatchMedia(false);
    installRequestAnimationFrameStub();

    const { host, emit } = createHostHarness({
      preset: "performance",
      maxPulses: 2,
      maxParticles: 0
    });
    const internals = host as unknown as {
      activePulses: Array<{ id: string; linkId: string; startedAt: number }>;
    };

    emit(createPropagationEvent("link-a", "source-a", "target-a"));
    const firstPulseId = internals.activePulses[0]?.id;
    expect(internals.activePulses).toHaveLength(1);

    emit(createPropagationEvent("link-a", "source-a", "target-a"));

    expect(internals.activePulses).toHaveLength(1);
    expect(internals.activePulses[0]?.id).toBe(firstPulseId);
    host.destroy();
  });

  test("pulse 和 particle 会按各自上限裁剪旧效果", () => {
    window.matchMedia = createMatchMedia(false);
    installRequestAnimationFrameStub();

    const { host, emit } = createHostHarness({
      preset: "expressive",
      maxPulses: 2,
      maxParticles: 1
    });
    const internals = host as unknown as {
      activePulses: Array<{ linkId: string }>;
      activeParticles: Array<{ linkId: string }>;
    };

    emit(createPropagationEvent("link-a", "source-a", "target-a"));
    emit(createPropagationEvent("link-b", "source-b", "target-b"));
    emit(createPropagationEvent("link-c", "source-c", "target-c"));

    expect(internals.activePulses).toHaveLength(2);
    expect(internals.activePulses.map((pulse) => pulse.linkId)).toEqual([
      "link-b",
      "link-c"
    ]);
    expect(internals.activeParticles).toHaveLength(1);
    expect(internals.activeParticles[0]?.linkId).toBe("link-c");
    host.destroy();
  });

  test("reduced motion 开启时不会创建活动动画", () => {
    window.matchMedia = createMatchMedia(true);

    const { host, emit } = createHostHarness({
      preset: "expressive",
      maxPulses: 2,
      maxParticles: 2
    });
    const internals = host as unknown as {
      activePulses: unknown[];
      activeParticles: unknown[];
    };

    emit(createPropagationEvent("link-a", "source-a", "target-a"));

    expect(internals.activePulses).toHaveLength(0);
    expect(internals.activeParticles).toHaveLength(0);
    host.destroy();
  });

  test("关闭 reduced motion 遵循后仍会创建活动动画", () => {
    window.matchMedia = createMatchMedia(true);
    installRequestAnimationFrameStub();

    const { host, emit } = createHostHarness(
      {
        preset: "performance",
        maxPulses: 2,
        maxParticles: 0
      },
      {
        respectReducedMotion: false
      }
    );
    const internals = host as unknown as {
      activePulses: unknown[];
    };

    emit(createPropagationEvent("link-a", "source-a", "target-a"));

    expect(internals.activePulses).toHaveLength(1);
    host.destroy();
  });

  test("restoreLayer 会把 overlay 重新挂回连线层", () => {
    window.matchMedia = createMatchMedia(false);

    const { host, linkLayer } = createHostHarness();
    const internals = host as unknown as {
      overlayGroup: Group & { parent?: unknown };
    };

    internals.overlayGroup.remove();
    expect(internals.overlayGroup.parent).toBeNull();

    host.restoreLayer();

    expect(internals.overlayGroup.parent).toBe(linkLayer);
    host.destroy();
  });

  test("传播触发与后续帧推进只请求 requestRender", () => {
    window.matchMedia = createMatchMedia(false);
    installRequestAnimationFrameStub();

    const { host, emit, getRenderCounts } = createHostHarness({
      preset: "performance",
      maxPulses: 1,
      maxParticles: 0
    });

    emit(createPropagationEvent("link-a", "source-a", "target-a"));

    expect(getRenderCounts()).toEqual({
      requestRenderCount: 1
    });

    (
      window as typeof window & {
        __runAnimationFrame(frameId?: number, timestamp?: number): void;
      }
    ).__runAnimationFrame(undefined, 32);

    expect(getRenderCounts()).toEqual({
      requestRenderCount: 2
    });
    host.destroy();
  });
});
