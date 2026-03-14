import { Matrix, Text } from "leafer-ui";
import { Editor, InnerEditor, registerInnerEditor } from "@leafer-in/editor";
import "@leafer-in/text-editor";
import type { App } from "leafer-ui";
import type {
  LeaferGraphWidgetTextEditFrame,
  LeaferGraphThemeMode,
  LeaferGraphWidgetEditingContext,
  LeaferGraphWidgetEditingOptions,
  LeaferGraphWidgetFocusBinding,
  LeaferGraphWidgetOptionsMenuRequest,
  LeaferGraphWidgetTextEditRequest,
  LeaferGraphWidgetThemeContext
} from "./plugin";

const LEAFER_GRAPH_WIDGET_OVERLAY_STYLE_ID = "leafergraph-widget-overlay-style";
const LEAFER_GRAPH_WIDGET_MENU_CLASS = "leafergraph-widget-menu";
const LEAFER_GRAPH_WIDGET_MENU_ITEM_CLASS = "leafergraph-widget-menu__item";
const LEAFER_GRAPH_WIDGET_MENU_ITEM_ACTIVE_CLASS =
  "leafergraph-widget-menu__item--active";
const LEAFER_GRAPH_WIDGET_EDITOR_CLASS = "leafergraph-widget-text-editor";
const LEAFER_GRAPH_WIDGET_EDITOR_TAG = "LeaferGraphWidgetTextEditor";
const LEAFER_GRAPH_WIDGET_EDIT_META = "__leaferGraphWidgetEditMeta";

type EditorHostApp = App;

interface TextEditRuntimeMeta {
  request: LeaferGraphWidgetTextEditRequest;
  manager: LeaferGraphWidgetEditingManager;
  originalValue: string;
  cancelled: boolean;
}

type LeaferGraphEditableText = Text & {
  editInner?: string;
  app?: EditorHostApp;
  worldTransform: {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
    scaleX?: number;
    scaleY?: number;
  };
  __?: Record<string, unknown>;
  [LEAFER_GRAPH_WIDGET_EDIT_META]?: TextEditRuntimeMeta;
};

interface ActiveOptionsMenuState {
  request: LeaferGraphWidgetOptionsMenuRequest;
  key: string;
  root: HTMLDivElement;
  items: HTMLButtonElement[];
  activeIndex: number;
}

function createWidgetFocusKey(nodeId: string, widgetIndex: number): string {
  return `${nodeId}:${widgetIndex}`;
}

function isHTMLElement(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement;
}

/** 判断当前按键是否属于 Widget 聚焦时应优先截获的组合。 */
function isReservedWidgetFocusKey(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey) {
    return true;
  }

  switch (event.key) {
    case " ":
    case "Enter":
    case "Escape":
    case "Delete":
    case "Backspace":
    case "ArrowUp":
    case "ArrowDown":
    case "ArrowLeft":
    case "ArrowRight":
    case "Home":
    case "End":
    case "PageUp":
    case "PageDown":
      return true;
    default:
      return false;
  }
}

/**
 * 为 Widget 文本编辑注入一个基于 Leafer InnerEditor 的专用实现。
 * 这层仍然建立在官方 editor 链路上，只是补齐了节点控件需要的
 * `Enter 提交 / Esc 取消 / placeholder / maxLength` 语义。
 */
class LeaferGraphWidgetTextEditor extends InnerEditor {
  declare public editTarget: LeaferGraphEditableText;

  public get tag(): string {
    return LEAFER_GRAPH_WIDGET_EDITOR_TAG;
  }

  public editDom!: HTMLDivElement;

  private handleDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (isHTMLElement(target) && this.editDom.contains(target)) {
      return;
    }

    this.editor.closeInnerEditor();
  };

  private handleWindowKeyDown = (event: KeyboardEvent): void => {
    const meta = this.editTarget[LEAFER_GRAPH_WIDGET_EDIT_META];
    if (!meta) {
      return;
    }

    if (event.key === "Escape") {
      meta.cancelled = true;
      event.preventDefault();
      event.stopPropagation();
      this.editor.closeInnerEditor();
      return;
    }

    if (!meta.request.multiline && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      this.editor.closeInnerEditor();
    }
  };

  private handleInput = (): void => {
    const meta = this.editTarget[LEAFER_GRAPH_WIDGET_EDIT_META];
    if (!meta) {
      return;
    }

    let value = this.readEditValue();
    if (typeof meta.request.maxLength === "number" && meta.request.maxLength > 0) {
      value = value.slice(0, meta.request.maxLength);
      if (value !== this.readEditValue()) {
        this.writeEditValue(value);
      }
    }

    if (!meta.request.multiline) {
      const singleLineValue = value.replace(/\r?\n/g, " ");
      if (singleLineValue !== value) {
        value = singleLineValue;
        this.writeEditValue(value);
      }
    }

    this.editTarget.text = value;
  };

  public onLoad(): void {
    const meta = this.editTarget[LEAFER_GRAPH_WIDGET_EDIT_META];
    if (!meta) {
      return;
    }

    const div = document.createElement("div");
    this.editDom = div;
    div.className = LEAFER_GRAPH_WIDGET_EDITOR_CLASS;
    div.contentEditable = String(!meta.request.readOnly);
    div.dataset.placeholder = meta.request.placeholder ?? "";
    div.dataset.multiline = meta.request.multiline ? "true" : "false";
    div.dataset.readOnly = meta.request.readOnly ? "true" : "false";
    div.style.position = "fixed";
    div.style.transformOrigin = "left top";
    div.style.boxSizing = "border-box";
    div.style.whiteSpace = meta.request.multiline ? "pre-wrap" : "nowrap";
    div.style.overflowWrap = "break-word";
    div.style.pointerEvents = "auto";
    div.style.userSelect = "text";

    this.writeEditValue(meta.request.value);
    meta.manager.applyTextEditorTheme(
      div,
      Boolean(meta.request.multiline),
      meta.request.frame
    );

    document.body.appendChild(div);
    document.addEventListener("pointerdown", this.handleDocumentPointerDown, true);
    window.addEventListener("keydown", this.handleWindowKeyDown, true);
    div.addEventListener("input", this.handleInput);

    this.onUpdate();

    queueMicrotask(() => {
      div.focus();

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(div);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  }

  public onUpdate(): void {
    const { editTarget: text } = this;
    const meta = text[LEAFER_GRAPH_WIDGET_EDIT_META];
    const appBounds =
      text.app?.view instanceof HTMLCanvasElement
        ? text.app.clientBounds
        : text.app?.tree.clientBounds;

    if (!appBounds || !this.editDom || !meta) {
      return;
    }

    const rawScaleX = text.worldTransform.scaleX ?? text.worldTransform.a ?? 1;
    const rawScaleY = text.worldTransform.scaleY ?? text.worldTransform.d ?? 1;
    const fontSize = text.fontSize ?? 12;
    const textWidth = text.width ?? 0;
    const textHeight = text.height ?? fontSize * 1.4;
    const frame = meta.request.frame;
    let textScale = Math.max(Math.abs(rawScaleX), Math.abs(rawScaleY), 1);

    if (fontSize * textScale < 12) {
      textScale *= 12 / Math.max(fontSize, 1);
    }

    let width = Math.max((frame?.width ?? textWidth) * textScale, 24);
    let height = Math.max(
      (frame?.height ?? textHeight) * textScale,
      fontSize * textScale * 1.4
    );
    let offsetX = frame?.offsetX ?? 0;
    let offsetY = frame?.offsetY ?? 0;

    const data = text.__ ?? {};
    if (data.__autoWidth) {
      width += 20;
      switch (data.textAlign) {
        case "center":
          offsetX = data.autoSizeAlign ? -width / 2 : -10;
          break;
        case "right":
          offsetX = data.autoSizeAlign ? -width : -20;
          break;
        default:
          break;
      }
    }

    if (data.__autoHeight) {
      height += 20;
      switch (data.verticalAlign) {
        case "middle":
          offsetY = data.autoSizeAlign ? -height / 2 : -10;
          break;
        case "bottom":
          offsetY = data.autoSizeAlign ? -height : -20;
          break;
        default:
          break;
      }
    }

    const matrix = new Matrix(text.worldTransform)
      .scale(1 / textScale)
      .translateInner(offsetX, offsetY);

    this.editDom.style.transform = `matrix(${matrix.a},${matrix.b},${matrix.c},${matrix.d},${matrix.e},${matrix.f})`;
    this.editDom.style.left = `${appBounds.x}px`;
    this.editDom.style.top = `${appBounds.y}px`;
    this.editDom.style.width = `${width}px`;
    this.editDom.style.height = `${height}px`;
    this.editDom.style.lineHeight = meta.request.multiline
      ? `${Math.max(fontSize * textScale * 1.5, 20)}px`
      : `${Math.max(textHeight * textScale, fontSize * textScale, 18)}px`;
    this.editDom.style.fontFamily = text.fontFamily || "Inter, sans-serif";
    this.editDom.style.fontSize = `${Math.max(fontSize * textScale, 12)}px`;
  }

  public onUnload(): void {
    const meta = this.editTarget[LEAFER_GRAPH_WIDGET_EDIT_META];
    if (!meta) {
      return;
    }

    document.removeEventListener("pointerdown", this.handleDocumentPointerDown, true);
    window.removeEventListener("keydown", this.handleWindowKeyDown, true);
    this.editDom.removeEventListener("input", this.handleInput);

    const finalValue = this.readEditValue();
    if (meta.cancelled) {
      this.editTarget.text = meta.originalValue;
      meta.request.onCancel?.(meta.originalValue);
    } else {
      this.editTarget.text = finalValue;
      meta.request.onCommit(finalValue);
    }

    this.editDom.remove();
    delete this.editTarget[LEAFER_GRAPH_WIDGET_EDIT_META];
    meta.manager.notifyTextEditorClosed();
  }

  private readEditValue(): string {
    return (this.editDom.innerText || "").replace(/\r\n?/g, "\n");
  }

  private writeEditValue(value: string): void {
    this.editDom.innerText = value;
  }
}

registerInnerEditor()(LeaferGraphWidgetTextEditor as unknown as Record<string, unknown>);

/**
 * Widget 编辑宿主。
 * 统一管理三类行为：
 * 1. 基于 Leafer InnerEditor 的真实文本编辑
 * 2. select 等离散控件的 DOM 候选菜单
 * 3. canvas Widget 的焦点与键盘事件转发
 */
export class LeaferGraphWidgetEditingManager
  implements LeaferGraphWidgetEditingContext
{
  readonly enabled: boolean;

  private readonly app: EditorHostApp;
  private readonly container: HTMLElement;
  private readonly options: Required<LeaferGraphWidgetEditingOptions>;
  private theme: LeaferGraphWidgetThemeContext;
  private editor: Editor | null = null;
  private followEditorFrame = 0;
  private focusedWidgetKey: string | null = null;
  private readonly focusBindings = new Map<string, LeaferGraphWidgetFocusBinding>();
  private activeMenu: ActiveOptionsMenuState | null = null;
  private readonly ownerWindow: Window;

  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target;

    if (isHTMLElement(target)) {
      const editorDom = this.getActiveEditorDom();
      if (editorDom?.contains(target) || this.activeMenu?.root.contains(target)) {
        return;
      }
    }

    if (this.activeMenu) {
      this.closeOptionsMenu();
    }

    this.clearWidgetFocus();
  };

  private readonly handleWindowKeyDown = (event: KeyboardEvent): void => {
    if (this.activeMenu) {
      return;
    }

    const target = event.target;
    if (target instanceof HTMLElement && target.isContentEditable) {
      return;
    }

    if (!this.focusedWidgetKey) {
      return;
    }

    const binding = this.focusBindings.get(this.focusedWidgetKey);
    const handled = binding?.onKeyDown?.(event) ?? false;
    if (handled || isReservedWidgetFocusKey(event)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  constructor(options: {
    app: App;
    container: HTMLElement;
    theme: LeaferGraphWidgetThemeContext;
    editing?: LeaferGraphWidgetEditingOptions;
  }) {
    this.app = options.app as EditorHostApp;
    this.container = options.container;
    this.theme = options.theme;
    this.ownerWindow = this.container.ownerDocument.defaultView ?? window;
    this.options = {
      enabled: options.editing?.enabled ?? false,
      useOfficialTextEditor: options.editing?.useOfficialTextEditor ?? true,
      allowOptionsMenu: options.editing?.allowOptionsMenu ?? true
    };
    this.enabled = this.options.enabled;

    this.ensureOverlayStyle();
    this.ownerWindow.document.addEventListener(
      "pointerdown",
      this.handleDocumentPointerDown,
      true
    );
    this.ownerWindow.addEventListener("keydown", this.handleWindowKeyDown, true);
  }

  beginTextEdit(request: LeaferGraphWidgetTextEditRequest): boolean {
    if (
      !this.enabled ||
      !this.options.useOfficialTextEditor ||
      request.readOnly
    ) {
      return false;
    }

    this.closeActiveEditor();
    const editor = this.ensureEditor();
    const target = request.target as LeaferGraphEditableText;

    target.text = request.value;
    target.editInner = LEAFER_GRAPH_WIDGET_EDITOR_TAG;
    target[LEAFER_GRAPH_WIDGET_EDIT_META] = {
      request,
      manager: this,
      originalValue: request.value,
      cancelled: false
    };

    this.focusWidget(createWidgetFocusKey(request.nodeId, request.widgetIndex));
    editor.select(target);
    editor.openInnerEditor(target, LEAFER_GRAPH_WIDGET_EDITOR_TAG);

    if (!editor.innerEditing) {
      delete target[LEAFER_GRAPH_WIDGET_EDIT_META];
      return false;
    }

    this.startEditorFollowLoop();
    return true;
  }

  openOptionsMenu(request: LeaferGraphWidgetOptionsMenuRequest): boolean {
    if (!this.enabled || !this.options.allowOptionsMenu || !request.options.length) {
      return false;
    }

    this.closeOptionsMenu();
    this.focusWidget(createWidgetFocusKey(request.nodeId, request.widgetIndex));

    const root = this.ownerWindow.document.createElement("div");
    root.className = LEAFER_GRAPH_WIDGET_MENU_CLASS;
    root.tabIndex = -1;
    this.applyMenuTheme(root);

    const items = request.options.map((option) => {
      const button = this.ownerWindow.document.createElement("button");
      button.type = "button";
      button.className = LEAFER_GRAPH_WIDGET_MENU_ITEM_CLASS;
      button.dataset.value = option.value;
      button.dataset.disabled = option.disabled ? "true" : "false";

      const label = this.ownerWindow.document.createElement("span");
      label.textContent = option.label;
      button.appendChild(label);

      if (option.description) {
        const description = this.ownerWindow.document.createElement("small");
        description.textContent = option.description;
        button.appendChild(description);
      }

      if (option.disabled) {
        button.disabled = true;
      }

      button.addEventListener("click", () => {
        if (option.disabled) {
          return;
        }

        request.onSelect(option.value);
        this.closeOptionsMenu();
      });

      root.appendChild(button);
      return button;
    });

    root.addEventListener("keydown", (event) => {
      if (!this.activeMenu) {
        return;
      }

      event.stopPropagation();

      if (event.key === "Escape") {
        event.preventDefault();
        this.closeOptionsMenu();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const nextIndex = this.resolveNextEnabledMenuIndex(
          this.activeMenu.activeIndex,
          event.key === "ArrowDown" ? 1 : -1
        );
        this.setActiveMenuIndex(nextIndex);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const item = this.activeMenu.items[this.activeMenu.activeIndex];
        item?.click();
      }
    });

    this.container.appendChild(root);
    this.activeMenu = {
      request,
      key: createWidgetFocusKey(request.nodeId, request.widgetIndex),
      root,
      items,
      activeIndex: 0
    };

    this.positionMenu(root, request.anchorClientX, request.anchorClientY);
    const initialIndex = this.resolveInitialMenuIndex(request);
    this.setActiveMenuIndex(initialIndex);
    root.focus();
    return true;
  }

  closeActiveEditor(): void {
    if (this.editor?.innerEditing) {
      this.editor.closeInnerEditor();
    }

    this.closeOptionsMenu();
    this.stopEditorFollowLoop();
  }

  registerFocusableWidget(binding: LeaferGraphWidgetFocusBinding): () => void {
    this.focusBindings.set(binding.key, binding);

    return () => {
      if (this.focusedWidgetKey === binding.key) {
        this.clearWidgetFocus();
      }

      this.focusBindings.delete(binding.key);
    };
  }

  focusWidget(key: string): void {
    if (this.focusedWidgetKey === key) {
      return;
    }

    if (this.focusedWidgetKey) {
      this.focusBindings.get(this.focusedWidgetKey)?.onFocusChange?.(false);
    }

    this.focusedWidgetKey = key;
    this.focusBindings.get(key)?.onFocusChange?.(true);
  }

  clearWidgetFocus(): void {
    if (!this.focusedWidgetKey) {
      return;
    }

    this.focusBindings.get(this.focusedWidgetKey)?.onFocusChange?.(false);
    this.focusedWidgetKey = null;
  }

  isWidgetFocused(key: string): boolean {
    return this.focusedWidgetKey === key;
  }

  setTheme(theme: LeaferGraphWidgetThemeContext): void {
    this.theme = theme;

    if (this.activeMenu) {
      this.applyMenuTheme(this.activeMenu.root);
    }

    const editorDom = this.getActiveEditorDom();
    if (editorDom) {
      const multiline = editorDom.dataset.multiline === "true";
      const frame = (
        this.editor?.innerEditor as LeaferGraphWidgetTextEditor | undefined
      )?.editTarget?.[LEAFER_GRAPH_WIDGET_EDIT_META]?.request.frame;
      this.applyTextEditorTheme(editorDom, multiline, frame);
    }
  }

  applyTextEditorTheme(
    element: HTMLDivElement,
    multiline: boolean,
    frame?: LeaferGraphWidgetTextEditFrame
  ): void {
    const { tokens, mode } = this.theme;
    element.dataset.theme = mode;
    element.style.setProperty("--leafergraph-widget-placeholder", tokens.mutedFill);
    element.style.color = tokens.valueFill;
    element.style.background = tokens.fieldFill;
    element.style.border = `1px solid ${tokens.fieldFocusStroke}`;
    element.style.borderRadius = `${tokens.fieldRadius}px`;
    element.style.boxShadow = `0 0 0 1px ${tokens.focusRing}, ${tokens.fieldShadow}`;
    element.style.padding = frame
      ? `${frame.paddingTop ?? 0}px ${frame.paddingRight ?? 0}px ${frame.paddingBottom ?? 0}px ${frame.paddingLeft ?? 0}px`
      : multiline
        ? "8px 10px"
        : "4px 10px";
    element.style.minHeight = frame ? "0" : multiline ? "72px" : "28px";
  }

  notifyTextEditorClosed(): void {
    this.stopEditorFollowLoop();
  }

  destroy(): void {
    this.closeActiveEditor();
    this.ownerWindow.document.removeEventListener(
      "pointerdown",
      this.handleDocumentPointerDown,
      true
    );
    this.ownerWindow.removeEventListener("keydown", this.handleWindowKeyDown, true);
    this.focusBindings.clear();
    this.focusedWidgetKey = null;
    this.editor?.destroy();
    this.editor = null;
  }

  private ensureEditor(): Editor {
    if (this.editor) {
      return this.editor;
    }

    const editor = new Editor();
    editor.visible = false;
    editor.hittable = false;
    const host = this.app as App & {
      sky?: { add(item: Editor): void };
      tree: { add(item: unknown): void };
      editor?: Editor;
    };

    if (host.sky) {
      host.sky.add(editor);
    } else {
      host.tree.add(editor);
    }

    host.editor = editor;
    this.editor = editor;
    return editor;
  }

  private getActiveEditorDom(): HTMLDivElement | null {
    const innerEditor = this.editor?.innerEditor as LeaferGraphWidgetTextEditor | undefined;
    return innerEditor?.editDom ?? null;
  }

  private startEditorFollowLoop(): void {
    this.stopEditorFollowLoop();

    const loop = (): void => {
      if (!this.editor?.innerEditing) {
        this.followEditorFrame = 0;
        return;
      }

      (this.editor.innerEditor as LeaferGraphWidgetTextEditor | undefined)?.update();
      this.followEditorFrame = this.ownerWindow.requestAnimationFrame(loop);
    };

    this.followEditorFrame = this.ownerWindow.requestAnimationFrame(loop);
  }

  private stopEditorFollowLoop(): void {
    if (this.followEditorFrame) {
      this.ownerWindow.cancelAnimationFrame(this.followEditorFrame);
      this.followEditorFrame = 0;
    }
  }

  private closeOptionsMenu(): void {
    if (!this.activeMenu) {
      return;
    }

    const { request, root } = this.activeMenu;
    root.remove();
    this.activeMenu = null;
    request.onClose?.();
  }

  private ensureOverlayStyle(): void {
    const { document } = this.ownerWindow;
    if (document.getElementById(LEAFER_GRAPH_WIDGET_OVERLAY_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = LEAFER_GRAPH_WIDGET_OVERLAY_STYLE_ID;
    style.textContent = `
.${LEAFER_GRAPH_WIDGET_EDITOR_CLASS} {
  outline: none;
  margin: 0;
  z-index: 40;
  font: inherit;
}
.${LEAFER_GRAPH_WIDGET_EDITOR_CLASS}[data-read-only="true"] {
  cursor: default;
}
.${LEAFER_GRAPH_WIDGET_EDITOR_CLASS}:empty::before {
  content: attr(data-placeholder);
  color: var(--leafergraph-widget-placeholder, rgba(100, 116, 139, 0.9));
  pointer-events: none;
}
.${LEAFER_GRAPH_WIDGET_MENU_CLASS} {
  position: absolute;
  min-width: 176px;
  display: grid;
  gap: 6px;
  padding: 8px;
  border-radius: 14px;
  border: 1px solid var(--leafergraph-widget-menu-stroke);
  background: var(--leafergraph-widget-menu-fill);
  box-shadow: var(--leafergraph-widget-menu-shadow);
  z-index: 50;
}
.${LEAFER_GRAPH_WIDGET_MENU_ITEM_CLASS} {
  display: grid;
  gap: 2px;
  width: 100%;
  border: none;
  padding: 10px 12px;
  border-radius: 10px;
  text-align: left;
  background: transparent;
  color: var(--leafergraph-widget-menu-text);
  cursor: pointer;
}
.${LEAFER_GRAPH_WIDGET_MENU_ITEM_CLASS} small {
  color: var(--leafergraph-widget-menu-muted);
}
.${LEAFER_GRAPH_WIDGET_MENU_ITEM_CLASS}:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.${LEAFER_GRAPH_WIDGET_MENU_ITEM_ACTIVE_CLASS} {
  background: var(--leafergraph-widget-menu-active);
  color: var(--leafergraph-widget-menu-active-text);
}
`;

    document.head.appendChild(style);
  }

  private applyMenuTheme(root: HTMLDivElement): void {
    const { tokens } = this.theme;
    root.style.setProperty("--leafergraph-widget-menu-fill", tokens.menuFill);
    root.style.setProperty("--leafergraph-widget-menu-stroke", tokens.menuStroke);
    root.style.setProperty("--leafergraph-widget-menu-shadow", tokens.menuShadow);
    root.style.setProperty("--leafergraph-widget-menu-text", tokens.menuTextFill);
    root.style.setProperty("--leafergraph-widget-menu-muted", tokens.menuMutedFill);
    root.style.setProperty("--leafergraph-widget-menu-active", tokens.menuActiveFill);
    root.style.setProperty(
      "--leafergraph-widget-menu-active-text",
      tokens.menuActiveTextFill
    );
  }

  private positionMenu(
    root: HTMLDivElement,
    anchorClientX: number,
    anchorClientY: number
  ): void {
    const hostBounds = this.container.getBoundingClientRect();
    const left = anchorClientX - hostBounds.left;
    const top = anchorClientY - hostBounds.top + 10;

    root.style.left = `${left}px`;
    root.style.top = `${top}px`;

    const menuBounds = root.getBoundingClientRect();
    const maxLeft = Math.max(hostBounds.width - menuBounds.width - 12, 12);
    const maxTop = Math.max(hostBounds.height - menuBounds.height - 12, 12);

    root.style.left = `${Math.max(12, Math.min(left, maxLeft))}px`;
    root.style.top = `${Math.max(12, Math.min(top, maxTop))}px`;
  }

  private resolveInitialMenuIndex(
    request: LeaferGraphWidgetOptionsMenuRequest
  ): number {
    const matchedIndex = request.options.findIndex(
      (item) => item.value === request.value && !item.disabled
    );

    if (matchedIndex >= 0) {
      return matchedIndex;
    }

    return request.options.findIndex((item) => !item.disabled);
  }

  private setActiveMenuIndex(index: number): void {
    if (!this.activeMenu) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(index, this.activeMenu.items.length - 1));
    this.activeMenu.activeIndex = safeIndex;
    this.activeMenu.items.forEach((item, itemIndex) => {
      item.classList.toggle(
        LEAFER_GRAPH_WIDGET_MENU_ITEM_ACTIVE_CLASS,
        itemIndex === safeIndex
      );
    });
    this.activeMenu.items[safeIndex]?.focus();
  }

  private resolveNextEnabledMenuIndex(currentIndex: number, delta: 1 | -1): number {
    if (!this.activeMenu) {
      return currentIndex;
    }

    const total = this.activeMenu.items.length;
    if (!total) {
      return 0;
    }

    let nextIndex = currentIndex;
    for (let count = 0; count < total; count += 1) {
      nextIndex = (nextIndex + delta + total) % total;
      if (!this.activeMenu.items[nextIndex].disabled) {
        return nextIndex;
      }
    }

    return currentIndex;
  }
}

/** 创建一个永不抛错的默认编辑上下文。 */
export function createDisabledWidgetEditingContext(): LeaferGraphWidgetEditingContext {
  return {
    enabled: false,
    beginTextEdit() {
      return false;
    },
    openOptionsMenu() {
      return false;
    },
    closeActiveEditor() {},
    registerFocusableWidget() {
      return () => undefined;
    },
    focusWidget() {},
    clearWidgetFocus() {},
    isWidgetFocused() {
      return false;
    }
  };
}

/** 根据主题模式解析一份安全的 Widget 编辑配置。 */
export function resolveWidgetEditingOptions(
  mode: LeaferGraphThemeMode,
  options?: LeaferGraphWidgetEditingOptions
): {
  themeMode: LeaferGraphThemeMode;
  editing: Required<LeaferGraphWidgetEditingOptions>;
} {
  return {
    themeMode: mode,
    editing: {
      enabled: options?.enabled ?? false,
      useOfficialTextEditor: options?.useOfficialTextEditor ?? true,
      allowOptionsMenu: options?.allowOptionsMenu ?? true
    }
  };
}
