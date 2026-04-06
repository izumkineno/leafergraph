import type {
  ShortcutFunctionDefinition,
  ShortcutFunctionId,
  ShortcutFunctionRegistry,
  ShortcutRegistryRegisterOptions
} from "./types";

/**
 * 创建快捷键功能注册表。
 *
 * @returns 创建后的结果对象。
 */
export function createShortcutFunctionRegistry<TData = void>(): ShortcutFunctionRegistry<TData> {
  const definitions = new Map<ShortcutFunctionId, ShortcutFunctionDefinition<TData>>();

  return {
    register(definition, options) {
      return registerFunctionDefinition(definitions, definition, options);
    },
    unregister(id) {
      return definitions.delete(id);
    },
    get(id) {
      return definitions.get(id);
    },
    list() {
      return [...definitions.values()];
    }
  };
}

/**
 * 注册功能定义。
 *
 * @param definitions - 定义。
 * @param definition - 定义。
 * @param options - 可选配置项。
 * @returns 用于撤销当前注册的清理函数。
 */
function registerFunctionDefinition<TData>(
  definitions: Map<ShortcutFunctionId, ShortcutFunctionDefinition<TData>>,
  definition: ShortcutFunctionDefinition<TData>,
  options?: ShortcutRegistryRegisterOptions
): () => void {
  const normalizedId = definition.id.trim();
  if (!normalizedId) {
    throw new Error("快捷键功能 id 不能为空");
  }

  const nextDefinition = {
    ...definition,
    id: normalizedId
  };

  if (definitions.has(normalizedId) && !options?.replace) {
    throw new Error(`快捷键功能已存在: ${normalizedId}`);
  }

  definitions.delete(normalizedId);
  definitions.set(normalizedId, nextDefinition);

  return () => {
    if (definitions.get(normalizedId) === nextDefinition) {
      definitions.delete(normalizedId);
    }
  };
}
