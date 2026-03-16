import type { EditorBundleSlot } from "./types";

/** 单个槽位写入浏览器后的持久化记录。 */
export interface PersistedEditorBundleRecord {
  slot: EditorBundleSlot;
  fileName: string;
  sourceCode: string;
  enabled: boolean;
  savedAt: number;
}

const BUNDLE_PERSISTENCE_DB_NAME = "leafergraph-editor";
const BUNDLE_PERSISTENCE_STORE_NAME = "bundle-records";
const BUNDLE_PERSISTENCE_DB_VERSION = 1;

/** 判断当前环境是否支持 IndexedDB。 */
function canUseIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

/** 打开 bundle 持久化数据库。 */
function openBundlePersistenceDatabase(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(
      BUNDLE_PERSISTENCE_DB_NAME,
      BUNDLE_PERSISTENCE_DB_VERSION
    );

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(BUNDLE_PERSISTENCE_STORE_NAME)) {
        database.createObjectStore(BUNDLE_PERSISTENCE_STORE_NAME, {
          keyPath: "slot"
        });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.warn("无法打开 bundle 持久化数据库", request.error);
      resolve(null);
    };
  });
}

/** 统一执行一次 IndexedDB 事务。 */
async function withBundlePersistenceStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>
): Promise<T | null> {
  const database = await openBundlePersistenceDatabase();
  if (!database) {
    return null;
  }

  try {
    const transaction = database.transaction(BUNDLE_PERSISTENCE_STORE_NAME, mode);
    const store = transaction.objectStore(BUNDLE_PERSISTENCE_STORE_NAME);

    return await run(store);
  } catch (error) {
    console.warn("bundle 持久化事务失败", error);
    return null;
  } finally {
    database.close();
  }
}

/** 从浏览器读取全部 bundle 持久化记录。 */
export async function readPersistedEditorBundleRecords(): Promise<
  PersistedEditorBundleRecord[]
> {
  const records =
    (await withBundlePersistenceStore("readonly", (store) => {
      return new Promise<PersistedEditorBundleRecord[]>((resolve) => {
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(
            (Array.isArray(request.result)
              ? request.result
              : []) as PersistedEditorBundleRecord[]
          );
        };

        request.onerror = () => {
          console.warn("读取 bundle 持久化记录失败", request.error);
          resolve([]);
        };
      });
    })) ?? [];

  return records.sort((left, right) => right.savedAt - left.savedAt);
}

/** 写入或替换一个 bundle 持久化记录。 */
export async function persistEditorBundleRecord(
  record: PersistedEditorBundleRecord
): Promise<boolean> {
  const result = await withBundlePersistenceStore("readwrite", (store) => {
    return new Promise<boolean>((resolve) => {
      const request = store.put(record);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        console.warn("写入 bundle 持久化记录失败", request.error);
        resolve(false);
      };
    });
  });

  return Boolean(result);
}

/** 只更新某个槽位的启用态。 */
export async function updatePersistedEditorBundleEnabled(
  slot: EditorBundleSlot,
  enabled: boolean
): Promise<boolean> {
  const result = await withBundlePersistenceStore("readwrite", (store) => {
    return new Promise<boolean>((resolve) => {
      const readRequest = store.get(slot);

      readRequest.onsuccess = () => {
        const record = readRequest.result as PersistedEditorBundleRecord | undefined;
        if (!record) {
          resolve(false);
          return;
        }

        const writeRequest = store.put({
          ...record,
          enabled,
          savedAt: Date.now()
        } satisfies PersistedEditorBundleRecord);

        writeRequest.onsuccess = () => {
          resolve(true);
        };

        writeRequest.onerror = () => {
          console.warn("更新 bundle 启用态失败", writeRequest.error);
          resolve(false);
        };
      };

      readRequest.onerror = () => {
        console.warn("读取 bundle 启用态记录失败", readRequest.error);
        resolve(false);
      };
    });
  });

  return Boolean(result);
}

/** 删除某个槽位的持久化记录。 */
export async function removePersistedEditorBundleRecord(
  slot: EditorBundleSlot
): Promise<boolean> {
  const result = await withBundlePersistenceStore("readwrite", (store) => {
    return new Promise<boolean>((resolve) => {
      const request = store.delete(slot);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        console.warn("删除 bundle 持久化记录失败", request.error);
        resolve(false);
      };
    });
  });

  return Boolean(result);
}
