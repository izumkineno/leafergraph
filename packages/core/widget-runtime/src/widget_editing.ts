/**
 * Widget 编辑宿主模块。
 *
 * @remarks
 * 负责文本编辑、选项菜单、焦点转发和编辑态 DOM 管理。
 */

import { Matrix, Text } from "leafer-ui";
import { Editor, InnerEditor, registerInnerEditor } from "@leafer-in/editor";
import "@leafer-in/text-editor";
import type { App } from "leafer-ui";
import type {
  LeaferGraphWidgetTextEditFrame,
  LeaferGraphWidgetEditingContext,
  LeaferGraphWidgetFocusBinding,
  LeaferGraphWidgetOptionsMenuRequest,
  LeaferGraphWidgetTextEditRequest
} from "@leafergraph/core/contracts";
import type {
  LeaferGraphWidgetEditingConfig,
  NormalizedLeaferGraphLeaferEditorConfig,
  NormalizedLeaferGraphLeaferTextEditorConfig,
  NormalizedLeaferGraphWidgetEditingConfig
} from "@leafergraph/core/config";
import { resolveWidgetEditingOptions as resolveCoreWidgetEditingOptions } from "@leafergraph/core/config";
import type {
  LeaferGraphWidgetThemeContext
} from "@leafergraph/core/theme";

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

/**
 * 为节点内 Widget 生成稳定焦点键。
 *
 * @remarks
 * 当前格式固定为 `nodeId:widgetIndex`，够稳定也足够可读。
 *
 * @param nodeId - 目标节点 ID。
 * @param widgetIndex - Widget `Index`。
 * @returns 创建后的结果对象。
 */
function createWidgetFocusKey(nodeId: string, widgetIndex: number): string {
  return `${nodeId}:${widgetIndex}`;
}

/**
 *  判断一个事件目标是否为当前 window 下的 HTMLElement。
 *
 * @param target - 当前目标对象。
 * @returns 对应的判断结果。
 */
function isHTMLElement(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement;
}

/**
 *  判断当前按键是否属于 Widget 聚焦时应优先截获的组合。
 *
 * @param event - 当前事件对象。
 * @returns 对应的判断结果。
 */
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

  /**
   * 获取 `tag`。
   *
   * @returns 当前读取到的属性值。
   */
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

  /**
   * 处理 `onLoad` 相关逻辑。
   *
   * @returns 无返回值。
   */
  public onLoad(): void {
    const meta = this.editTarget[LEAFER_GRAPH_WIDGET_EDIT_META];
    if (!meta) {
      return;
    }

    // 真正可编辑的 DOM 只在进入编辑态时按需创建，退出后立即销毁，避免画布外常驻无用元素。
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

    // 等 DOM 真正插入后再聚焦并全选内容，保证首次输入体验稳定。
    queueMicrotask(() => {
      div.focus();

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(div);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  }

  /**
   * 处理 `onUpdate` 相关逻辑。
   *
   * @returns 无返回值。
   */
  public onUpdate(): void {
    // 先整理当前阶段需要的输入、状态与依赖。
    const { editTarget: text } = this;
    const meta = text[LEAFER_GRAPH_WIDGET_EDIT_META];
    const appBounds =
      text.app?.view instanceof HTMLCanvasElement
        ? text.app.clientBounds
        : text.app?.tree.clientBounds;

    if (!appBounds || !this.editDom || !meta) {
      return;
    }

    // Leafer 内文本的世界矩阵会随着缩放和平移变化，这里每一帧把编辑框重新对齐回正确屏幕位置。
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

  /**
   * 处理 `onUnload` 相关逻辑。
   *
   * @returns 无返回值。
   */
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
      // Esc 取消时回滚文本图元内容，并透传 onCancel 给外层 Widget。
      this.editTarget.text = meta.originalValue;
      meta.request.onCancel?.(meta.originalValue);
    } else {
      // 正常关闭则把 DOM 中的最终值提交回 Widget。
      this.editTarget.text = finalValue;
      meta.request.onCommit(finalValue);
    }

    this.editDom.remove();
    delete this.editTarget[LEAFER_GRAPH_WIDGET_EDIT_META];
    meta.manager.notifyTextEditorClosed();
  }

  /**
   * 读取`Edit` 值。
   *
   * @returns 处理后的结果。
   */
  private readEditValue(): string {
    return (this.editDom.innerText || "").replace(/\r\n?/g, "\n");
  }

  /**
   * 写入`Edit` 值。
   *
   * @param value - 当前值。
   * @returns 无返回值。
   */
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
  private readonly options: NormalizedLeaferGraphWidgetEditingConfig;
  private readonly editorConfig?: NormalizedLeaferGraphLeaferEditorConfig;
  private readonly textEditorConfig?: NormalizedLeaferGraphLeaferTextEditorConfig;
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

  /**
   * 初始化 LeaferGraphWidgetEditingManager 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(options: {
    app: App;
    container: HTMLElement;
    theme: LeaferGraphWidgetThemeContext;
    editing: NormalizedLeaferGraphWidgetEditingConfig;
    editorConfig?: NormalizedLeaferGraphLeaferEditorConfig;
    textEditorConfig?: NormalizedLeaferGraphLeaferTextEditorConfig;
  }) {
    this.app = options.app as EditorHostApp;
    this.container = options.container;
    this.theme = options.theme;
    this.ownerWindow = this.container.ownerDocument.defaultView ?? window;
    this.options = options.editing;
    this.editorConfig = options.editorConfig;
    this.textEditorConfig = options.textEditorConfig;
    this.enabled = this.options.enabled;

    // 浮层样式只需要向当前宿主 window 注入一次，避免 editor 多实例时重复插入。
    this.ensureOverlayStyle();
    this.ownerWindow.document.addEventListener(
      "pointerdown",
      this.handleDocumentPointerDown,
      true
    );
    this.ownerWindow.addEventListener("keydown", this.handleWindowKeyDown, true);
  }

  /**
   * 开始文本`Edit`。
   *
   * @param request - `request`。
   * @returns 对应的判断结果。
   */
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

    // 编辑元信息挂在目标文本图元上，方便 InnerEditor 生命周期里读取。
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
      // 官方 editor 没有真正进入 inner editing 时，立即回滚临时挂载的元信息。
      delete target[LEAFER_GRAPH_WIDGET_EDIT_META];
      return false;
    }

    this.startEditorFollowLoop();
    return true;
  }

  /**
   * 打开选项菜单。
   *
   * @param request - `request`。
   * @returns 对应的判断结果。
   */
  openOptionsMenu(request: LeaferGraphWidgetOptionsMenuRequest): boolean {
    // 先准备宿主依赖、初始状态和需要挂载的资源。
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

        // 菜单项点击只负责选值并关闭，真正的节点值回写由调用方 onSelect 完成。
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

  /**
   * 关闭活动编辑器。
   *
   * @returns 无返回值。
   */
  closeActiveEditor(): void {
    if (this.editor?.innerEditing) {
      this.editor.closeInnerEditor();
    }

    // 文本编辑和离散菜单都视为“当前激活编辑态”的一部分，这里统一关闭。
    this.closeOptionsMenu();
    this.stopEditorFollowLoop();
  }

  /**
   * 注册一个可聚焦 Widget。
   *
   * @param binding - Widget 的焦点和键盘转发绑定。
   * @returns 对应的注销函数。
   */
  registerFocusableWidget(binding: LeaferGraphWidgetFocusBinding): () => void {
    this.focusBindings.set(binding.key, binding);

    return () => {
      if (this.focusedWidgetKey === binding.key) {
        this.clearWidgetFocus();
      }

      this.focusBindings.delete(binding.key);
    };
  }

  /**
   * 显式把焦点切换到某个 Widget。
   *
   * @param key - 目标 Widget 焦点键。
   *
   * @returns 无返回值。
   */
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

  /**
   * 清理当前 Widget 焦点。
   *
   * @returns 无返回值。
   */
  clearWidgetFocus(): void {
    if (!this.focusedWidgetKey) {
      return;
    }

    this.focusBindings.get(this.focusedWidgetKey)?.onFocusChange?.(false);
    this.focusedWidgetKey = null;
  }

  /**
   * 判断某个 Widget 当前是否处于聚焦态。
   *
   * @param key - Widget 焦点键。
   * @returns 是否聚焦。
   */
  isWidgetFocused(key: string): boolean {
    return this.focusedWidgetKey === key;
  }

  /**
   * 运行时更新编辑浮层主题。
   *
   * @param theme - 新的 Widget 主题上下文。
   *
   * @returns 无返回值。
   */
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

  /**
   * 把当前主题 token 应用到文本编辑浮层。
   *
   * @param element - 实际承载编辑内容的 DOM。
   * @param multiline - 是否为多行编辑。
   * @param frame - 可选的几何与 padding 覆盖配置。
   *
   * @returns 无返回值。
   */
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

  /**
   * 在文本编辑浮层关闭后清理跟随循环。
   *
   * @returns 无返回值。
   */
  notifyTextEditorClosed(): void {
    this.stopEditorFollowLoop();
  }

  /**
   * 销毁整个 Widget 编辑宿主。
   *
   * @remarks
   * 主包销毁时必须显式调用这里，才能完整释放 DOM 浮层、全局监听和官方 editor 实例。
   *
   * @returns 无返回值。
   */
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

  /**
   * 惰性创建官方 Editor 实例。
   *
   * @remarks
   * 文本编辑未启用前不会创建 Editor，减少非编辑场景下的额外开销。
   *
   * @returns 确保编辑器的结果。
   */
  private ensureEditor(): Editor {
    if (this.editor) {
      return this.editor;
    }

    const editor = new Editor({
      ...(this.editorConfig?.raw ?? {}),
      ...(this.textEditorConfig?.raw
        ? { textEditor: this.textEditorConfig.raw }
        : {})
    });
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

  /**
   *  读取当前活跃文本编辑 DOM。
   *
   * @returns 处理后的结果。
   */
  private getActiveEditorDom(): HTMLDivElement | null {
    const innerEditor = this.editor?.innerEditor as LeaferGraphWidgetTextEditor | undefined;
    return innerEditor?.editDom ?? null;
  }

  /**
   * 启动文本编辑浮层的逐帧跟随更新。
   *
   * @remarks
   * 画布缩放、平移、节点移动都会影响文本在屏幕上的位置，
   * 因此编辑态下需要通过 RAF 持续同步 DOM 浮层位置。
   *
   * @returns 无返回值。
   */
  private startEditorFollowLoop(): void {
    this.stopEditorFollowLoop();

    /**
     * 处理 `loop` 相关逻辑。
     *
     * @returns 无返回值。
     */
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

  /**
   *  停止文本编辑浮层的逐帧跟随更新。
   *
   * @returns 无返回值。
   */
  private stopEditorFollowLoop(): void {
    if (this.followEditorFrame) {
      this.ownerWindow.cancelAnimationFrame(this.followEditorFrame);
      this.followEditorFrame = 0;
    }
  }

  /**
   * 关闭当前打开的离散选项菜单。
   *
   * @returns 无返回值。
   */
  private closeOptionsMenu(): void {
    if (!this.activeMenu) {
      return;
    }

    const { request, root } = this.activeMenu;
    root.remove();
    this.activeMenu = null;
    request.onClose?.();
  }

  /**
   * 向宿主文档注入一次性的 Widget 浮层样式。
   *
   * @remarks
   * 这里统一维护文本编辑器和选项菜单的基础样式，
   * 避免样式散落在 editor 页面层或各个 Widget 文件里。
   *
   * @returns 无返回值。
   */
  private ensureOverlayStyle(): void {
    // 先整理当前阶段需要的输入、状态与依赖。
    const { document } = this.ownerWindow;
    if (document.getElementById(LEAFER_GRAPH_WIDGET_OVERLAY_STYLE_ID)) {
      return;
    }

    // 再执行核心逻辑，并把结果或副作用统一收口。
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

  /**
   * 应用离散菜单主题变量。
   *
   * @param root - 菜单根元素。
   *
   * @returns 无返回值。
   */
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

  /**
   * 把离散菜单定位到锚点附近，并限制在当前宿主容器内。
   *
   * @param root - 菜单根元素。
   * @param anchorClientX - 视口坐标系中的锚点 X。
   * @param anchorClientY - 视口坐标系中的锚点 Y。
   *
   * @returns 无返回值。
   */
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

  /**
   * 解析菜单初始高亮项。
   *
   * @remarks
   * 优先命中当前值对应项，否则回退到第一个未禁用选项。
   *
   * @param request - `request`。
   * @returns 处理后的结果。
   */
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

  /**
   * 更新菜单当前高亮项并同步 DOM focus。
   *
   * @param index - 目标高亮索引。
   *
   * @returns 无返回值。
   */
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

  /**
   * 按方向寻找下一个可用菜单项。
   *
   * @param currentIndex - 当前高亮索引。
   * @param delta - 移动方向，`1` 为向下，`-1` 为向上。
   * @returns 新的可用索引；若都不可用则返回原索引。
   */
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

/**
 * 创建一个永不抛错的默认编辑上下文。
 *
 * @remarks
 * 当宿主未启用真实编辑能力时，Widget 仍然可以安全调用这组方法，
 * 只是所有编辑请求都会被无副作用地忽略。
 *
 * @returns 创建后的结果对象。
 */
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

export { resolveWidgetEditingOptions } from "@leafergraph/core/config";
