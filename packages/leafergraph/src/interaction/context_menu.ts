/**
 * 右键菜单基础设施模块。
 *
 * @remarks
 * 负责 Leafer 菜单事件归一化、DOM 菜单挂载与上下文菜单渲染。
 */

import { PointerEvent as LeaferPointerEvent, type App } from "leafer-ui";

/**
 * Leafer 官方右键菜单事件名。
 * 文档中明确说明 `pointer.menu` 对应 HTML `contextmenu`，并且在按下阶段触发。
 */
export const LEAFER_GRAPH_POINTER_MENU_EVENT = LeaferPointerEvent.MENU;

/**
 * 右键菜单样式节点的固定 ID。
 * 这样可以避免多个菜单管理器重复注入同一份基础样式。
 */
const CONTEXT_MENU_STYLE_ID = "leafergraph-context-menu-style";

/**
 * 右键菜单根节点的基础类名。
 * 所有对外样式扩展都应建立在这个根类名之上。
 */
const CONTEXT_MENU_ROOT_CLASS = "leafergraph-context-menu";

/**
 * 右键菜单默认样式。
 * 当前实现故意保持为一份宿主级基础样式：
 * 1. 足够好用，可以直接落地
 * 2. 足够克制，不把 editor 壳层设计硬编码到核心库
 */
const CONTEXT_MENU_STYLE_TEXT = `
.${CONTEXT_MENU_ROOT_CLASS} {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2147483647;
  display: none;
  min-width: 220px;
  max-width: 320px;
  padding: 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  color: #0f172a;
  font-family: "Inter", "IBM Plex Sans", "Segoe UI", sans-serif;
  user-select: none;
}

.${CONTEXT_MENU_ROOT_CLASS}[data-open="true"] {
  display: block;
}

.${CONTEXT_MENU_ROOT_CLASS}__item {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 10px 12px;
  border: 0;
  border-radius: 10px;
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
.${CONTEXT_MENU_ROOT_CLASS}__item:focus-visible {
  outline: none;
  background: rgba(59, 130, 246, 0.10);
}

.${CONTEXT_MENU_ROOT_CLASS}__item[disabled] {
  opacity: 0.45;
  cursor: default;
}

.${CONTEXT_MENU_ROOT_CLASS}__item[data-danger="true"] {
  color: #b42318;
}

.${CONTEXT_MENU_ROOT_CLASS}__content {
  min-width: 0;
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
  color: #64748b;
  font-size: 11px;
  line-height: 1.3;
}

.${CONTEXT_MENU_ROOT_CLASS}__shortcut {
  color: #64748b;
  font-size: 11px;
  line-height: 1;
}

.${CONTEXT_MENU_ROOT_CLASS}__separator {
  height: 1px;
  margin: 6px 4px;
  background: rgba(148, 163, 184, 0.22);
}
`;

/**
 * Leafer 右键菜单事件监听 ID。
 * 这里只取 `on_()` 的返回值结构，不把 Leafer 内部事件类型直接暴露到公共 API。
 */
type LeaferGraphEventListenerId = ReturnType<NonNullable<App["on_"]>>;

/**
 * 可用于右键菜单绑定的 Leafer 事件目标。
 * 当前只要求它具备最小的 `on_ / off_` 能力，因此既可以是画布级目标，也可以是节点级目标。
 */
export interface LeaferGraphContextMenuBindingTarget {
  name?: string;
  on_?: App["on_"];
  off_?: App["off_"];
}

/**
 * 右键菜单绑定类型。
 * 用于区分“当前这次菜单是从画布挂载点触发的，还是从节点挂载点触发的”。
 */
export type LeaferGraphContextMenuBindingKind = "canvas" | "node" | "custom";

/**
 * 菜单挂载描述。
 * 一个管理器可以同时维护多个挂载目标，例如：
 * 1. 画布根节点
 * 2. 某个具体节点
 * 3. 某类额外自定义图元
 */
export interface LeaferGraphContextMenuBinding {
  /**
   * 挂载键名。
   * 在同一个菜单管理器实例内部必须唯一。
   */
  key: string;
  /**
   * 右键菜单监听目标。
   */
  target: LeaferGraphContextMenuBindingTarget;
  /**
   * 当前挂载点的语义类型。
   * 默认是 `custom`。
   */
  kind?: LeaferGraphContextMenuBindingKind;
  /**
   * 透传给上下文的附加信息。
   * 适合携带 nodeId、slotId、业务分组等宿主语义。
   */
  meta?: Record<string, unknown>;
}

/**
 * 菜单挂载记录。
 * 用于在绑定、解绑和重绑之间维持最小的内部状态。
 */
interface LeaferGraphContextMenuBindingRecord {
  binding: LeaferGraphContextMenuBinding;
  listenerId: LeaferGraphEventListenerId | null;
}

/**
 * Leafer 的 `event.origin` 可能承载浏览器原生事件。
 * 右键菜单的 DOM 定位和 `preventDefault()` 都需要使用其中的少量字段。
 */
export interface LeaferGraphMenuOriginEvent {
  clientX?: number;
  clientY?: number;
  pageX?: number;
  pageY?: number;
  preventDefault?(): void;
  stopPropagation?(): void;
}

/**
 * 右键菜单内部统一使用的二维坐标结构。
 * 之所以不直接暴露 Leafer 的 `IPointData`，是为了让公共 API 保持宿主无关。
 */
export interface LeaferGraphContextMenuPoint {
  x: number;
  y: number;
}

/**
 * `pointer.menu` 事件的最小结构约束。
 * 这里按实际菜单管理需求抽取字段，避免公共类型和 Leafer 内部完整事件定义强绑定。
 */
export interface LeaferGraphPointerMenuEvent {
  x: number;
  y: number;
  target?: unknown;
  current?: unknown;
  origin?: LeaferGraphMenuOriginEvent;
  stopDefault?(): void;
  getPagePoint?(): LeaferGraphContextMenuPoint;
  getBoxPoint?(relative?: unknown): LeaferGraphContextMenuPoint;
  getLocalPoint?(relative?: unknown): LeaferGraphContextMenuPoint;
}

/**
 * 右键菜单解析完成后的上下文。
 * 设计目标是让菜单系统只做“事件与坐标归一化”，不提前绑定具体业务含义。
 */
export interface LeaferGraphContextMenuContext {
  /**
   * 当前绑定的 Leafer App。
   * 宿主可以继续通过它拿到 tree、view 或其他运行时对象。
   */
  app: App;
  /**
   * 宿主容器，一般就是创建 `LeaferGraph` 时传入的容器元素。
   */
  container: HTMLElement;
  /**
   * 当前触发菜单的挂载点。
   * 它和 `event.target` 不同：
   * - `currentTarget` 表示菜单监听是挂在哪个 Leafer 对象上的
   * - `target` 表示这次事件最终命中了哪个 Leafer 对象
   */
  currentTarget: LeaferGraphContextMenuBindingTarget;
  /**
   * 当前挂载点键名。
   * 适合在同一套解析器里快速区分多个挂载源。
   */
  bindingKey: string;
  /**
   * 当前挂载点类型。
   */
  bindingKind: LeaferGraphContextMenuBindingKind;
  /**
   * 当前挂载点的附加元信息。
   */
  bindingMeta?: Record<string, unknown>;
  /**
   * 原始的 Leafer `pointer.menu` 事件。
   */
  event: LeaferGraphPointerMenuEvent;
  /**
   * Leafer 命中的目标对象。
   * 当前层只负责透传，不假定它一定是节点或端口。
   */
  target?: unknown;
  /**
   * 原生 DOM 事件。
   * 在需要读取浏览器侧坐标、按钮或修饰键时可以继续向下使用。
   */
  originEvent?: LeaferGraphMenuOriginEvent;
  /**
   * Leafer world 坐标，也就是事件上的 `x / y`。
   */
  worldPoint: LeaferGraphContextMenuPoint;
  /**
   * 页面坐标，优先来自 `event.getPagePoint()`。
   * 当菜单需要挂到 `document.body` 时，这组坐标最适合作为跨容器参照。
   */
  pagePoint: LeaferGraphContextMenuPoint;
  /**
   * 浏览器 viewport 坐标。
   * 当前 DOM 菜单使用 `position: fixed`，因此最终定位依赖这组坐标。
   */
  clientPoint: LeaferGraphContextMenuPoint;
  /**
   * 相对于宿主容器的局部坐标。
   * 当业务要判断菜单落点位于容器哪里时，这组坐标最方便。
   */
  containerPoint: LeaferGraphContextMenuPoint;
  /**
   * 相对于当前监听对象的 box 坐标。
   * 适合后续做“节点局部菜单”“端口局部菜单”等更细粒度能力。
   */
  boxPoint?: LeaferGraphContextMenuPoint;
  /**
   * 相对于当前监听对象的 local 坐标。
   * 若后续需要精确命中节点内部 widget，可优先使用这组坐标。
   */
  localPoint?: LeaferGraphContextMenuPoint;
}

/**
 * 右键菜单分隔线项。
 * 分隔线只负责视觉分组，不会响应任何交互。
 */
export interface LeaferGraphContextMenuSeparatorItem {
  kind: "separator";
  key?: string;
}

/**
 * 右键菜单可执行项。
 * 这是当前阶段真正承载业务动作的菜单项类型。
 */
export interface LeaferGraphContextMenuActionItem {
  /**
   * 动作项类型。
   * 当前保留为可选字段，方便后续调用方显式声明，同时不增加现阶段样板代码负担。
   */
  kind?: "action";
  /**
   * 项目键名。
   * 推荐在同一份菜单中保持稳定，便于埋点、测试和后续 diff。
   */
  key: string;
  /**
   * 菜单展示文本。
   */
  label: string;
  /**
   * 补充说明。
   * 适合展示动作含义，而不是长段落说明。
   */
  description?: string;
  /**
   * 快捷键信息。
   * 当前只负责展示，不会自动绑定键盘行为。
   */
  shortcut?: string;
  /**
   * 是否禁用。
   */
  disabled?: boolean;
  /**
   * 是否隐藏。
   * 管理器会在渲染前过滤掉隐藏项。
   */
  hidden?: boolean;
  /**
   * 是否为危险动作。
   * 当前仅用于切换样式表现，不改变执行逻辑。
   */
  danger?: boolean;
  /**
   * 选中后是否自动关闭菜单。
   * 默认行为是关闭，适合大多数上下文菜单场景。
   */
  closeOnSelect?: boolean;
  /**
   * 点击后的执行逻辑。
   * 菜单管理器会把已经归一化过的上下文传入。
   */
  onSelect?(context: LeaferGraphContextMenuContext): void | Promise<void>;
}

/**
 * 右键菜单项联合类型。
 * 当前仅提供 action 和 separator，两者已经足够覆盖主包基础设施阶段需求。
 */
export type LeaferGraphContextMenuItem =
  | LeaferGraphContextMenuSeparatorItem
  | LeaferGraphContextMenuActionItem;

/**
 * 菜单项解析器。
 * 它是菜单管理器和具体业务之间最关键的边界：
 * 菜单管理器只负责“何时打开、打开在哪里、怎么渲染”；
 * 业务层负责“当前上下文应该出现哪些菜单项”。
 */
export interface LeaferGraphContextMenuResolver {
  (
    context: LeaferGraphContextMenuContext
  ): LeaferGraphContextMenuItem[] | null | undefined;
}

/**
 * 菜单管理器配置项。
 */
export interface LeaferGraphContextMenuOptions {
  /**
   * 绑定的 Leafer App。
   */
  app: App;
  /**
   * Leafer 宿主容器。
   */
  container: HTMLElement;
  /**
   * 画布级右键菜单挂载目标。
   * 默认使用 `app`，传入 `false` 可关闭默认画布挂载。
   */
  canvasTarget?: LeaferGraphContextMenuBindingTarget | false;
  /**
   * 额外挂载点列表。
   * 适合在创建管理器时就一次性声明节点、端口或其它自定义图元挂载。
   */
  bindings?: LeaferGraphContextMenuBinding[];
  /**
   * 自定义菜单挂载根节点。
   * 默认挂到 `container.ownerDocument.body`，以避免宿主容器的 `overflow: hidden` 裁剪菜单。
   */
  host?: HTMLElement;
  /**
   * 额外类名。
   * 宿主可基于它叠加自己的菜单样式，而不必改动管理器内部结构。
   */
  className?: string;
  /**
   * 菜单项解析器。
   */
  resolveItems?: LeaferGraphContextMenuResolver;
  /**
   * 打开前钩子。
   * 返回 `false` 时会跳过本次菜单展示。
   */
  onBeforeOpen?(context: LeaferGraphContextMenuContext): boolean | void;
  /**
   * 菜单打开后钩子。
   */
  onOpen?(context: LeaferGraphContextMenuContext): void;
  /**
   * 菜单关闭后钩子。
   */
  onClose?(context?: LeaferGraphContextMenuContext): void;
}

/**
 * LeaferGraph 右键菜单管理器。
 *
 * 它的职责只聚焦在四件事情：
 * 1. 监听 `pointer.menu`
 * 2. 阻止浏览器原生右键菜单
 * 3. 归一化 Leafer 事件坐标并构造上下文
 * 4. 挂载、渲染、定位、关闭 DOM 菜单
 *
 * 它明确不负责：
 * 1. 节点命令系统
 * 2. 复制/删除/粘贴等业务动作
 * 3. 菜单项权限判断
 * 4. 节点 / 端口 / 画布的具体分类逻辑
 */
export class LeaferGraphContextMenuManager {
  readonly app: App;
  readonly container: HTMLElement;
  readonly host: HTMLElement;

  private readonly ownerDocument: Document;
  private readonly className?: string;
  private readonly canvasTarget?: LeaferGraphContextMenuBindingTarget | false;
  private resolveItems?: LeaferGraphContextMenuResolver;
  private readonly onBeforeOpen?: LeaferGraphContextMenuOptions["onBeforeOpen"];
  private readonly onOpen?: LeaferGraphContextMenuOptions["onOpen"];
  private readonly onClose?: LeaferGraphContextMenuOptions["onClose"];
  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    if (!this.isOpen()) {
      return;
    }

    if (this.menuRoot?.contains(event.target as Node)) {
      return;
    }

    this.hide();
  };
  private readonly handleDocumentContextMenu = (event: MouseEvent): void => {
    if (!this.isOpen()) {
      return;
    }

    if (this.menuRoot?.contains(event.target as Node)) {
      event.preventDefault();
      return;
    }

    this.hide();
  };
  private readonly handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (!this.isOpen()) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.hide();
    }
  };
  private readonly handleWindowResize = (): void => {
    if (this.isOpen()) {
      this.hide();
    }
  };
  private readonly handleWindowBlur = (): void => {
    if (this.isOpen()) {
      this.hide();
    }
  };

  private readonly bindingRecords = new Map<
    string,
    LeaferGraphContextMenuBindingRecord
  >();
  private menuRoot: HTMLDivElement | null = null;
  private activeContext?: LeaferGraphContextMenuContext;
  private lastHandledMenuEvent: LeaferGraphPointerMenuEvent | null = null;
  private lastHandledMenuOrigin: LeaferGraphMenuOriginEvent | null = null;
  private bound = false;

  /**
   * 创建菜单管理器实例。
   * 构造阶段只记录配置，不会自动开始监听。
   */
  constructor(options: LeaferGraphContextMenuOptions) {
    this.app = options.app;
    this.container = options.container;
    this.ownerDocument = this.container.ownerDocument;
    this.host = options.host ?? this.ownerDocument.body ?? this.container;
    this.className = options.className;
    this.canvasTarget =
      options.canvasTarget ??
      (this.app as unknown as LeaferGraphContextMenuBindingTarget);
    this.resolveItems = options.resolveItems;
    this.onBeforeOpen = options.onBeforeOpen;
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;

    if (options.bindings?.length) {
      for (const binding of options.bindings) {
        this.setBindingRecord(binding);
      }
    }
  }

  /**
   * 绑定 `pointer.menu` 和菜单关闭相关监听。
   * 重复调用是安全的。
   */
  bind(): this {
    if (this.bound) {
      return this;
    }

    injectContextMenuStyle(this.ownerDocument);
    this.ensureMenuRoot();
    if (this.canvasTarget !== false) {
      this.bindCanvas(this.canvasTarget);
    }
    for (const record of this.bindingRecords.values()) {
      this.attachBindingRecord(record);
    }

    this.ownerDocument.addEventListener(
      "pointerdown",
      this.handleDocumentPointerDown,
      true
    );
    this.ownerDocument.addEventListener(
      "contextmenu",
      this.handleDocumentContextMenu,
      true
    );
    this.ownerDocument.addEventListener(
      "keydown",
      this.handleDocumentKeyDown,
      true
    );

    const ownerWindow = this.ownerDocument.defaultView;
    ownerWindow?.addEventListener("resize", this.handleWindowResize);
    ownerWindow?.addEventListener("blur", this.handleWindowBlur);
    ownerWindow?.addEventListener("scroll", this.handleWindowResize, true);

    this.bound = true;
    return this;
  }

  /**
   * 解绑 Leafer 与 DOM 监听，但保留已创建的菜单根节点。
   * 当宿主只是暂时停用菜单而不是销毁实例时，可优先使用它。
   */
  unbind(): this {
    if (!this.bound) {
      return this;
    }

    for (const record of this.bindingRecords.values()) {
      this.detachBindingRecord(record);
    }

    this.ownerDocument.removeEventListener(
      "pointerdown",
      this.handleDocumentPointerDown,
      true
    );
    this.ownerDocument.removeEventListener(
      "contextmenu",
      this.handleDocumentContextMenu,
      true
    );
    this.ownerDocument.removeEventListener(
      "keydown",
      this.handleDocumentKeyDown,
      true
    );

    const ownerWindow = this.ownerDocument.defaultView;
    ownerWindow?.removeEventListener("resize", this.handleWindowResize);
    ownerWindow?.removeEventListener("blur", this.handleWindowBlur);
    ownerWindow?.removeEventListener("scroll", this.handleWindowResize, true);

    this.bound = false;
    return this;
  }

  /**
   * 绑定画布级右键菜单。
   * 默认会复用 `app`，也可以显式传入其它画布级目标。
   */
  bindCanvas(
    target: LeaferGraphContextMenuBindingTarget =
      this.app as unknown as LeaferGraphContextMenuBindingTarget,
    meta?: Record<string, unknown>
  ): this {
    return this.bindTarget({
      key: "canvas",
      kind: "canvas",
      target,
      meta
    });
  }

  /**
   * 绑定节点级右键菜单。
   * 这层 API 的存在意义是把“节点菜单挂载”显式表达出来，而不是让外部都走无语义的通用绑定。
   */
  bindNode(
    key: string,
    target: LeaferGraphContextMenuBindingTarget,
    meta?: Record<string, unknown>
  ): this {
    return this.bindTarget({
      key,
      kind: "node",
      target,
      meta
    });
  }

  /**
   * 绑定任意 Leafer 目标。
   * 当调用方不属于“画布”或“节点”这两类标准挂载点时，可使用它。
   */
  bindTarget(binding: LeaferGraphContextMenuBinding): this {
    const record = this.setBindingRecord(binding);

    if (this.bound) {
      this.attachBindingRecord(record);
    }

    return this;
  }

  /**
   * 解绑某个挂载点。
   */
  unbindTarget(key: string): this {
    const record = this.bindingRecords.get(key);
    if (!record) {
      return this;
    }

    this.detachBindingRecord(record);
    this.bindingRecords.delete(key);
    return this;
  }

  /**
   * 更新菜单项解析器。
   * 适合宿主在不重建管理器的前提下切换菜单逻辑。
   */
  setResolver(resolver?: LeaferGraphContextMenuResolver): this {
    this.resolveItems = resolver;
    return this;
  }

  /**
   * 当前菜单是否处于打开状态。
   */
  isOpen(): boolean {
    return Boolean(this.menuRoot?.dataset.open === "true");
  }

  /**
   * 使用给定上下文和菜单项主动显示菜单。
   * 如果菜单项为空，会自动退化为关闭。
   */
  show(
    context: LeaferGraphContextMenuContext,
    items: LeaferGraphContextMenuItem[]
  ): void {
    const normalizedItems = normalizeContextMenuItems(items);

    if (!normalizedItems.length) {
      this.hide();
      return;
    }

    const menuRoot = this.ensureMenuRoot();
    this.renderMenu(normalizedItems, context, menuRoot);
    this.positionMenu(menuRoot, context.clientPoint);
    menuRoot.dataset.open = "true";
    menuRoot.setAttribute("aria-hidden", "false");
    this.activeContext = context;
    this.onOpen?.(context);
  }

  /**
   * 关闭当前菜单。
   */
  hide(): void {
    if (!this.menuRoot) {
      return;
    }

    if (!this.isOpen()) {
      return;
    }

    const previousContext = this.activeContext;
    this.menuRoot.dataset.open = "false";
    this.menuRoot.setAttribute("aria-hidden", "true");
    this.menuRoot.style.transform = "translate3d(-9999px, -9999px, 0)";
    this.activeContext = undefined;
    this.onClose?.(previousContext);
  }

  /**
   * 销毁菜单管理器。
   * 这一步会同时解绑事件并移除菜单 DOM。
   */
  destroy(): void {
    this.hide();
    this.unbind();

    if (this.menuRoot?.parentNode) {
      this.menuRoot.parentNode.removeChild(this.menuRoot);
    }

    this.menuRoot = null;
  }

  /**
   * 归一化并写入挂载记录。
   * 如果同键名已存在，会先解绑旧记录，再替换为新记录。
   */
  private setBindingRecord(
    binding: LeaferGraphContextMenuBinding
  ): LeaferGraphContextMenuBindingRecord {
    const normalizedBinding = normalizeBinding(binding);
    const previous = this.bindingRecords.get(normalizedBinding.key);

    if (previous) {
      this.detachBindingRecord(previous);
    }

    const record: LeaferGraphContextMenuBindingRecord = {
      binding: normalizedBinding,
      listenerId: null
    };

    this.bindingRecords.set(normalizedBinding.key, record);
    return record;
  }

  /**
   * 将某个挂载记录真正挂到 Leafer 目标上。
   */
  private attachBindingRecord(
    record: LeaferGraphContextMenuBindingRecord
  ): void {
    if (record.listenerId || !record.binding.target.on_) {
      return;
    }

    record.listenerId =
      record.binding.target.on_(
        LeaferPointerEvent.MENU,
        this.createBindingMenuHandler(record.binding)
      ) ?? null;
  }

  /**
   * 从 Leafer 目标上移除某个挂载记录。
   */
  private detachBindingRecord(
    record: LeaferGraphContextMenuBindingRecord
  ): void {
    if (!record.listenerId) {
      return;
    }

    record.binding.target.off_?.(record.listenerId);
    record.listenerId = null;
  }

  /**
   * 为某个挂载点创建专属的菜单事件处理器。
   * 这样上下文里就能保留“这次是从画布触发的，还是从节点触发的”信息。
   */
  private createBindingMenuHandler(
    binding: LeaferGraphContextMenuBinding
  ): (event: LeaferGraphPointerMenuEvent) => void {
    return (event) => {
      if (this.isHandledMenuEvent(event)) {
        return;
      }

      this.markHandledMenuEvent(event);
      const context = this.createContext(event, binding);

      if (this.onBeforeOpen?.(context) === false) {
        return;
      }

      this.preventNativeMenu(event);
      const items = this.resolveItems?.(context);
      this.show(context, items ?? []);
    };
  }

  /**
   * 当同一个 `pointer.menu` 事件同时命中节点和画布挂载点时，避免重复弹出菜单。
   */
  private isHandledMenuEvent(event: LeaferGraphPointerMenuEvent): boolean {
    return (
      this.lastHandledMenuEvent === event ||
      Boolean(event.origin && this.lastHandledMenuOrigin === event.origin)
    );
  }

  /**
   * 标记当前菜单事件已处理，并在本轮事件循环结束后自动清空。
   */
  private markHandledMenuEvent(event: LeaferGraphPointerMenuEvent): void {
    this.lastHandledMenuEvent = event;
    this.lastHandledMenuOrigin = event.origin ?? null;

    const currentEvent = event;
    const currentOrigin = event.origin ?? null;
    queueMicrotask(() => {
      if (this.lastHandledMenuEvent === currentEvent) {
        this.lastHandledMenuEvent = null;
      }
      if (this.lastHandledMenuOrigin === currentOrigin) {
        this.lastHandledMenuOrigin = null;
      }
    });
  }

  /**
   * 创建并归一化 `pointer.menu` 上下文。
   * 这里把 Leafer world/page 坐标和 DOM client/container 坐标同时准备好，
   * 目的是让后续菜单项解析器不必重复做坐标转换。
   */
  private createContext(
    event: LeaferGraphPointerMenuEvent,
    binding: LeaferGraphContextMenuBinding
  ): LeaferGraphContextMenuContext {
    const worldPoint = toSafePoint({ x: event.x, y: event.y });
    const pagePoint = toSafePoint(
      event.getPagePoint?.() ??
        resolvePagePointFromOrigin(event.origin, this.ownerDocument)
    );
    const clientPoint = toSafePoint(
      resolveClientPoint(event.origin, pagePoint, this.ownerDocument)
    );
    const containerPoint = this.resolveContainerPoint(clientPoint);
    const boxPoint = event.getBoxPoint?.();
    const localPoint = event.getLocalPoint?.();

    return {
      app: this.app,
      container: this.container,
      currentTarget: binding.target,
      bindingKey: binding.key,
      bindingKind: binding.kind ?? "custom",
      bindingMeta: binding.meta,
      event,
      target: event.target,
      originEvent: event.origin,
      worldPoint,
      pagePoint,
      clientPoint,
      containerPoint,
      boxPoint: boxPoint ? toSafePoint(boxPoint) : undefined,
      localPoint: localPoint ? toSafePoint(localPoint) : undefined
    };
  }

  /**
   * 阻止浏览器原生右键菜单。
   * 优先走 Leafer 事件对象的 `stopDefault()`，再回退到原生事件的 `preventDefault()`。
   */
  private preventNativeMenu(event: LeaferGraphPointerMenuEvent): void {
    event.stopDefault?.();
    event.origin?.preventDefault?.();
  }

  /**
   * 创建菜单 DOM 根节点。
   * 根节点默认挂到 `document.body`，避免受宿主容器裁剪影响。
   */
  private ensureMenuRoot(): HTMLDivElement {
    if (this.menuRoot) {
      if (!this.menuRoot.parentNode) {
        this.host.appendChild(this.menuRoot);
      }

      return this.menuRoot;
    }

    const menuRoot = this.ownerDocument.createElement("div");
    menuRoot.className = [CONTEXT_MENU_ROOT_CLASS, this.className]
      .filter(Boolean)
      .join(" ");
    menuRoot.dataset.open = "false";
    menuRoot.setAttribute("role", "menu");
    menuRoot.setAttribute("aria-hidden", "true");
    menuRoot.style.transform = "translate3d(-9999px, -9999px, 0)";
    this.host.appendChild(menuRoot);
    this.menuRoot = menuRoot;
    return menuRoot;
  }

  /**
   * 用菜单项重建 DOM。
   * 当前实现直接整块重绘，这是因为右键菜单项数量通常很小，重建成本远低于维护细粒度 patch 复杂度。
   */
  private renderMenu(
    items: LeaferGraphContextMenuItem[],
    context: LeaferGraphContextMenuContext,
    menuRoot: HTMLDivElement
  ): void {
    const fragment = this.ownerDocument.createDocumentFragment();

    for (const item of items) {
      if (item.kind === "separator") {
        fragment.appendChild(this.createSeparatorElement(item));
      } else {
        fragment.appendChild(this.createActionElement(item, context));
      }
    }

    menuRoot.replaceChildren(fragment);
  }

  /**
   * 创建分隔线 DOM。
   */
  private createSeparatorElement(
    item: LeaferGraphContextMenuSeparatorItem
  ): HTMLDivElement {
    const separator = this.ownerDocument.createElement("div");
    separator.className = `${CONTEXT_MENU_ROOT_CLASS}__separator`;
    separator.setAttribute("role", "separator");

    if (item.key) {
      separator.dataset.key = item.key;
    }

    return separator;
  }

  /**
   * 创建可执行菜单项 DOM。
   */
  private createActionElement(
    item: LeaferGraphContextMenuActionItem,
    context: LeaferGraphContextMenuContext
  ): HTMLButtonElement {
    const button = this.ownerDocument.createElement("button");
    button.type = "button";
    button.className = `${CONTEXT_MENU_ROOT_CLASS}__item`;
    button.dataset.key = item.key;
    button.dataset.danger = String(Boolean(item.danger));
    button.setAttribute("role", "menuitem");

    if (item.disabled) {
      button.disabled = true;
    }

    const content = this.ownerDocument.createElement("span");
    content.className = `${CONTEXT_MENU_ROOT_CLASS}__content`;

    const label = this.ownerDocument.createElement("span");
    label.className = `${CONTEXT_MENU_ROOT_CLASS}__label`;
    label.textContent = item.label;
    content.appendChild(label);

    if (item.description) {
      const description = this.ownerDocument.createElement("span");
      description.className = `${CONTEXT_MENU_ROOT_CLASS}__description`;
      description.textContent = item.description;
      content.appendChild(description);
    }

    button.appendChild(content);

    if (item.shortcut) {
      const shortcut = this.ownerDocument.createElement("span");
      shortcut.className = `${CONTEXT_MENU_ROOT_CLASS}__shortcut`;
      shortcut.textContent = item.shortcut;
      button.appendChild(shortcut);
    }

    button.addEventListener("click", (domEvent) => {
      domEvent.preventDefault();
      domEvent.stopPropagation();

      if (item.disabled) {
        return;
      }

      const maybePromise = item.onSelect?.(context);
      const closeOnSelect = item.closeOnSelect ?? true;

      if (!maybePromise) {
        if (closeOnSelect) {
          this.hide();
        }
        return;
      }

      Promise.resolve(maybePromise)
        .catch((error) => {
          console.error("[leafergraph] 右键菜单项执行失败", error);
        })
        .finally(() => {
          if (closeOnSelect) {
            this.hide();
          }
        });
    });

    return button;
  }

  /**
   * 把菜单吸附到 viewport 内。
   * 这是一个很重要的宿主级职责，因为 DOM 菜单一旦超出窗口会直接影响可用性。
   */
  private positionMenu(
    menuRoot: HTMLDivElement,
    clientPoint: LeaferGraphContextMenuPoint
  ): void {
    const ownerWindow = this.ownerDocument.defaultView;

    if (!ownerWindow) {
      menuRoot.style.transform = `translate3d(${clientPoint.x}px, ${clientPoint.y}px, 0)`;
      return;
    }

    menuRoot.style.transform = "translate3d(-9999px, -9999px, 0)";
    menuRoot.dataset.open = "true";
    const bounds = menuRoot.getBoundingClientRect();
    const margin = 10;
    const maxX = Math.max(
      margin,
      ownerWindow.innerWidth - bounds.width - margin
    );
    const maxY = Math.max(
      margin,
      ownerWindow.innerHeight - bounds.height - margin
    );
    const clampedX = clamp(clientPoint.x, margin, maxX);
    const clampedY = clamp(clientPoint.y, margin, maxY);
    menuRoot.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
  }

  /**
   * 计算相对于宿主容器的局部坐标。
   */
  private resolveContainerPoint(
    clientPoint: LeaferGraphContextMenuPoint
  ): LeaferGraphContextMenuPoint {
    const rect = this.container.getBoundingClientRect();

    return {
      x: clientPoint.x - rect.left,
      y: clientPoint.y - rect.top
    };
  }
}

/**
 * 创建并立即绑定一个右键菜单管理器。
 * 这是主包对外推荐的快捷入口。
 */
export function createLeaferGraphContextMenu(
  options: LeaferGraphContextMenuOptions
): LeaferGraphContextMenuManager {
  return new LeaferGraphContextMenuManager(options).bind();
}

/**
 * 归一化挂载配置。
 */
function normalizeBinding(
  binding: LeaferGraphContextMenuBinding
): LeaferGraphContextMenuBinding {
  const key = binding.key.trim();

  if (!key) {
    throw new Error("右键菜单挂载键名不能为空");
  }

  if (!binding.target?.on_) {
    throw new Error(`右键菜单挂载目标缺少 on_ 监听能力: ${key}`);
  }

  return {
    ...binding,
    key,
    kind: binding.kind ?? "custom"
  };
}

/**
 * 过滤并规整菜单项：
 * 1. 去掉隐藏项
 * 2. 合并连续分隔线
 * 3. 去掉头尾分隔线
 */
function normalizeContextMenuItems(
  items: LeaferGraphContextMenuItem[]
): LeaferGraphContextMenuItem[] {
  const normalized: LeaferGraphContextMenuItem[] = [];

  for (const item of items) {
    if (item.kind !== "separator" && item.hidden) {
      continue;
    }

    const previous = normalized[normalized.length - 1];
    if (
      item.kind === "separator" &&
      (!previous || previous.kind === "separator")
    ) {
      continue;
    }

    normalized.push(item);
  }

  while (normalized[0]?.kind === "separator") {
    normalized.shift();
  }

  while (normalized[normalized.length - 1]?.kind === "separator") {
    normalized.pop();
  }

  return normalized;
}

/**
 * 向宿主文档注入一次基础样式。
 */
function injectContextMenuStyle(ownerDocument: Document): void {
  if (ownerDocument.getElementById(CONTEXT_MENU_STYLE_ID)) {
    return;
  }

  const style = ownerDocument.createElement("style");
  style.id = CONTEXT_MENU_STYLE_ID;
  style.textContent = CONTEXT_MENU_STYLE_TEXT;
  ownerDocument.head?.appendChild(style);
}

/**
 * 从原生事件中解析 page 坐标。
 * 当 Leafer 事件未提供 `getPagePoint()` 时，这个回退逻辑仍能让菜单正确定位。
 */
function resolvePagePointFromOrigin(
  origin: LeaferGraphMenuOriginEvent | undefined,
  ownerDocument: Document
): LeaferGraphContextMenuPoint {
  if (!origin) {
    return { x: 0, y: 0 };
  }

  if (isFiniteNumber(origin.pageX) && isFiniteNumber(origin.pageY)) {
    return { x: origin.pageX, y: origin.pageY };
  }

  const ownerWindow = ownerDocument.defaultView;
  const scrollX = ownerWindow?.scrollX ?? 0;
  const scrollY = ownerWindow?.scrollY ?? 0;

  return {
    x: (isFiniteNumber(origin.clientX) ? origin.clientX : 0) + scrollX,
    y: (isFiniteNumber(origin.clientY) ? origin.clientY : 0) + scrollY
  };
}

/**
 * 解析用于 DOM `position: fixed` 的 viewport 坐标。
 */
function resolveClientPoint(
  origin: LeaferGraphMenuOriginEvent | undefined,
  pagePoint: LeaferGraphContextMenuPoint,
  ownerDocument: Document
): LeaferGraphContextMenuPoint {
  if (
    origin &&
    isFiniteNumber(origin.clientX) &&
    isFiniteNumber(origin.clientY)
  ) {
    return { x: origin.clientX, y: origin.clientY };
  }

  const ownerWindow = ownerDocument.defaultView;
  const scrollX = ownerWindow?.scrollX ?? 0;
  const scrollY = ownerWindow?.scrollY ?? 0;

  return {
    x: pagePoint.x - scrollX,
    y: pagePoint.y - scrollY
  };
}

/**
 * 将任意输入点规范化成安全数值。
 */
function toSafePoint(
  point: Partial<LeaferGraphContextMenuPoint> | undefined
): LeaferGraphContextMenuPoint {
  return {
    x: isFiniteNumber(point?.x) ? point.x : 0,
    y: isFiniteNumber(point?.y) ? point.y : 0
  };
}

/**
 * 判断一个值是否是合法数字。
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * 数值钳制工具。
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
