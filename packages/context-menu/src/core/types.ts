/**
 * 右键菜单核心类型。
 *
 * @remarks
 * 这层只定义与菜单 schema、目标分类和控制器交互相关的公共契约，
 * 不耦合 Leafer，也不耦合 DOM 具体渲染细节。
 */

export interface ContextMenuPoint {
  x: number;
  y: number;
}

export type ContextMenuTargetKind =
  | "canvas"
  | "node"
  | "link"
  | "custom"
  | (string & {});

export interface ContextMenuTarget {
  kind: ContextMenuTargetKind;
  id?: string;
  meta?: Record<string, unknown>;
  data?: unknown;
}

export type ContextMenuTriggerReason =
  | "contextmenu"
  | "click"
  | "hover"
  | "keyboard"
  | "manual";

export interface ContextMenuContext {
  container: HTMLElement;
  host: HTMLElement;
  target: ContextMenuTarget;
  currentTarget?: unknown;
  bindingKey?: string;
  bindingKind?: string;
  bindingMeta?: Record<string, unknown>;
  event?: unknown;
  originEvent?: unknown;
  triggerReason: ContextMenuTriggerReason;
  worldPoint?: ContextMenuPoint;
  pagePoint: ContextMenuPoint;
  clientPoint: ContextMenuPoint;
  containerPoint: ContextMenuPoint;
  boxPoint?: ContextMenuPoint;
  localPoint?: ContextMenuPoint;
  data?: Record<string, unknown>;
}

export type ContextMenuRenderableIcon =
  | string
  | Node
  | ((ownerDocument: Document) => Node);

export interface ContextMenuItemBase {
  key: string;
  label?: string;
  description?: string;
  icon?: ContextMenuRenderableIcon;
  shortcut?: string;
  disabled?: boolean;
  hidden?: boolean;
  danger?: boolean;
  closeOnSelect?: boolean;
  order?: number;
  targetKinds?: readonly string[];
  excludeTargetKinds?: readonly string[];
  when?(context: ContextMenuContext): boolean;
  enableWhen?(context: ContextMenuContext): boolean;
}

export interface ContextMenuActionItem extends ContextMenuItemBase {
  kind?: "action";
  onSelect?(context: ContextMenuContext): void | Promise<void>;
}

export interface ContextMenuSeparatorItem {
  kind: "separator";
  key?: string;
  hidden?: boolean;
  order?: number;
}

export interface ContextMenuGroupItem extends ContextMenuItemBase {
  kind: "group";
  children: ContextMenuItem[];
}

export type ContextMenuLazyChildrenResolver = (
  context: ContextMenuContext
) => ContextMenuItem[] | Promise<ContextMenuItem[]>;

export type SubmenuTriggerMode = "hover" | "click" | "hover+click";

export interface ContextMenuSubmenuItem extends ContextMenuItemBase {
  kind: "submenu";
  children?: ContextMenuItem[];
  lazyChildren?: ContextMenuLazyChildrenResolver;
  submenuTriggerMode?: SubmenuTriggerMode;
  openDelay?: number;
  closeDelay?: number;
}

export interface ContextMenuCheckboxItem extends ContextMenuItemBase {
  kind: "checkbox";
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?(
    checked: boolean,
    context: ContextMenuContext
  ): void | Promise<void>;
}

export interface ContextMenuRadioItem extends ContextMenuItemBase {
  kind: "radio";
  groupKey: string;
  value: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?(
    checked: boolean,
    context: ContextMenuContext
  ): void | Promise<void>;
}

export type ContextMenuItem =
  | ContextMenuActionItem
  | ContextMenuSeparatorItem
  | ContextMenuGroupItem
  | ContextMenuSubmenuItem
  | ContextMenuCheckboxItem
  | ContextMenuRadioItem;

export type ContextMenuResolver = (
  context: ContextMenuContext
) => ContextMenuItem[] | null | undefined;

export interface ContextMenuOpenState {
  open: boolean;
  context: ContextMenuContext | null;
  items: readonly ContextMenuItem[];
  openPath: readonly string[];
  focusedKeys: readonly (string | null)[];
}

export interface ContextMenuAdapter {
  connect(controller: ContextMenuController): () => void;
  destroy(): void;
}

export interface ContextMenuRenderer {
  connect(controller: ContextMenuController): () => void;
  destroy(): void;
}

export interface CreateContextMenuControllerOptions {
  resolveItems?: ContextMenuResolver;
  onBeforeOpen?(context: ContextMenuContext): boolean | void;
  onOpen?(context: ContextMenuContext): void;
  onClose?(context?: ContextMenuContext): void;
  submenuTriggerMode?: SubmenuTriggerMode;
  openDelay?: number;
  closeDelay?: number;
  controlledOpenPath?: readonly string[];
  onOpenPathChange?(openPath: readonly string[]): void;
  adapters?: ContextMenuAdapter[];
  renderer?: ContextMenuRenderer;
}

export interface ContextMenuController {
  getState(): ContextMenuOpenState;
  subscribe(listener: (state: ContextMenuOpenState) => void): () => void;
  setResolver(resolver?: ContextMenuResolver): void;
  open(context: ContextMenuContext, items?: ContextMenuItem[]): void;
  close(): void;
  setOpenPath(openPath: readonly string[]): void;
  closeToLevel(level: number): void;
  setFocusedKey(level: number, key: string | null): void;
  focusNext(level: number): void;
  focusPrevious(level: number): void;
  focusHome(level: number): void;
  focusEnd(level: number): void;
  activateItem(item: ContextMenuItem): Promise<void>;
  activateFocused(level: number): Promise<void>;
  activateKey(level: number, key: string): Promise<void>;
  setControlledOpenPath(openPath?: readonly string[] | null): void;
  getSubmenuTriggerMode(
    item?: ContextMenuSubmenuItem
  ): SubmenuTriggerMode;
  getOpenDelay(item?: ContextMenuSubmenuItem): number;
  getCloseDelay(item?: ContextMenuSubmenuItem): number;
  destroy(): void;
}
