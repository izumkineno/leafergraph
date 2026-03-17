import * as LeaferGraphRuntime from "leafergraph";
import type { GraphDocument, LeaferGraphNodePlugin } from "leafergraph";

import type {
  EditorBundleManifest,
  EditorBundleRequirement,
  EditorBundleRuntimeSetup,
  EditorBundleSlot,
  EditorBundleSlotState,
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

/** 创建单个槽位的初始状态。 */
export function createInitialBundleSlotState(
  slot: EditorBundleSlot
): EditorBundleSlotState {
  return {
    slot,
    manifest: null,
    fileName: null,
    enabled: false,
    loading: false,
    error: null,
    persisted: false,
    restoredFromPersistence: false
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
    .map((item) => {
      if (item === "demo" || item === "node" || item === "widget") {
        return item;
      }

      throw new Error(`Bundle requires 包含未知槽位: ${String(item)}`);
    })
    .filter(
      (item, index, items): item is EditorBundleRequirement =>
        items.indexOf(item) === index
    );

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

/** 判断一个槽位当前是否真的参与运行时装配。 */
function resolveSlotActivity(
  slot: EditorBundleSlot,
  slots: Record<EditorBundleSlot, EditorBundleSlotState>,
  cache: Partial<Record<EditorBundleSlot, boolean>>,
  trail: EditorBundleSlot[] = []
): boolean {
  if (cache[slot] !== undefined) {
    return cache[slot];
  }

  if (trail.includes(slot)) {
    cache[slot] = false;
    return false;
  }

  const current = slots[slot];
  if (
    !current.manifest ||
    !current.enabled ||
    current.loading ||
    (!current.manifest && current.error)
  ) {
    cache[slot] = false;
    return false;
  }

  const requirements = current.manifest.requires ?? [];
  const active = requirements.every((requirement) =>
    resolveSlotActivity(requirement, slots, cache, [...trail, slot])
  );

  cache[slot] = active;
  return active;
}

/** 解析某个槽位当前缺失的依赖。 */
function resolveMissingRequirements(
  slot: EditorBundleSlot,
  slots: Record<EditorBundleSlot, EditorBundleSlotState>,
  cache: Partial<Record<EditorBundleSlot, boolean>>
): EditorBundleSlot[] {
  const current = slots[slot];
  if (!current.manifest || !current.enabled) {
    return [];
  }

  return (current.manifest.requires ?? []).filter(
    (requirement) => !resolveSlotActivity(requirement, slots, cache)
  );
}

/** 从槽位集合中挑出当前应参与主包实例化的插件。 */
function resolveActivePlugins(
  slots: Record<EditorBundleSlot, EditorBundleSlotState>,
  activityCache: Partial<Record<EditorBundleSlot, boolean>>
): LeaferGraphNodePlugin[] {
  const plugins: LeaferGraphNodePlugin[] = [];

  for (const slot of ["widget", "node"] as const) {
    if (!resolveSlotActivity(slot, slots, activityCache)) {
      continue;
    }

    const manifest = slots[slot].manifest;
    if (manifest?.kind === "widget" || manifest?.kind === "node") {
      plugins.push(manifest.plugin);
    }
  }

  return plugins;
}

/** 解析当前应优先用于右键创建节点的类型。 */
function resolveQuickCreateNodeType(
  slots: Record<EditorBundleSlot, EditorBundleSlotState>,
  activityCache: Partial<Record<EditorBundleSlot, boolean>>
): string | undefined {
  for (const slot of ["node", "widget"] as const) {
    if (!resolveSlotActivity(slot, slots, activityCache)) {
      continue;
    }

    const manifest = slots[slot].manifest as EditorPluginBundleManifest | null;
    if (manifest?.quickCreateNodeType) {
      return manifest.quickCreateNodeType;
    }
  }

  return undefined;
}

/**
 * 将 bundle 槽位状态归一化成 editor 真正需要的运行时装配结果。
 * 这一步集中完成依赖分析、graph 选择和插件装配顺序。
 */
export function resolveEditorBundleRuntimeSetup(
  slots: Record<EditorBundleSlot, EditorBundleSlotState>
): EditorBundleRuntimeSetup {
  const activityCache: Partial<Record<EditorBundleSlot, boolean>> = {};
  const resolvedSlots = {} as EditorBundleRuntimeSetup["slots"];

  for (const slot of EDITOR_BUNDLE_SLOTS) {
    const current = slots[slot];
    const missingRequirements = resolveMissingRequirements(
      slot,
      slots,
      activityCache
    );
    const active = resolveSlotActivity(slot, slots, activityCache);

    resolvedSlots[slot] = {
      ...current,
      status: current.loading
        ? "loading"
        : current.error && !current.manifest
          ? "failed"
          : !current.manifest
            ? "idle"
            : current.enabled && missingRequirements.length > 0
              ? "dependency-missing"
              : "ready",
      active,
      missingRequirements
    };
  }

  const activeDemo = resolvedSlots.demo.active
    ? resolvedSlots.demo.manifest
    : null;

  return {
    document:
      activeDemo?.kind === "demo"
        ? activeDemo.document
        : EMPTY_EDITOR_DOCUMENT,
    plugins: resolveActivePlugins(slots, activityCache),
    quickCreateNodeType: resolveQuickCreateNodeType(slots, activityCache),
    slots: resolvedSlots
  };
}
