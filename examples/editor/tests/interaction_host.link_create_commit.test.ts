import { describe, expect, test } from "bun:test";

import type {
  LeaferGraphConnectionPortState,
  LeaferGraphInteractionCommitEvent
} from "leafergraph";
import { LeaferGraphInteractionHost } from "../../../packages/leafergraph/src/interaction/interaction_host";

function createPort(
  nodeId: string,
  direction: "input" | "output",
  slot: number
): LeaferGraphConnectionPortState {
  return {
    nodeId,
    direction,
    slot,
    center: {
      x: 0,
      y: 0
    },
    hitBounds: {
      x: 0,
      y: 0,
      width: 24,
      height: 24
    }
  };
}

function createInteractionHost(options?: {
  emitInteractionCommit?: (event: LeaferGraphInteractionCommitEvent) => void;
  createLink?: () => boolean;
}) {
  const sourcePort = createPort("node-a", "output", 0);
  const targetPort = createPort("node-b", "input", 1);
  let createLinkCount = 0;

  const ownerWindow = {
    addEventListener() {},
    removeEventListener() {}
  } as unknown as Window;

  const container = {
    ownerDocument: {
      defaultView: ownerWindow
    },
    style: {
      cursor: ""
    }
  } as unknown as HTMLElement;

  const runtime = {
    getNodeView() {
      return undefined;
    },
    setNodeHovered() {},
    focusNode() {
      return true;
    },
    syncNodeResizeHandleVisibility() {},
    resolvePort(nodeId: string, direction: "input" | "output", slot: number) {
      if (
        nodeId === sourcePort.nodeId &&
        direction === sourcePort.direction &&
        slot === sourcePort.slot
      ) {
        return sourcePort;
      }

      if (
        nodeId === targetPort.nodeId &&
        direction === targetPort.direction &&
        slot === targetPort.slot
      ) {
        return targetPort;
      }

      return undefined;
    },
    resolvePortAtPoint() {
      return targetPort;
    },
    setConnectionSourcePort() {},
    setConnectionCandidatePort() {},
    setConnectionPreview() {},
    clearConnectionPreview() {},
    canCreateLink() {
      return { valid: true as const };
    },
    createLink() {
      createLinkCount += 1;
      return options?.createLink ? options.createLink() : true;
    },
    resolveDraggedNodeIds() {
      return [];
    },
    moveNodesByDelta() {},
    resizeNode() {},
    setNodeCollapsed() {
      return true;
    },
    canResizeNode() {
      return false;
    },
    getPagePointByClient() {
      return { x: 0, y: 0 };
    },
    getPagePointFromGraphEvent() {
      return { x: 0, y: 0 };
    },
    resolveNodeSize() {
      return undefined;
    }
  } as const;

  const host = new LeaferGraphInteractionHost({
    container,
    runtime,
    emitInteractionCommit: options?.emitInteractionCommit
  });

  (host as unknown as { connectionState: unknown }).connectionState = {
    originNodeId: sourcePort.nodeId,
    originDirection: sourcePort.direction,
    originSlot: sourcePort.slot,
    hoveredTarget: targetPort
  };

  return {
    host,
    container,
    getCreateLinkCount() {
      return createLinkCount;
    }
  };
}

describe("LeaferGraphInteractionHost link create commit", () => {
  test("存在交互提交监听时应发出 link.create.commit，而不是直接本地建线", () => {
    const events: LeaferGraphInteractionCommitEvent[] = [];
    const { host, getCreateLinkCount, container } = createInteractionHost({
      emitInteractionCommit(event) {
        events.push(event);
      }
    });

    (host as unknown as { finishConnection(point?: { x: number; y: number }): void })
      .finishConnection({ x: 120, y: 80 });

    expect(events).toEqual([
      {
        type: "link.create.commit",
        input: {
          source: {
            nodeId: "node-a",
            slot: 0
          },
          target: {
            nodeId: "node-b",
            slot: 1
          }
        }
      }
    ]);
    expect(getCreateLinkCount()).toBe(0);
    expect(container.style.cursor).toBe("");
  });

  test("没有交互提交监听时应保留原本的本地建线回退", () => {
    const { host, getCreateLinkCount } = createInteractionHost();

    (host as unknown as { finishConnection(point?: { x: number; y: number }): void })
      .finishConnection({ x: 120, y: 80 });

    expect(getCreateLinkCount()).toBe(1);
  });
});
