/**
 * 图 Widget 环境装配模块。
 *
 * @remarks
 * 负责把 Widget 注册表、主题宿主和编辑宿主的初始化收敛到一处，
 * 避免主装配器继续同时关心主题模式解析、编辑配置归一化和 Widget 宿主基础依赖。
 */

import type { App } from "leafer-ui";
import type {
  LeaferGraphThemeMode,
  LeaferGraphWidgetEditingContext,
  LeaferGraphWidgetEditingOptions,
  LeaferGraphWidgetRenderer,
  LeaferGraphWidgetThemeContext
} from "@leafergraph/contracts";
import { LeaferGraphThemeHost } from "./graph_theme_host";
import {
  LeaferGraphWidgetEditingManager,
  resolveWidgetEditingOptions
} from "../widgets/widget_editing";
import { LeaferGraphWidgetRegistry } from "../widgets/widget_registry";

/**
 * Widget 环境装配输入。
 *
 * @remarks
 * 这层只处理 Widget 生态运行前的基础环境：
 * 主题模式、Widget 注册表、编辑宿主和缺失态 renderer。
 */
export interface LeaferGraphWidgetEnvironmentOptions {
  app: App;
  container: HTMLElement;
  themeMode?: LeaferGraphThemeMode;
  widgetEditing?: LeaferGraphWidgetEditingOptions;
  createMissingWidgetRenderer(): LeaferGraphWidgetRenderer;
  resolveWidgetTheme(mode: LeaferGraphThemeMode): LeaferGraphWidgetThemeContext;
}

/**
 * Widget 环境装配结果。
 *
 * @remarks
 * 主装配器后续会把这些对象继续接入节点、场景和主题运行时。
 */
export interface LeaferGraphWidgetEnvironment {
  widgetRegistry: LeaferGraphWidgetRegistry;
  themeHost: LeaferGraphThemeHost;
  widgetEditingManager: LeaferGraphWidgetEditingManager;
  widgetEditingContext: LeaferGraphWidgetEditingContext;
}

/**
 * 创建主包当前所需的 Widget 基础运行环境。
 *
 * @param options - Widget 环境装配输入。
 * @returns 主装配器继续向下接线所需的 Widget 基础环境。
 */
export function createLeaferGraphWidgetEnvironment(
  options: LeaferGraphWidgetEnvironmentOptions
): LeaferGraphWidgetEnvironment {
  const widgetRegistry = new LeaferGraphWidgetRegistry(
    options.createMissingWidgetRenderer()
  );
  const resolvedEditing = resolveWidgetEditingOptions(
    options.themeMode ?? "light",
    options.widgetEditing
  );
  const themeHost = new LeaferGraphThemeHost({
    initialMode: resolvedEditing.themeMode,
    resolveWidgetTheme: options.resolveWidgetTheme
  });
  const widgetEditingManager = new LeaferGraphWidgetEditingManager({
    app: options.app,
    container: options.container,
    theme: themeHost.getWidgetTheme(),
    editing: resolvedEditing.editing
  });

  return {
    widgetRegistry,
    themeHost,
    widgetEditingManager,
    widgetEditingContext: widgetEditingManager
  };
}
