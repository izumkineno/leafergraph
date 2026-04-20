import { createShortcutController } from "../core/controller";
import { formatShortcutLabel } from "../core/chord";
import { createShortcutFunctionRegistry } from "../core/function_registry";
import { createShortcutKeymapRegistry } from "../core/keymap_registry";
import { registerLeaferGraphShortcutFunctions } from "./functions";
import { registerLeaferGraphShortcutKeymap } from "./keymap";
import { resolveShortcutPlatform } from "./platform";
import type { BoundLeaferGraphShortcuts, BindLeaferGraphShortcutsOptions } from "./types";

/**
 * 绑定LeaferGraph 快捷键。
 *
 * @param options - 可选配置项。
 * @returns 用于解除当前绑定的清理函数。
 */
export function bindLeaferGraphShortcuts(
  options: BindLeaferGraphShortcutsOptions
): BoundLeaferGraphShortcuts {
  // 先准备宿主依赖、初始状态和需要挂载的资源。
  const platform = resolveShortcutPlatform(options.platform);
  const functionRegistry = createShortcutFunctionRegistry<{
    host: BindLeaferGraphShortcutsOptions["host"];
    history?: BindLeaferGraphShortcutsOptions["history"];
    clipboard?: BindLeaferGraphShortcutsOptions["clipboard"];
  }>();
  const keymapRegistry = createShortcutKeymapRegistry();
  const disposeFunctions = registerLeaferGraphShortcutFunctions(functionRegistry, {
    host: options.host,
    history: options.history,
    clipboard: options.clipboard
  });
  const disposeKeymap = registerLeaferGraphShortcutKeymap(keymapRegistry, {
    enableClipboardBindings: Boolean(options.clipboard),
    enableExecutionBindings: options.enableExecutionBindings,
    enableHistoryBindings: Boolean(options.history),
    platform
  });
  // 再建立绑定与同步关系，让运行期交互能够稳定生效。
  const scopeTracker = options.scopeElement
    ? createScopeActivityTracker(options.scopeElement)
    : null;
  const controller = createShortcutController({
    functionRegistry,
    keymapRegistry,
    platform,
    resolveExecutionData: () => ({
      host: options.host,
      history: options.history,
      clipboard: options.clipboard
    }),
    guard: () => {
      if (options.host.isContextMenuOpen?.()) {
        return false;
      }

      if (options.host.isTextEditingActive?.()) {
        return false;
      }

      if (scopeTracker && !scopeTracker.isActive()) {
        return false;
      }

      return true;
    }
  });
  const unbind = controller.bind(options.target);

  return {
    controller,
    functionRegistry,
    keymapRegistry,
    resolveShortcutLabel(functionId) {
      const labels = listShortcutLabels(functionId);
      return labels.length ? labels.join(" / ") : undefined;
    },
    listShortcutLabels,
    destroy() {
      unbind();
      controller.destroy();
      disposeKeymap();
      disposeFunctions();
      scopeTracker?.destroy();
    }
  };

  /**
   * 列出快捷键标签。
   *
   * @param functionId - 功能 ID。
   * @returns 收集到的结果列表。
   */
  function listShortcutLabels(functionId: string): string[] {
    return keymapRegistry
      .listByFunctionId(functionId)
      .map((binding) => formatShortcutLabel(binding.shortcut, { platform }));
  }
}

/**
 * 处理 `createScopeActivityTracker` 相关逻辑。
 *
 * @param scopeElement - 作用域`Element`。
 * @returns 创建后的结果对象。
 */
function createScopeActivityTracker(scopeElement: HTMLElement) {
  // 先拿到作用域所在文档，并准备一份可复用的活跃态缓存。
  const ownerDocument = scopeElement.ownerDocument;
  let active = false;

  /**
   * 从目标同步`Activity`。
   *
   * @param target - 当前目标对象。
   * @returns 无返回值。
   */
  const syncActivityFromTarget = (target: EventTarget | null): void => {
    active = target instanceof Node && scopeElement.contains(target);
  };

  /**
   * 处理指针`Down`。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  const handlePointerDown = (event: PointerEvent): void => {
    syncActivityFromTarget(event.target);
  };

  /**
   * 处理 `handleFocusIn` 相关逻辑。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  const handleFocusIn = (event: FocusEvent): void => {
    syncActivityFromTarget(event.target);
  };

  // 再把指针和焦点变化都收敛到同一份追踪器里，供快捷键守卫统一判断。
  ownerDocument.addEventListener("pointerdown", handlePointerDown, true);
  ownerDocument.addEventListener("focusin", handleFocusIn, true);

  return {
    isActive(): boolean {
      if (scopeElement.matches(":focus-within")) {
        return true;
      }

      return active;
    },
    destroy(): void {
      ownerDocument.removeEventListener("pointerdown", handlePointerDown, true);
      ownerDocument.removeEventListener("focusin", handleFocusIn, true);
    }
  };
}
