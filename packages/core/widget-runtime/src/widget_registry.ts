/**
 * Widget 注册表模块。
 *
 * @remarks
 * 负责主包唯一 Widget 条目的注册、查询和 renderer 归一化。
 */

import type {
  RegisterWidgetOptions,
  WidgetDefinition,
  WidgetDefinitionReader
} from "@leafergraph/core/node";
import { createWidgetLifecycleRenderer } from "./widget_lifecycle";
import type {
  LeaferGraphWidgetEntry,
  LeaferGraphWidgetRenderer,
  LeaferGraphWidgetRendererLike
} from "@leafergraph/core/contracts";

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
 * 3. 作为 `@leafergraph/core/node` 的 Widget 定义读取源
 */
export class LeaferGraphWidgetRegistry implements WidgetDefinitionReader {
  private readonly entries = new Map<string, RegisteredWidgetEntry>();
  private readonly fallbackRenderer: LeaferGraphWidgetRenderer;

  /**
   * 初始化 LeaferGraphWidgetRegistry 实例。
   *
   * @param fallbackRenderer - 回退渲染器。
   */
  constructor(fallbackRenderer: LeaferGraphWidgetRenderer) {
    this.fallbackRenderer = fallbackRenderer;
  }

  /**
   *  注册一个完整 Widget 条目。
   *
   * @param entry - 条目。
   * @param options - 可选配置项。
   * @returns 无返回值。
   */
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

  /**
   *  `register` 的语义化别名。
   *
   * @param entry - 条目。
   * @param options - 可选配置项。
   * @returns 无返回值。
   */
  registerWidget(entry: LeaferGraphWidgetEntry, options?: RegisterWidgetOptions): void {
    this.register(entry, options);
  }

  /**
   *  从注册表移除一个 Widget。
   *
   * @param type - 类型。
   * @returns 无返回值。
   */
  unregister(type: string): void {
    this.entries.delete(type);
  }

  /**
   *  `unregister` 的语义化别名。
   *
   * @param type - 类型。
   * @returns 无返回值。
   */
  unregisterWidget(type: string): void {
    this.unregister(type);
  }

  /**
   *  获取 Widget 条目；未命中时返回 `undefined`。
   *
   * @param type - 类型。
   * @returns 处理后的结果。
   */
  get(type: string): WidgetDefinition | undefined {
    return this.entries.get(type);
  }

  /**
   *  获取完整 Widget 条目；未命中时返回 `undefined`。
   *
   * @param type - 类型。
   * @returns 处理后的结果。
   */
  getWidget(type: string): LeaferGraphWidgetEntry | undefined {
    return this.entries.get(type);
  }

  /**
   *  获取 Widget 条目；未命中时抛错。
   *
   * @param type - 类型。
   * @returns 处理后的结果。
   */
  require(type: string): LeaferGraphWidgetEntry {
    const entry = this.getWidget(type);

    if (!entry) {
      throw new Error(`未注册的 Widget 类型: ${type}`);
    }

    return entry;
  }

  /**
   *  `require` 的语义化别名。
   *
   * @param type - 类型。
   * @returns 获取Widget的结果。
   */
  requireWidget(type: string): LeaferGraphWidgetEntry {
    return this.require(type);
  }

  /**
   *  判断 Widget 类型是否存在。
   *
   * @param type - 类型。
   * @returns 对应的判断结果。
   */
  has(type: string): boolean {
    return this.entries.has(type);
  }

  /**
   *  `has` 的语义化别名。
   *
   * @param type - 类型。
   * @returns 对应的判断结果。
   */
  hasWidget(type: string): boolean {
    return this.has(type);
  }

  /**
   *  以数组形式返回全部 Widget 条目。
   *
   * @returns 收集到的结果列表。
   */
  list(): LeaferGraphWidgetEntry[] {
    return [...this.entries.values()];
  }

  /**
   *  `list` 的语义化别名。
   *
   * @returns 收集到的结果列表。
   */
  listWidgets(): LeaferGraphWidgetEntry[] {
    return this.list();
  }

  /**
   *  获取某个 Widget 的正式 renderer。
   *
   * @param type - 类型。
   * @returns 处理后的结果。
   */
  getRenderer(type: string): LeaferGraphWidgetRenderer | undefined {
    return this.entries.get(type)?.renderer;
  }

  /**
   * 获取某个 Widget 的可执行 renderer。
   * 未注册时自动回退到内部缺失态 renderer。
   *
   * @param type - 类型。
   * @returns 处理后的结果。
   */
  resolveRenderer(type: string): LeaferGraphWidgetRenderer {
    return this.getRenderer(type) ?? this.fallbackRenderer;
  }

  /**
   * 销毁注册表，清理所有资源，防止内存泄漏。
   *
   * @returns 无返回值。
   */
  dispose(): void {
    this.entries.clear();
  }
}

/**
 *  把生命周期对象或函数式 renderer 统一归一化成正式 renderer。
 *
 * @param renderer - 渲染器。
 * @returns 处理后的结果。
 */
function normalizeWidgetRenderer(
  renderer: LeaferGraphWidgetRendererLike
): LeaferGraphWidgetRenderer {
  if (typeof renderer === "function") {
    return renderer;
  }

  return createWidgetLifecycleRenderer(renderer);
}
