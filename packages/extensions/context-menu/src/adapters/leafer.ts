/**
 * Leafer 右键菜单适配器。
 *
 * @remarks
 * 负责把 Leafer 的 `pointer.menu` 事件和命中链归一化为通用菜单上下文。
 */

import type { App } from "leafer-ui";
import type {
  ContextMenuAdapter,
  ContextMenuContext,
  ContextMenuController,
  ContextMenuPoint,
  ContextMenuTarget
} from "../core/types";

/**
 * Leafer 官方菜单事件名。
 * 这里直接使用稳定字符串，避免适配器在非浏览器测试环境中强依赖 Leafer 运行时。
 */
export const LEAFER_GRAPH_POINTER_MENU_EVENT = "pointer.menu";

type LeaferContextMenuListenerId = ReturnType<NonNullable<App["on_"]>>;

export interface LeaferContextMenuBindingTarget {
  name?: string;
  parent?: LeaferContextMenuBindingTarget | null;
  on_?: App["on_"];
  off_?: App["off_"];
}

export type LeaferContextMenuBindingKind =
  | "canvas"
  | "node"
  | "link"
  | "custom";

export interface LeaferMenuOriginEvent {
  clientX?: number;
  clientY?: number;
  pageX?: number;
  pageY?: number;
  preventDefault?(): void;
  stopPropagation?(): void;
}

export interface LeaferPointerMenuEvent {
  x: number;
  y: number;
  target?: unknown;
  current?: unknown;
  origin?: LeaferMenuOriginEvent;
  stopDefault?(): void;
  getPagePoint?(): ContextMenuPoint;
  getBoxPoint?(relative?: unknown): ContextMenuPoint;
  getLocalPoint?(relative?: unknown): ContextMenuPoint;
}

export interface LeaferContextMenuBindingResolverInput {
  app: App;
  binding: LeaferContextMenuBinding;
  event: LeaferPointerMenuEvent;
  hitTarget: unknown;
}

export interface LeaferContextMenuBinding {
  key: string;
  target: LeaferContextMenuBindingTarget;
  kind?: LeaferContextMenuBindingKind;
  meta?: Record<string, unknown>;
  resolveTarget?(
    input: LeaferContextMenuBindingResolverInput
  ): ContextMenuTarget | null | undefined;
}

export interface CreateLeaferContextMenuAdapterOptions {
  app: App;
  container: HTMLElement;
  host?: HTMLElement;
  canvasTarget?: LeaferContextMenuBindingTarget | false;
  bindings?: LeaferContextMenuBinding[];
}

export interface LeaferContextMenuAdapter extends ContextMenuAdapter {
  bindCanvas(
    target?: LeaferContextMenuBindingTarget,
    meta?: Record<string, unknown>
  ): this;
  bindNode(
    key: string,
    target: LeaferContextMenuBindingTarget,
    meta?: Record<string, unknown>
  ): this;
  bindLink(
    key: string,
    target: LeaferContextMenuBindingTarget,
    meta?: Record<string, unknown>
  ): this;
  bindTarget(binding: LeaferContextMenuBinding): this;
  unbindTarget(key: string): this;
}

interface LeaferContextMenuBindingRecord {
  binding: LeaferContextMenuBinding;
  listenerId: LeaferContextMenuListenerId | null;
}

/**
 * 封装 LeaferContextMenuAdapterImpl 的适配逻辑。
 */
class LeaferContextMenuAdapterImpl implements LeaferContextMenuAdapter {
  private readonly app: App;
  private readonly container: HTMLElement;
  private readonly host: HTMLElement;
  private readonly ownerDocument: Document;
  private readonly canvasTarget?: LeaferContextMenuBindingTarget | false;
  private readonly bindingRecords = new Map<string, LeaferContextMenuBindingRecord>();
  private controller: ContextMenuController | null = null;
  private lastHandledMenuEvent: LeaferPointerMenuEvent | null = null;
  private lastHandledMenuOrigin: LeaferMenuOriginEvent | null = null;

  /**
   * 初始化 LeaferContextMenuAdapterImpl 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(options: CreateLeaferContextMenuAdapterOptions) {
    this.app = options.app;
    this.container = options.container;
    this.ownerDocument = this.container.ownerDocument;
    this.host = options.host ?? this.ownerDocument.body ?? this.container;
    this.canvasTarget =
      options.canvasTarget ??
      (this.app as unknown as LeaferContextMenuBindingTarget);

    if (this.canvasTarget !== false) {
      this.setBindingRecord({
        key: "canvas",
        kind: "canvas",
        target: this.canvasTarget
      });
    }

    for (const binding of options.bindings ?? []) {
      this.setBindingRecord(binding);
    }
  }

  /**
   * 处理 `connect` 相关逻辑。
   *
   * @param controller - 控制器。
   * @returns 用于收尾当前绑定的清理函数。
   */
  connect(controller: ContextMenuController): () => void {
    this.controller = controller;
    for (const record of this.bindingRecords.values()) {
      this.attachBindingRecord(record);
    }

    return () => {
      if (this.controller === controller) {
        this.disconnect();
      }
    };
  }

  /**
   * 处理 `destroy` 相关逻辑。
   *
   * @returns 无返回值。
   */
  destroy(): void {
    this.disconnect();
    this.bindingRecords.clear();
  }

  /**
   * 绑定画布。
   *
   * @param target - 当前目标对象。
   * @param meta - `meta`。
   * @returns 用于解除当前绑定的清理函数。
   */
  bindCanvas(
    target: LeaferContextMenuBindingTarget = this.app as unknown as LeaferContextMenuBindingTarget,
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
   * 绑定节点。
   *
   * @param key - 键值。
   * @param target - 当前目标对象。
   * @param meta - `meta`。
   * @returns 用于解除当前绑定的清理函数。
   */
  bindNode(
    key: string,
    target: LeaferContextMenuBindingTarget,
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
   * 绑定连线。
   *
   * @param key - 键值。
   * @param target - 当前目标对象。
   * @param meta - `meta`。
   * @returns 用于解除当前绑定的清理函数。
   */
  bindLink(
    key: string,
    target: LeaferContextMenuBindingTarget,
    meta?: Record<string, unknown>
  ): this {
    return this.bindTarget({
      key,
      kind: "link",
      target,
      meta
    });
  }

  /**
   * 绑定目标。
   *
   * @param binding - 绑定。
   * @returns 用于解除当前绑定的清理函数。
   */
  bindTarget(binding: LeaferContextMenuBinding): this {
    const record = this.setBindingRecord(binding);
    if (this.controller) {
      this.attachBindingRecord(record);
    }

    return this;
  }

  /**
   * 处理 `unbindTarget` 相关逻辑。
   *
   * @param key - 键值。
   * @returns 处理后的结果。
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
   * 处理 `disconnect` 相关逻辑。
   *
   * @returns 无返回值。
   */
  private disconnect(): void {
    for (const record of this.bindingRecords.values()) {
      this.detachBindingRecord(record);
    }

    this.controller = null;
  }

  /**
   * 设置绑定记录。
   *
   * @param binding - 绑定。
   * @returns 设置绑定记录的结果。
   */
  private setBindingRecord(
    binding: LeaferContextMenuBinding
  ): LeaferContextMenuBindingRecord {
    const normalizedBinding = normalizeBinding(binding);
    const previous = this.bindingRecords.get(normalizedBinding.key);
    if (previous) {
      this.detachBindingRecord(previous);
    }

    const record: LeaferContextMenuBindingRecord = {
      binding: normalizedBinding,
      listenerId: null
    };

    this.bindingRecords.set(normalizedBinding.key, record);
    return record;
  }

  /**
   * 处理 `attachBindingRecord` 相关逻辑。
   *
   * @param record - 记录。
   * @returns 无返回值。
   */
  private attachBindingRecord(record: LeaferContextMenuBindingRecord): void {
    if (!this.controller || record.listenerId || !record.binding.target.on_) {
      return;
    }

    record.listenerId =
      record.binding.target.on_(
        LEAFER_GRAPH_POINTER_MENU_EVENT,
        this.createBindingMenuHandler(record.binding)
      ) ?? null;
  }

  /**
   * 处理 `detachBindingRecord` 相关逻辑。
   *
   * @param record - 记录。
   * @returns 无返回值。
   */
  private detachBindingRecord(record: LeaferContextMenuBindingRecord): void {
    if (!record.listenerId) {
      return;
    }

    record.binding.target.off_?.(record.listenerId);
    record.listenerId = null;
  }

  /**
   * 创建绑定菜单处理器。
   *
   * @param binding - 绑定。
   * @returns 用于收尾当前绑定的清理函数。
   */
  private createBindingMenuHandler(
    binding: LeaferContextMenuBinding
  ): (event: LeaferPointerMenuEvent) => void {
    return (event) => {
      if (!this.controller) {
        return;
      }

      const preferredRecord = this.findClosestBindingRecord(event.target);
      if (preferredRecord && preferredRecord.binding.key !== binding.key) {
        return;
      }

      if (this.isHandledMenuEvent(event)) {
        return;
      }

      this.markHandledMenuEvent(event);
      this.preventNativeMenu(event);
      this.controller.open(this.createContext(event, binding));
    };
  }

  /**
   * 查找`Closest` 绑定记录。
   *
   * @param target - 当前目标对象。
   * @returns 处理后的结果。
   */
  private findClosestBindingRecord(
    target: unknown
  ): LeaferContextMenuBindingRecord | undefined {
    let current = isBindingTargetLike(target) ? target : null;

    while (current) {
      const record = this.findBindingRecordByTarget(current);
      if (record) {
        return record;
      }

      current = current.parent ?? null;
    }

    return undefined;
  }

  /**
   * 按目标查找绑定记录。
   *
   * @param target - 当前目标对象。
   * @returns 处理后的结果。
   */
  private findBindingRecordByTarget(
    target: LeaferContextMenuBindingTarget
  ): LeaferContextMenuBindingRecord | undefined {
    for (const record of this.bindingRecords.values()) {
      if (record.binding.target === target) {
        return record;
      }
    }

    return undefined;
  }

  /**
   * 判断是否为`Handled` 菜单事件。
   *
   * @param event - 当前事件对象。
   * @returns 对应的判断结果。
   */
  private isHandledMenuEvent(event: LeaferPointerMenuEvent): boolean {
    return (
      this.lastHandledMenuEvent === event ||
      Boolean(event.origin && this.lastHandledMenuOrigin === event.origin)
    );
  }

  /**
   * 处理 `markHandledMenuEvent` 相关逻辑。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  private markHandledMenuEvent(event: LeaferPointerMenuEvent): void {
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
   * 创建上下文。
   *
   * @param event - 当前事件对象。
   * @param binding - 绑定。
   * @returns 创建后的结果对象。
   */
  private createContext(
    event: LeaferPointerMenuEvent,
    binding: LeaferContextMenuBinding
  ): ContextMenuContext {
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
    const target = this.resolveTarget(binding, event);

    return {
      container: this.container,
      host: this.host,
      target,
      currentTarget: binding.target,
      bindingKey: binding.key,
      bindingKind: binding.kind ?? "custom",
      bindingMeta: binding.meta,
      event,
      originEvent: event.origin,
      triggerReason: "contextmenu",
      worldPoint,
      pagePoint,
      clientPoint,
      containerPoint,
      boxPoint: boxPoint ? toSafePoint(boxPoint) : undefined,
      localPoint: localPoint ? toSafePoint(localPoint) : undefined,
      data: {
        app: this.app,
        rawTarget: event.target
      }
    } as ContextMenuContext;
  }

  /**
   * 解析目标。
   *
   * @param binding - 绑定。
   * @param event - 当前事件对象。
   * @returns 处理后的结果。
   */
  private resolveTarget(
    binding: LeaferContextMenuBinding,
    event: LeaferPointerMenuEvent
  ): ContextMenuTarget {
    const resolvedTarget = binding.resolveTarget?.({
      app: this.app,
      binding,
      event,
      hitTarget: event.target
    });

    if (resolvedTarget) {
      return resolvedTarget;
    }

    return {
      kind: binding.kind ?? "custom",
      id:
        typeof binding.meta?.id === "string" ? binding.meta.id : undefined,
      meta: binding.meta,
      data: event.target
    };
  }

  /**
   * 解析`Container` 坐标。
   *
   * @param clientPoint - 客户端坐标。
   * @returns 处理后的结果。
   */
  private resolveContainerPoint(clientPoint: ContextMenuPoint): ContextMenuPoint {
    const rect = this.container.getBoundingClientRect();

    return {
      x: clientPoint.x - rect.left,
      y: clientPoint.y - rect.top
    };
  }

  /**
   * 处理 `preventNativeMenu` 相关逻辑。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  private preventNativeMenu(event: LeaferPointerMenuEvent): void {
    event.stopDefault?.();
    event.origin?.preventDefault?.();
  }
}

/**
 * 创建`Leafer` 上下文菜单适配器。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createLeaferContextMenuAdapter(
  options: CreateLeaferContextMenuAdapterOptions
): LeaferContextMenuAdapter {
  return new LeaferContextMenuAdapterImpl(options);
}

/**
 * 规范化绑定。
 *
 * @param binding - 绑定。
 * @returns 处理后的结果。
 */
function normalizeBinding(
  binding: LeaferContextMenuBinding
): LeaferContextMenuBinding {
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
 * 从原点解析页面坐标。
 *
 * @param origin - 原点。
 * @param ownerDocument - 所属对象文档。
 * @returns 处理后的结果。
 */
function resolvePagePointFromOrigin(
  origin: LeaferMenuOriginEvent | undefined,
  ownerDocument: Document
): ContextMenuPoint {
  if (!origin) {
    return { x: 0, y: 0 };
  }

  if (isFiniteNumber(origin.pageX) && isFiniteNumber(origin.pageY)) {
    return { x: origin.pageX, y: origin.pageY };
  }

  const ownerWindow = ownerDocument.defaultView;
  return {
    x: (isFiniteNumber(origin.clientX) ? origin.clientX : 0) + (ownerWindow?.scrollX ?? 0),
    y: (isFiniteNumber(origin.clientY) ? origin.clientY : 0) + (ownerWindow?.scrollY ?? 0)
  };
}

/**
 * 解析客户端坐标。
 *
 * @param origin - 原点。
 * @param pagePoint - 页面坐标。
 * @param ownerDocument - 所属对象文档。
 * @returns 处理后的结果。
 */
function resolveClientPoint(
  origin: LeaferMenuOriginEvent | undefined,
  pagePoint: ContextMenuPoint,
  ownerDocument: Document
): ContextMenuPoint {
  if (
    origin &&
    isFiniteNumber(origin.clientX) &&
    isFiniteNumber(origin.clientY)
  ) {
    return {
      x: origin.clientX,
      y: origin.clientY
    };
  }

  const ownerWindow = ownerDocument.defaultView;
  return {
    x: pagePoint.x - (ownerWindow?.scrollX ?? 0),
    y: pagePoint.y - (ownerWindow?.scrollY ?? 0)
  };
}

/**
 * 转换为安全坐标。
 *
 * @param point - 坐标。
 * @returns 处理后的结果。
 */
function toSafePoint(
  point: Partial<ContextMenuPoint> | undefined
): ContextMenuPoint {
  return {
    x: isFiniteNumber(point?.x) ? point.x : 0,
    y: isFiniteNumber(point?.y) ? point.y : 0
  };
}

/**
 * 判断是否为有限`Number`。
 *
 * @param value - 当前值。
 * @returns 对应的判断结果。
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * 判断是否为绑定目标`Like`。
 *
 * @param value - 当前值。
 * @returns 对应的判断结果。
 */
function isBindingTargetLike(
  value: unknown
): value is LeaferContextMenuBindingTarget {
  return typeof value === "object" && value !== null;
}
