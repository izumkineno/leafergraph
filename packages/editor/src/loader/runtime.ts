import * as LeaferGraphRuntime from "leafergraph";
import type { GraphDocument, LeaferGraphNodePlugin } from "leafergraph";

import type {
  EditorBundleCatalogState,
  EditorBundleManifest,
  EditorBundleRecordState,
  EditorBundleRequirement,
  EditorBundleRuntimeSetup,
  EditorBundleSlot,
  EditorPluginBundleManifest
} from "./types";

/** editor 固定支持的 bundle 槽位顺序。 */
export const EDITOR_BUNDLE_SLOTS = ["demo", "node", "widget"] as const;

/** editor 在没有任何 demo bundle 时使用的空图。 */
export const EMPTY_EDITOR_DOCUMENT: GraphDocument = {
  documentId: "editor-empty-document",
  revision: 0,
  appKind: "leafergraph-local",
  nodes: [],
  links: []
};

/**
 * 单次本地 script 注入的等待态。
 * IIFE bundle 只能在这里声明一次 manifest。
 */
const pendingBundleLoadState: {
  slot: EditorBundleSlot | null;
  manifest: EditorBundleManifest | null;
  error: string | null;
} = {
  slot: null,
  manifest: null,
  error: null
};

/** 基于槽位和 bundle id 生成稳定主键。 */
export function createEditorBundleRecordKey(
  slot: EditorBundleSlot,
  bundleId: string
): string {
  return `${slot}:${bundleId}`;
}

/** 读取 bundle 记录显示用的逻辑 id。 */
export function resolveEditorBundleRecordId(
  record: EditorBundleRecordState
): string | null {
  return record.manifest?.id ?? null;
}

/** 创建空目录状态。 */
export function createInitialBundleCatalogState(): EditorBundleCatalogState {
  return {
    demo: [],
    node: [],
    widget: []
  };
}

/** 创建一个“正在加载”占位记录。 */
export function createLoadingBundleRecordState(
  slot: EditorBundleSlot,
  fileName: string,
  bundleKey = `${slot}:__loading__:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 8)}`
): EditorBundleRecordState {
  return {
    slot,
    bundleKey,
    manifest: null,
    fileName,
    enabled: false,
    loading: true,
    error: null,
    persisted: false,
    restoredFromPersistence: false,
    savedAt: null
  };
}

/** 创建单个正式 bundle 记录。 */
export function createLoadedBundleRecordState(options: {
  slot: EditorBundleSlot;
  manifest: EditorBundleManifest;
  fileName: string;
  enabled: boolean;
  persisted: boolean;
  restoredFromPersistence: boolean;
  savedAt?: number | null;
}): EditorBundleRecordState {
  return {
    slot: options.slot,
    bundleKey: createEditorBundleRecordKey(options.slot, options.manifest.id),
    manifest: options.manifest,
    fileName: options.fileName,
    enabled: options.enabled,
    loading: false,
    error: null,
    persisted: options.persisted,
    restoredFromPersistence: options.restoredFromPersistence,
    savedAt: options.savedAt ?? null
  };
}

/** 以同一 bundleKey 替换或追加 bundle 记录。 */
export function upsertEditorBundleRecord(
  catalog: EditorBundleCatalogState,
  record: EditorBundleRecordState
): EditorBundleCatalogState {
  const currentRecords = catalog[record.slot];
  const nextRecords = [...currentRecords];
  const currentIndex = nextRecords.findIndex(
    (entry) => entry.bundleKey === record.bundleKey
  );

  if (record.slot === "demo" && record.enabled) {
    for (let index = 0; index < nextRecords.length; index += 1) {
      nextRecords[index] = {
        ...nextRecords[index],
        enabled: false
      };
    }
  }

  if (currentIndex >= 0) {
    nextRecords[currentIndex] = record;
  } else {
    nextRecords.push(record);
  }

  return {
    ...catalog,
    [record.slot]: nextRecords
  };
}

/** 删除指定 bundle 记录。 */
export function removeEditorBundleRecord(
  catalog: EditorBundleCatalogState,
  slot: EditorBundleSlot,
  bundleKey: string
): EditorBundleCatalogState {
  return {
    ...catalog,
    [slot]: catalog[slot].filter((record) => record.bundleKey !== bundleKey)
  };
}

/** 按主键读取 bundle 记录。 */
export function findEditorBundleRecord(
  catalog: EditorBundleCatalogState,
  slot: EditorBundleSlot,
  bundleKey: string
): EditorBundleRecordState | null {
  return (
    catalog[slot].find((record) => record.bundleKey === bundleKey) ?? null
  );
}

/** 更新单个 bundle 记录的启用态。 */
export function setEditorBundleRecordEnabled(
  catalog: EditorBundleCatalogState,
  slot: EditorBundleSlot,
  bundleKey: string,
  enabled: boolean
): EditorBundleCatalogState {
  if (slot === "demo") {
    return setCurrentDemoBundle(catalog, enabled ? bundleKey : null);
  }

  return {
    ...catalog,
    [slot]: catalog[slot].map((record) =>
      record.bundleKey === bundleKey
        ? {
            ...record,
            enabled
          }
        : record
    )
  };
}

/** 设置当前 demo；传入 null 时清空所有当前 demo 标记。 */
export function setCurrentDemoBundle(
  catalog: EditorBundleCatalogState,
  bundleKey: string | null
): EditorBundleCatalogState {
  return {
    ...catalog,
    demo: catalog.demo.map((record) => ({
      ...record,
      enabled: bundleKey !== null && record.bundleKey === bundleKey
    }))
  };
}

/** 获取对用户更友好的错误文本。 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "发生了未知错误";
}

/** 生成忽略 identity 字段的文档对比快照。 */
function createDocumentComparableSnapshot(document: GraphDocument): unknown {
  return {
    appKind: document.appKind,
    nodes: document.nodes,
    links: document.links,
    meta: document.meta ?? null,
    capabilityProfile: document.capabilityProfile ?? null,
    adapterBinding: document.adapterBinding ?? null
  };
}

/** 判断两份图文档在忽略 documentId/revision 后是否一致。 */
export function areEditorBundleDocumentsEquivalent(
  left: GraphDocument,
  right: GraphDocument
): boolean {
  return (
    JSON.stringify(createDocumentComparableSnapshot(left)) ===
    JSON.stringify(createDocumentComparableSnapshot(right))
  );
}

/** 规范化字符串字段。 */
function requireNonEmptyText(value: unknown, fieldName: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new Error(`Bundle 缺少合法的 ${fieldName}`);
  }
  return text;
}

/** 判断未知值是否为对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 校验插件对象的最小形态。 */
function requirePlugin(value: unknown): LeaferGraphNodePlugin {
  if (!isRecord(value)) {
    throw new Error("Bundle 缺少合法的 plugin 对象");
  }

  const name = requireNonEmptyText(value.name, "plugin.name");
  const install = value.install;

  if (typeof install !== "function") {
    throw new Error("Bundle 缺少合法的 plugin.install");
  }

  return {
    ...value,
    name,
    install
  } as LeaferGraphNodePlugin;
}

/** 归一化 bundle 依赖列表。 */
function normalizeBundleRequirements(
  value: unknown
): EditorBundleRequirement[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error("Bundle requires 必须是数组");
  }

  const requirements = value
    .map((item) => requireNonEmptyText(item, "requires[]"))
    .filter((item, index, items) => items.indexOf(item) === index);

  return requirements.length > 0 ? requirements : undefined;
}

/** 归一化 quick create 类型字段。 */
function normalizeQuickCreateNodeType(value: unknown): string | undefined {
  const type = typeof value === "string" ? value.trim() : "";
  return type || undefined;
}

/** 归一化并校验图文档。 */
function requireGraphDocument(value: unknown): GraphDocument {
  if (!isRecord(value)) {
    throw new Error("Demo bundle 缺少 document");
  }

  const nodes = value.nodes;
  const links = value.links;

  if (!Array.isArray(nodes) || !Array.isArray(links)) {
    throw new Error("Demo bundle document 必须包含 nodes 和 links 数组");
  }

  return structuredClone({
    documentId:
      typeof value.documentId === "string" && value.documentId.trim()
        ? value.documentId.trim()
        : "bundle-document",
    revision:
      typeof value.revision === "number" || typeof value.revision === "string"
        ? value.revision
        : 0,
    appKind:
      typeof value.appKind === "string" && value.appKind.trim()
        ? value.appKind.trim()
        : "leafergraph-local",
    nodes,
    links,
    meta: isRecord(value.meta) ? value.meta : undefined,
    capabilityProfile: isRecord(value.capabilityProfile)
      ? value.capabilityProfile
      : undefined,
    adapterBinding: isRecord(value.adapterBinding)
      ? value.adapterBinding
      : undefined
  }) as GraphDocument;
}

/**
 * 把未知 manifest 归一化成 editor 可消费的正式结构。
 * 归一化后会立即冻结“这次加载到底是什么”，避免后续状态计算还要处理脏数据。
 */
function normalizeBundleManifest(
  expectedSlot: EditorBundleSlot,
  manifest: unknown
): EditorBundleManifest {
  if (!isRecord(manifest)) {
    throw new Error("Bundle 没有注册合法的 manifest 对象");
  }

  const kind = requireNonEmptyText(manifest.kind, "kind") as EditorBundleSlot;
  if (kind !== expectedSlot) {
    throw new Error(`当前槽位需要 ${expectedSlot} bundle，但文件注册的是 ${kind}`);
  }

  const id = requireNonEmptyText(manifest.id, "id");
  const name = requireNonEmptyText(manifest.name, "name");
  const version =
    typeof manifest.version === "string" && manifest.version.trim()
      ? manifest.version.trim()
      : undefined;
  const requires = normalizeBundleRequirements(manifest.requires);

  if (kind === "demo") {
    return {
      id,
      name,
      kind,
      version,
      requires,
      document: requireGraphDocument(manifest.document)
    };
  }

  return {
    id,
    name,
    kind,
    version,
    requires,
    plugin: requirePlugin(manifest.plugin),
    quickCreateNodeType: normalizeQuickCreateNodeType(
      manifest.quickCreateNodeType
    )
  };
}

/**
 * 把主包运行时和 editor bridge 暴露到全局。
 * browser IIFE bundle 会直接从这里读取宿主能力并完成 manifest 注册。
 */
export function ensureEditorBundleRuntimeGlobals(): void {
  const bundleHost = globalThis as typeof globalThis & {
    LeaferGraphRuntime?: typeof import("leafergraph");
    LeaferGraphEditorBundleBridge?: {
      registerBundle(manifest: EditorBundleManifest): void;
    };
  };

  bundleHost.LeaferGraphRuntime = LeaferGraphRuntime;
  bundleHost.LeaferGraphEditorBundleBridge = {
    registerBundle(manifest: EditorBundleManifest) {
      if (!pendingBundleLoadState.slot) {
        throw new Error("当前没有等待中的本地 bundle 加载任务");
      }

      if (pendingBundleLoadState.manifest) {
        throw new Error("一个 bundle 文件只能注册一次 manifest");
      }

      pendingBundleLoadState.manifest = normalizeBundleManifest(
        pendingBundleLoadState.slot,
        manifest
      );
    }
  };
}

/**
 * 读取一个本地 JS 文件，并按 IIFE bundle 协议完成注入。
 * 成功后返回已归一化的 manifest；失败时不会污染现有槽位状态。
 */
export async function loadEditorBundleSource(
  slot: EditorBundleSlot,
  sourceCode: string,
  sourceLabel = "inline bundle"
): Promise<EditorBundleManifest> {
  ensureEditorBundleRuntimeGlobals();

  if (pendingBundleLoadState.slot) {
    throw new Error("当前已有一个 bundle 正在加载，请稍后再试");
  }

  const objectUrl = URL.createObjectURL(
    new Blob([sourceCode], {
      type: "text/javascript"
    })
  );
  const script = document.createElement("script");
  const ownerWindow = document.defaultView ?? window;

  pendingBundleLoadState.slot = slot;
  pendingBundleLoadState.manifest = null;
  pendingBundleLoadState.error = null;

  const cleanup = () => {
    script.remove();
    ownerWindow.removeEventListener("error", handleWindowError, true);
    URL.revokeObjectURL(objectUrl);
    pendingBundleLoadState.slot = null;
    pendingBundleLoadState.manifest = null;
    pendingBundleLoadState.error = null;
  };

  const handleWindowError = (event: ErrorEvent): void => {
    if (event.filename && event.filename !== objectUrl) {
      return;
    }

    pendingBundleLoadState.error =
      pendingBundleLoadState.error ?? toErrorMessage(event.error ?? event.message);
  };

  ownerWindow.addEventListener("error", handleWindowError, true);

  try {
    return await new Promise<EditorBundleManifest>((resolve, reject) => {
      script.src = objectUrl;
      script.async = false;

      script.onload = () => {
        if (pendingBundleLoadState.error) {
          reject(new Error(pendingBundleLoadState.error));
          return;
        }

        if (!pendingBundleLoadState.manifest) {
          reject(
            new Error(
              "Bundle 已执行，但没有调用 LeaferGraphEditorBundleBridge.registerBundle(...)"
            )
          );
          return;
        }

        resolve(pendingBundleLoadState.manifest);
      };

      script.onerror = () => {
        reject(new Error(`无法执行本地 bundle：${sourceLabel}`));
      };

      document.head.append(script);
    });
  } finally {
    cleanup();
  }
}

/**
 * 读取一个本地 JS 文件，并按 IIFE bundle 协议完成注入。
 * 成功后返回已归一化的 manifest；失败时不会污染现有槽位状态。
 */
export async function loadLocalEditorBundle(
  slot: EditorBundleSlot,
  file: File
): Promise<EditorBundleManifest> {
  return loadEditorBundleSource(slot, await file.text(), file.name);
}

/** 把目录摊平成一维列表。 */
function listBundleRecords(
  catalog: EditorBundleCatalogState
): EditorBundleRecordState[] {
  return [...catalog.demo, ...catalog.node, ...catalog.widget];
}

/** 根据 bundle id 查找全部候选依赖。 */
function findBundleRecordsById(
  catalog: EditorBundleCatalogState,
  bundleId: string
): EditorBundleRecordState[] {
  return listBundleRecords(catalog).filter(
    (record) => record.manifest?.id === bundleId
  );
}

/** 判断某条 bundle 记录当前是否真的参与运行时装配。 */
function resolveRecordActivity(
  record: EditorBundleRecordState,
  catalog: EditorBundleCatalogState,
  cache: Map<string, boolean>,
  trail: string[] = []
): boolean {
  if (cache.has(record.bundleKey)) {
    return cache.get(record.bundleKey) ?? false;
  }

  if (trail.includes(record.bundleKey)) {
    cache.set(record.bundleKey, false);
    return false;
  }

  if (
    !record.manifest ||
    !record.enabled ||
    record.loading ||
    (!record.manifest && record.error)
  ) {
    cache.set(record.bundleKey, false);
    return false;
  }

  const requirements = record.manifest.requires ?? [];
  const active = requirements.every((requirement) => {
    const candidates = findBundleRecordsById(catalog, requirement);
    if (candidates.length === 0) {
      return false;
    }

    return candidates.some((candidate) =>
      resolveRecordActivity(candidate, catalog, cache, [...trail, record.bundleKey])
    );
  });

  cache.set(record.bundleKey, active);
  return active;
}

/** 解析某条 bundle 记录当前缺失的依赖。 */
function resolveMissingRequirements(
  record: EditorBundleRecordState,
  catalog: EditorBundleCatalogState,
  cache: Map<string, boolean>
): EditorBundleRequirement[] {
  if (!record.manifest || !record.enabled) {
    return [];
  }

  return (record.manifest.requires ?? []).filter((requirement) => {
    const candidates = findBundleRecordsById(catalog, requirement);
    if (candidates.length === 0) {
      return true;
    }

    return !candidates.some((candidate) =>
      resolveRecordActivity(candidate, catalog, cache)
    );
  });
}

/** 从目录集合中挑出当前应参与主包实例化的插件。 */
function resolveActivePlugins(
  catalog: EditorBundleCatalogState,
  activityCache: Map<string, boolean>
): LeaferGraphNodePlugin[] {
  const plugins: LeaferGraphNodePlugin[] = [];

  for (const slot of ["widget", "node"] as const) {
    for (const record of catalog[slot]) {
      if (!resolveRecordActivity(record, catalog, activityCache)) {
        continue;
      }

      const manifest = record.manifest;
      if (manifest?.kind === "widget" || manifest?.kind === "node") {
        plugins.push(manifest.plugin);
      }
    }
  }

  return plugins;
}

/** 解析当前应优先用于右键创建节点的类型。 */
function resolveQuickCreateNodeType(
  catalog: EditorBundleCatalogState,
  activityCache: Map<string, boolean>
): string | undefined {
  for (const slot of ["node", "widget"] as const) {
    for (const record of catalog[slot]) {
      if (!resolveRecordActivity(record, catalog, activityCache)) {
        continue;
      }

      const manifest = record.manifest as EditorPluginBundleManifest | null;
      if (manifest?.quickCreateNodeType) {
        return manifest.quickCreateNodeType;
      }
    }
  }

  return undefined;
}

/**
 * 将 bundle 目录归一化成 editor 真正需要的运行时装配结果。
 * 这一步集中完成依赖分析、demo 选择和插件装配顺序。
 */
export function resolveEditorBundleRuntimeSetup(
  catalog: EditorBundleCatalogState
): EditorBundleRuntimeSetup {
  const activityCache = new Map<string, boolean>();
  const resolvedBundles = {
    demo: [],
    node: [],
    widget: []
  } as EditorBundleRuntimeSetup["bundles"];

  for (const slot of EDITOR_BUNDLE_SLOTS) {
    resolvedBundles[slot] = catalog[slot].map((record) => {
      const missingRequirements = resolveMissingRequirements(
        record,
        catalog,
        activityCache
      );
      const active = resolveRecordActivity(record, catalog, activityCache);

      return {
        ...record,
        status: record.loading
          ? "loading"
          : record.error && !record.manifest
            ? "failed"
            : !record.manifest
              ? "idle"
              : record.enabled && missingRequirements.length > 0
                ? "dependency-missing"
                : "ready",
        active,
        missingRequirements
      };
    });
  }

  const currentDemo =
    resolvedBundles.demo.find(
      (record) => record.active && record.manifest?.kind === "demo"
    ) ?? null;

  return {
    document:
      currentDemo?.manifest?.kind === "demo"
        ? currentDemo.manifest.document
        : EMPTY_EDITOR_DOCUMENT,
    plugins: resolveActivePlugins(catalog, activityCache),
    quickCreateNodeType: resolveQuickCreateNodeType(catalog, activityCache),
    bundles: resolvedBundles,
    currentDemo
  };
}
