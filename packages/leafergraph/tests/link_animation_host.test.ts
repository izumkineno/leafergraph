import { afterEach, describe, expect, test } from "bun:test";

import { Group } from "leafer-ui";
import type { GraphLink } from "@leafergraph/node";
import type { LeaferGraphLinkPropagationEvent } from "@leafergraph/contracts";
import {
  NODE_SHELL_LAYOUT_METRICS,
  createDefaultDataFlowAnimationStyleConfig
} from "../src/graph/style";
import { LeaferGraphLinkDataFlowAnimationHost } from "../src/link/animation/controller";
import type { LeaferGraphLinkNodeState } from "../src/link/link_host";

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
): LeaferGraphLinkNodeState {
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
  } as LeaferGraphLinkNodeState;
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

function createHostHarness(
  styleOverrides?: Partial<ReturnType<typeof createDefaultDataFlowAnimationStyleConfig>>,
  hostOptions?: {
    respectReducedMotion?: boolean;
  }
) {
  const container = createContainer();
  const linkLayer = new Group();
  const graphNodes = new Map<string, LeaferGraphLinkNodeState>([
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
  const host = new LeaferGraphLinkDataFlowAnimationHost({
    container,
    linkLayer,
    graphNodes,
    graphLinks,
    layoutMetrics: NODE_SHELL_LAYOUT_METRICS,
    defaultNodeWidth: NODE_SHELL_LAYOUT_METRICS.defaultNodeWidth,
    portSize: NODE_SHELL_LAYOUT_METRICS.portSize,
    resolveLinkStroke: () => "#475569",
    resolveSlotTypeFillMap: () => ({ number: "#22c55e" }),
    resolveStyle: () => ({
      ...createDefaultDataFlowAnimationStyleConfig("expressive"),
      ...styleOverrides
    }),
    respectReducedMotion: hostOptions?.respectReducedMotion ?? true,
    getThemeMode: () => "light",
    requestRender() {},
    renderFrame() {},
    subscribeLinkPropagation(listener) {
      propagationListener = listener;
      return () => {
        propagationListener = undefined;
      };
    }
  });

  return {
    container,
    linkLayer,
    host,
    emit(event: LeaferGraphLinkPropagationEvent) {
      propagationListener?.(event);
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
});
