/**
 * 右键菜单核心类型。
 *
 * @remarks
 * 这层只定义与菜单 schema、目标分类和控制器交互相关的公共契约，
 * 不耦合 Leafer，也不耦合 DOM 具体渲染细节。
 */

/**
 * 菜单相关坐标点。
 */
export interface ContextMenuPoint {
  /** 横向坐标。 */
  x: number;
  /** 纵向坐标。 */
  y: number;
}

/**
 * 右键菜单目标类型。
 */
export type ContextMenuTargetKind =
  | "canvas"
  | "node"
  | "link"
  | "custom"
  | (string & {});

/**
 * 触发菜单时命中的目标对象。
 */
export interface ContextMenuTarget {
  /** 当前命中的目标类型。 */
  kind: ContextMenuTargetKind;
  /** 目标稳定 ID。 */
  id?: string;
  /** 与目标绑定的扩展元数据。 */
  meta?: Record<string, unknown>;
  /** 目标附带的原始数据载荷。 */
  data?: unknown;
}

/**
 * 菜单触发原因。
 */
export type ContextMenuTriggerReason =
  | "contextmenu"
  | "click"
  | "hover"
  | "keyboard"
  | "manual";

/**
 * 一次菜单打开时的上下文。
 */
export interface ContextMenuContext {
  /** 当前菜单绑定的容器。 */
  container: HTMLElement;
  /** 当前菜单实际挂载的宿主元素。 */
  host: HTMLElement;
  /** 当前命中的菜单目标。 */
  target: ContextMenuTarget;
  /** 当前事件命中的原始 currentTarget。 */
  currentTarget?: unknown;
  /** 当前命中的绑定键。 */
  bindingKey?: string;
  /** 当前命中的绑定类别。 */
  bindingKind?: string;
  /** 当前命中的绑定元数据。 */
  bindingMeta?: Record<string, unknown>;
  /** 触发菜单的原始事件对象。 */
  event?: unknown;
  /** 若存在进一步包装，则记录最初的原始事件。 */
  originEvent?: unknown;
  /** 当前菜单触发原因。 */
  triggerReason: ContextMenuTriggerReason;
  /** 世界坐标系中的命中点。 */
  worldPoint?: ContextMenuPoint;
  /** 页面坐标系中的命中点。 */
  pagePoint: ContextMenuPoint;
  /** 客户端坐标系中的命中点。 */
  clientPoint: ContextMenuPoint;
  /** 容器坐标系中的命中点。 */
  containerPoint: ContextMenuPoint;
  /** 绑定对象局部 box 坐标中的命中点。 */
  boxPoint?: ContextMenuPoint;
  /** 目标对象局部坐标中的命中点。 */
  localPoint?: ContextMenuPoint;
  /** 供外部 resolver 或 adapter 传递的扩展数据。 */
  data?: Record<string, unknown>;
}

/**
 * 菜单项图标的可渲染形态。
 */
export type ContextMenuRenderableIcon =
  | string
  | Node
  | ((ownerDocument: Document) => Node);

/**
 * 菜单项公共字段。
 */
export interface ContextMenuItemBase {
  /** 菜单项稳定 key。 */
  key: string;
  /** 菜单项主标题。 */
  label?: string;
  /** 菜单项补充说明。 */
  description?: string;
  /** 菜单项图标。 */
  icon?: ContextMenuRenderableIcon;
  /** 菜单项快捷键文案。 */
  shortcut?: string;
  /** 是否强制禁用该菜单项。 */
  disabled?: boolean;
  /** 是否隐藏该菜单项。 */
  hidden?: boolean;
  /** 是否按危险操作风格渲染。 */
  danger?: boolean;
  /** 选中后是否自动关闭菜单。 */
  closeOnSelect?: boolean;
  /** 菜单项排序权重。 */
  order?: number;
  /** 允许出现的目标类型集合。 */
  targetKinds?: readonly string[];
  /** 禁止出现的目标类型集合。 */
  excludeTargetKinds?: readonly string[];
  /** 额外可见性条件。 */
  when?(context: ContextMenuContext): boolean;
  /** 额外可用性条件。 */
  enableWhen?(context: ContextMenuContext): boolean;
}

/**
 * 普通动作菜单项。
 */
export interface ContextMenuActionItem extends ContextMenuItemBase {
  /** 菜单项类型；省略时默认视为 `action`。 */
  kind?: "action";
  /** 选中该菜单项时执行的回调。 */
  onSelect?(context: ContextMenuContext): void | Promise<void>;
}

/**
 * 分隔线菜单项。
 */
export interface ContextMenuSeparatorItem {
  /** 菜单项类型。 */
  kind: "separator";
  /** 可选稳定 key。 */
  key?: string;
  /** 是否隐藏该分隔线。 */
  hidden?: boolean;
  /** 分隔线排序权重。 */
  order?: number;
}

/**
 * 菜单项分组。
 */
export interface ContextMenuGroupItem extends ContextMenuItemBase {
  /** 菜单项类型。 */
  kind: "group";
  /** 分组内子菜单项。 */
  children: ContextMenuItem[];
}

/**
 * 懒加载子菜单项的解析函数。
 */
export type ContextMenuLazyChildrenResolver = (
  context: ContextMenuContext
) => ContextMenuItem[] | Promise<ContextMenuItem[]>;

/**
 * 子菜单触发方式。
 */
export type SubmenuTriggerMode = "hover" | "click" | "hover+click";

/**
 * 子菜单项。
 */
export interface ContextMenuSubmenuItem extends ContextMenuItemBase {
  /** 菜单项类型。 */
  kind: "submenu";
  /** 同步给出的子项列表。 */
  children?: ContextMenuItem[];
  /** 按需解析子项列表的异步或同步 resolver。 */
  lazyChildren?: ContextMenuLazyChildrenResolver;
  /** 当前子菜单项专属触发方式。 */
  submenuTriggerMode?: SubmenuTriggerMode;
  /** 当前子菜单项专属展开延迟。 */
  openDelay?: number;
  /** 当前子菜单项专属关闭延迟。 */
  closeDelay?: number;
}

/**
 * 复选菜单项。
 */
export interface ContextMenuCheckboxItem extends ContextMenuItemBase {
  /** 菜单项类型。 */
  kind: "checkbox";
  /** 当前显式勾选状态。 */
  checked?: boolean;
  /** 默认勾选状态。 */
  defaultChecked?: boolean;
  /** 勾选状态变化时的回调。 */
  onCheckedChange?(
    checked: boolean,
    context: ContextMenuContext
  ): void | Promise<void>;
}

/**
 * 单选菜单项。
 */
export interface ContextMenuRadioItem extends ContextMenuItemBase {
  /** 菜单项类型。 */
  kind: "radio";
  /** 单选组 key。 */
  groupKey: string;
  /** 当前菜单项代表的值。 */
  value: string;
  /** 当前显式勾选状态。 */
  checked?: boolean;
  /** 默认勾选状态。 */
  defaultChecked?: boolean;
  /** 勾选状态变化时的回调。 */
  onCheckedChange?(
    checked: boolean,
    context: ContextMenuContext
  ): void | Promise<void>;
}

/**
 * 菜单项联合类型。
 */
export type ContextMenuItem =
  | ContextMenuActionItem
  | ContextMenuSeparatorItem
  | ContextMenuGroupItem
  | ContextMenuSubmenuItem
  | ContextMenuCheckboxItem
  | ContextMenuRadioItem;

/**
 * 菜单项解析函数。
 */
export type ContextMenuResolver = (
  context: ContextMenuContext
) => ContextMenuItem[] | null | undefined;

/**
 * 当前菜单打开状态快照。
 */
export interface ContextMenuOpenState {
  /** 当前菜单是否处于打开状态。 */
  open: boolean;
  /** 当前打开状态对应的上下文。 */
  context: ContextMenuContext | null;
  /** 当前实际渲染的菜单项列表。 */
  items: readonly ContextMenuItem[];
  /** 当前展开的子菜单 key 路径。 */
  openPath: readonly string[];
  /** 各级菜单当前聚焦 key。 */
  focusedKeys: readonly (string | null)[];
}

/**
 * 菜单 adapter 协议。
 */
export interface ContextMenuAdapter {
  /** 将 adapter 接到控制器上，并返回取消绑定函数。 */
  connect(controller: ContextMenuController): () => void;
  /** 释放 adapter 资源。 */
  destroy(): void;
}

/**
 * 菜单 renderer 协议。
 */
export interface ContextMenuRenderer {
  /** 将 renderer 接到控制器上，并返回取消绑定函数。 */
  connect(controller: ContextMenuController): () => void;
  /** 释放 renderer 资源。 */
  destroy(): void;
}

/**
 * 菜单控制器初始化选项。
 */
export interface CreateContextMenuControllerOptions {
  /** 默认菜单项解析函数。 */
  resolveItems?: ContextMenuResolver;
  /** 打开前的守卫钩子。 */
  onBeforeOpen?(context: ContextMenuContext): boolean | void;
  /** 菜单打开后的回调。 */
  onOpen?(context: ContextMenuContext): void;
  /** 菜单关闭后的回调。 */
  onClose?(context?: ContextMenuContext): void;
  /** 全局默认子菜单触发方式。 */
  submenuTriggerMode?: SubmenuTriggerMode;
  /** 全局默认子菜单展开延迟。 */
  openDelay?: number;
  /** 全局默认子菜单关闭延迟。 */
  closeDelay?: number;
  /** 外部受控的展开路径。 */
  controlledOpenPath?: readonly string[];
  /** 展开路径变化时的回调。 */
  onOpenPathChange?(openPath: readonly string[]): void;
  /** 需要绑定到控制器上的 adapter 列表。 */
  adapters?: ContextMenuAdapter[];
  /** 菜单渲染器。 */
  renderer?: ContextMenuRenderer;
}

/**
 * 菜单控制器协议。
 */
export interface ContextMenuController {
  /** 获取当前菜单状态快照。 */
  getState(): ContextMenuOpenState;
  /** 订阅菜单状态变化。 */
  subscribe(listener: (state: ContextMenuOpenState) => void): () => void;
  /** 动态替换菜单解析函数。 */
  setResolver(resolver?: ContextMenuResolver): void;
  /** 以给定上下文和可选项列表打开菜单。 */
  open(context: ContextMenuContext, items?: ContextMenuItem[]): void;
  /** 关闭当前菜单。 */
  close(): void;
  /** 直接设置当前展开路径。 */
  setOpenPath(openPath: readonly string[]): void;
  /** 把展开路径截断到给定层级。 */
  closeToLevel(level: number): void;
  /** 设置某一级菜单的聚焦项。 */
  setFocusedKey(level: number, key: string | null): void;
  /** 将焦点移到下一个菜单项。 */
  focusNext(level: number): void;
  /** 将焦点移到上一个菜单项。 */
  focusPrevious(level: number): void;
  /** 将焦点移到当前层第一个菜单项。 */
  focusHome(level: number): void;
  /** 将焦点移到当前层最后一个菜单项。 */
  focusEnd(level: number): void;
  /** 激活指定菜单项。 */
  activateItem(item: ContextMenuItem): Promise<void>;
  /** 激活当前聚焦菜单项。 */
  activateFocused(level: number): Promise<void>;
  /** 按 key 激活当前层的指定菜单项。 */
  activateKey(level: number, key: string): Promise<void>;
  /** 设置或清除受控展开路径。 */
  setControlledOpenPath(openPath?: readonly string[] | null): void;
  /** 获取某个子菜单项最终生效的触发方式。 */
  getSubmenuTriggerMode(
    item?: ContextMenuSubmenuItem
  ): SubmenuTriggerMode;
  /** 获取某个子菜单项最终生效的展开延迟。 */
  getOpenDelay(item?: ContextMenuSubmenuItem): number;
  /** 获取某个子菜单项最终生效的关闭延迟。 */
  getCloseDelay(item?: ContextMenuSubmenuItem): number;
  /** 销毁控制器及其内部资源。 */
  destroy(): void;
}
