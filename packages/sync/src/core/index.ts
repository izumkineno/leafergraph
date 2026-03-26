/**
 * 同步包根层模型入口。
 *
 * @remarks
 * 负责聚合同步语义类型与运行时辅助工具，供根出口与子出口复用。
 */
export {
  DEFAULT_RESYNC_POLICY,
  type ConnectionStatus,
  type CreateSyncSessionOptions,
  type DocumentPatch,
  type DocumentRevision,
  type DocumentSnapshot,
  type ResyncPolicy,
  type RuntimeFeedback,
  type SyncAck,
  type SyncAckStatus,
  type SyncApplyOperationCommand,
  type SyncCommand,
  type SyncDocumentAck,
  type SyncOutlet,
  type SyncOutletError,
  type SyncOutletEvent,
  type SyncReplaceDocumentCommand,
  type SyncRuntimeAck,
  type SyncRuntimeControlCommand,
  type SyncRuntimeControlRequest,
  type SyncSession,
  type SyncSessionStorageScopeInput,
  type SyncStorage,
  type SyncStorageScope,
  type SyncStoredState
} from "./types";
export {
  cloneValue,
  isDocumentRevision,
  isGraphDocument,
  isGraphDocumentDiff,
  isGraphExecutionState,
  isGraphOperation,
  isRecord,
  isRuntimeFeedbackEvent,
  isSyncRuntimeControlRequest,
  isSyncStoredState
} from "./guards";
