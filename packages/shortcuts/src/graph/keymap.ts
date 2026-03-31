import type { ShortcutKeymapRegistry } from "../core/types";
import { resolveShortcutPlatform } from "./platform";
import type { RegisterLeaferGraphShortcutKeymapOptions } from "./types";

/**
 * 注册LeaferGraph 快捷键键位映射。
 *
 * @param registry - 注册表。
 * @param options - 可选配置项。
 * @returns 用于撤销当前注册的清理函数。
 */
export function registerLeaferGraphShortcutKeymap(
  registry: ShortcutKeymapRegistry,
  options: RegisterLeaferGraphShortcutKeymapOptions = {}
): () => void {
  // 先准备宿主依赖、初始状态和需要挂载的资源。
  const platform = resolveShortcutPlatform(options.platform);
  const cleanups = [
    registry.register({
      id: "graph.select-all",
      functionId: "graph.select-all",
      shortcut: "Mod+KeyA"
    }),
    registry.register({
      id: "graph.clear-selection",
      functionId: "graph.clear-selection",
      shortcut: "Escape"
    }),
    registry.register({
      id: "graph.delete-selection.delete",
      functionId: "graph.delete-selection",
      shortcut: "Delete"
    }),
    registry.register({
      id: "graph.delete-selection.backspace",
      functionId: "graph.delete-selection",
      shortcut: "Backspace"
    }),
    registry.register({
      id: "graph.fit-view",
      functionId: "graph.fit-view",
      shortcut: "KeyF"
    })
  ];

  if (options.enableClipboardBindings) {
    cleanups.unshift(
      registry.register({
        id: "graph.copy",
        functionId: "graph.copy",
        shortcut: "Mod+KeyC"
      }),
      registry.register({
        id: "graph.cut",
        functionId: "graph.cut",
        shortcut: "Mod+KeyX"
      }),
      registry.register({
        id: "graph.paste",
        functionId: "graph.paste",
        shortcut: "Mod+KeyV"
      }),
      registry.register({
        id: "graph.duplicate",
        functionId: "graph.duplicate",
        shortcut: "Mod+KeyD"
      })
    );
  }

  // 再建立绑定与同步关系，让运行期交互能够稳定生效。
  if (options.enableHistoryBindings) {
    cleanups.push(
      registry.register({
        id: "graph.undo",
        functionId: "graph.undo",
        shortcut: "Mod+KeyZ"
      }),
      registry.register({
        id: "graph.redo",
        functionId: "graph.redo",
        shortcut: platform === "mac" ? "Mod+Shift+KeyZ" : "Mod+KeyY"
      })
    );
  }

  if (options.enableExecutionBindings) {
    cleanups.push(
      registry.register({
        id: "graph.play",
        functionId: "graph.play",
        shortcut: "Mod+Enter"
      }),
      registry.register({
        id: "graph.step",
        functionId: "graph.step",
        shortcut: "Mod+Shift+Enter"
      }),
      registry.register({
        id: "graph.stop",
        functionId: "graph.stop",
        shortcut: "Mod+Period"
      })
    );
  }

  return () => {
    for (const cleanup of cleanups.reverse()) {
      cleanup();
    }
  };
}
