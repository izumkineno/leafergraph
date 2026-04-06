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

/**
 * 创建快捷键控制器。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createShortcutController<TData = void>(
  options: ShortcutControllerOptions<TData> = {}
): ShortcutController {
  // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
  const functionRegistry =
    options.functionRegistry ?? createShortcutFunctionRegistry<TData>();
  const keymapRegistry = options.keymapRegistry ?? createShortcutKeymapRegistry();
  // 再按当前规则组合结果，并把派生数据一并收口到输出里。
  const disposeListeners = new Set<() => void>();

  /**
   * 处理键盘按下。
   *
   * @param event - 当前事件对象。
   * @returns 对应的判断结果。
   */
  const handleKeydown = (event: KeyboardEvent): boolean => {
    // 先读取当前目标状态与上下文约束，避免处理中出现不一致的中间态。
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
      // 再执行核心更新步骤，并同步派生副作用与收尾状态。
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
      /**
       * 处理 `listener` 相关逻辑。
       *
       * @param event - 当前事件对象。
       * @returns 无返回值。
       */
      const listener = (event: Event): void => {
        if (event instanceof KeyboardEvent && event.type === "keydown") {
          handleKeydown(event);
        }
      };

      target.addEventListener("keydown", listener);
      /**
       * 处理 `dispose` 相关逻辑。
       *
       * @returns 无返回值。
       */
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

/**
 * 规范化作用域。
 *
 * @param scopes - 作用域。
 * @returns 处理后的结果。
 */
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

/**
 * 处理 `matchesScope` 相关逻辑。
 *
 * @param binding - 绑定。
 * @param scopes - 作用域。
 * @returns 对应的判断结果。
 */
function matchesScope(
  binding: ShortcutBindingDefinition,
  scopes: readonly string[]
): boolean {
  if (!binding.scope) {
    return true;
  }

  return scopes.includes(binding.scope);
}

/**
 * 判断是否为`Editable` 事件目标。
 *
 * @param target - 当前目标对象。
 * @returns 对应的判断结果。
 */
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

/**
 * 执行快捷键功能。
 *
 * @param functionDefinition - 功能定义。
 * @param context - 当前上下文。
 * @returns 无返回值。
 */
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
