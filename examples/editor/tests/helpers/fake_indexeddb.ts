interface FakeDatabaseState {
  version: number;
  stores: Map<string, Map<string, unknown>>;
}

class FakeRequest<T> {
  onsuccess: ((this: FakeRequest<T>, event: Event) => void) | null = null;
  onerror: ((this: FakeRequest<T>, event: Event) => void) | null = null;
  result!: T;
  error: Error | null = null;

  succeed(result: T): void {
    this.result = result;
    queueMicrotask(() => {
      this.onsuccess?.call(this, new Event("success"));
    });
  }

  fail(error: Error): void {
    this.error = error;
    queueMicrotask(() => {
      this.onerror?.call(this, new Event("error"));
    });
  }
}

class FakeObjectStore {
  constructor(private readonly records: Map<string, unknown>) {}

  getAll(): IDBRequest<unknown[]> {
    const request = new FakeRequest<unknown[]>();
    request.succeed([...this.records.values()]);
    return request as unknown as IDBRequest<unknown[]>;
  }

  get(key: string): IDBRequest<unknown> {
    const request = new FakeRequest<unknown>();
    request.succeed(this.records.get(key));
    return request as unknown as IDBRequest<unknown>;
  }

  put(value: unknown): IDBRequest<IDBValidKey> {
    const request = new FakeRequest<IDBValidKey>();
    if (
      typeof value !== "object" ||
      value === null ||
      !("key" in value) ||
      typeof (value as { key?: unknown }).key !== "string"
    ) {
      request.fail(new Error("FakeIndexedDB 只支持 keyPath=key 的记录"));
      return request as unknown as IDBRequest<IDBValidKey>;
    }

    const key = (value as { key: string }).key;
    this.records.set(key, structuredClone(value));
    request.succeed(key);
    return request as unknown as IDBRequest<IDBValidKey>;
  }

  delete(key: string): IDBRequest<undefined> {
    const request = new FakeRequest<undefined>();
    this.records.delete(key);
    request.succeed(undefined);
    return request as unknown as IDBRequest<undefined>;
  }
}

class FakeTransaction {
  constructor(private readonly state: FakeDatabaseState) {}

  objectStore(name: string): IDBObjectStore {
    let store = this.state.stores.get(name);
    if (!store) {
      store = new Map<string, unknown>();
      this.state.stores.set(name, store);
    }

    return new FakeObjectStore(store) as unknown as IDBObjectStore;
  }
}

class FakeDatabase {
  constructor(private readonly state: FakeDatabaseState) {}

  readonly objectStoreNames = {
    contains: (name: string) => this.state.stores.has(name)
  };

  createObjectStore(name: string): IDBObjectStore {
    const store = new Map<string, unknown>();
    this.state.stores.set(name, store);
    return new FakeObjectStore(store) as unknown as IDBObjectStore;
  }

  deleteObjectStore(name: string): void {
    this.state.stores.delete(name);
  }

  transaction(_name: string, _mode: IDBTransactionMode): IDBTransaction {
    return new FakeTransaction(this.state) as unknown as IDBTransaction;
  }

  close(): void {}
}

class FakeOpenRequest extends FakeRequest<IDBDatabase> {
  onupgradeneeded:
    | ((this: IDBOpenDBRequest, event: IDBVersionChangeEvent) => void)
    | null = null;
}

/** 为 bun:test 提供最小 IndexedDB mock。 */
export function createFakeIndexedDb(): IDBFactory {
  const databases = new Map<string, FakeDatabaseState>();

  return {
    open(name: string, version?: number): IDBOpenDBRequest {
      const request = new FakeOpenRequest();
      queueMicrotask(() => {
        const currentState = databases.get(name);
        const nextVersion = version ?? currentState?.version ?? 1;
        const state =
          currentState ??
          {
            version: nextVersion,
            stores: new Map<string, Map<string, unknown>>()
          };
        const shouldUpgrade = !currentState || state.version !== nextVersion;
        state.version = nextVersion;
        databases.set(name, state);
        request.result = new FakeDatabase(state) as unknown as IDBDatabase;

        if (shouldUpgrade) {
          request.onupgradeneeded?.call(
            request as unknown as IDBOpenDBRequest,
            new Event("upgradeneeded") as IDBVersionChangeEvent
          );
        }

        request.succeed(request.result);
      });
      return request as unknown as IDBOpenDBRequest;
    },
    deleteDatabase(name: string): IDBOpenDBRequest {
      const request = new FakeOpenRequest();
      queueMicrotask(() => {
        databases.delete(name);
        request.result = undefined as unknown as IDBDatabase;
        request.succeed(request.result);
      });
      return request as unknown as IDBOpenDBRequest;
    },
    cmp(first: IDBValidKey, second: IDBValidKey): number {
      if (first === second) {
        return 0;
      }

      return String(first) > String(second) ? 1 : -1;
    }
  } as IDBFactory;
}
