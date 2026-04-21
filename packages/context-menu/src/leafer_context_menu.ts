/**
 * Leafer-first 右键菜单公开入口。
 *
 * @remarks
 * 这个文件定义 `@leafergraph/context-menu` 唯一对外推荐的 API：
 * - 事件来源固定为 Leafer `pointer.menu`
 * - 菜单展示仍然走内部 DOM overlay
 * - 外部不再感知 controller / renderer / adapter 的分层拼装
 */

import type { App } from "leafer-ui";
import {
  normalizeLeaferContextMenuConfig,
  type LeaferContextMenuConfig,
  type LeaferContextMenuSubmenuTriggerMode
} from "@leafergraph/core/config";
import {
  resolveThemePreset,
  type LeaferGraphThemeMode,
  type LeaferGraphThemePresetId
} from "@leafergraph/core/theme";
import { createLeaferContextMenuAdapter } from "./adapters/leafer";
import {
  LEAFER_GRAPH_POINTER_MENU_EVENT,
  type LeaferContextMenuAdapter as InternalLeaferContextMenuAdapter,
  type LeaferContextMenuBinding as InternalLeaferContextMenuBinding,
  type LeaferMenuOriginEvent as InternalLeaferMenuOriginEvent,
  type LeaferPointerMenuEvent as InternalLeaferPointerMenuEvent
} from "./adapters/leafer";
import { createContextMenuController } from "./core/controller";
import type {
  ContextMenuActionItem as InternalContextMenuActionItem,
  ContextMenuCheckboxItem as InternalContextMenuCheckboxItem,
  ContextMenuContext as InternalContextMenuContext,
  ContextMenuController as InternalContextMenuController,
  ContextMenuGroupItem as InternalContextMenuGroupItem,
  ContextMenuItem as InternalContextMenuItem,
  ContextMenuRadioItem as InternalContextMenuRadioItem,
  ContextMenuSeparatorItem as InternalContextMenuSeparatorItem,
  ContextMenuSubmenuItem as InternalContextMenuSubmenuItem,
  ContextMenuTarget as InternalContextMenuTarget
} from "./core/types";
import { createDomContextMenuRenderer } from "./internal/dom_overlay_renderer";

interface LeaferContextMenuPoint {
  x: number;
  y: number;
}

interface LeaferContextMenuOriginEvent {
  clientX?: number;
  clientY?: number;
  pageX?: number;
  pageY?: number;
  preventDefault?(): void;
  stopPropagation?(): void;
}

interface LeaferBindingTargetLike {
  name?: string;
  parent?: unknown | null;
  on_?: App["on_"];
  off_?: App["off_"];
}

type LeaferContextMenuTriggerReason =
  | "contextmenu"
  | "click"
  | "hover"
  | "keyboard"
  | "manual";

type LeaferContextMenuRenderableIcon =
  | string
  | Node
  | ((ownerDocument: Document) => Node);

export type LeaferContextMenuResolver = (
  context: LeaferContextMenuContext
) => LeaferContextMenuItem[] | null | undefined;

interface LeaferContextMenuBindingResolverInput {
  app: App;
  binding: LeaferContextMenuBinding;
  event: LeaferPointerMenuEvent;
  hitTarget: unknown;
}

export const LEAFER_POINTER_MENU_EVENT = LEAFER_GRAPH_POINTER_MENU_EVENT;

export type LeaferPointerMenuEvent = InternalLeaferPointerMenuEvent;

export type LeaferContextMenuTargetKind =
  | "canvas"
  | "node"
  | "link"
  | "custom"
  | (string & {});

export interface LeaferContextMenuTarget {
  kind: LeaferContextMenuTargetKind;
  id?: string;
  meta?: Record<string, unknown>;
  data?: unknown;
}

export interface LeaferContextMenuContext {
  container: HTMLElement;
  host: HTMLElement;
  target: LeaferContextMenuTarget;
  currentTarget?: unknown;
  bindingKey?: string;
  bindingKind?: string;
  bindingMeta?: Record<string, unknown>;
  event?: LeaferPointerMenuEvent;
  originEvent?: LeaferContextMenuOriginEvent;
  triggerReason: LeaferContextMenuTriggerReason;
  worldPoint?: LeaferContextMenuPoint;
  pagePoint: LeaferContextMenuPoint;
  clientPoint: LeaferContextMenuPoint;
  containerPoint: LeaferContextMenuPoint;
  boxPoint?: LeaferContextMenuPoint;
  localPoint?: LeaferContextMenuPoint;
  data?: Record<string, unknown>;
}

interface LeaferContextMenuItemBase {
  key: string;
  label?: string;
  description?: string;
  icon?: LeaferContextMenuRenderableIcon;
  shortcut?: string;
  disabled?: boolean;
  hidden?: boolean;
  danger?: boolean;
  closeOnSelect?: boolean;
  order?: number;
  targetKinds?: readonly string[];
  excludeTargetKinds?: readonly string[];
  when?(context: LeaferContextMenuContext): boolean;
  enableWhen?(context: LeaferContextMenuContext): boolean;
}

export interface LeaferContextMenuActionItem
  extends LeaferContextMenuItemBase {
  kind?: "action";
  onSelect?(context: LeaferContextMenuContext): void | Promise<void>;
}

export interface LeaferContextMenuSeparatorItem {
  kind: "separator";
  key?: string;
  hidden?: boolean;
  order?: number;
}

export interface LeaferContextMenuGroupItem
  extends LeaferContextMenuItemBase {
  kind: "group";
  children: LeaferContextMenuItem[];
}

export interface LeaferContextMenuSubmenuItem
  extends LeaferContextMenuItemBase {
  kind: "submenu";
  children?: LeaferContextMenuItem[];
  lazyChildren?(
    context: LeaferContextMenuContext
  ): LeaferContextMenuItem[] | Promise<LeaferContextMenuItem[]>;
  submenuTriggerMode?: LeaferContextMenuSubmenuTriggerMode;
  openDelay?: number;
  closeDelay?: number;
}

export interface LeaferContextMenuCheckboxItem
  extends LeaferContextMenuItemBase {
  kind: "checkbox";
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?(
    checked: boolean,
    context: LeaferContextMenuContext
  ): void | Promise<void>;
}

export interface LeaferContextMenuRadioItem
  extends LeaferContextMenuItemBase {
  kind: "radio";
  groupKey: string;
  value: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?(
    checked: boolean,
    context: LeaferContextMenuContext
  ): void | Promise<void>;
}

export type LeaferContextMenuItem =
  | LeaferContextMenuActionItem
  | LeaferContextMenuSeparatorItem
  | LeaferContextMenuGroupItem
  | LeaferContextMenuSubmenuItem
  | LeaferContextMenuCheckboxItem
  | LeaferContextMenuRadioItem;

export interface LeaferContextMenuBinding {
  key: string;
  target: LeaferBindingTargetLike;
  kind?: LeaferContextMenuTargetKind;
  meta?: Record<string, unknown>;
  resolveTarget?(
    input: LeaferContextMenuBindingResolverInput
  ): LeaferContextMenuTarget | null | undefined;
}

export interface LeaferContextMenuOptions {
  app: App;
  container: HTMLElement;
  host?: HTMLElement;
  className?: string;
  canvasTarget?: LeaferBindingTargetLike | false;
  bindings?: LeaferContextMenuBinding[];
  resolveItems?: LeaferContextMenuResolver;
  onBeforeOpen?(context: LeaferContextMenuContext): boolean | void;
  onOpen?(context: LeaferContextMenuContext): void;
  onClose?(context?: LeaferContextMenuContext): void;
  config?: LeaferContextMenuConfig;
  themePreset?: LeaferGraphThemePresetId;
  resolveThemeMode?(): LeaferGraphThemeMode;
}

export interface LeaferContextMenu {
  bindCanvas(
    target?: LeaferBindingTargetLike,
    meta?: Record<string, unknown>
  ): this;
  bindNode(
    key: string,
    target: LeaferBindingTargetLike,
    meta?: Record<string, unknown>
  ): this;
  bindLink(
    key: string,
    target: LeaferBindingTargetLike,
    meta?: Record<string, unknown>
  ): this;
  bindTarget(binding: LeaferContextMenuBinding): this;
  unbindTarget(key: string): this;
  setResolver(resolver?: LeaferContextMenuResolver): this;
  registerResolver(
    key: string,
    resolver: LeaferContextMenuResolver
  ): () => void;
  unregisterResolver(key: string): this;
  open(
    context: LeaferContextMenuContext,
    items?: LeaferContextMenuItem[]
  ): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

/**
 * 封装 LeaferContextMenuImpl 的相关行为。
 */
class LeaferContextMenuImpl implements LeaferContextMenu {
  private readonly app: App;
  private readonly adapter: InternalLeaferContextMenuAdapter;
  private readonly controller: InternalContextMenuController;
  private baseResolver?: LeaferContextMenuResolver;
  private readonly registeredResolvers = new Map<string, LeaferContextMenuResolver>();

  /**
   * 初始化 LeaferContextMenuImpl 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(options: LeaferContextMenuOptions) {
    // 先整理当前阶段需要的输入、状态与依赖。
    this.app = options.app;
    const resolvedConfig = normalizeLeaferContextMenuConfig(options.config);
    const host =
      options.host ??
      options.container.ownerDocument.body ??
      options.container;
    // 再执行核心逻辑，并把结果或副作用统一收口。
    this.baseResolver = options.resolveItems;
    this.adapter = createLeaferContextMenuAdapter({
      app: options.app,
      container: options.container,
      host: options.host,
      canvasTarget: options.canvasTarget as
        | InternalLeaferContextMenuBinding["target"]
        | false
        | undefined,
      bindings: options.bindings?.map((binding) =>
        toInternalBinding(binding)
      )
    });
    this.controller = createContextMenuController({
      renderer: createDomContextMenuRenderer({
        host,
        className: options.className,
        resolveThemeTokens: () => {
          const themeMode = options.resolveThemeMode?.() ?? "light";
          return resolveThemePreset(options.themePreset).modes[themeMode]
            .contextMenu;
        }
      }),
      adapters: [this.adapter],
      submenuTriggerMode: resolvedConfig.submenu.triggerMode,
      openDelay: resolvedConfig.submenu.openDelay,
      closeDelay: resolvedConfig.submenu.closeDelay,
      resolveItems: (context) => this.resolveAllItems(toPublicContext(context)),
      onBeforeOpen: (context) =>
        options.onBeforeOpen?.(toPublicContext(context)),
      onOpen: (context) => {
        options.onOpen?.(toPublicContext(context));
      },
      onClose: (context) => {
        options.onClose?.(
          context ? toPublicContext(context) : undefined
        );
      }
    });
  }

  /**
   * 绑定画布。
   *
   * @param target - 当前目标对象。
   * @param meta - `meta`。
   * @returns 用于解除当前绑定的清理函数。
   */
  bindCanvas(
    target: LeaferBindingTargetLike = this.app as unknown as LeaferBindingTargetLike,
    meta?: Record<string, unknown>
  ): this {
    this.adapter.bindCanvas(
      target as InternalLeaferContextMenuBinding["target"],
      meta
    );
    return this;
  }

  /**
   * 绑定节点。
   *
   * @param key - 键值。
   * @param target - 当前目标对象。
   * @param meta - `meta`。
   * @returns 用于解除当前绑定的清理函数。
   */
  bindNode(
    key: string,
    target: LeaferBindingTargetLike,
    meta?: Record<string, unknown>
  ): this {
    this.adapter.bindNode(
      key,
      target as InternalLeaferContextMenuBinding["target"],
      meta
    );
    return this;
  }

  /**
   * 绑定连线。
   *
   * @param key - 键值。
   * @param target - 当前目标对象。
   * @param meta - `meta`。
   * @returns 用于解除当前绑定的清理函数。
   */
  bindLink(
    key: string,
    target: LeaferBindingTargetLike,
    meta?: Record<string, unknown>
  ): this {
    this.adapter.bindLink(
      key,
      target as InternalLeaferContextMenuBinding["target"],
      meta
    );
    return this;
  }

  /**
   * 绑定目标。
   *
   * @param binding - 绑定。
   * @returns 用于解除当前绑定的清理函数。
   */
  bindTarget(binding: LeaferContextMenuBinding): this {
    this.adapter.bindTarget(toInternalBinding(binding));
    return this;
  }

  /**
   * 处理 `unbindTarget` 相关逻辑。
   *
   * @param key - 键值。
   * @returns 处理后的结果。
   */
  unbindTarget(key: string): this {
    this.adapter.unbindTarget(key);
    return this;
  }

  /**
   * 设置解析器。
   *
   * @param resolver - 解析器。
   * @returns 设置解析器的结果。
   */
  setResolver(resolver?: LeaferContextMenuResolver): this {
    this.baseResolver = resolver;
    this.refreshControllerResolver();
    return this;
  }

  /**
   * 注册解析器。
   *
   * @param key - 键值。
   * @param resolver - 解析器。
   * @returns 用于撤销当前注册的清理函数。
   */
  registerResolver(
    key: string,
    resolver: LeaferContextMenuResolver
  ): () => void {
    const normalizedKey = normalizeResolverKey(key);
    this.registeredResolvers.set(normalizedKey, resolver);
    this.refreshControllerResolver();

    return () => {
      if (this.registeredResolvers.get(normalizedKey) !== resolver) {
        return;
      }

      this.registeredResolvers.delete(normalizedKey);
      this.refreshControllerResolver();
    };
  }

  /**
   * 取消注册解析器。
   *
   * @param key - 键值。
   * @returns 取消注册解析器的结果。
   */
  unregisterResolver(key: string): this {
    this.registeredResolvers.delete(normalizeResolverKey(key));
    this.refreshControllerResolver();
    return this;
  }

  /**
   * 处理 `open` 相关逻辑。
   *
   * @param context - 当前上下文。
   * @param items - 项目。
   * @returns 无返回值。
   */
  open(
    context: LeaferContextMenuContext,
    items?: LeaferContextMenuItem[]
  ): void {
    this.controller.open(
      toInternalContext(context),
      items?.map((item) => toInternalItem(item))
    );
  }

  /**
   * 处理 `close` 相关逻辑。
   *
   * @returns 无返回值。
   */
  close(): void {
    this.controller.close();
  }

  /**
   * 判断是否为打开。
   *
   * @returns 对应的判断结果。
   */
  isOpen(): boolean {
    return this.controller.getState().open;
  }

  /**
   * 处理 `destroy` 相关逻辑。
   *
   * @returns 无返回值。
   */
  destroy(): void {
    this.adapter.destroy();
    this.controller.destroy();
  }

  /**
   *  把基础 resolver 和全部注册 resolver 合并成当前正式菜单结果。
   *
   * @param context - 当前上下文。
   * @returns 处理后的结果。
   */
  private resolveAllItems(
    context: LeaferContextMenuContext
  ): InternalContextMenuItem[] {
    const resolvedItems: LeaferContextMenuItem[] = [];

    const baseItems = this.baseResolver?.(context);
    if (baseItems?.length) {
      resolvedItems.push(...baseItems);
    }

    for (const resolver of this.registeredResolvers.values()) {
      const items = resolver(context);
      if (items?.length) {
        resolvedItems.push(...items);
      }
    }

    return resolvedItems.map((item) => toInternalItem(item));
  }

  /**
   *  每次 resolver 变更后都统一刷新控制器入口，避免外层自己关心合并逻辑。
   *
   * @returns 无返回值。
   */
  private refreshControllerResolver(): void {
    this.controller.setResolver((context) =>
      this.resolveAllItems(toPublicContext(context))
    );
  }
}

/**
 * 创建`Leafer` 上下文菜单。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createLeaferContextMenu(
  options: LeaferContextMenuOptions
): LeaferContextMenu {
  return new LeaferContextMenuImpl(options);
}

/**
 * 规范化解析器键值。
 *
 * @param key - 键值。
 * @returns 处理后的结果。
 */
function normalizeResolverKey(key: string): string {
  const normalizedKey = key.trim();
  if (!normalizedKey) {
    throw new Error("右键菜单 resolver 键名不能为空");
  }

  return normalizedKey;
}

/**
 * 转换为`Internal` 绑定。
 *
 * @param binding - 绑定。
 * @returns 处理后的结果。
 */
function toInternalBinding(
  binding: LeaferContextMenuBinding
): InternalLeaferContextMenuBinding {
  return {
    key: binding.key,
    target: binding.target as InternalLeaferContextMenuBinding["target"],
    kind: binding.kind as InternalLeaferContextMenuBinding["kind"],
    meta: binding.meta,
    resolveTarget: binding.resolveTarget
      ? (input) =>
          binding.resolveTarget?.({
            app: input.app,
            binding,
            event: input.event,
            hitTarget: input.hitTarget
          }) as InternalContextMenuTarget | null | undefined
      : undefined
  };
}

/**
 * 转换为公开上下文。
 *
 * @param context - 当前上下文。
 * @returns 处理后的结果。
 */
function toPublicContext(
  context: InternalContextMenuContext
): LeaferContextMenuContext {
  return {
    container: context.container,
    host: context.host,
    target: toPublicTarget(context.target),
    currentTarget: context.currentTarget,
    bindingKey: context.bindingKey,
    bindingKind: context.bindingKind,
    bindingMeta: context.bindingMeta,
    event: context.event as LeaferPointerMenuEvent | undefined,
    originEvent: context.originEvent as
      | LeaferContextMenuOriginEvent
      | undefined,
    triggerReason: context.triggerReason,
    worldPoint: context.worldPoint,
    pagePoint: context.pagePoint,
    clientPoint: context.clientPoint,
    containerPoint: context.containerPoint,
    boxPoint: context.boxPoint,
    localPoint: context.localPoint,
    data: context.data
  };
}

/**
 * 转换为公开目标。
 *
 * @param target - 当前目标对象。
 * @returns 处理后的结果。
 */
function toPublicTarget(
  target: InternalContextMenuTarget
): LeaferContextMenuTarget {
  return {
    kind: target.kind,
    id: target.id,
    meta: target.meta,
    data: target.data
  };
}

/**
 * 转换为`Internal` 上下文。
 *
 * @param context - 当前上下文。
 * @returns 处理后的结果。
 */
function toInternalContext(
  context: LeaferContextMenuContext
): InternalContextMenuContext {
  return {
    container: context.container,
    host: context.host,
    target: {
      kind: context.target.kind,
      id: context.target.id,
      meta: context.target.meta,
      data: context.target.data
    },
    currentTarget: context.currentTarget,
    bindingKey: context.bindingKey,
    bindingKind: context.bindingKind,
    bindingMeta: context.bindingMeta,
    event: context.event,
    originEvent: context.originEvent as
      | InternalLeaferMenuOriginEvent
      | undefined,
    triggerReason: context.triggerReason,
    worldPoint: context.worldPoint,
    pagePoint: context.pagePoint,
    clientPoint: context.clientPoint,
    containerPoint: context.containerPoint,
    boxPoint: context.boxPoint,
    localPoint: context.localPoint,
    data: context.data
  };
}

/**
 * 转换为`Internal` 项目。
 *
 * @param item - 项目。
 * @returns 处理后的结果。
 */
function toInternalItem(
  item: LeaferContextMenuItem
): InternalContextMenuItem {
  switch (item.kind) {
    case "separator":
      return toInternalSeparatorItem(item);
    case "group":
      return toInternalGroupItem(item);
    case "submenu":
      return toInternalSubmenuItem(item);
    case "checkbox":
      return toInternalCheckboxItem(item);
    case "radio":
      return toInternalRadioItem(item);
    default:
      return toInternalActionItem(item);
  }
}

/**
 * 转换为`Internal` 动作项目。
 *
 * @param item - 项目。
 * @returns 处理后的结果。
 */
function toInternalActionItem(
  item: LeaferContextMenuActionItem
): InternalContextMenuActionItem {
  return {
    ...toInternalItemBase(item),
    kind: item.kind,
    onSelect: item.onSelect
      ? (context) => item.onSelect?.(toPublicContext(context))
      : undefined
  };
}

/**
 * 转换为`Internal` 分隔符项目。
 *
 * @param item - 项目。
 * @returns 处理后的结果。
 */
function toInternalSeparatorItem(
  item: LeaferContextMenuSeparatorItem
): InternalContextMenuSeparatorItem {
  return {
    kind: "separator",
    key: item.key,
    hidden: item.hidden,
    order: item.order
  };
}

/**
 * 转换为`Internal` 分组项目。
 *
 * @param item - 项目。
 * @returns 处理后的结果。
 */
function toInternalGroupItem(
  item: LeaferContextMenuGroupItem
): InternalContextMenuGroupItem {
  return {
    ...toInternalItemBase(item),
    kind: "group",
    children: item.children.map((child) => toInternalItem(child))
  };
}

/**
 * 转换为`Internal` 子菜单项目。
 *
 * @param item - 项目。
 * @returns 处理后的结果。
 */
function toInternalSubmenuItem(
  item: LeaferContextMenuSubmenuItem
): InternalContextMenuSubmenuItem {
  return {
    ...toInternalItemBase(item),
    kind: "submenu",
    children: item.children?.map((child) => toInternalItem(child)),
    lazyChildren: item.lazyChildren
      ? async (context) => {
          const children = await item.lazyChildren?.(toPublicContext(context));
          return (children ?? []).map((child) => toInternalItem(child));
        }
      : undefined,
    submenuTriggerMode: item.submenuTriggerMode,
    openDelay: item.openDelay,
    closeDelay: item.closeDelay
  };
}

/**
 * 转换为`Internal` 复选框项目。
 *
 * @param item - 项目。
 * @returns 处理后的结果。
 */
function toInternalCheckboxItem(
  item: LeaferContextMenuCheckboxItem
): InternalContextMenuCheckboxItem {
  return {
    ...toInternalItemBase(item),
    kind: "checkbox",
    checked: item.checked,
    defaultChecked: item.defaultChecked,
    onCheckedChange: item.onCheckedChange
      ? (checked, context) =>
          item.onCheckedChange?.(checked, toPublicContext(context))
      : undefined
  };
}

/**
 * 转换为`Internal` 单选项项目。
 *
 * @param item - 项目。
 * @returns 处理后的结果。
 */
function toInternalRadioItem(
  item: LeaferContextMenuRadioItem
): InternalContextMenuRadioItem {
  return {
    ...toInternalItemBase(item),
    kind: "radio",
    groupKey: item.groupKey,
    value: item.value,
    checked: item.checked,
    defaultChecked: item.defaultChecked,
    onCheckedChange: item.onCheckedChange
      ? (checked, context) =>
          item.onCheckedChange?.(checked, toPublicContext(context))
      : undefined
  };
}

/**
 * 处理 `toInternalItemBase` 相关逻辑。
 *
 * @param item - 项目。
 * @returns 处理后的结果。
 */
function toInternalItemBase(item: LeaferContextMenuItemBase) {
  const when = item.when;
  const enableWhen = item.enableWhen;

  return {
    key: item.key,
    label: item.label,
    description: item.description,
    icon: item.icon,
    shortcut: item.shortcut,
    disabled: item.disabled,
    hidden: item.hidden,
    danger: item.danger,
    closeOnSelect: item.closeOnSelect,
    order: item.order,
    targetKinds: item.targetKinds,
    excludeTargetKinds: item.excludeTargetKinds,
    when: when
      ? (context: InternalContextMenuContext) => when(toPublicContext(context))
      : undefined,
    enableWhen: enableWhen
      ? (context: InternalContextMenuContext) =>
          enableWhen(toPublicContext(context))
      : undefined
  };
}
