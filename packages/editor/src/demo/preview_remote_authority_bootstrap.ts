/**
 * bootstrap 模块。
 *
 * @remarks
 * 负责解析页面级启动参数或 demo 宿主配置，并把结果整理成 editor 可直接消费的初始化输入。
 */
import type { EditorAppBootstrap } from "../app/editor_app_bootstrap";
import {
  isEditorRemoteAuthorityHostAdapter,
  type EditorRemoteAuthorityHostAdapter
} from "../backend/authority/remote_authority_host_adapter";
import { createEditorRemoteAuthorityServiceSource } from "../backend/authority/remote_authority_app_runtime";
import { createDemoRemoteAuthorityService } from "./remote_authority_demo_service";

/** 预览页 query 参数中用于启用自定义 authority adapter 的 key。 */
export const PREVIEW_REMOTE_AUTHORITY_QUERY_KEY = "authority";
/** 预览页内置的自定义 authority host adapter 标识。 */
export const PREVIEW_REMOTE_AUTHORITY_ADAPTER_ID = "preview-demo-service";

interface PreviewRemoteAuthorityBootstrapHost {
  location?: {
    search?: string;
  };
  LeaferGraphEditorAppBootstrap?: EditorAppBootstrap;
}

export interface PreviewRemoteAuthorityAdapterOptions {
  label?: string;
  description?: string;
  authorityName?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasExplicitRemoteAuthorityBootstrap(
  bootstrap: EditorAppBootstrap
): boolean {
  return (
    bootstrap.remoteAuthoritySource !== undefined ||
    bootstrap.remoteAuthorityAdapter !== undefined ||
    bootstrap.remoteAuthorityMessagePort !== undefined ||
    bootstrap.remoteAuthorityWorker !== undefined ||
    bootstrap.remoteAuthorityWindow !== undefined ||
    bootstrap.remoteAuthorityDemoWorker !== undefined
  );
}

function normalizePreviewRemoteAuthorityAdapterOptions(
  options: PreviewRemoteAuthorityAdapterOptions = {}
): Required<PreviewRemoteAuthorityAdapterOptions> {
  return {
    label:
      typeof options.label === "string" && options.label.trim().length > 0
        ? options.label.trim()
        : "Preview Demo Service Authority",
    description:
      typeof options.description === "string" &&
      options.description.trim().length > 0
        ? options.description.trim()
        : "通过浏览器预览 host adapter 注入的浏览器内 authority service",
    authorityName:
      typeof options.authorityName === "string" &&
      options.authorityName.trim().length > 0
        ? options.authorityName.trim()
        : "preview-demo-service"
  };
}

function readPreviewRemoteAuthorityAdapterOptions(
  params: URLSearchParams
): Required<PreviewRemoteAuthorityAdapterOptions> {
  return normalizePreviewRemoteAuthorityAdapterOptions({
    label: params.get("authorityLabel") ?? undefined,
    description: params.get("authorityDescription") ?? undefined,
    authorityName: params.get("authorityName") ?? undefined
  });
}

export function createPreviewRemoteAuthorityHostAdapter(): EditorRemoteAuthorityHostAdapter {
  return {
    adapterId: PREVIEW_REMOTE_AUTHORITY_ADAPTER_ID,
    resolveSource(options) {
      const resolvedOptions = normalizePreviewRemoteAuthorityAdapterOptions(
        isRecord(options)
          ? (options as PreviewRemoteAuthorityAdapterOptions)
          : undefined
      );

      return createEditorRemoteAuthorityServiceSource({
        label: resolvedOptions.label,
        description: resolvedOptions.description,
        createService() {
          return createDemoRemoteAuthorityService({
            authorityName: resolvedOptions.authorityName
          });
        }
      });
    }
  };
}

const PREVIEW_REMOTE_AUTHORITY_HOST_ADAPTER =
  createPreviewRemoteAuthorityHostAdapter();

export function createPreviewRemoteAuthorityBootstrap(
  options: PreviewRemoteAuthorityAdapterOptions = {}
): Pick<
  EditorAppBootstrap,
  "remoteAuthorityAdapter" | "remoteAuthorityHostAdapters"
> {
  return {
    remoteAuthorityAdapter: {
      adapterId: PREVIEW_REMOTE_AUTHORITY_ADAPTER_ID,
      options: normalizePreviewRemoteAuthorityAdapterOptions(options)
    },
    remoteAuthorityHostAdapters: [PREVIEW_REMOTE_AUTHORITY_HOST_ADAPTER]
  };
}

/**
 * 根据预览页 query 参数安装浏览器内置的自定义 authority host adapter。
 *
 * @remarks
 * 这层专门服务于真实浏览器预览与手工联调：
 * - 不改 editor 主入口协议
 * - 只在显式 query 命中时注入自定义 adapter
 * - 若宿主已显式配置 authority source / adapter，则保留宿主优先级
 */
export function installPreviewRemoteAuthorityBootstrap(
  host: PreviewRemoteAuthorityBootstrapHost =
    globalThis as PreviewRemoteAuthorityBootstrapHost
): void {
  const search = host.location?.search;
  if (typeof search !== "string" || search.length === 0) {
    return;
  }

  const params = new URLSearchParams(search);
  if (
    params.get(PREVIEW_REMOTE_AUTHORITY_QUERY_KEY) !==
    PREVIEW_REMOTE_AUTHORITY_ADAPTER_ID
  ) {
    return;
  }

  const currentBootstrap = host.LeaferGraphEditorAppBootstrap ?? {};
  const previewBootstrap = createPreviewRemoteAuthorityBootstrap(
    readPreviewRemoteAuthorityAdapterOptions(params)
  );
  const currentAdapters = Array.isArray(currentBootstrap.remoteAuthorityHostAdapters)
    ? currentBootstrap.remoteAuthorityHostAdapters.filter(
        isEditorRemoteAuthorityHostAdapter
      )
    : [];
  const nextAdapters = [
    ...currentAdapters.filter(
      (adapter) => adapter.adapterId !== PREVIEW_REMOTE_AUTHORITY_ADAPTER_ID
    ),
    ...(previewBootstrap.remoteAuthorityHostAdapters ?? [])
  ];

  host.LeaferGraphEditorAppBootstrap = {
    ...currentBootstrap,
    remoteAuthorityHostAdapters: nextAdapters,
    remoteAuthorityAdapter: hasExplicitRemoteAuthorityBootstrap(currentBootstrap)
      ? currentBootstrap.remoteAuthorityAdapter
      : previewBootstrap.remoteAuthorityAdapter
  };
}
