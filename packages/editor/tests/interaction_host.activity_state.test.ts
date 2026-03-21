import { describe, expect, test } from "bun:test";

import type {
  LeaferGraphConnectionPortState,
  LeaferGraphInteractionActivityState
} from "leafergraph";
import { LeaferGraphInteractionHost } from "../../leafergraph/src/interaction/interaction_host";

type Handler = (event?: unknown) => void;

function createEventSource() {
  const handlers = new Map<string, Handler[]>();

  return {
    on(type: string, handler: Handler) {
      const nextHandlers = handlers.get(type) ?? [];
      nextHandlers.push(handler);
      handlers.set(type, nextHandlers);
    },
    emit(type: string, event?: unknown) {
      for (const handler of handlers.get(type) ?? []) {
        handler(event);
      }
    }
  };
}

function createPort(
  nodeId: string,
  direction: "input" | "output",
  slot: number
): LeaferGraphConnectionPortState {
  return {
    nodeId,
    direction,
    slot,
    center: { x: 0, y: 0 },
    hitBounds: {
      x: 0,
      y: 0,
      width: 20,
      height: 20
    }
  };
}

function createInteractionHost() {
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
  const resizeHandle = createEventSource();
  const portHitArea = createEventSource();
  const signalButton = createEventSource();
  const sourcePort = createPort("node-a", "output", 0);
  const targetPort = createPort("node-b", "input", 1);
  const nodeState = {
    id: "node-a",
    layout: {
      x: 100,
      y: 80,
      width: 120,
      height: 60
    },
    flags: {}
  } as const;
  const nodeViewState = {
    state: nodeState,
    view: createEventSource() as unknown,
    resizeHandle: resizeHandle as unknown,
    shellView: {
      signalButton: signalButton as unknown,
      portViews: [
        {
          layout: {
            direction: "output" as const,
            index: 0,
            portX: 0,
            portY: 0,
            portWidth: 20,
            portHeight: 20
          },
          highlight: {},
          hitArea: portHitArea as unknown
        }
      ]
    },
    hovered: false
  };
  const runtime = {
    getNodeView(nodeId: string) {
      return nodeId === "node-a" ? nodeViewState : undefined;
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
      return true;
    },
    resolveDraggedNodeIds() {
      return ["node-a"];
    },
    moveNodesByDelta() {},
    resizeNode() {},
    setNodeCollapsed() {
      return true;
    },
    canResizeNode() {
      return true;
    },
    getPagePointByClient() {
      return { x: 120, y: 90 };
    },
    getPagePointFromGraphEvent() {
      return { x: 120, y: 90 };
    },
    resolveNodeSize() {
      return {
        width: 120,
        height: 60
      };
    }
  } as const;
  const host = new LeaferGraphInteractionHost<any, any>({
    container,
    runtime: runtime as any
  });

  return {
    host,
    nodeViewState,
    resizeHandle,
    portHitArea
  };
}

function collectModes(
  host: LeaferGraphInteractionHost<any, any>
): LeaferGraphInteractionActivityState["mode"][] {
  const modes: LeaferGraphInteractionActivityState["mode"][] = [];
  host.subscribeInteractionActivity((state) => {
    modes.push(state.mode);
  });
  return modes;
}

describe("LeaferGraphInteractionHost activity state", () => {
  test("节点拖拽应发出 idle -> node-drag -> idle", () => {
    const { host, nodeViewState } = createInteractionHost();
    const modes = collectModes(host);

    (host as unknown as {
      startNodeDrag(nodeId: string, state: unknown, event: unknown): void;
      handleWindowPointerUp(): void;
    }).startNodeDrag("node-a", nodeViewState, {
      origin: { clientX: 120, clientY: 90 }
    });
    (host as unknown as { handleWindowPointerUp(): void }).handleWindowPointerUp();

    expect(modes).toEqual(["idle", "node-drag", "idle"]);
    expect(host.getInteractionActivityState()).toEqual({
      active: false,
      mode: "idle"
    });
  });

  test("resize 应发出 idle -> node-resize -> idle", () => {
    const { host, nodeViewState, resizeHandle } = createInteractionHost();
    const modes = collectModes(host);

    host.bindNodeResize("node-a", nodeViewState);
    resizeHandle.emit("pointer.down", {
      stopNow() {},
      stop() {}
    });
    (host as unknown as { handleWindowPointerUp(): void }).handleWindowPointerUp();

    expect(modes).toEqual(["idle", "node-resize", "idle"]);
  });

  test("端口拖线应发出 idle -> link-connect -> idle", () => {
    const { host, nodeViewState, portHitArea } = createInteractionHost();
    const modes = collectModes(host);

    host.bindNodePorts("node-a", nodeViewState);
    portHitArea.emit("pointer.down", {
      right: false,
      middle: false,
      stopNow() {},
      stop() {}
    });
    (host as unknown as {
      handleWindowPointerUp(event?: { clientX: number; clientY: number }): void;
    }).handleWindowPointerUp({
      clientX: 120,
      clientY: 90
    });

    expect(modes).toEqual(["idle", "link-connect", "idle"]);
  });

  test("clearInteractionState 与 destroy 后都应回到 idle", () => {
    const { host, nodeViewState } = createInteractionHost();
    const modes = collectModes(host);

    (host as unknown as {
      startNodeDrag(nodeId: string, state: unknown, event: unknown): void;
    }).startNodeDrag("node-a", nodeViewState, {
      origin: { clientX: 120, clientY: 90 }
    });
    host.clearInteractionState();
    host.destroy();

    expect(modes).toEqual(["idle", "node-drag", "idle"]);
    expect(host.getInteractionActivityState()).toEqual({
      active: false,
      mode: "idle"
    });
  });
});
