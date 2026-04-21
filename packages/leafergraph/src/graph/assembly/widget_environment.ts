/**
 * 图 Widget 环境装配模块。
 *
 * @remarks
 * 负责把 Widget 注册表、主题宿主和编辑宿主的初始化收敛到一处，
 * 避免主装配器继续同时关心主题模式解析、编辑配置归一化和 Widget 宿主基础依赖。
 */

import type { App } from "leafer-ui";
import type {
  LeaferGraphWidgetEditingContext,
  LeaferGraphWidgetRenderer
} from "@leafergraph/core/contracts";
import type {
  NormalizedLeaferGraphLeaferEditorConfig,
  NormalizedLeaferGraphLeaferTextEditorConfig,
  NormalizedLeaferGraphWidgetConfig
} from "@leafergraph/core/config";
import type {
  LeaferGraphThemeMode,
  LeaferGraphWidgetThemeContext
} from "@leafergraph/core/theme";
import { LeaferGraphThemeHost } from "../theme/host";
import {
  LeaferGraphWidgetEditingManager,
  LeaferGraphWidgetRegistry
} from "@leafergraph/core/widget-runtime";

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
  widgetConfig: NormalizedLeaferGraphWidgetConfig;
  leaferEditorConfig: NormalizedLeaferGraphLeaferEditorConfig;
  leaferTextEditorConfig: NormalizedLeaferGraphLeaferTextEditorConfig;
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
  const themeHost = new LeaferGraphThemeHost({
    initialMode: options.themeMode ?? "light",
    resolveWidgetTheme: options.resolveWidgetTheme
  });
  const widgetEditingManager = new LeaferGraphWidgetEditingManager({
    app: options.app,
    container: options.container,
    theme: themeHost.getWidgetTheme(),
    editing: options.widgetConfig.editing,
    editorConfig: options.leaferEditorConfig,
    textEditorConfig: options.leaferTextEditorConfig
  });

  return {
    widgetRegistry,
    themeHost,
    widgetEditingManager,
    widgetEditingContext: widgetEditingManager
  };
}
