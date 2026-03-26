/**
 * 浏览器缓存 storage 模块。
 *
 * @remarks
 * 负责基于 IndexedDB 实现 `SyncStorage`，为 session 提供浏览器侧恢复资料缓存。
 */
import { cloneValue, isRecord, isSyncStoredState } from "../core/guards";
import type {
  SyncStorage,
  SyncStorageScope,
  SyncStoredState
} from "../core/types";

const DEFAULT_BROWSER_CACHE_NAMESPACE = "@leafergraph/sync";
const BROWSER_CACHE_DATABASE_NAME = "leafergraph-sync-cache";
const BROWSER_CACHE_STORE_NAME = "sync_states";
const BROWSER_CACHE_DATABASE_VERSION = 1;

interface BrowserCacheRecord {
  key: string;
  state: SyncStoredState;
}

/** 创建浏览器缓存 storage 时可选的最小配置。 */
export interface CreateBrowserCacheStorageOptions {
  /** 实际缓存 key 使用的命名空间。 */
  namespace?: string;
  /** 可选自定义 IndexedDB 实例，主要服务测试与特殊宿主。 */
  indexedDB?: IDBFactory;
}

/** 判断当前宿主是否具备浏览器持久化能力。 */
export function hasBrowserPersistenceHost(indexedDB?: IDBFactory): boolean {
  return typeof (indexedDB ?? globalThis.indexedDB) !== "undefined";
}

/** 生成实际写入 IndexedDB 的缓存 key。 */
function createStorageKey(
  namespace: string,
  scope: SyncStorageScope
): string {
  return `${namespace}::${scope.authorityKey}::${scope.documentId}`;
}

/** 打开固定数据库与对象仓库。 */
function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(
      BROWSER_CACHE_DATABASE_NAME,
      BROWSER_CACHE_DATABASE_VERSION
    );

    request.onerror = () => {
      reject(request.error ?? new Error("打开浏览器缓存数据库失败"));
    };
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(BROWSER_CACHE_STORE_NAME)) {
        database.createObjectStore(BROWSER_CACHE_STORE_NAME, {
          keyPath: "key"
        });
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

/** 读取单条缓存记录。 */
function readRecord(
  database: IDBDatabase,
  key: string
): Promise<BrowserCacheRecord | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(BROWSER_CACHE_STORE_NAME, "readonly");
    const store = transaction.objectStore(BROWSER_CACHE_STORE_NAME);
    const request = store.get(key);

    request.onerror = () => {
      reject(request.error ?? new Error("读取浏览器缓存失败"));
    };
    request.onsuccess = () => {
      const result = request.result;
      resolve(
        isRecord(result)
          ? (result as unknown as BrowserCacheRecord)
          : undefined
      );
    };
  });
}

/** 写入单条缓存记录。 */
function writeRecord(
  database: IDBDatabase,
  record: BrowserCacheRecord
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(BROWSER_CACHE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(BROWSER_CACHE_STORE_NAME);
    const request = store.put(record);

    request.onerror = () => {
      reject(request.error ?? new Error("写入浏览器缓存失败"));
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("写入浏览器缓存失败"));
    };
  });
}

/** 删除单条缓存记录。 */
function deleteRecord(
  database: IDBDatabase,
  key: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(BROWSER_CACHE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(BROWSER_CACHE_STORE_NAME);
    const request = store.delete(key);

    request.onerror = () => {
      reject(request.error ?? new Error("清理浏览器缓存失败"));
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("清理浏览器缓存失败"));
    };
  });
}

/**
 * 创建基于 IndexedDB 的浏览器缓存 storage。
 *
 * @remarks
 * 这份实现固定采用 `namespace::authorityKey::documentId` 作为实际缓存 key。
 */
export function createBrowserCacheStorage(
  options: CreateBrowserCacheStorageOptions = {}
): SyncStorage {
  const namespace = options.namespace ?? DEFAULT_BROWSER_CACHE_NAMESPACE;
  const indexedDBFactory = options.indexedDB ?? globalThis.indexedDB;
  if (!indexedDBFactory) {
    throw new Error("当前宿主缺少 IndexedDB，无法创建浏览器缓存 storage");
  }

  let databasePromise: Promise<IDBDatabase> | null = null;
  let closed = false;

  const getDatabase = (): Promise<IDBDatabase> => {
    if (closed) {
      return Promise.reject(new Error("浏览器缓存 storage 已释放"));
    }
    // 数据库连接按需懒创建，并在整个 storage 生命周期内复用。
    databasePromise ??= openDatabase(indexedDBFactory);
    return databasePromise;
  };

  return {
    async load(scope): Promise<SyncStoredState | undefined> {
      const database = await getDatabase();
      const key = createStorageKey(namespace, scope);
      const record = await readRecord(database, key);
      if (!record) {
        return undefined;
      }

      // 读到损坏记录时直接清理，避免下一次启动继续恢复坏数据。
      if (!isSyncStoredState(record.state)) {
        await deleteRecord(database, key);
        return undefined;
      }

      return cloneValue(record.state);
    },

    async save(scope, state): Promise<void> {
      const database = await getDatabase();
      const key = createStorageKey(namespace, scope);
      await writeRecord(database, {
        key,
        state: cloneValue(state)
      });
    },

    async clear(scope): Promise<void> {
      const database = await getDatabase();
      const key = createStorageKey(namespace, scope);
      await deleteRecord(database, key);
    },

    async dispose(): Promise<void> {
      closed = true;
      if (!databasePromise) {
        return;
      }

      // IndexedDB 不需要额外 flush，释放时只关闭已经打开的数据库连接。
      const database = await databasePromise.catch(() => undefined);
      database?.close();
    }
  };
}
