import { normalizeShortcutChord } from "./chord";
import type {
  ShortcutBindingDefinition,
  ShortcutKeymapRegistry,
  ShortcutRegistryRegisterOptions
} from "./types";

export function createShortcutKeymapRegistry(): ShortcutKeymapRegistry {
  const bindings = new Map<string, ShortcutBindingDefinition>();

  return {
    register(binding, options) {
      return registerShortcutBinding(bindings, binding, options);
    },
    unregister(id) {
      return bindings.delete(id);
    },
    get(id) {
      return bindings.get(id);
    },
    list() {
      return [...bindings.values()];
    },
    listByFunctionId(functionId) {
      return [...bindings.values()].filter((binding) => binding.functionId === functionId);
    }
  };
}

function registerShortcutBinding(
  bindings: Map<string, ShortcutBindingDefinition>,
  binding: ShortcutBindingDefinition,
  options?: ShortcutRegistryRegisterOptions
): () => void {
  const normalizedId = binding.id.trim();
  if (!normalizedId) {
    throw new Error("快捷键绑定 id 不能为空");
  }

  const normalizedFunctionId = binding.functionId.trim();
  if (!normalizedFunctionId) {
    throw new Error("快捷键绑定缺少 functionId");
  }

  if (bindings.has(normalizedId) && !options?.replace) {
    throw new Error(`快捷键绑定已存在: ${normalizedId}`);
  }

  const nextBinding: ShortcutBindingDefinition = {
    ...binding,
    id: normalizedId,
    functionId: normalizedFunctionId,
    shortcut: normalizeShortcutChord(binding.shortcut),
    scope: binding.scope?.trim() || undefined
  };

  bindings.delete(normalizedId);
  bindings.set(normalizedId, nextBinding);

  return () => {
    if (bindings.get(normalizedId) === nextBinding) {
      bindings.delete(normalizedId);
    }
  };
}
