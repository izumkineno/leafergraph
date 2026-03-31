export type ShortcutFunctionId = string;

export interface ShortcutExecutionContext<TData = void> {
  event: KeyboardEvent;
  chord: string;
  binding: ShortcutBindingDefinition;
  functionDefinition: ShortcutFunctionDefinition<TData>;
  data: TData;
}

export interface ShortcutFunctionDefinition<TData = void> {
  id: ShortcutFunctionId;
  run(context: ShortcutExecutionContext<TData>): void | Promise<void>;
  when?(context: ShortcutExecutionContext<TData>): boolean;
  enabled?(context: ShortcutExecutionContext<TData>): boolean;
}

export interface ShortcutBindingDefinition {
  id: string;
  functionId: ShortcutFunctionId;
  shortcut: string;
  scope?: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  allowInEditable?: boolean;
  repeat?: boolean;
}

export interface ShortcutRegistryRegisterOptions {
  replace?: boolean;
}

export interface ShortcutFunctionRegistry<TData = void> {
  register(
    definition: ShortcutFunctionDefinition<TData>,
    options?: ShortcutRegistryRegisterOptions
  ): () => void;
  unregister(id: ShortcutFunctionId): boolean;
  get(id: ShortcutFunctionId): ShortcutFunctionDefinition<TData> | undefined;
  list(): ShortcutFunctionDefinition<TData>[];
}

export interface ShortcutKeymapRegistry {
  register(
    binding: ShortcutBindingDefinition,
    options?: ShortcutRegistryRegisterOptions
  ): () => void;
  unregister(id: string): boolean;
  get(id: string): ShortcutBindingDefinition | undefined;
  list(): ShortcutBindingDefinition[];
  listByFunctionId(functionId: ShortcutFunctionId): ShortcutBindingDefinition[];
}

export interface ShortcutControllerOptions<TData = void> {
  functionRegistry?: ShortcutFunctionRegistry<TData>;
  keymapRegistry?: ShortcutKeymapRegistry;
  guard?(event: KeyboardEvent): boolean;
  resolveExecutionData?(event: KeyboardEvent): TData;
  resolveScopes?(event: KeyboardEvent): string | readonly string[] | undefined;
  platform?: "mac" | "windows" | "linux";
}

export interface ShortcutController {
  bind(target: EventTarget): () => void;
  handleKeydown(event: KeyboardEvent): boolean;
  destroy(): void;
}
