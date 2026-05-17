import type { LeaferGraphHistoryEvent } from "@leafergraph/core/contracts";
import type { LeaferGraph } from "leafergraph";

const POINTER_MENU_EVENT = "pointer.menu";

type SmallInteractiveGraphLinkViewLike = NonNullable<
  ReturnType<LeaferGraph["getLinkView"]>
>;
type SmallInteractiveGraphLike = Pick<
  LeaferGraph,
  "getGraphDocument" | "getLinkView" | "removeLink" | "subscribeHistory"
>;
type SmallInteractiveGraphListenerId = ReturnType<
  NonNullable<SmallInteractiveGraphLinkViewLike["on_"]>
>;

interface LinkBinding {
  listenerId: SmallInteractiveGraphListenerId;
  view: SmallInteractiveGraphLinkViewLike;
}

export interface SmallInteractiveGraphLinkDisconnectController {
  refresh(): void;
  destroy(): void;
}

export function installSmallInteractiveGraphLinkDisconnect(
  graph: SmallInteractiveGraphLike
): SmallInteractiveGraphLinkDisconnectController {
  const bindings = new Map<string, LinkBinding>();

  const unbindLink = (linkId: string): void => {
    const binding = bindings.get(linkId);
    if (!binding) {
      return;
    }

    binding.view.off_?.(binding.listenerId);
    bindings.delete(linkId);
  };

  const bindLink = (linkId: string): void => {
    if (bindings.has(linkId)) {
      return;
    }

    const view = graph.getLinkView(linkId);
    if (!view?.on_) {
      return;
    }

    const listenerId = view.on_(POINTER_MENU_EVENT, (event) => {
      event.stopDefault?.();
      event.origin?.preventDefault?.();
      graph.removeLink(linkId);
    });

    if (listenerId === undefined || listenerId === null) {
      return;
    }

    bindings.set(linkId, { listenerId, view });
  };

  const refresh = (): void => {
    const nextLinkIds = new Set(
      graph.getGraphDocument().links.map((link) => link.id)
    );

    for (const linkId of nextLinkIds) {
      bindLink(linkId);
    }

    for (const linkId of bindings.keys()) {
      if (!nextLinkIds.has(linkId)) {
        unbindLink(linkId);
      }
    }
  };

  const unsubscribeHistory = graph.subscribeHistory((event: LeaferGraphHistoryEvent) => {
    if (event.type === "history.record" || event.type === "history.reset") {
      refresh();
    }
  });

  refresh();

  return {
    refresh,
    destroy(): void {
      unsubscribeHistory();
      for (const linkId of [...bindings.keys()]) {
        unbindLink(linkId);
      }
    }
  };
}
