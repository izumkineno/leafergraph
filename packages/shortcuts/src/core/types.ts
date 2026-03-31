/**
 * 快捷键核心契约模块。
 *
 * @remarks
 * 负责定义快捷键函数、按键绑定、注册表和控制器协议，
 * 供图宿主和其他扩展系统复用同一套键盘调度抽象。
 */

/** 快捷键函数的稳定标识。 */
export type ShortcutFunctionId = string;

/**
 * 快捷键执行上下文。
 */
export interface ShortcutExecutionContext<TData = void> {
  /** 当前原始键盘事件。 */
  event: KeyboardEvent;
  /** 当前命中的标准化 chord。 */
  chord: string;
  /** 当前命中的绑定定义。 */
  binding: ShortcutBindingDefinition;
  /** 当前即将执行的函数定义。 */
  functionDefinition: ShortcutFunctionDefinition<TData>;
  /** 调用方解析出的附加运行时数据。 */
  data: TData;
}

/**
 * 单个快捷键函数定义。
 */
export interface ShortcutFunctionDefinition<TData = void> {
  /** 函数稳定 ID。 */
  id: ShortcutFunctionId;
  /** 命中该函数时执行的回调。 */
  run(context: ShortcutExecutionContext<TData>): void | Promise<void>;
  /** 额外的命中条件。 */
  when?(context: ShortcutExecutionContext<TData>): boolean;
  /** 当前函数是否可执行。 */
  enabled?(context: ShortcutExecutionContext<TData>): boolean;
}

/**
 * 单个快捷键绑定定义。
 */
export interface ShortcutBindingDefinition {
  /** 绑定自身的稳定 ID。 */
  id: string;
  /** 当前绑定指向的函数 ID。 */
  functionId: ShortcutFunctionId;
  /** 用户可读的快捷键表达式。 */
  shortcut: string;
  /** 绑定所属作用域。 */
  scope?: string;
  /** 命中后是否阻止浏览器默认行为。 */
  preventDefault?: boolean;
  /** 命中后是否阻止事件继续冒泡。 */
  stopPropagation?: boolean;
  /** 是否允许在可编辑区域内仍然生效。 */
  allowInEditable?: boolean;
  /** 是否允许在连续按住键盘时重复触发。 */
  repeat?: boolean;
}

/**
 * 快捷键注册时的控制项。
 */
export interface ShortcutRegistryRegisterOptions {
  /** 是否允许用同名定义覆写已存在条目。 */
  replace?: boolean;
}

/**
 * 快捷键函数注册表协议。
 */
export interface ShortcutFunctionRegistry<TData = void> {
  /** 注册一个快捷键函数定义。 */
  register(
    definition: ShortcutFunctionDefinition<TData>,
    options?: ShortcutRegistryRegisterOptions
  ): () => void;
  /** 按 ID 注销函数定义。 */
  unregister(id: ShortcutFunctionId): boolean;
  /** 按 ID 读取函数定义。 */
  get(id: ShortcutFunctionId): ShortcutFunctionDefinition<TData> | undefined;
  /** 列出当前全部函数定义。 */
  list(): ShortcutFunctionDefinition<TData>[];
}

/**
 * 快捷键绑定注册表协议。
 */
export interface ShortcutKeymapRegistry {
  /** 注册一个按键绑定。 */
  register(
    binding: ShortcutBindingDefinition,
    options?: ShortcutRegistryRegisterOptions
  ): () => void;
  /** 按 ID 注销绑定。 */
  unregister(id: string): boolean;
  /** 按 ID 读取绑定。 */
  get(id: string): ShortcutBindingDefinition | undefined;
  /** 列出当前全部绑定。 */
  list(): ShortcutBindingDefinition[];
  /** 按函数 ID 读取相关绑定。 */
  listByFunctionId(functionId: ShortcutFunctionId): ShortcutBindingDefinition[];
}

/**
 * 快捷键控制器初始化选项。
 */
export interface ShortcutControllerOptions<TData = void> {
  /** 自定义函数注册表；未提供时使用默认实现。 */
  functionRegistry?: ShortcutFunctionRegistry<TData>;
  /** 自定义按键绑定注册表；未提供时使用默认实现。 */
  keymapRegistry?: ShortcutKeymapRegistry;
  /** 全局事件守卫；返回 `false` 表示忽略本次事件。 */
  guard?(event: KeyboardEvent): boolean;
  /** 从原始键盘事件解析附加运行时数据。 */
  resolveExecutionData?(event: KeyboardEvent): TData;
  /** 为当前事件解析作用域集合。 */
  resolveScopes?(event: KeyboardEvent): string | readonly string[] | undefined;
  /** 平台类型，用于决定主键显示与解析规则。 */
  platform?: "mac" | "windows" | "linux";
}

/**
 * 快捷键控制器协议。
 */
export interface ShortcutController {
  /** 将控制器绑定到某个事件目标上。 */
  bind(target: EventTarget): () => void;
  /** 手动处理一次键盘事件。 */
  handleKeydown(event: KeyboardEvent): boolean;
  /** 销毁控制器及其内部状态。 */
  destroy(): void;
}
