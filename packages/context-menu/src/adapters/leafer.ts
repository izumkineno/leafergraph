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

  destroy(): void {
    this.disconnect();
    this.bindingRecords.clear();
  }

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

  bindTarget(binding: LeaferContextMenuBinding): this {
    const record = this.setBindingRecord(binding);
    if (this.controller) {
      this.attachBindingRecord(record);
    }

    return this;
  }

  unbindTarget(key: string): this {
    const record = this.bindingRecords.get(key);
    if (!record) {
      return this;
    }

    this.detachBindingRecord(record);
    this.bindingRecords.delete(key);
    return this;
  }

  private disconnect(): void {
    for (const record of this.bindingRecords.values()) {
      this.detachBindingRecord(record);
    }

    this.controller = null;
  }

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

  private detachBindingRecord(record: LeaferContextMenuBindingRecord): void {
    if (!record.listenerId) {
      return;
    }

    record.binding.target.off_?.(record.listenerId);
    record.listenerId = null;
  }

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

  private isHandledMenuEvent(event: LeaferPointerMenuEvent): boolean {
    return (
      this.lastHandledMenuEvent === event ||
      Boolean(event.origin && this.lastHandledMenuOrigin === event.origin)
    );
  }

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

  private resolveContainerPoint(clientPoint: ContextMenuPoint): ContextMenuPoint {
    const rect = this.container.getBoundingClientRect();

    return {
      x: clientPoint.x - rect.left,
      y: clientPoint.y - rect.top
    };
  }

  private preventNativeMenu(event: LeaferPointerMenuEvent): void {
    event.stopDefault?.();
    event.origin?.preventDefault?.();
  }
}

export function createLeaferContextMenuAdapter(
  options: CreateLeaferContextMenuAdapterOptions
): LeaferContextMenuAdapter {
  return new LeaferContextMenuAdapterImpl(options);
}

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

function toSafePoint(
  point: Partial<ContextMenuPoint> | undefined
): ContextMenuPoint {
  return {
    x: isFiniteNumber(point?.x) ? point.x : 0,
    y: isFiniteNumber(point?.y) ? point.y : 0
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBindingTargetLike(
  value: unknown
): value is LeaferContextMenuBindingTarget {
  return typeof value === "object" && value !== null;
}
