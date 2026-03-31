import type { ShortcutFunctionRegistry } from "../core/types";
import type {
  LeaferGraphShortcutHost,
  LeaferGraphShortcutRuntimeData,
  RegisterLeaferGraphShortcutFunctionsOptions
} from "./types";

export function registerLeaferGraphShortcutFunctions(
  registry: ShortcutFunctionRegistry<LeaferGraphShortcutRuntimeData>,
  options: RegisterLeaferGraphShortcutFunctionsOptions
): () => void {
  const cleanups = [
    registry.register({
      id: "graph.select-all",
      when: ({ data }) => canRunSelectionShortcut(data.host),
      enabled: ({ data }) => data.host.listNodeIds().length > 0,
      run: ({ data }) => {
        data.host.setSelectedNodeIds(data.host.listNodeIds());
      }
    }),
    registry.register({
      id: "graph.clear-selection",
      when: ({ data }) => canRunSelectionShortcut(data.host),
      enabled: ({ data }) => data.host.listSelectedNodeIds().length > 0,
      run: ({ data }) => {
        data.host.clearSelectedNodes();
      }
    }),
    registry.register({
      id: "graph.delete-selection",
      when: ({ data }) => canRunSelectionShortcut(data.host),
      enabled: ({ data }) => data.host.listSelectedNodeIds().length > 0,
      run: ({ data }) => {
        const selectedNodeIds = [...data.host.listSelectedNodeIds()];
        if (!selectedNodeIds.length) {
          return;
        }

        for (const nodeId of selectedNodeIds) {
          data.host.removeNode(nodeId);
        }
        data.host.clearSelectedNodes();
      }
    }),
    registry.register({
      id: "graph.fit-view",
      run: ({ data }) => {
        data.host.fitView();
      }
    })
  ];

  if (options.clipboard) {
    cleanups.unshift(
      registry.register({
        id: "graph.copy",
        when: ({ data }) => canRunSelectionShortcut(data.host),
        enabled: ({ data }) => data.clipboard?.canCopySelection?.() ?? true,
        run: ({ data }) => {
          data.clipboard?.copySelection();
        }
      }),
      registry.register({
        id: "graph.cut",
        when: ({ data }) => canRunSelectionShortcut(data.host),
        enabled: ({ data }) => data.clipboard?.canCutSelection?.() ?? true,
        run: ({ data }) => {
          data.clipboard?.cutSelection();
        }
      }),
      registry.register({
        id: "graph.paste",
        when: ({ data }) => canRunSelectionShortcut(data.host),
        enabled: ({ data }) => data.clipboard?.canPasteClipboard?.() ?? true,
        run: ({ data }) => {
          data.clipboard?.pasteClipboard();
        }
      }),
      registry.register({
        id: "graph.duplicate",
        when: ({ data }) => canRunSelectionShortcut(data.host),
        enabled: ({ data }) => data.clipboard?.canDuplicateSelection?.() ?? true,
        run: ({ data }) => {
          data.clipboard?.duplicateSelection();
        }
      })
    );
  }

  if (options.history) {
    cleanups.push(
      registry.register({
        id: "graph.undo",
        when: ({ data }) => canRunSelectionShortcut(data.host),
        enabled: ({ data }) => data.history?.canUndo?.() ?? true,
        run: ({ data }) => {
          data.history?.undo();
        }
      }),
      registry.register({
        id: "graph.redo",
        when: ({ data }) => canRunSelectionShortcut(data.host),
        enabled: ({ data }) => data.history?.canRedo?.() ?? true,
        run: ({ data }) => {
          data.history?.redo();
        }
      })
    );
  }

  cleanups.push(
    registry.register({
      id: "graph.play",
      run: ({ data }) => {
        data.host.play();
      }
    }),
    registry.register({
      id: "graph.step",
      run: ({ data }) => {
        data.host.step();
      }
    }),
    registry.register({
      id: "graph.stop",
      run: ({ data }) => {
        data.host.stop();
      }
    })
  );

  return () => {
    for (const cleanup of cleanups.reverse()) {
      cleanup();
    }
  };
}

function canRunSelectionShortcut(host: LeaferGraphShortcutHost): boolean {
  const state = host.getInteractionActivityState?.();
  if (!state) {
    return true;
  }

  return !state.active || state.mode === "idle";
}
