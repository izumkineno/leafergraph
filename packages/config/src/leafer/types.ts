import type { IAppConfig, IEditorConfig, ILeaferConfig } from "leafer-ui";

export type LeaferGraphLeaferMoveScrollMode =
  | boolean
  | "x"
  | "y"
  | "limit"
  | "x-limit"
  | "y-limit";

/** Leafer App 配置。 */
export interface LeaferGraphLeaferAppConfig {
  pixelSnap?: boolean;
  usePartRender?: boolean;
  usePartLayout?: boolean;
  raw?: Partial<IAppConfig>;
}

/** Leafer tree 配置。 */
export interface LeaferGraphLeaferTreeConfig {
  raw?: Partial<ILeaferConfig>;
}

/** 视口缩放配置。 */
export interface LeaferGraphLeaferViewportZoomConfig {
  min?: number;
  max?: number;
}

/** 视口平移配置。 */
export interface LeaferGraphLeaferViewportMoveConfig {
  holdSpaceKey?: boolean;
  holdMiddleKey?: boolean;
  scroll?: LeaferGraphLeaferMoveScrollMode;
}

/** Leafer 视口配置。 */
export interface LeaferGraphLeaferViewportConfig {
  zoom?: LeaferGraphLeaferViewportZoomConfig;
  move?: LeaferGraphLeaferViewportMoveConfig;
  raw?: Partial<ILeaferConfig>;
}

/** Leafer view 配置。 */
export interface LeaferGraphLeaferViewConfig {
  fitPadding?: number;
  raw?: Record<string, unknown>;
}

/** Leafer editor 配置。 */
export interface LeaferGraphLeaferEditorConfig {
  raw?: Partial<IEditorConfig>;
}

/** Leafer text editor 配置。 */
export interface LeaferGraphLeaferTextEditorConfig {
  useOfficialTextEditor?: boolean;
  raw?: Record<string, unknown>;
}

/** 官方插件透传配置。 */
export interface LeaferGraphLeaferPluginConfig {
  raw?: Record<string, unknown>;
}

export type LeaferGraphLeaferResizeConfig = LeaferGraphLeaferPluginConfig;
export type LeaferGraphLeaferStateConfig = LeaferGraphLeaferPluginConfig;
export type LeaferGraphLeaferFindConfig = LeaferGraphLeaferPluginConfig;
export type LeaferGraphLeaferFlowConfig = LeaferGraphLeaferPluginConfig;

/** Leafer 相关总配置。 */
export interface LeaferGraphLeaferConfig {
  app?: LeaferGraphLeaferAppConfig;
  tree?: LeaferGraphLeaferTreeConfig;
  viewport?: LeaferGraphLeaferViewportConfig;
  view?: LeaferGraphLeaferViewConfig;
  editor?: LeaferGraphLeaferEditorConfig;
  textEditor?: LeaferGraphLeaferTextEditorConfig;
  resize?: LeaferGraphLeaferResizeConfig;
  state?: LeaferGraphLeaferStateConfig;
  find?: LeaferGraphLeaferFindConfig;
  flow?: LeaferGraphLeaferFlowConfig;
}

/** 归一化后的 Leafer App 配置。 */
export interface NormalizedLeaferGraphLeaferAppConfig {
  pixelSnap: boolean;
  usePartRender: boolean;
  usePartLayout: boolean;
  raw?: Partial<IAppConfig>;
}

/** 归一化后的 Leafer tree 配置。 */
export interface NormalizedLeaferGraphLeaferTreeConfig {
  raw?: Partial<ILeaferConfig>;
}

/** 归一化后的视口缩放配置。 */
export interface NormalizedLeaferGraphLeaferViewportZoomConfig {
  min: number;
  max: number;
}

/** 归一化后的视口平移配置。 */
export interface NormalizedLeaferGraphLeaferViewportMoveConfig {
  holdSpaceKey: boolean;
  holdMiddleKey: boolean;
  scroll: LeaferGraphLeaferMoveScrollMode;
}

/** 归一化后的 Leafer 视口配置。 */
export interface NormalizedLeaferGraphLeaferViewportConfig {
  zoom: NormalizedLeaferGraphLeaferViewportZoomConfig;
  move: NormalizedLeaferGraphLeaferViewportMoveConfig;
  raw?: Partial<ILeaferConfig>;
}

/** 归一化后的 Leafer view 配置。 */
export interface NormalizedLeaferGraphLeaferViewConfig {
  fitPadding: number;
  raw?: Record<string, unknown>;
}

/** 归一化后的 Leafer editor 配置。 */
export interface NormalizedLeaferGraphLeaferEditorConfig {
  raw?: Partial<IEditorConfig>;
}

/** 归一化后的 Leafer text editor 配置。 */
export interface NormalizedLeaferGraphLeaferTextEditorConfig {
  useOfficialTextEditor: boolean;
  raw?: Record<string, unknown>;
}

/** 归一化后的官方插件透传配置。 */
export interface NormalizedLeaferGraphLeaferPluginConfig {
  raw?: Record<string, unknown>;
}

export type NormalizedLeaferGraphLeaferResizeConfig =
  NormalizedLeaferGraphLeaferPluginConfig;
export type NormalizedLeaferGraphLeaferStateConfig =
  NormalizedLeaferGraphLeaferPluginConfig;
export type NormalizedLeaferGraphLeaferFindConfig =
  NormalizedLeaferGraphLeaferPluginConfig;
export type NormalizedLeaferGraphLeaferFlowConfig =
  NormalizedLeaferGraphLeaferPluginConfig;

/** 归一化后的 Leafer 总配置。 */
export interface NormalizedLeaferGraphLeaferConfig {
  app: NormalizedLeaferGraphLeaferAppConfig;
  tree: NormalizedLeaferGraphLeaferTreeConfig;
  viewport: NormalizedLeaferGraphLeaferViewportConfig;
  view: NormalizedLeaferGraphLeaferViewConfig;
  editor: NormalizedLeaferGraphLeaferEditorConfig;
  textEditor: NormalizedLeaferGraphLeaferTextEditorConfig;
  resize: NormalizedLeaferGraphLeaferResizeConfig;
  state: NormalizedLeaferGraphLeaferStateConfig;
  find: NormalizedLeaferGraphLeaferFindConfig;
  flow: NormalizedLeaferGraphLeaferFlowConfig;
}
