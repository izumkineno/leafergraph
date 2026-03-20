import {
  type EditorRemoteAuthorityAppSource
} from "../backend/authority/remote_authority_app_runtime";
import type { EditorBundleSlot } from "../loader/types";
import type { GraphViewportHostBridge } from "../ui/viewport";
import {
  DEMO_WORKER_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
  MESSAGE_PORT_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
  WINDOW_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
  WORKER_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
  isEditorRemoteAuthorityHostAdapter,
  isEditorRemoteAuthorityHostAdapterDescriptor,
  resolveEditorRemoteAuthorityHostAdapterSource,
  type EditorRemoteAuthorityHostAdapter,
  type EditorRemoteAuthorityHostAdapterDescriptor
} from "../backend/authority/remote_authority_host_adapter";
import type {
  EditorRemoteAuthorityPortConnectorTarget,
  EditorRemoteAuthorityWindowTarget
} from "../backend/authority/remote_authority_app_runtime";

/** editor 浏览器入口允许读取的最小 bootstrap 配置。 */
export interface EditorAppBootstrapMessagePortAuthority {
  /** 浏览器原生 MessagePort。 */
  port: MessagePort;
  /** authority 标题。 */
  label?: string;
  /** authority 说明。 */
  description?: string;
  /** 释放 runtime 时是否关闭 port。 */
  closePortOnDispose?: boolean;
}

/** editor 浏览器入口允许读取的最小 worker authority 配置。 */
export interface EditorAppBootstrapWorkerAuthority {
  /** 负责承接 authority host 的 worker。 */
  worker: EditorRemoteAuthorityPortConnectorTarget & {
    terminate?(): void;
  };
  /** authority 标题。 */
  label?: string;
  /** authority 说明。 */
  description?: string;
  /** 握手消息类型。 */
  handshakeType?: string;
  /** 释放 runtime 时是否终止 worker。 */
  terminateWorkerOnDispose?: boolean;
  /** 释放 transport 时是否关闭专用 MessagePort。 */
  closePortOnDispose?: boolean;
}

/** editor 浏览器入口允许读取的最小 window / iframe authority 配置。 */
export interface EditorAppBootstrapWindowAuthority {
  /** 负责承接 authority host 的目标窗口。 */
  target: EditorRemoteAuthorityWindowTarget;
  /** 当前握手使用的 targetOrigin。 */
  targetOrigin: string;
  /** authority 标题。 */
  label?: string;
  /** authority 说明。 */
  description?: string;
  /** 握手消息类型。 */
  handshakeType?: string;
  /** 释放 transport 时是否关闭专用 MessagePort。 */
  closePortOnDispose?: boolean;
}

/** editor 浏览器入口允许读取的最小内置 demo worker authority 配置。 */
export interface EditorAppBootstrapDemoWorkerAuthority {
  /** 是否启用内置 demo worker authority。 */
  enabled?: boolean;
  /** authority 标题。 */
  label?: string;
  /** authority 说明。 */
  description?: string;
}

/** editor 浏览器入口允许读取的最小 authority host adapter 描述。 */
export interface EditorAppBootstrapRemoteAuthorityAdapter
  extends EditorRemoteAuthorityHostAdapterDescriptor {}

/** editor 浏览器入口允许读取的最小预装 bundle 描述。 */
export interface EditorAppBootstrapPreloadedBundle {
  /** 需要装入的 bundle 槽位。 */
  slot: EditorBundleSlot;
  /** 浏览器可访问的 bundle URL。 */
  url: string;
  /** 可选展示文件名；未提供时由 URL 自动推断。 */
  fileName?: string;
  /** 是否默认启用该 bundle。 */
  enabled?: boolean;
}

export interface EditorAppBootstrap {
  remoteAuthoritySource?: EditorRemoteAuthorityAppSource;
  remoteAuthorityAdapter?: EditorAppBootstrapRemoteAuthorityAdapter;
  remoteAuthorityHostAdapters?: readonly EditorRemoteAuthorityHostAdapter[];
  remoteAuthorityMessagePort?: EditorAppBootstrapMessagePortAuthority;
  remoteAuthorityWorker?: EditorAppBootstrapWorkerAuthority;
  remoteAuthorityWindow?: EditorAppBootstrapWindowAuthority;
  remoteAuthorityDemoWorker?: EditorAppBootstrapDemoWorkerAuthority;
  preloadedBundles?: readonly EditorAppBootstrapPreloadedBundle[];
  onViewportHostBridgeChange?(
    bridge: GraphViewportHostBridge | null
  ): void;
}

interface EditorAppBootstrapHost {
  LeaferGraphEditorAppBootstrap?: EditorAppBootstrap;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRemoteAuthorityAppSource(
  value: unknown
): value is EditorRemoteAuthorityAppSource {
  return (
    isRecord(value) &&
    typeof value.label === "string" &&
    (typeof value.createClient === "function" ||
      typeof value.createTransport === "function")
  );
}

function isMessagePort(value: unknown): value is MessagePort {
  return (
    isRecord(value) &&
    typeof value.postMessage === "function" &&
    typeof value.addEventListener === "function" &&
    typeof value.start === "function" &&
    typeof value.close === "function"
  );
}

function isRemoteAuthorityPortConnectorTarget(
  value: unknown
): value is EditorRemoteAuthorityPortConnectorTarget {
  return isRecord(value) && typeof value.postMessage === "function";
}

function isRemoteAuthorityWindowTarget(
  value: unknown
): value is EditorRemoteAuthorityWindowTarget {
  return isRecord(value) && typeof value.postMessage === "function";
}

function isEditorAppBootstrapMessagePortAuthority(
  value: unknown
): value is EditorAppBootstrapMessagePortAuthority {
  return (
    isRecord(value) &&
    isMessagePort(value.port) &&
    (value.label === undefined || typeof value.label === "string") &&
    (value.description === undefined || typeof value.description === "string") &&
    (value.closePortOnDispose === undefined ||
      typeof value.closePortOnDispose === "boolean")
  );
}

function isEditorAppBootstrapWorkerAuthority(
  value: unknown
): value is EditorAppBootstrapWorkerAuthority {
  return (
    isRecord(value) &&
    isRemoteAuthorityPortConnectorTarget(value.worker) &&
    (value.label === undefined || typeof value.label === "string") &&
    (value.description === undefined || typeof value.description === "string") &&
    (value.handshakeType === undefined ||
      typeof value.handshakeType === "string") &&
    (value.terminateWorkerOnDispose === undefined ||
      typeof value.terminateWorkerOnDispose === "boolean") &&
    (value.closePortOnDispose === undefined ||
      typeof value.closePortOnDispose === "boolean")
  );
}

function isEditorAppBootstrapWindowAuthority(
  value: unknown
): value is EditorAppBootstrapWindowAuthority {
  return (
    isRecord(value) &&
    isRemoteAuthorityWindowTarget(value.target) &&
    typeof value.targetOrigin === "string" &&
    (value.label === undefined || typeof value.label === "string") &&
    (value.description === undefined || typeof value.description === "string") &&
    (value.handshakeType === undefined ||
      typeof value.handshakeType === "string") &&
    (value.closePortOnDispose === undefined ||
      typeof value.closePortOnDispose === "boolean")
  );
}

function isEditorAppBootstrapDemoWorkerAuthority(
  value: unknown
): value is EditorAppBootstrapDemoWorkerAuthority {
  return (
    isRecord(value) &&
    (value.enabled === undefined || typeof value.enabled === "boolean") &&
    (value.label === undefined || typeof value.label === "string") &&
    (value.description === undefined || typeof value.description === "string")
  );
}

function isEditorBundleSlot(value: unknown): value is EditorBundleSlot {
  return value === "demo" || value === "node" || value === "widget";
}

function isEditorAppBootstrapPreloadedBundle(
  value: unknown
): value is EditorAppBootstrapPreloadedBundle {
  return (
    isRecord(value) &&
    isEditorBundleSlot(value.slot) &&
    typeof value.url === "string" &&
    value.url.trim().length > 0 &&
    (value.fileName === undefined || typeof value.fileName === "string") &&
    (value.enabled === undefined || typeof value.enabled === "boolean")
  );
}

function isEditorAppBootstrapPreloadedBundleArray(
  value: unknown
): value is readonly EditorAppBootstrapPreloadedBundle[] {
  return (
    Array.isArray(value) &&
    value.every(isEditorAppBootstrapPreloadedBundle)
  );
}

function isEditorRemoteAuthorityHostAdapterArray(
  value: unknown
): value is readonly EditorRemoteAuthorityHostAdapter[] {
  return Array.isArray(value) && value.every(isEditorRemoteAuthorityHostAdapter);
}

/**
 * 解析浏览器全局 bootstrap。
 *
 * @remarks
 * 这层只允许 editor sandbox 读取可选装配项；
 * 不把具体后端协议、URL 或 Dora 细节写死在主入口里。
 */
export function resolveEditorAppBootstrap(
  host: EditorAppBootstrapHost = globalThis as EditorAppBootstrapHost
): EditorAppBootstrap {
  const bootstrap = host.LeaferGraphEditorAppBootstrap;
  if (!isRecord(bootstrap)) {
    return {};
  }

  const nextBootstrap: EditorAppBootstrap = {};
  const customHostAdapters = isEditorRemoteAuthorityHostAdapterArray(
    bootstrap.remoteAuthorityHostAdapters
  )
    ? bootstrap.remoteAuthorityHostAdapters
    : undefined;
  const resolveAdapterSource = (
    descriptor: EditorRemoteAuthorityHostAdapterDescriptor
  ): EditorRemoteAuthorityAppSource | undefined =>
    resolveEditorRemoteAuthorityHostAdapterSource(descriptor, {
      adapters: customHostAdapters
    }) ?? undefined;

  if (isRemoteAuthorityAppSource(bootstrap.remoteAuthoritySource)) {
    nextBootstrap.remoteAuthoritySource = bootstrap.remoteAuthoritySource;
  } else if (
    isEditorRemoteAuthorityHostAdapterDescriptor(bootstrap.remoteAuthorityAdapter)
  ) {
    nextBootstrap.remoteAuthoritySource = resolveAdapterSource(
      bootstrap.remoteAuthorityAdapter
    );
  } else if (
    isEditorAppBootstrapMessagePortAuthority(bootstrap.remoteAuthorityMessagePort)
  ) {
    nextBootstrap.remoteAuthoritySource = resolveAdapterSource({
      adapterId: MESSAGE_PORT_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
      options: bootstrap.remoteAuthorityMessagePort
    });
  } else if (
    isEditorAppBootstrapWorkerAuthority(bootstrap.remoteAuthorityWorker)
  ) {
    nextBootstrap.remoteAuthoritySource = resolveAdapterSource({
      adapterId: WORKER_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
      options: bootstrap.remoteAuthorityWorker
    });
  } else if (
    isEditorAppBootstrapWindowAuthority(bootstrap.remoteAuthorityWindow)
  ) {
    nextBootstrap.remoteAuthoritySource = resolveAdapterSource({
      adapterId: WINDOW_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
      options: bootstrap.remoteAuthorityWindow
    });
  } else if (
    isEditorAppBootstrapDemoWorkerAuthority(bootstrap.remoteAuthorityDemoWorker) &&
    bootstrap.remoteAuthorityDemoWorker.enabled !== false
  ) {
    nextBootstrap.remoteAuthoritySource = resolveAdapterSource({
      adapterId: DEMO_WORKER_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
      options: {
        label: bootstrap.remoteAuthorityDemoWorker.label,
        description: bootstrap.remoteAuthorityDemoWorker.description
      }
    });
  }
  if (customHostAdapters) {
    nextBootstrap.remoteAuthorityHostAdapters = customHostAdapters;
  }
  if (isEditorAppBootstrapPreloadedBundleArray(bootstrap.preloadedBundles)) {
    nextBootstrap.preloadedBundles = bootstrap.preloadedBundles.map((bundle) => ({
      slot: bundle.slot,
      url: bundle.url,
      fileName: bundle.fileName,
      enabled: bundle.enabled
    }));
  }
  if (typeof bootstrap.onViewportHostBridgeChange === "function") {
    nextBootstrap.onViewportHostBridgeChange =
      bootstrap.onViewportHostBridgeChange as (
        bridge: GraphViewportHostBridge | null
      ) => void;
  }

  return nextBootstrap;
}

declare global {
  var LeaferGraphEditorAppBootstrap: EditorAppBootstrap | undefined;
}
