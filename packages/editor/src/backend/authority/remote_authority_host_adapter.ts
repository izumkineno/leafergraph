import {
  createEditorRemoteAuthorityMessagePortSource,
  createEditorRemoteAuthorityWindowSource,
  createEditorRemoteAuthorityWorkerSource,
  type EditorRemoteAuthorityAppSource,
  type EditorRemoteAuthorityPortConnectorTarget,
  type EditorRemoteAuthorityWindowTarget
} from "./remote_authority_app_runtime";
import {
  createEditorRemoteAuthorityDemoWorkerSource,
  type CreateEditorRemoteAuthorityDemoWorkerSourceOptions
} from "../../demo/remote_authority_demo_source";
import { DEFAULT_REMOTE_AUTHORITY_BRIDGE_HANDSHAKE_TYPE } from "../../session/message_port_remote_authority_bridge_host";

/** 内置 MessagePort authority host adapter 标识。 */
export const MESSAGE_PORT_REMOTE_AUTHORITY_HOST_ADAPTER_ID = "message-port";
/** 内置 worker authority host adapter 标识。 */
export const WORKER_REMOTE_AUTHORITY_HOST_ADAPTER_ID = "worker";
/** 内置 window / iframe authority host adapter 标识。 */
export const WINDOW_REMOTE_AUTHORITY_HOST_ADAPTER_ID = "window";
/** 内置 demo worker authority host adapter 标识。 */
export const DEMO_WORKER_REMOTE_AUTHORITY_HOST_ADAPTER_ID = "demo-worker";

/** 宿主提供给 editor 的 authority adapter 描述。 */
export interface EditorRemoteAuthorityHostAdapterDescriptor {
  /** 当前 descriptor 选中的 adapter 标识。 */
  adapterId: string;
  /** 交给 adapter 解释的原始配置。 */
  options?: unknown;
}

/**
 * editor 浏览器宿主侧 authority adapter。
 *
 * @remarks
 * 这一层专门解决“宿主如何把某种 bridge / port / 协议入口接到 editor”：
 * - editor 主链继续只消费 `EditorRemoteAuthorityAppSource`
 * - 每种宿主接法停留在独立 adapter 中
 * - 新接协议优先新增 adapter，而不是继续修改 bootstrap 主分支
 */
export interface EditorRemoteAuthorityHostAdapter {
  /** adapter 的稳定标识。 */
  adapterId: string;
  /** 尝试把宿主配置解析为标准 authority source。 */
  resolveSource(options: unknown): EditorRemoteAuthorityAppSource | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function isMessagePortAdapterOptions(
  value: unknown
): value is {
  label?: string;
  description?: string;
  port: MessagePort;
  closePortOnDispose?: boolean;
} {
  return (
    isRecord(value) &&
    isMessagePort(value.port) &&
    (value.label === undefined || typeof value.label === "string") &&
    (value.description === undefined || typeof value.description === "string") &&
    (value.closePortOnDispose === undefined ||
      typeof value.closePortOnDispose === "boolean")
  );
}

function isWorkerAdapterOptions(
  value: unknown
): value is {
  label?: string;
  description?: string;
  worker: EditorRemoteAuthorityPortConnectorTarget & {
    terminate?(): void;
  };
  handshakeType?: string;
  terminateWorkerOnDispose?: boolean;
  closePortOnDispose?: boolean;
} {
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

function isWindowAdapterOptions(
  value: unknown
): value is {
  label?: string;
  description?: string;
  target: EditorRemoteAuthorityWindowTarget;
  targetOrigin: string;
  handshakeType?: string;
  closePortOnDispose?: boolean;
} {
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

function isDemoWorkerAdapterOptions(
  value: unknown
): value is CreateEditorRemoteAuthorityDemoWorkerSourceOptions {
  return (
    isRecord(value) &&
    (value.label === undefined || typeof value.label === "string") &&
    (value.description === undefined || typeof value.description === "string") &&
    (value.createWorker === undefined || typeof value.createWorker === "function")
  );
}

/** 判断一条 authority adapter descriptor 是否满足最小结构。 */
export function isEditorRemoteAuthorityHostAdapterDescriptor(
  value: unknown
): value is EditorRemoteAuthorityHostAdapterDescriptor {
  return (
    isRecord(value) &&
    typeof value.adapterId === "string" &&
    value.adapterId.length > 0
  );
}

/** 判断一条 authority host adapter 是否满足最小结构。 */
export function isEditorRemoteAuthorityHostAdapter(
  value: unknown
): value is EditorRemoteAuthorityHostAdapter {
  return (
    isRecord(value) &&
    typeof value.adapterId === "string" &&
    typeof value.resolveSource === "function"
  );
}

function createMessagePortRemoteAuthorityHostAdapter(): EditorRemoteAuthorityHostAdapter {
  return {
    adapterId: MESSAGE_PORT_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
    resolveSource(options) {
      if (!isMessagePortAdapterOptions(options)) {
        return null;
      }

      return createEditorRemoteAuthorityMessagePortSource(options);
    }
  };
}

function createWorkerRemoteAuthorityHostAdapter(): EditorRemoteAuthorityHostAdapter {
  return {
    adapterId: WORKER_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
    resolveSource(options) {
      if (!isWorkerAdapterOptions(options)) {
        return null;
      }

      return createEditorRemoteAuthorityWorkerSource({
        ...options,
        handshakeType:
          options.handshakeType ?? DEFAULT_REMOTE_AUTHORITY_BRIDGE_HANDSHAKE_TYPE
      });
    }
  };
}

function createWindowRemoteAuthorityHostAdapter(): EditorRemoteAuthorityHostAdapter {
  return {
    adapterId: WINDOW_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
    resolveSource(options) {
      if (!isWindowAdapterOptions(options)) {
        return null;
      }

      return createEditorRemoteAuthorityWindowSource({
        ...options,
        handshakeType:
          options.handshakeType ?? DEFAULT_REMOTE_AUTHORITY_BRIDGE_HANDSHAKE_TYPE
      });
    }
  };
}

function createDemoWorkerRemoteAuthorityHostAdapter(): EditorRemoteAuthorityHostAdapter {
  return {
    adapterId: DEMO_WORKER_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
    resolveSource(options) {
      if (!isDemoWorkerAdapterOptions(options)) {
        return null;
      }

      return createEditorRemoteAuthorityDemoWorkerSource(options);
    }
  };
}

/** editor 当前内置的 authority host adapters。 */
export const DEFAULT_EDITOR_REMOTE_AUTHORITY_HOST_ADAPTERS: readonly EditorRemoteAuthorityHostAdapter[] =
  [
    createMessagePortRemoteAuthorityHostAdapter(),
    createWorkerRemoteAuthorityHostAdapter(),
    createWindowRemoteAuthorityHostAdapter(),
    createDemoWorkerRemoteAuthorityHostAdapter()
  ];

/**
 * 根据 descriptor 解析标准 authority source。
 *
 * @remarks
 * 自定义 adapters 永远优先于内置 adapters，这样宿主可以：
 * - 覆盖内置协议的默认接法
 * - 新增完全自定义的 bridge / backend 接法
 *
 * 同时 editor 主入口仍只接收标准 `EditorRemoteAuthorityAppSource`。
 */
export function resolveEditorRemoteAuthorityHostAdapterSource(
  descriptor: EditorRemoteAuthorityHostAdapterDescriptor,
  options: {
    adapters?: readonly EditorRemoteAuthorityHostAdapter[];
  } = {}
): EditorRemoteAuthorityAppSource | null {
  const adapters = [
    ...(options.adapters ?? []),
    ...DEFAULT_EDITOR_REMOTE_AUTHORITY_HOST_ADAPTERS
  ];
  const adapter = adapters.find(
    (candidate) => candidate.adapterId === descriptor.adapterId
  );

  if (!adapter) {
    return null;
  }

  return adapter.resolveSource(descriptor.options);
}
