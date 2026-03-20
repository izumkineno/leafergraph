import type {
  GraphDocument,
  LeaferGraphNodePlugin
} from "leafergraph";

/** editor 当前支持的本地 bundle 槽位。 */
export type EditorBundleSlot = "demo" | "node" | "widget";

/** bundle 可声明的依赖 bundle id。 */
export type EditorBundleRequirement = string;

/**
 * bundle manifest 的公共字段。
 * 这套协议只属于 editor 装载层，不进入主包公共 API。
 */
export interface EditorBundleManifestBase {
  /** bundle 的稳定唯一标识。 */
  id: string;
  /** bundle 名称，用于 editor 面板展示。 */
  name: string;
  /** bundle 运行时类型，必须和加载槽位一致。 */
  kind: EditorBundleSlot;
  /** bundle 版本号。 */
  version?: string;
  /** 当前 bundle 依赖的其它 bundle id。 */
  requires?: EditorBundleRequirement[];
}

/** demo bundle 只负责提供图数据。 */
export interface EditorDemoBundleManifest extends EditorBundleManifestBase {
  kind: "demo";
  document: GraphDocument;
}

/**
 * node / widget bundle 统一走插件安装入口。
 * `quickCreateNodeType` 用来告诉 editor 右键创建节点时优先使用哪个类型。
 */
export interface EditorPluginBundleManifest extends EditorBundleManifestBase {
  kind: "node" | "widget";
  plugin: LeaferGraphNodePlugin;
  quickCreateNodeType?: string;
}

/** editor 当前支持的全部 bundle manifest。 */
export type EditorBundleManifest =
  | EditorDemoBundleManifest
  | EditorPluginBundleManifest;

/** editor 内部单个 bundle 记录。 */
export interface EditorBundleRecordState {
  slot: EditorBundleSlot;
  bundleKey: string;
  manifest: EditorBundleManifest | null;
  fileName: string | null;
  enabled: boolean;
  loading: boolean;
  error: string | null;
  persisted: boolean;
  restoredFromPersistence: boolean;
  savedAt: number | null;
}

/** editor 内部的全部 bundle 目录。 */
export type EditorBundleCatalogState = Record<
  EditorBundleSlot,
  EditorBundleRecordState[]
>;

/** editor 对每个 bundle 计算后的展示状态。 */
export type EditorBundleResolvedStatus =
  | "idle"
  | "ready"
  | "dependency-missing"
  | "failed"
  | "loading";

/** 单个 bundle 经过依赖分析后的最终结果。 */
export interface EditorResolvedBundleRecordState
  extends EditorBundleRecordState {
  status: EditorBundleResolvedStatus;
  active: boolean;
  missingRequirements: EditorBundleRequirement[];
}

/** editor 真正传给 GraphViewport 的运行时装配结果。 */
export interface EditorBundleRuntimeSetup {
  document: GraphDocument;
  plugins: LeaferGraphNodePlugin[];
  quickCreateNodeType?: string;
  bundles: Record<EditorBundleSlot, EditorResolvedBundleRecordState[]>;
  currentDemo: EditorResolvedBundleRecordState | null;
}

/** IIFE bundle 可调用的 editor 全局桥接。 */
export interface LeaferGraphEditorBundleBridge {
  registerBundle(manifest: EditorBundleManifest): void;
}

/** `window` / `globalThis` 上暴露的 editor 装载全局对象。 */
declare global {
  interface Window {
    LeaferGraphRuntime?: typeof import("leafergraph");
    LeaferGraphEditorBundleBridge?: LeaferGraphEditorBundleBridge;
  }

  interface GlobalThis {
    LeaferGraphRuntime?: typeof import("leafergraph");
    LeaferGraphEditorBundleBridge?: LeaferGraphEditorBundleBridge;
  }
}
