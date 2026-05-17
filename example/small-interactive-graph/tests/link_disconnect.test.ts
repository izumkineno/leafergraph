import { describe, expect, test } from "bun:test";
import { createSmallInteractiveGraphDocument } from "../src/graph/example_document";
import { installSmallInteractiveGraphLinkDisconnect } from "../src/graph/link_disconnect";

type Listener = (event: { stopDefault?(): void; origin?: { preventDefault?(): void } }) => void;

function createLinkViewStub() {
  const listeners = new Map<string, Listener>();

  return {
    on_(eventName: string, listener: Listener) {
      listeners.set(eventName, listener);
      return `${eventName}:listener`;
    },
    off_(listenerId: string) {
      if (listenerId === "pointer.menu:listener") {
        listeners.delete("pointer.menu");
      }
    },
    emit(eventName: string) {
      listeners.get(eventName)?.({
        stopDefault() {}
      });
    }
  };
}

describe("small-interactive-graph link disconnect", () => {
  test("right click removes existing links and binds newly created links", () => {
    const document = createSmallInteractiveGraphDocument();
    const linkViews = new Map<string, ReturnType<typeof createLinkViewStub>>();
    const removedLinks: string[] = [];
    const historyListeners = new Set<(event: any) => void>();

    for (const link of document.links) {
      linkViews.set(link.id, createLinkViewStub());
    }

    const graph = {
      getGraphDocument() {
        return document;
      },
      getLinkView(linkId: string) {
        return linkViews.get(linkId);
      },
      removeLink(linkId: string) {
        removedLinks.push(linkId);
        return true;
      },
      subscribeHistory(listener: (event: any) => void) {
        historyListeners.add(listener);
        return () => {
          historyListeners.delete(listener);
        };
      }
    } as const;

    const controller = installSmallInteractiveGraphLinkDisconnect(graph);

    linkViews.get("small-link-1")?.emit("pointer.menu");
    expect(removedLinks).toEqual(["small-link-1"]);

    const nextLinkView = createLinkViewStub();
    linkViews.set("small-link-3", nextLinkView);
    document.links = [
      ...document.links,
      {
        id: "small-link-3",
        source: { nodeId: "small-transform", slot: 0 },
        target: { nodeId: "small-sink", slot: 0 }
      }
    ];

    for (const listener of historyListeners) {
      listener({
        type: "history.record",
        record: {
          kind: "operation",
          redoOperations: [
            {
              type: "link.create",
              input: {
                id: "small-link-3"
              }
            }
          ]
        }
      });
    }

    nextLinkView.emit("pointer.menu");
    expect(removedLinks).toEqual(["small-link-1", "small-link-3"]);

    controller.destroy();
  });
});
