/**
 * sync session 单元测试。
 *
 * @remarks
 * 覆盖 authority-first 会话的恢复、resync 与 storage 生命周期边界。
 */
import { describe, expect, test } from "bun:test";
import {
  createSyncSession,
  type SyncCommand
} from "../src";
import {
  FakeIndexedDBFactory,
  MockOutlet,
  MockStorage,
  createDocument,
  createOperation,
  createPatch,
  waitFor
} from "./test_helpers";

describe("createSyncSession", () => {
  test("在无 storage 时首连拉取 authority 快照并立即回放", async () => {
    const authoritySnapshot = createDocument(1);
    const outlet = new MockOutlet([authoritySnapshot]);
    const receivedSnapshots = [];
    const session = createSyncSession({
      documentId: "doc-1",
      outlet,
      storage: false
    });

    session.subscribeDocument((snapshot) => {
      receivedSnapshots.push(snapshot.revision);
    });

    await session.connect();

    expect(receivedSnapshots).toEqual([1]);
    expect(session.getDocumentSnapshot()?.revision).toBe(1);
    expect(outlet.getSnapshotCalls).toHaveLength(1);
  });

  test("storage 恢复快照会先投影，再被 authority 首快照整体替换", async () => {
    const recoverySnapshot = createDocument(1);
    const authoritySnapshot = createDocument(2);
    const storage = new MockStorage({
      snapshot: recoverySnapshot,
      recoveryMeta: {
        revision: recoverySnapshot.revision,
        savedAt: Date.now()
      }
    });
    const outlet = new MockOutlet([authoritySnapshot]);
    const receivedSnapshots = [];
    const session = createSyncSession({
      documentId: "doc-1",
      outlet,
      storage,
      storageScope: {
        authorityKey: "authority-a"
      }
    });

    session.subscribeDocument((snapshot) => {
      receivedSnapshots.push(snapshot.revision);
    });

    await session.connect();

    expect(receivedSnapshots).toEqual([1, 2]);
    expect(storage.loadCalls).toBe(1);
    expect(storage.saveCalls).toBe(1);
  });

  test("patch baseRevision 不匹配时会触发 resync", async () => {
    const initialSnapshot = createDocument(1);
    const resyncedSnapshot = createDocument(3);
    const outlet = new MockOutlet([initialSnapshot, resyncedSnapshot]);
    const receivedSnapshots = [];
    const session = createSyncSession({
      documentId: "doc-1",
      outlet,
      storage: false
    });

    session.subscribeDocument((snapshot) => {
      receivedSnapshots.push(snapshot.revision);
    });

    await session.connect();
    outlet.emit({
      type: "patch",
      patch: createPatch({
        baseRevision: 99,
        revision: 100
      })
    });

    await waitFor(() => outlet.getSnapshotCalls.length === 2);
    await waitFor(() => receivedSnapshots.at(-1) === 3);

    expect(receivedSnapshots).toEqual([1, 3]);
  });

  test("ack rejection 与 decode error 都会走既定 resync 策略", async () => {
    const initialSnapshot = createDocument(1);
    const afterRejectSnapshot = createDocument(2);
    const afterDecodeSnapshot = createDocument(3);
    const outlet = new MockOutlet([
      initialSnapshot,
      afterRejectSnapshot,
      afterDecodeSnapshot
    ]);
    const session = createSyncSession({
      documentId: "doc-1",
      outlet,
      storage: false
    });

    await session.connect();
    outlet.requestHandler = async (command: SyncCommand) => ({
      commandId: command.commandId,
      type: command.type,
      status: "rejected",
      reason: "authority rejected"
    });

    const ack = await session.submitCommand({
      commandId: "cmd-1",
      issuedAt: Date.now(),
      type: "document.apply-operation",
      operation: createOperation("op-1")
    });

    expect(ack.status).toBe("rejected");
    await waitFor(() => outlet.getSnapshotCalls.length === 2);
    expect(session.getDocumentSnapshot()?.revision).toBe(2);

    outlet.emit({
      type: "error",
      error: {
        kind: "decode",
        message: "broken payload"
      }
    });

    await waitFor(() => outlet.getSnapshotCalls.length === 3);
    expect(session.getDocumentSnapshot()?.revision).toBe(3);
  });

  test("implicit default storage 会在 session dispose 时释放，而 injected storage 不会", async () => {
    const indexedDBFactory = new FakeIndexedDBFactory();
    const previousIndexedDB = globalThis.indexedDB;
    globalThis.indexedDB = indexedDBFactory as unknown as IDBFactory;

    try {
      const sessionWithDefaultStorage = createSyncSession({
        documentId: "doc-1",
        outlet: new MockOutlet([createDocument(1)]),
        storageScope: {
          authorityKey: "authority-a"
        }
      });
      await sessionWithDefaultStorage.connect();
      await sessionWithDefaultStorage.dispose();

      const database = indexedDBFactory.getDatabase("leafergraph-sync-cache");
      expect(database?.closeCalls).toBe(1);
    } finally {
      globalThis.indexedDB = previousIndexedDB;
    }

    const injectedStorage = new MockStorage();
    const sessionWithInjectedStorage = createSyncSession({
      documentId: "doc-1",
      outlet: new MockOutlet([createDocument(1)]),
      storage: injectedStorage,
      storageScope: {
        authorityKey: "authority-a"
      }
    });
    await sessionWithInjectedStorage.connect();
    await sessionWithInjectedStorage.dispose();

    expect(injectedStorage.disposeCalls).toBe(0);
  });
});
