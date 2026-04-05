import type { ShortcutFunctionRegistry } from "../core/types";
import type {
  LeaferGraphShortcutHost,
  LeaferGraphShortcutRuntimeData,
  RegisterLeaferGraphShortcutFunctionsOptions
} from "./types";

/**
 * 注册LeaferGraph 快捷键功能。
 *
 * @param registry - 注册表。
 * @param options - 可选配置项。
 * @returns 用于撤销当前注册的清理函数。
 */
export function registerLeaferGraphShortcutFunctions(
  registry: ShortcutFunctionRegistry<LeaferGraphShortcutRuntimeData>,
  options: RegisterLeaferGraphShortcutFunctionsOptions
): () => void {
  // 先准备宿主依赖、初始状态和需要挂载的资源。
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
      run: async ({ data }) => {
        const selectedNodeIds = [...data.host.listSelectedNodeIds()];
        if (!selectedNodeIds.length) {
          return;
        }

        for (const nodeId of selectedNodeIds) {
          await data.host.removeNode(nodeId);
        }
        data.host.clearSelectedNodes();
      }
    }),
    registry.register({
      id: "graph.fit-view",
      run: async ({ data }) => {
        await data.host.fitView();
      }
    })
  ];

  if (options.clipboard) {
    cleanups.unshift(
      registry.register({
        id: "graph.copy",
        when: ({ data }) => canRunSelectionShortcut(data.host),
        enabled: ({ data }) => data.clipboard?.canCopySelection?.() ?? true,
        run: async ({ data }) => {
          await data.clipboard?.copySelection();
        }
      }),
      registry.register({
        id: "graph.cut",
        when: ({ data }) => canRunSelectionShortcut(data.host),
        enabled: ({ data }) => data.clipboard?.canCutSelection?.() ?? true,
        run: async ({ data }) => {
          await data.clipboard?.cutSelection();
        }
      }),
      registry.register({
        id: "graph.paste",
        when: ({ data }) => canRunSelectionShortcut(data.host),
        enabled: ({ data }) => data.clipboard?.canPasteClipboard?.() ?? true,
        run: async ({ data }) => {
          await data.clipboard?.pasteClipboard();
        }
      }),
      registry.register({
        id: "graph.duplicate",
        when: ({ data }) => canRunSelectionShortcut(data.host),
        enabled: ({ data }) => data.clipboard?.canDuplicateSelection?.() ?? true,
        run: async ({ data }) => {
          await data.clipboard?.duplicateSelection();
        }
      })
    );
  }

  // 再建立绑定与同步关系，让运行期交互能够稳定生效。
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
      run: async ({ data }) => {
        await data.host.play();
      }
    }),
    registry.register({
      id: "graph.step",
      run: async ({ data }) => {
        await data.host.step();
      }
    }),
    registry.register({
      id: "graph.stop",
      run: async ({ data }) => {
        await data.host.stop();
      }
    })
  );

  return () => {
    for (const cleanup of cleanups.reverse()) {
      cleanup();
    }
  };
}

/**
 * 判断是否可以执行选区快捷键。
 *
 * @param host - 当前宿主实现。
 * @returns 对应的判断结果。
 */
function canRunSelectionShortcut(host: LeaferGraphShortcutHost): boolean {
  const state = host.getInteractionActivityState?.();
  if (!state) {
    return true;
  }

  return !state.active || state.mode === "idle";
}
