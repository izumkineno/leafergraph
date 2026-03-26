/**
 * sync 测试辅助模块。
 *
 * @remarks
 * 负责提供 mock outlet、fake carrier、fake IndexedDB 与共享测试数据工厂。
 */
import type {
  GraphDocument,
  GraphDocumentDiff,
  GraphOperation,
  LeaferGraphGraphExecutionState,
  RuntimeFeedbackEvent
} from "leafergraph";
import type {
  ConnectionStatus,
  DocumentSnapshot,
  SyncAck,
  SyncCommand,
  SyncOutlet,
  SyncOutletEvent,
  SyncStorage
} from "../src";
import type {
  JsonRpcRequestEnvelope,
  JsonRpcResponseEnvelope,
  OpenRpcCarrier,
  OpenRpcCarrierEvent,
  WebSocketLike
} from "../src/openrpc";

/** 创建最小可用 GraphDocument。 */
export function createDocument(revision: number | string): GraphDocument {
  return {
    documentId: "doc-1",
    revision,
    appKind: "leafergraph/test",
    nodes: [
      {
        id: "node-1",
        type: "test/node",
        layout: {
          x: 0,
          y: 0
        }
      }
    ],
    links: []
  };
}

/** 创建最小可用 GraphOperation。 */
export function createOperation(operationId: string): GraphOperation {
  return {
    type: "document.update",
    operationId,
    timestamp: Date.now(),
    source: "test",
    input: {
      appKind: "leafergraph/test"
    }
  };
}

/** 创建最小可用 GraphDocumentDiff。 */
export function createPatch(options: {
  baseRevision: number | string;
  revision: number | string;
}): GraphDocumentDiff {
  return {
    documentId: "doc-1",
    baseRevision: options.baseRevision,
    revision: options.revision,
    emittedAt: Date.now(),
    operations: [],
    fieldChanges: []
  };
}

/** 创建最小 runtime feedback。 */
export function createRuntimeFeedback(): RuntimeFeedbackEvent {
  return {
    type: "graph.execution",
    event: {
      type: "advanced",
      state: {
        status: "running",
        queueSize: 1,
        stepCount: 1,
        runId: "run-1",
        startedAt: Date.now(),
        lastSource: "graph-play"
      },
      runId: "run-1",
      source: "graph-play",
      timestamp: Date.now()
    }
  };
}

/** 轮询直到条件成立。 */
export async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1000
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("等待条件成立超时");
    }
    await Bun.sleep(5);
  }
}

/** session 测试使用的 mock outlet。 */
export class MockOutlet implements SyncOutlet {
  private readonly listeners = new Set<(event: SyncOutletEvent) => void>();
  private readonly snapshotQueue: DocumentSnapshot[];
  readonly requestCalls: SyncCommand[] = [];
  readonly getSnapshotCalls: string[] = [];
  connectionStatus: ConnectionStatus = "idle";
  requestHandler: (command: SyncCommand) => Promise<SyncAck> = async () => {
    throw new Error("未配置 mock requestHandler");
  };

  constructor(snapshots: DocumentSnapshot[]) {
    this.snapshotQueue = [...snapshots].map((snapshot) => structuredClone(snapshot));
  }

  async getSnapshot(): Promise<DocumentSnapshot> {
    this.getSnapshotCalls.push("getSnapshot");
    const nextSnapshot = this.snapshotQueue.shift() ?? this.snapshotQueue.at(-1);
    if (!nextSnapshot) {
      throw new Error("mock outlet 没有可用 snapshot");
    }
    return structuredClone(nextSnapshot);
  }

  async request(command: SyncCommand): Promise<SyncAck> {
    this.requestCalls.push(structuredClone(command));
    return this.requestHandler(structuredClone(command));
  }

  subscribe(listener: (event: SyncOutletEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  emit(event: SyncOutletEvent): void {
    for (const listener of this.listeners) {
      listener(structuredClone(event));
    }
  }

  setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.emit({
      type: "connection",
      status
    });
  }
}

/** session 测试使用的 mock storage。 */
export class MockStorage implements SyncStorage {
  loadCalls = 0;
  saveCalls = 0;
  clearCalls = 0;
  disposeCalls = 0;

  constructor(
    public storedState?: {
      snapshot?: DocumentSnapshot;
      recoveryMeta?: {
        revision?: number | string;
        savedAt?: number;
      };
    }
  ) {}

  async load() {
    this.loadCalls += 1;
    return this.storedState ? structuredClone(this.storedState) : undefined;
  }

  async save(_scope: never, state: never): Promise<void> {
    this.saveCalls += 1;
    this.storedState = structuredClone(state);
  }

  async clear(): Promise<void> {
    this.clearCalls += 1;
    this.storedState = undefined;
  }

  async dispose(): Promise<void> {
    this.disposeCalls += 1;
  }
}

/** OpenRPC outlet 测试使用的 fake carrier。 */
export class FakeCarrier implements OpenRpcCarrier {
  private readonly listeners = new Set<(event: OpenRpcCarrierEvent) => void>();
  status: ConnectionStatus = "idle";
  requestHandler: (envelope: JsonRpcRequestEnvelope) => Promise<JsonRpcResponseEnvelope> =
    async () => {
      throw new Error("未配置 fake carrier requestHandler");
    };

  async request(envelope: JsonRpcRequestEnvelope): Promise<JsonRpcResponseEnvelope> {
    return this.requestHandler(structuredClone(envelope));
  }

  subscribe(listener: (event: OpenRpcCarrierEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  emit(event: OpenRpcCarrierEvent): void {
    for (const listener of this.listeners) {
      listener(structuredClone(event));
    }
  }

  setConnectionStatus(status: ConnectionStatus): void {
    this.status = status;
    this.emit({
      type: "connection",
      status
    });
  }
}

class FakeStringList {
  constructor(private readonly values: Set<string>) {}

  contains(value: string): boolean {
    return this.values.has(value);
  }
}

class FakeIDBRequest<TValue> {
  result!: TValue;
  error: Error | null = null;
  onsuccess: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onupgradeneeded: ((event: Event) => void) | null = null;

  succeed(result: TValue): void {
    this.result = result;
    this.onsuccess?.({} as Event);
  }

  fail(error: Error): void {
    this.error = error;
    this.onerror?.({} as Event);
  }

  upgrade(result: TValue): void {
    this.result = result;
    this.onupgradeneeded?.({} as Event);
  }
}

class FakeIDBTransaction {
  oncomplete: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  error: Error | null = null;

  constructor(private readonly records: Map<string, unknown>) {}

  objectStore(): {
    get: (key: string) => FakeIDBRequest<unknown>;
    put: (value: { key: string; state: unknown }) => FakeIDBRequest<string>;
    delete: (key: string) => FakeIDBRequest<undefined>;
  } {
    return {
      get: (key) => {
        const request = new FakeIDBRequest<unknown>();
        queueMicrotask(() => {
          request.succeed(structuredClone(this.records.get(key)));
        });
        return request;
      },
      put: (value) => {
        const request = new FakeIDBRequest<string>();
        queueMicrotask(() => {
          this.records.set(value.key, structuredClone(value));
          request.succeed(value.key);
          this.oncomplete?.({} as Event);
        });
        return request;
      },
      delete: (key) => {
        const request = new FakeIDBRequest<undefined>();
        queueMicrotask(() => {
          this.records.delete(key);
          request.succeed(undefined);
          this.oncomplete?.({} as Event);
        });
        return request;
      }
    };
  }
}

class FakeIDBDatabase {
  private readonly storeNames = new Set<string>();
  readonly stores = new Map<string, Map<string, unknown>>();
  readonly objectStoreNames = new FakeStringList(this.storeNames);
  closeCalls = 0;

  createObjectStore(name: string): void {
    this.storeNames.add(name);
    this.stores.set(name, new Map());
  }

  transaction(name: string): FakeIDBTransaction {
    const store = this.stores.get(name);
    if (!store) {
      throw new Error(`找不到 object store: ${name}`);
    }
    return new FakeIDBTransaction(store);
  }

  close(): void {
    this.closeCalls += 1;
  }
}

/** 测试用 fake IndexedDB 工厂。 */
export class FakeIndexedDBFactory {
  private readonly databases = new Map<string, FakeIDBDatabase>();

  open(name: string): FakeIDBRequest<FakeIDBDatabase> {
    const request = new FakeIDBRequest<FakeIDBDatabase>();
    queueMicrotask(() => {
      let database = this.databases.get(name);
      if (!database) {
        database = new FakeIDBDatabase();
        this.databases.set(name, database);
        request.upgrade(database);
      }
      request.succeed(database);
    });
    return request;
  }

  getDatabase(name: string): FakeIDBDatabase | undefined {
    return this.databases.get(name);
  }
}

/** OpenRPC WebSocket carrier 测试使用的 fake socket。 */
export class FakeWebSocket implements WebSocketLike {
  readonly sentMessages: string[] = [];
  readonly listeners = new Map<string, Set<EventListener>>();
  readyState = 0;

  addEventListener(type: string, listener: EventListener): void {
    const current = this.listeners.get(type) ?? new Set<EventListener>();
    current.add(listener);
    this.listeners.set(type, current);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = 3;
  }

  emit(type: "open" | "message" | "close" | "error", data?: unknown): void {
    const event =
      type === "message"
        ? ({ data } as MessageEvent<unknown>)
        : ({} as Event);
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

/** 创建最小图级运行状态。 */
export function createGraphExecutionState(): LeaferGraphGraphExecutionState {
  return {
    status: "running",
    queueSize: 1,
    stepCount: 1,
    runId: "run-1",
    startedAt: Date.now(),
    lastSource: "graph-play"
  };
}
