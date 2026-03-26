/**
 * storage 解析模块。
 *
 * @remarks
 * 负责把 session 的三态 storage 入参收敛成统一的有效 storage 与 scope。
 */
import type {
  SyncSessionStorageScopeInput,
  SyncStorage,
  SyncStorageScope
} from "../core/types";
import {
  createBrowserCacheStorage,
  hasBrowserPersistenceHost
} from "./browser_cache_storage";

/** session 解析 storage 后的内部结果。 */
export interface ResolvedSyncStorage {
  storage?: SyncStorage;
  scope?: SyncStorageScope;
  ownsStorage: boolean;
}

/**
 * 按 v1 三态入口合同解析 session 的有效 storage。
 *
 * @remarks
 * 这里集中裁决 `storage === false`、`storage` 省略、显式注入 storage 三种入口语义。
 */
export function resolveSyncStorage(options: {
  documentId: string;
  storage?: false | SyncStorage;
  storageScope?: SyncSessionStorageScopeInput;
}): ResolvedSyncStorage {
  const authorityKey = options.storageScope?.authorityKey;
  if (!authorityKey) {
    // 没有完整 authorityKey 时，storage 固定自动退化为禁用。
    return {
      ownsStorage: false
    };
  }

  const scope: SyncStorageScope = {
    documentId: options.documentId,
    authorityKey
  };

  if (options.storage === false) {
    // 调用者显式禁用时，不创建默认缓存，也不接管任何外部 storage。
    return {
      scope,
      ownsStorage: false
    };
  }

  if (options.storage) {
    // 注入型 storage 的生命周期归调用者所有，session 不会擅自 dispose。
    return {
      storage: options.storage,
      scope,
      ownsStorage: false
    };
  }

  if (!hasBrowserPersistenceHost()) {
    // 非浏览器或无 IndexedDB 宿主时，不做 localStorage / 文件系统之类的隐式回退。
    return {
      scope,
      ownsStorage: false
    };
  }

  return {
    // 只有隐式创建的默认浏览器缓存才由 session 持有并在 dispose 时释放。
    storage: createBrowserCacheStorage(),
    scope,
    ownsStorage: true
  };
}
