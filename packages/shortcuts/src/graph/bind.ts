import { createShortcutController } from "../core/controller";
import { formatShortcutLabel } from "../core/chord";
import { createShortcutFunctionRegistry } from "../core/function_registry";
import { createShortcutKeymapRegistry } from "../core/keymap_registry";
import { registerLeaferGraphShortcutFunctions } from "./functions";
import { registerLeaferGraphShortcutKeymap } from "./keymap";
import { resolveShortcutPlatform } from "./platform";
import type { BoundLeaferGraphShortcuts, BindLeaferGraphShortcutsOptions } from "./types";

export function bindLeaferGraphShortcuts(
  options: BindLeaferGraphShortcutsOptions
): BoundLeaferGraphShortcuts {
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

  function listShortcutLabels(functionId: string): string[] {
    return keymapRegistry
      .listByFunctionId(functionId)
      .map((binding) => formatShortcutLabel(binding.shortcut, { platform }));
  }
}

function createScopeActivityTracker(scopeElement: HTMLElement) {
  const ownerDocument = scopeElement.ownerDocument;
  let active = false;

  const syncActivityFromTarget = (target: EventTarget | null): void => {
    active = target instanceof Node && scopeElement.contains(target);
  };

  const handlePointerDown = (event: PointerEvent): void => {
    syncActivityFromTarget(event.target);
  };

  const handleFocusIn = (event: FocusEvent): void => {
    syncActivityFromTarget(event.target);
  };

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
