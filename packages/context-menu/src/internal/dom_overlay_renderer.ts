/**
 * 默认 DOM 右键菜单渲染器。
 *
 * @remarks
 * 这层只负责：
 * - 把 headless controller 状态映射成 DOM
 * - 处理键盘、焦点、ARIA 和定位
 * - 管理 outside click / scroll / blur / escape dismiss
 *
 * 它不负责：
 * - 业务菜单项生成
 * - 目标分类解析
 * - Leafer 或 DOM 事件接线
 */

import {
  findContextMenuItemByPath,
  flattenContextMenuLevelItems,
  isFocusableContextMenuItem,
  resolveContextMenuLevelItems
} from "../core/normalize";
import type { LeaferGraphContextMenuThemeTokens } from "@leafergraph/theme/context-menu";
import type {
  ContextMenuController,
  ContextMenuItem,
  ContextMenuOpenState,
  ContextMenuRenderableIcon,
  ContextMenuRenderer,
  ContextMenuSubmenuItem
} from "../core/types";

const CONTEXT_MENU_STYLE_ID = "leafergraph-context-menu-style";
const CONTEXT_MENU_ROOT_CLASS = "leafergraph-context-menu";
const TYPEAHEAD_RESET_MS = 500;
const ROOT_PANEL_MARGIN = 10;
const SUBMENU_PANEL_GAP = 6;

const CONTEXT_MENU_STYLE_TEXT = `
.${CONTEXT_MENU_ROOT_CLASS} {
  --lgcm-font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  --lgcm-bg: rgba(255, 255, 255, 0.96);
  --lgcm-panel-border: rgba(15, 23, 42, 0.08);
  --lgcm-shadow: 0 18px 42px rgba(15, 23, 42, 0.18);
  --lgcm-color: #0f172a;
  --lgcm-muted: #64748b;
  --lgcm-hover-bg: rgba(37, 99, 235, 0.12);
  --lgcm-danger: #b42318;
  --lgcm-separator: rgba(148, 163, 184, 0.22);
  --lgcm-check: #2563eb;
  --lgcm-panel-radius: 14px;
  --lgcm-panel-padding: 8px;
  --lgcm-panel-min-width: 220px;
  --lgcm-panel-max-width: 320px;
  --lgcm-item-radius: 10px;
  --lgcm-item-padding-x: 12px;
  --lgcm-item-padding-y: 10px;
  --lgcm-group-label-padding-x: 12px;
  --lgcm-group-label-padding-top: 6px;
  --lgcm-group-label-padding-bottom: 4px;
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
  user-select: none;
  font-family: var(--lgcm-font-family);
}

.${CONTEXT_MENU_ROOT_CLASS}[data-open="false"] {
  display: none;
}

.${CONTEXT_MENU_ROOT_CLASS}__panel {
  position: fixed;
  top: 0;
  left: 0;
  min-width: var(--lgcm-panel-min-width);
  max-width: var(--lgcm-panel-max-width);
  padding: var(--lgcm-panel-padding);
  border: 1px solid var(--lgcm-panel-border);
  border-radius: var(--lgcm-panel-radius);
  background: var(--lgcm-bg);
  box-shadow: var(--lgcm-shadow);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  color: var(--lgcm-color);
  pointer-events: auto;
  outline: none;
  transform: translate3d(-9999px, -9999px, 0);
}

.${CONTEXT_MENU_ROOT_CLASS}__group {
  display: grid;
  gap: 2px;
}

.${CONTEXT_MENU_ROOT_CLASS}__group-label {
  padding:
    var(--lgcm-group-label-padding-top)
    var(--lgcm-group-label-padding-x)
    var(--lgcm-group-label-padding-bottom);
  color: var(--lgcm-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}

.${CONTEXT_MENU_ROOT_CLASS}__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--lgcm-item-padding-y) var(--lgcm-item-padding-x);
  border: 0;
  border-radius: var(--lgcm-item-radius);
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    background-color 120ms ease,
    color 120ms ease,
    opacity 120ms ease;
}

.${CONTEXT_MENU_ROOT_CLASS}__item:hover,
.${CONTEXT_MENU_ROOT_CLASS}__item:focus-visible,
.${CONTEXT_MENU_ROOT_CLASS}__item[data-focused="true"] {
  outline: none;
  background: var(--lgcm-hover-bg);
}

.${CONTEXT_MENU_ROOT_CLASS}__item[disabled] {
  opacity: 0.45;
  cursor: default;
}

.${CONTEXT_MENU_ROOT_CLASS}__item[data-danger="true"] {
  color: var(--lgcm-danger);
}

.${CONTEXT_MENU_ROOT_CLASS}__leading,
.${CONTEXT_MENU_ROOT_CLASS}__trailing {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.${CONTEXT_MENU_ROOT_CLASS}__indicator,
.${CONTEXT_MENU_ROOT_CLASS}__arrow,
.${CONTEXT_MENU_ROOT_CLASS}__shortcut,
.${CONTEXT_MENU_ROOT_CLASS}__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  color: var(--lgcm-muted);
  font-size: 11px;
  line-height: 1;
}

.${CONTEXT_MENU_ROOT_CLASS}__indicator[data-checked="true"] {
  color: var(--lgcm-check);
}

.${CONTEXT_MENU_ROOT_CLASS}__content {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.${CONTEXT_MENU_ROOT_CLASS}__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
}

.${CONTEXT_MENU_ROOT_CLASS}__description {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--lgcm-muted);
  font-size: 11px;
  line-height: 1.3;
}

.${CONTEXT_MENU_ROOT_CLASS}__separator {
  height: 1px;
  margin: 6px 4px;
  background: var(--lgcm-separator);
}
`;

export interface CreateDomContextMenuRendererOptions {
  host?: HTMLElement;
  className?: string;
  resolveThemeTokens?():
    | LeaferGraphContextMenuThemeTokens
    | Partial<LeaferGraphContextMenuThemeTokens>
    | null
    | undefined;
}

export interface DomContextMenuRenderer extends ContextMenuRenderer {}

interface ContextMenuKeyboardSelection {
  key: string;
  level: number;
}

type FocusableContextMenuItem = Exclude<
  ContextMenuItem,
  { kind: "separator" } | { kind: "group" }
>;

class DomContextMenuRendererImpl implements DomContextMenuRenderer {
  private readonly host?: HTMLElement;
  private readonly className?: string;
  private readonly resolveThemeTokens?: CreateDomContextMenuRendererOptions["resolveThemeTokens"];
  private controller: ContextMenuController | null = null;
  private state: ContextMenuOpenState = {
    open: false,
    context: null,
    items: [],
    openPath: [],
    focusedKeys: []
  };
  private rootElement: HTMLDivElement | null = null;
  private ownerDocument: Document | null = null;
  private unsubscribe?: () => void;
  private detachGlobals?: () => void;
  private readonly openTimers = new Map<number, number>();
  private readonly closeTimers = new Map<number, number>();
  private typeaheadBuffer = "";
  private lastTypeaheadTimestamp = 0;

  constructor(options: CreateDomContextMenuRendererOptions) {
    this.host = options.host;
    this.className = options.className;
    this.resolveThemeTokens = options.resolveThemeTokens;
  }

  connect(controller: ContextMenuController): () => void {
    this.controller = controller;
    this.unsubscribe = controller.subscribe((nextState) => {
      const previousState = this.state;
      this.state = nextState;
      this.handleStateChange(previousState, nextState);
    });

    return () => {
      this.unsubscribe?.();
      this.unsubscribe = undefined;
      this.destroy();
    };
  }

  destroy(): void {
    this.clearAllTimers();
    this.detachGlobals?.();
    this.detachGlobals = undefined;
    if (this.rootElement?.parentNode) {
      this.rootElement.parentNode.removeChild(this.rootElement);
    }
    this.rootElement = null;
    this.ownerDocument = null;
    this.controller = null;
    this.typeaheadBuffer = "";
    this.lastTypeaheadTimestamp = 0;
  }

  private handleStateChange(
    previousState: ContextMenuOpenState,
    nextState: ContextMenuOpenState
  ): void {
    if (!this.controller) {
      return;
    }

    if (!nextState.open || !nextState.context) {
      this.hide();
      return;
    }

    if (this.shouldRebuildPanels(previousState, nextState)) {
      this.render();
      return;
    }

    this.syncFocusedState();
  }

  private render(): void {
    if (!this.controller) {
      return;
    }

    if (!this.state.open || !this.state.context) {
      this.hide();
      return;
    }

    const ownerDocument = this.resolveOwnerDocument();
    if (!ownerDocument) {
      return;
    }

    injectContextMenuStyle(ownerDocument);
    const rootElement = this.ensureRootElement(ownerDocument);
    this.applyThemeTokens(rootElement);
    rootElement.dataset.open = "true";
    rootElement.setAttribute("aria-hidden", "false");
    this.attachGlobalListeners(ownerDocument);

    const fragment = ownerDocument.createDocumentFragment();
    for (let level = 0; level <= this.state.openPath.length; level += 1) {
      const panel = this.createPanel(level);
      fragment.appendChild(panel);
    }

    rootElement.replaceChildren(fragment);
    this.positionPanels();
    this.syncFocusedState();
  }

  private hide(): void {
    this.clearAllTimers();
    this.typeaheadBuffer = "";
    this.lastTypeaheadTimestamp = 0;
    if (!this.rootElement) {
      return;
    }

    this.rootElement.dataset.open = "false";
    this.rootElement.setAttribute("aria-hidden", "true");
    this.rootElement.replaceChildren();
    this.detachGlobals?.();
    this.detachGlobals = undefined;
  }

  private resolveOwnerDocument(): Document | null {
    if (this.ownerDocument) {
      return this.ownerDocument;
    }

    this.ownerDocument =
      this.host?.ownerDocument ??
      this.state.context?.host.ownerDocument ??
      this.state.context?.container.ownerDocument ??
      (typeof document === "undefined" ? null : document);

    return this.ownerDocument;
  }

  private ensureRootElement(ownerDocument: Document): HTMLDivElement {
    if (this.rootElement) {
      if (!this.rootElement.parentNode) {
        this.resolveHost(ownerDocument).appendChild(this.rootElement);
      }

      return this.rootElement;
    }

    const rootElement = ownerDocument.createElement("div");
    rootElement.className = [CONTEXT_MENU_ROOT_CLASS, this.className]
      .filter(Boolean)
      .join(" ");
    rootElement.dataset.open = "false";
    rootElement.setAttribute("aria-hidden", "true");
    this.applyThemeTokens(rootElement);
    this.resolveHost(ownerDocument).appendChild(rootElement);
    this.rootElement = rootElement;
    return rootElement;
  }

  private resolveHost(ownerDocument: Document): HTMLElement {
    return this.host ?? this.state.context?.host ?? ownerDocument.body ?? this.state.context?.container ?? ownerDocument.documentElement;
  }

  private applyThemeTokens(rootElement: HTMLDivElement): void {
    const themeTokens = this.resolveThemeTokens?.();
    if (!themeTokens) {
      return;
    }

    const styleMap: Array<[keyof LeaferGraphContextMenuThemeTokens, string]> = [
      ["fontFamily", "--lgcm-font-family"],
      ["background", "--lgcm-bg"],
      ["panelBorder", "--lgcm-panel-border"],
      ["shadow", "--lgcm-shadow"],
      ["color", "--lgcm-color"],
      ["muted", "--lgcm-muted"],
      ["hoverBackground", "--lgcm-hover-bg"],
      ["danger", "--lgcm-danger"],
      ["separator", "--lgcm-separator"],
      ["check", "--lgcm-check"],
      ["panelRadius", "--lgcm-panel-radius"],
      ["panelPadding", "--lgcm-panel-padding"],
      ["panelMinWidth", "--lgcm-panel-min-width"],
      ["panelMaxWidth", "--lgcm-panel-max-width"],
      ["itemRadius", "--lgcm-item-radius"],
      ["itemPaddingX", "--lgcm-item-padding-x"],
      ["itemPaddingY", "--lgcm-item-padding-y"],
      ["groupLabelPaddingX", "--lgcm-group-label-padding-x"],
      ["groupLabelPaddingTop", "--lgcm-group-label-padding-top"],
      ["groupLabelPaddingBottom", "--lgcm-group-label-padding-bottom"]
    ];

    for (const [tokenKey, cssVariable] of styleMap) {
      const value = themeTokens[tokenKey];
      if (value !== undefined && value !== null) {
        rootElement.style.setProperty(
          cssVariable,
          typeof value === "number" ? `${value}px` : value
        );
      }
    }
  }

  private createPanel(level: number): HTMLDivElement {
    const ownerDocument = this.ownerDocument;
    if (!ownerDocument) {
      throw new Error("缺少右键菜单文档上下文");
    }

    const panel = ownerDocument.createElement("div");
    panel.className = `${CONTEXT_MENU_ROOT_CLASS}__panel`;
    panel.dataset.level = String(level);
    panel.setAttribute("role", "menu");
    panel.tabIndex = -1;
    panel.addEventListener("keydown", (event) => {
      this.handlePanelKeyDown(level, event);
    });
    panel.addEventListener("pointerenter", () => {
      if (level > 0) {
        this.clearCloseTimersThrough(level - 1);
      }
    });
    panel.addEventListener("pointerleave", () => {
      if (level > 0) {
        this.scheduleClose(level - 1, this.getParentSubmenu(level));
      }
    });

    const levelItems = resolveContextMenuLevelItems(
      this.state.items,
      this.state.openPath.slice(0, level)
    );

    for (const item of levelItems) {
      panel.appendChild(this.createLevelItem(item, level));
    }

    return panel;
  }

  private createLevelItem(item: ContextMenuItem, level: number): Node {
    if (item.kind === "separator") {
      return this.createSeparatorElement(item.key);
    }

    if (item.kind === "group") {
      return this.createGroupElement(item, level);
    }

    return this.createInteractiveItemElement(item, level);
  }

  private createSeparatorElement(key?: string): HTMLDivElement {
    const ownerDocument = this.ownerDocument;
    if (!ownerDocument) {
      throw new Error("缺少右键菜单文档上下文");
    }

    const separator = ownerDocument.createElement("div");
    separator.className = `${CONTEXT_MENU_ROOT_CLASS}__separator`;
    separator.setAttribute("role", "separator");
    if (key) {
      separator.dataset.key = key;
    }
    return separator;
  }

  private createGroupElement(
    item: Extract<ContextMenuItem, { kind: "group" }>,
    level: number
  ): HTMLDivElement {
    const ownerDocument = this.ownerDocument;
    if (!ownerDocument) {
      throw new Error("缺少右键菜单文档上下文");
    }

    const group = ownerDocument.createElement("div");
    group.className = `${CONTEXT_MENU_ROOT_CLASS}__group`;
    group.setAttribute("role", "group");
    if (item.label) {
      const label = ownerDocument.createElement("div");
      label.className = `${CONTEXT_MENU_ROOT_CLASS}__group-label`;
      label.textContent = item.label;
      group.appendChild(label);
    }

    for (const child of item.children) {
      group.appendChild(this.createLevelItem(child, level));
    }

    return group;
  }

  private createInteractiveItemElement(
    item: Exclude<ContextMenuItem, { kind: "separator" } | { kind: "group" }>,
    level: number
  ): HTMLButtonElement {
    const ownerDocument = this.ownerDocument;
    if (!ownerDocument) {
      throw new Error("缺少右键菜单文档上下文");
    }

    const button = ownerDocument.createElement("button");
    button.type = "button";
    button.className = `${CONTEXT_MENU_ROOT_CLASS}__item`;
    button.dataset.key = item.key;
    button.dataset.level = String(level);
    button.dataset.focused = String(this.state.focusedKeys[level] === item.key);
    button.dataset.danger = String(Boolean(item.danger));
    button.tabIndex = this.state.focusedKeys[level] === item.key ? 0 : -1;
    if (item.disabled) {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    }

    if (item.kind === "checkbox") {
      button.setAttribute("role", "menuitemcheckbox");
      button.setAttribute("aria-checked", String(Boolean(item.checked)));
    } else if (item.kind === "radio") {
      button.setAttribute("role", "menuitemradio");
      button.setAttribute("aria-checked", String(Boolean(item.checked)));
    } else {
      button.setAttribute("role", "menuitem");
    }

    if (item.kind === "submenu") {
      button.setAttribute("aria-haspopup", "menu");
      button.setAttribute(
        "aria-expanded",
        String(this.state.openPath[level] === item.key)
      );
    }

    const leading = this.createLeadingElement(item);
    if (leading) {
      button.appendChild(leading);
    }

    const content = ownerDocument.createElement("span");
    content.className = `${CONTEXT_MENU_ROOT_CLASS}__content`;
    const label = ownerDocument.createElement("span");
    label.className = `${CONTEXT_MENU_ROOT_CLASS}__label`;
    label.textContent = item.label ?? item.key;
    content.appendChild(label);
    if (item.description) {
      const description = ownerDocument.createElement("span");
      description.className = `${CONTEXT_MENU_ROOT_CLASS}__description`;
      description.textContent = item.description;
      content.appendChild(description);
    }
    button.appendChild(content);

    const trailing = this.createTrailingElement(item);
    if (trailing) {
      button.appendChild(trailing);
    }

    button.addEventListener("focus", () => {
      this.controller?.setFocusedKey(level, item.key);
    });
    button.addEventListener("pointerenter", () => {
      this.controller?.setFocusedKey(level, item.key);
      if (item.kind === "submenu") {
        const triggerMode = this.resolveSubmenuTriggerMode(item);
        if (triggerMode !== "click") {
          this.scheduleOpen(level, item);
        }
      } else {
        this.clearCloseTimer(level);
        this.controller?.closeToLevel(level);
      }
    });
    button.addEventListener("pointerleave", () => {
      if (item.kind === "submenu" && this.resolveSubmenuTriggerMode(item) !== "click") {
        this.scheduleClose(level, item);
      }
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (item.disabled) {
        return;
      }

      if (item.kind === "submenu") {
        this.clearCloseTimer(level);
        this.openSubmenu(level, item);
        return;
      }

      void this.controller?.activateItem(item);
    });

    return button;
  }

  private createLeadingElement(
    item: Exclude<ContextMenuItem, { kind: "separator" } | { kind: "group" }>
  ): HTMLSpanElement | null {
    const ownerDocument = this.ownerDocument;
    if (!ownerDocument) {
      throw new Error("缺少右键菜单文档上下文");
    }

    const hasIndicator =
      item.kind === "checkbox" || item.kind === "radio";
    const hasIcon = Boolean(item.icon);
    if (!hasIndicator && !hasIcon) {
      return null;
    }

    const leading = ownerDocument.createElement("span");
    leading.className = `${CONTEXT_MENU_ROOT_CLASS}__leading`;
    leading.setAttribute("aria-hidden", "true");

    if (hasIndicator) {
      const indicator = ownerDocument.createElement("span");
      indicator.className = `${CONTEXT_MENU_ROOT_CLASS}__indicator`;
      if (item.kind === "checkbox") {
        indicator.dataset.checked = String(Boolean(item.checked));
        indicator.textContent = item.checked ? "✓" : "";
      } else {
        indicator.dataset.checked = String(Boolean(item.checked));
        indicator.textContent = item.checked ? "●" : "";
      }
      leading.appendChild(indicator);
    }

    if (hasIcon) {
      leading.appendChild(this.createIconElement(item.icon));
    }

    return leading;
  }

  private createIconElement(icon: ContextMenuRenderableIcon | undefined): HTMLSpanElement {
    const ownerDocument = this.ownerDocument;
    if (!ownerDocument) {
      throw new Error("缺少右键菜单文档上下文");
    }

    const iconElement = ownerDocument.createElement("span");
    iconElement.className = `${CONTEXT_MENU_ROOT_CLASS}__icon`;
    iconElement.setAttribute("aria-hidden", "true");

    if (!icon) {
      iconElement.textContent = "";
      return iconElement;
    }

    if (typeof icon === "string") {
      iconElement.textContent = icon;
      return iconElement;
    }

    const node =
      typeof icon === "function"
        ? icon(ownerDocument)
        : icon.cloneNode(true);
    iconElement.appendChild(node);
    return iconElement;
  }

  private createTrailingElement(
    item: Exclude<ContextMenuItem, { kind: "separator" } | { kind: "group" }>
  ): HTMLSpanElement | null {
    const ownerDocument = this.ownerDocument;
    if (!ownerDocument) {
      throw new Error("缺少右键菜单文档上下文");
    }

    const hasShortcut = Boolean(item.shortcut);
    const hasArrow = item.kind === "submenu";
    if (!hasShortcut && !hasArrow) {
      return null;
    }

    const trailing = ownerDocument.createElement("span");
    trailing.className = `${CONTEXT_MENU_ROOT_CLASS}__trailing`;
    trailing.setAttribute("aria-hidden", "true");

    if (hasShortcut) {
      const shortcut = ownerDocument.createElement("span");
      shortcut.className = `${CONTEXT_MENU_ROOT_CLASS}__shortcut`;
      shortcut.textContent = item.shortcut ?? "";
      trailing.appendChild(shortcut);
    }

    if (hasArrow) {
      const arrow = ownerDocument.createElement("span");
      arrow.className = `${CONTEXT_MENU_ROOT_CLASS}__arrow`;
      arrow.textContent = "›";
      trailing.appendChild(arrow);
    }

    return trailing;
  }

  private handlePanelKeyDown(level: number, event: KeyboardEvent): void {
    if (!this.controller) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.controller.focusNext(level);
        return;
      case "ArrowUp":
        event.preventDefault();
        this.controller.focusPrevious(level);
        return;
      case "Home":
        event.preventDefault();
        this.controller.focusHome(level);
        return;
      case "End":
        event.preventDefault();
        this.controller.focusEnd(level);
        return;
      case "ArrowRight": {
        const selection = this.resolveKeyboardSelection(level);
        if (!selection) {
          return;
        }

        const levelItems = this.resolveFocusableLevelItems(level);
        const item = levelItems.find((currentItem) => currentItem.key === selection.key);
        if (item?.kind === "submenu") {
          event.preventDefault();
          this.openSubmenu(level, item);
          queueMicrotask(() => {
            this.controller?.focusHome(level + 1);
          });
        }
        return;
      }
      case "ArrowLeft":
        if (level > 0) {
          event.preventDefault();
          this.controller.closeToLevel(level - 1);
          queueMicrotask(() => {
            const parentKey = this.state.openPath[level - 1];
            if (parentKey) {
              this.controller?.setFocusedKey(level - 1, parentKey);
            }
          });
        }
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        void this.controller.activateFocused(level);
        return;
      case "Escape":
        event.preventDefault();
        this.controller.close();
        return;
      default:
        if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
          const matchedItem = this.resolveTypeaheadMatch(level, event.key);
          if (matchedItem) {
            event.preventDefault();
            this.controller.setFocusedKey(level, matchedItem.key);
          }
        }
    }
  }

  private resolveKeyboardSelection(level: number): ContextMenuKeyboardSelection | null {
    const key = this.state.focusedKeys[level];
    if (!key) {
      return null;
    }

    return { key, level };
  }

  private resolveTypeaheadMatch(
    level: number,
    input: string
  ): FocusableContextMenuItem | undefined {
    const normalizedInput = input.trim().toLowerCase();
    if (!normalizedInput) {
      return undefined;
    }

    const now = Date.now();
    if (now - this.lastTypeaheadTimestamp > TYPEAHEAD_RESET_MS) {
      this.typeaheadBuffer = normalizedInput;
    } else {
      this.typeaheadBuffer += normalizedInput;
    }
    this.lastTypeaheadTimestamp = now;

    const items = this.resolveFocusableLevelItems(level);
    if (!items.length) {
      return undefined;
    }

    const currentIndex = items.findIndex(
      (item) => item.key === this.state.focusedKeys[level]
    );
    const orderedItems =
      currentIndex >= 0
        ? [...items.slice(currentIndex + 1), ...items.slice(0, currentIndex + 1)]
        : items;

    return orderedItems.find((item) =>
      (item.label ?? item.key).toLowerCase().startsWith(this.typeaheadBuffer)
    );
  }

  private resolveFocusableLevelItems(level: number): Array<
    FocusableContextMenuItem
  > {
    const levelItems = resolveContextMenuLevelItems(
      this.state.items,
      this.state.openPath.slice(0, level)
    );

    return flattenContextMenuLevelItems(levelItems).filter(isFocusableContextMenuItem);
  }

  private openSubmenu(level: number, item: ContextMenuSubmenuItem): void {
    if (!this.controller) {
      return;
    }

    const nextOpenPath = [...this.state.openPath.slice(0, level), item.key];
    this.controller.setOpenPath(nextOpenPath);
    queueMicrotask(() => {
      this.controller?.focusHome(level + 1);
    });
  }

  private scheduleOpen(level: number, item: ContextMenuSubmenuItem): void {
    this.clearOpenTimer(level);
    this.clearCloseTimer(level);
    const ownerWindow = this.ownerDocument?.defaultView;
    if (!ownerWindow) {
      this.openSubmenu(level, item);
      return;
    }

    const timerId = ownerWindow.setTimeout(() => {
      this.openSubmenu(level, item);
      this.openTimers.delete(level);
    }, this.controller?.getOpenDelay(item) ?? 0);

    this.openTimers.set(level, timerId);
  }

  private scheduleClose(level: number, item?: ContextMenuSubmenuItem): void {
    if (!this.controller || level < 0) {
      return;
    }

    this.clearCloseTimer(level);
    const ownerWindow = this.ownerDocument?.defaultView;
    if (!ownerWindow) {
      this.controller.closeToLevel(level);
      return;
    }

    const timerId = ownerWindow.setTimeout(() => {
      this.controller?.closeToLevel(level);
      this.closeTimers.delete(level);
    }, this.controller.getCloseDelay(item));

    this.closeTimers.set(level, timerId);
  }

  private clearOpenTimer(level: number): void {
    const timerId = this.openTimers.get(level);
    if (timerId === undefined || !this.ownerDocument?.defaultView) {
      return;
    }

    this.ownerDocument.defaultView.clearTimeout(timerId);
    this.openTimers.delete(level);
  }

  private clearCloseTimer(level: number): void {
    const timerId = this.closeTimers.get(level);
    if (timerId === undefined || !this.ownerDocument?.defaultView) {
      return;
    }

    this.ownerDocument.defaultView.clearTimeout(timerId);
    this.closeTimers.delete(level);
  }

  /**
   * 进入更深层 submenu panel 时，需要把祖先链上还没执行的关闭定时器一起清掉。
   *
   * 例如从二级 panel 进入三级 panel 时：
   * - 当前 submenu item 的 `pointerleave` 会挂一个“关闭二级 submenu”的定时器
   * - 二级 panel 自己的 `pointerleave` 还会挂一个“关闭一级 submenu”的定时器
   *
   * 如果这里只清理最里层那一个，祖先层的延迟关闭仍会生效，表现出来就是
   * “三级及以上 submenu 一 hover 就自己收回去”。
   */
  private clearCloseTimersThrough(maxLevel: number): void {
    for (let level = 0; level <= maxLevel; level += 1) {
      this.clearCloseTimer(level);
    }
  }

  private clearAllTimers(): void {
    const ownerWindow = this.ownerDocument?.defaultView;
    if (ownerWindow) {
      for (const timerId of this.openTimers.values()) {
        ownerWindow.clearTimeout(timerId);
      }
      for (const timerId of this.closeTimers.values()) {
        ownerWindow.clearTimeout(timerId);
      }
    }

    this.openTimers.clear();
    this.closeTimers.clear();
  }

  private getParentSubmenu(level: number): ContextMenuSubmenuItem | undefined {
    const item = findContextMenuItemByPath(
      this.state.items,
      this.state.openPath.slice(0, level)
    );

    return item?.kind === "submenu" ? item : undefined;
  }

  private resolveSubmenuTriggerMode(item: ContextMenuSubmenuItem): "hover" | "click" | "hover+click" {
    if (this.isCoarsePointer()) {
      return "click";
    }

    return this.controller?.getSubmenuTriggerMode(item) ?? "hover+click";
  }

  private isCoarsePointer(): boolean {
    const ownerWindow = this.ownerDocument?.defaultView;
    if (!ownerWindow) {
      return false;
    }

    // 混合设备上常见 `maxTouchPoints > 0`，但只要存在可 hover 的细指针，
    // 子菜单仍应保持桌面端 hover 体验，不能一刀切退化成 click。
    if (ownerWindow.matchMedia?.("(any-hover: hover)").matches) {
      return false;
    }

    if (ownerWindow.matchMedia?.("(pointer: coarse)").matches) {
      return true;
    }

    return (
      ownerWindow.matchMedia?.("(hover: none)").matches &&
      (ownerWindow.navigator.maxTouchPoints ?? 0) > 0
    );
  }

  private attachGlobalListeners(ownerDocument: Document): void {
    if (this.detachGlobals) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      if (!this.state.open) {
        return;
      }

      if (this.rootElement?.contains(event.target as Node)) {
        return;
      }

      this.controller?.close();
    };

    const handleContextMenu = (event: MouseEvent): void => {
      if (!this.state.open) {
        return;
      }

      if (this.rootElement?.contains(event.target as Node)) {
        event.preventDefault();
        return;
      }

      this.controller?.close();
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!this.state.open || event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      this.controller?.close();
    };

    const handleDismiss = (): void => {
      if (this.state.open) {
        this.controller?.close();
      }
    };

    ownerDocument.addEventListener("pointerdown", handlePointerDown, true);
    ownerDocument.addEventListener("contextmenu", handleContextMenu, true);
    ownerDocument.addEventListener("keydown", handleKeyDown, true);

    const ownerWindow = ownerDocument.defaultView;
    ownerWindow?.addEventListener("resize", handleDismiss);
    ownerWindow?.addEventListener("blur", handleDismiss);
    ownerWindow?.addEventListener("scroll", handleDismiss, true);

    this.detachGlobals = () => {
      ownerDocument.removeEventListener("pointerdown", handlePointerDown, true);
      ownerDocument.removeEventListener("contextmenu", handleContextMenu, true);
      ownerDocument.removeEventListener("keydown", handleKeyDown, true);
      ownerWindow?.removeEventListener("resize", handleDismiss);
      ownerWindow?.removeEventListener("blur", handleDismiss);
      ownerWindow?.removeEventListener("scroll", handleDismiss, true);
    };
  }

  private positionPanels(): void {
    const ownerDocument = this.ownerDocument;
    const rootElement = this.rootElement;
    if (!ownerDocument || !rootElement || !this.state.context) {
      return;
    }

    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow) {
      return;
    }

    const rootPanel = rootElement.querySelector<HTMLDivElement>(
      `.${CONTEXT_MENU_ROOT_CLASS}__panel[data-level="0"]`
    );
    if (!rootPanel) {
      return;
    }

    this.positionRootPanel(rootPanel, ownerWindow);
    for (let level = 1; level <= this.state.openPath.length; level += 1) {
      const panel = rootElement.querySelector<HTMLDivElement>(
        `.${CONTEXT_MENU_ROOT_CLASS}__panel[data-level="${level}"]`
      );
      const trigger = rootElement.querySelector<HTMLElement>(
        `.${CONTEXT_MENU_ROOT_CLASS}__item[data-level="${level - 1}"][data-key="${this.state.openPath[level - 1]}"]`
      );

      if (!panel || !trigger) {
        continue;
      }

      this.positionSubmenuPanel(panel, trigger, ownerWindow);
    }
  }

  private positionRootPanel(panel: HTMLDivElement, ownerWindow: Window): void {
    const bounds = panel.getBoundingClientRect();
    const maxX = Math.max(
      ROOT_PANEL_MARGIN,
      ownerWindow.innerWidth - bounds.width - ROOT_PANEL_MARGIN
    );
    const maxY = Math.max(
      ROOT_PANEL_MARGIN,
      ownerWindow.innerHeight - bounds.height - ROOT_PANEL_MARGIN
    );

    const nextX = clamp(
      this.state.context?.clientPoint.x ?? 0,
      ROOT_PANEL_MARGIN,
      maxX
    );
    const nextY = clamp(
      this.state.context?.clientPoint.y ?? 0,
      ROOT_PANEL_MARGIN,
      maxY
    );

    applyPanelPosition(panel, nextX, nextY);
  }

  private positionSubmenuPanel(
    panel: HTMLDivElement,
    trigger: HTMLElement,
    ownerWindow: Window
  ): void {
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const preferredRight = triggerRect.right + SUBMENU_PANEL_GAP;
    const fallbackLeft = triggerRect.left - panelRect.width - SUBMENU_PANEL_GAP;
    const x =
      preferredRight + panelRect.width <= ownerWindow.innerWidth - ROOT_PANEL_MARGIN ||
      fallbackLeft < ROOT_PANEL_MARGIN
        ? preferredRight
        : fallbackLeft;
    const nextY = clamp(
      triggerRect.top,
      ROOT_PANEL_MARGIN,
      Math.max(
        ROOT_PANEL_MARGIN,
        ownerWindow.innerHeight - panelRect.height - ROOT_PANEL_MARGIN
      )
    );

    applyPanelPosition(
      panel,
      clamp(
        x,
        ROOT_PANEL_MARGIN,
        Math.max(
          ROOT_PANEL_MARGIN,
          ownerWindow.innerWidth - panelRect.width - ROOT_PANEL_MARGIN
        )
      ),
      nextY
    );
  }

  private syncFocusedElement(): void {
    const rootElement = this.rootElement;
    const ownerDocument = this.ownerDocument;
    if (!rootElement || !ownerDocument) {
      return;
    }

    const activeLevel = this.state.openPath.length;
    const focusedKey = this.state.focusedKeys[activeLevel];
    if (!focusedKey) {
      return;
    }

    const targetElement = rootElement.querySelector<HTMLButtonElement>(
      `.${CONTEXT_MENU_ROOT_CLASS}__item[data-level="${activeLevel}"][data-key="${focusedKey}"]`
    );
    if (!targetElement) {
      return;
    }

    const activeElement = ownerDocument.activeElement;
    if (activeElement === targetElement) {
      return;
    }

    targetElement.focus({ preventScroll: true });
  }

  private shouldRebuildPanels(
    previousState: ContextMenuOpenState,
    nextState: ContextMenuOpenState
  ): boolean {
    if (!previousState.open || !previousState.context) {
      return true;
    }

    if (previousState.context !== nextState.context) {
      return true;
    }

    if (previousState.items !== nextState.items) {
      return true;
    }

    return !isSameStringArray(previousState.openPath, nextState.openPath);
  }

  private syncFocusedState(): void {
    const rootElement = this.rootElement;
    if (!rootElement) {
      return;
    }

    const itemElements = rootElement.querySelectorAll<HTMLButtonElement>(
      `.${CONTEXT_MENU_ROOT_CLASS}__item[data-level][data-key]`
    );

    for (const itemElement of itemElements) {
      const level = Number(itemElement.dataset.level ?? "-1");
      const itemKey = itemElement.dataset.key ?? "";
      const isFocused =
        level >= 0 && this.state.focusedKeys[level] === itemKey;

      itemElement.dataset.focused = String(isFocused);
      itemElement.tabIndex = isFocused ? 0 : -1;
    }

    this.syncFocusedElement();
  }
}

export function createDomContextMenuRenderer(
  options: CreateDomContextMenuRendererOptions = {}
): DomContextMenuRenderer {
  return new DomContextMenuRendererImpl(options);
}

function injectContextMenuStyle(ownerDocument: Document): void {
  if (ownerDocument.getElementById(CONTEXT_MENU_STYLE_ID)) {
    return;
  }

  const style = ownerDocument.createElement("style");
  style.id = CONTEXT_MENU_STYLE_ID;
  style.textContent = CONTEXT_MENU_STYLE_TEXT;
  ownerDocument.head?.appendChild(style);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isSameStringArray(
  left: readonly string[],
  right: readonly string[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function applyPanelPosition(
  panel: HTMLDivElement,
  x: number,
  y: number
): void {
  const userAgent = panel.ownerDocument.defaultView?.navigator.userAgent ?? "";
  if (
    userAgent.includes("HappyDOM") ||
    "happyDOM" in panel.ownerDocument.defaultView!
  ) {
    panel.dataset.position = `${x},${y}`;
    return;
  }

  panel.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}
