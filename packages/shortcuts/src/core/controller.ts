import { matchShortcutEvent } from "./chord";
import { createShortcutFunctionRegistry } from "./function_registry";
import { createShortcutKeymapRegistry } from "./keymap_registry";
import type {
  ShortcutBindingDefinition,
  ShortcutController,
  ShortcutControllerOptions,
  ShortcutExecutionContext,
  ShortcutFunctionDefinition
} from "./types";

export function createShortcutController<TData = void>(
  options: ShortcutControllerOptions<TData> = {}
): ShortcutController {
  const functionRegistry =
    options.functionRegistry ?? createShortcutFunctionRegistry<TData>();
  const keymapRegistry = options.keymapRegistry ?? createShortcutKeymapRegistry();
  const disposeListeners = new Set<() => void>();

  const handleKeydown = (event: KeyboardEvent): boolean => {
    if (options.guard?.(event) === false) {
      return false;
    }

    const scopes = normalizeScopes(options.resolveScopes?.(event));
    const data = options.resolveExecutionData
      ? options.resolveExecutionData(event)
      : (undefined as TData);

    for (const binding of keymapRegistry.list()) {
      if (!matchesScope(binding, scopes)) {
        continue;
      }

      if (!binding.repeat && event.repeat) {
        continue;
      }

      if (!binding.allowInEditable && isEditableEventTarget(event.target)) {
        continue;
      }

      if (!matchShortcutEvent(event, binding.shortcut, { platform: options.platform })) {
        continue;
      }

      const functionDefinition = functionRegistry.get(binding.functionId);
      if (!functionDefinition) {
        continue;
      }

      const context: ShortcutExecutionContext<TData> = {
        event,
        chord: binding.shortcut,
        binding,
        functionDefinition,
        data
      };

      if (functionDefinition.when?.(context) === false) {
        continue;
      }

      if (functionDefinition.enabled?.(context) === false) {
        continue;
      }

      if (binding.preventDefault !== false) {
        event.preventDefault();
      }

      if (binding.stopPropagation !== false) {
        event.stopPropagation();
      }

      runShortcutFunction(functionDefinition, context);
      return true;
    }

    return false;
  };

  return {
    bind(target) {
      const listener = (event: Event): void => {
        if (event instanceof KeyboardEvent && event.type === "keydown") {
          handleKeydown(event);
        }
      };

      target.addEventListener("keydown", listener);
      const dispose = () => {
        target.removeEventListener("keydown", listener);
        disposeListeners.delete(dispose);
      };

      disposeListeners.add(dispose);
      return dispose;
    },
    handleKeydown,
    destroy() {
      for (const dispose of [...disposeListeners]) {
        dispose();
      }
    }
  };
}

function normalizeScopes(
  scopes: string | readonly string[] | undefined
): readonly string[] {
  if (!scopes) {
    return [];
  }

  const nextScopes = Array.isArray(scopes) ? scopes : [scopes];
  return nextScopes
    .map((scope) => scope.trim())
    .filter((scope) => Boolean(scope));
}

function matchesScope(
  binding: ShortcutBindingDefinition,
  scopes: readonly string[]
): boolean {
  if (!binding.scope) {
    return true;
  }

  return scopes.includes(binding.scope);
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  return Boolean(target.closest("[contenteditable='true']"));
}

function runShortcutFunction<TData>(
  functionDefinition: ShortcutFunctionDefinition<TData>,
  context: ShortcutExecutionContext<TData>
): void {
  try {
    const result = functionDefinition.run(context);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      void (result as Promise<unknown>).catch((error) => {
        queueMicrotask(() => {
          throw error;
        });
      });
    }
  } catch (error) {
    queueMicrotask(() => {
      throw error;
    });
  }
}
