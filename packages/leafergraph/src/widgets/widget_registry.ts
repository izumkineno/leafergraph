import type {
  RegisterWidgetOptions,
  WidgetDefinition,
  WidgetDefinitionReader
} from "@leafergraph/node";
import { createWidgetLifecycleRenderer } from "./widget_lifecycle";
import type {
  LeaferGraphWidgetEntry,
  LeaferGraphWidgetRenderer,
  LeaferGraphWidgetRendererLike
} from "../api/plugin";

/**
 * 注册后的 Widget 条目。
 * 对外仍暴露 `LeaferGraphWidgetEntry` 结构，只是内部会把 renderer 归一化成正式函数。
 */
type RegisteredWidgetEntry = Omit<LeaferGraphWidgetEntry, "renderer"> & {
  renderer: LeaferGraphWidgetRenderer;
};

/**
 * 主包唯一生效的 Widget 注册表。
 * 它同时承担三件事：
 * 1. 保存 Widget 的数据定义
 * 2. 保存并归一化 Widget renderer
 * 3. 作为 `@leafergraph/node` 的 Widget 定义读取源
 */
export class LeaferGraphWidgetRegistry implements WidgetDefinitionReader {
  private readonly entries = new Map<string, RegisteredWidgetEntry>();
  private readonly fallbackRenderer: LeaferGraphWidgetRenderer;

  constructor(fallbackRenderer: LeaferGraphWidgetRenderer) {
    this.fallbackRenderer = fallbackRenderer;
  }

  /** 注册一个完整 Widget 条目。 */
  register(entry: LeaferGraphWidgetEntry, options: RegisterWidgetOptions = {}): void {
    const type = entry.type.trim();

    if (!type) {
      throw new Error("Widget 类型不能为空");
    }

    if (!options.overwrite && this.entries.has(type)) {
      throw new Error(`Widget 类型已存在: ${type}`);
    }

    this.entries.set(type, {
      ...entry,
      type,
      renderer: normalizeWidgetRenderer(entry.renderer)
    });
  }

  /** `register` 的语义化别名。 */
  registerWidget(entry: LeaferGraphWidgetEntry, options?: RegisterWidgetOptions): void {
    this.register(entry, options);
  }

  /** 从注册表移除一个 Widget。 */
  unregister(type: string): void {
    this.entries.delete(type);
  }

  /** `unregister` 的语义化别名。 */
  unregisterWidget(type: string): void {
    this.unregister(type);
  }

  /** 获取 Widget 条目；未命中时返回 `undefined`。 */
  get(type: string): WidgetDefinition | undefined {
    return this.entries.get(type);
  }

  /** 获取完整 Widget 条目；未命中时返回 `undefined`。 */
  getWidget(type: string): LeaferGraphWidgetEntry | undefined {
    return this.entries.get(type);
  }

  /** 获取 Widget 条目；未命中时抛错。 */
  require(type: string): LeaferGraphWidgetEntry {
    const entry = this.getWidget(type);

    if (!entry) {
      throw new Error(`未注册的 Widget 类型: ${type}`);
    }

    return entry;
  }

  /** `require` 的语义化别名。 */
  requireWidget(type: string): LeaferGraphWidgetEntry {
    return this.require(type);
  }

  /** 判断 Widget 类型是否存在。 */
  has(type: string): boolean {
    return this.entries.has(type);
  }

  /** `has` 的语义化别名。 */
  hasWidget(type: string): boolean {
    return this.has(type);
  }

  /** 以数组形式返回全部 Widget 条目。 */
  list(): LeaferGraphWidgetEntry[] {
    return [...this.entries.values()];
  }

  /** `list` 的语义化别名。 */
  listWidgets(): LeaferGraphWidgetEntry[] {
    return this.list();
  }

  /** 获取某个 Widget 的正式 renderer。 */
  getRenderer(type: string): LeaferGraphWidgetRenderer | undefined {
    return this.entries.get(type)?.renderer;
  }

  /**
   * 获取某个 Widget 的可执行 renderer。
   * 未注册时自动回退到内部缺失态 renderer。
   */
  resolveRenderer(type: string): LeaferGraphWidgetRenderer {
    return this.getRenderer(type) ?? this.fallbackRenderer;
  }
}

/** 把生命周期对象或函数式 renderer 统一归一化成正式 renderer。 */
function normalizeWidgetRenderer(
  renderer: LeaferGraphWidgetRendererLike
): LeaferGraphWidgetRenderer {
  if (typeof renderer === "function") {
    return renderer;
  }

  return createWidgetLifecycleRenderer(renderer);
}
