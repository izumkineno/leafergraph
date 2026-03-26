/**
 * 同步包根层类型模块。
 *
 * @remarks
 * 负责定义协议无关的同步语义合同，供 session、storage 与协议子出口共同复用。
 */
import type {
  GraphDocument,
  GraphDocumentDiff,
  GraphOperation,
  LeaferGraphGraphExecutionState,
  RuntimeFeedbackEvent
} from "leafergraph";

/** authority 认可的正式整图快照。 */
export type DocumentSnapshot = GraphDocument;

/** authority 推进文档事实时使用的增量补丁。 */
export type DocumentPatch = GraphDocumentDiff;

/** 统一运行反馈事件。 */
export type RuntimeFeedback = RuntimeFeedbackEvent;

/** 文档 revision 的共享别名。 */
export type DocumentRevision = GraphDocument["revision"];

/** outlet 与 session 共用的最小连接状态。 */
export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

/** 图运行控制请求。 */
export type SyncRuntimeControlRequest =
  | {
      type: "node.play";
      nodeId: string;
    }
  | {
      type: "graph.play";
    }
  | {
      type: "graph.step";
    }
  | {
      type: "graph.stop";
    };

interface SyncCommandBase {
  /** 命令唯一 ID。 */
  commandId: string;
  /** 命令发出时间。 */
  issuedAt: number;
}

/** 提交正式图操作的同步命令。 */
export interface SyncApplyOperationCommand extends SyncCommandBase {
  type: "document.apply-operation";
  operation: GraphOperation;
}

/** 以整图方式替换 authority 文档的同步命令。 */
export interface SyncReplaceDocumentCommand extends SyncCommandBase {
  type: "document.replace";
  snapshot: DocumentSnapshot;
}

/** 控制 authority runtime 的同步命令。 */
export interface SyncRuntimeControlCommand extends SyncCommandBase {
  type: "runtime.control";
  request: SyncRuntimeControlRequest;
}

/** session 提交给 authority 的正式命令集合。 */
export type SyncCommand =
  | SyncApplyOperationCommand
  | SyncReplaceDocumentCommand
  | SyncRuntimeControlCommand;

/** 文档命令的确认状态。 */
export type SyncAckStatus = "accepted" | "rejected" | "resync-required";

interface SyncAckBase {
  /** authority 最终确认的命令 ID。 */
  commandId: string;
  /** 对应的命令类型。 */
  type: SyncCommand["type"];
  /** authority 给出的最小裁决。 */
  status: SyncAckStatus;
  /** 未接受或要求重同步时的原因。 */
  reason?: string;
}

/** 文档类命令的 authority 确认。 */
export interface SyncDocumentAck extends SyncAckBase {
  type: "document.apply-operation" | "document.replace";
  /** authority 是否确认这次命令真的改变了文档。 */
  changed?: boolean;
  /** authority 当前认可的文档 revision。 */
  documentRevision?: DocumentRevision;
  /** authority 直接返回的新整图快照。 */
  snapshot?: DocumentSnapshot;
}

/** runtime 控制命令的 authority 确认。 */
export interface SyncRuntimeAck extends SyncAckBase {
  type: "runtime.control";
  /** authority 是否确认这次控制真的改变了运行状态。 */
  changed?: boolean;
  /** authority 当前图级运行状态快照。 */
  runtimeState?: LeaferGraphGraphExecutionState;
}

/** authority 返回给 session 的最小确认结构。 */
export type SyncAck = SyncDocumentAck | SyncRuntimeAck;

/** outlet 上报给 session 的最小错误分类。 */
export interface SyncOutletError {
  /** 错误类型。 */
  kind: "decode" | "transport" | "protocol";
  /** 错误说明。 */
  message: string;
  /** 可选原始错误。 */
  cause?: unknown;
}

/** outlet 主动回推给 session 的统一事件面。 */
export type SyncOutletEvent =
  | {
      type: "snapshot";
      snapshot: DocumentSnapshot;
    }
  | {
      type: "patch";
      patch: DocumentPatch;
    }
  | {
      type: "feedback";
      feedback: RuntimeFeedback;
    }
  | {
      type: "connection";
      status: ConnectionStatus;
    }
  | {
      type: "error";
      error: SyncOutletError;
    };

/** 协议出口的最小公开合同。 */
export interface SyncOutlet {
  /** 主动拉取 authority 当前正式整图快照。 */
  getSnapshot(): Promise<DocumentSnapshot>;
  /** 提交一条正式同步命令，并等待 authority 确认。 */
  request(command: SyncCommand): Promise<SyncAck>;
  /** 订阅 authority 主动推送的长流事件。 */
  subscribe(listener: (event: SyncOutletEvent) => void): () => void;
  /** 读取当前连接状态。 */
  getConnectionStatus?(): ConnectionStatus;
  /** 释放协议出口与底层 carrier 资源。 */
  dispose?(): void | Promise<void>;
}

/** storage 的固定隔离范围。 */
export interface SyncStorageScope {
  documentId: string;
  authorityKey: string;
}

/** storage 保存的最小恢复资料。 */
export interface SyncStoredState {
  /** 最近一次 authority 认可的正式快照。 */
  snapshot?: DocumentSnapshot;
  /** 恢复辅助元信息。 */
  recoveryMeta?: {
    revision?: DocumentRevision;
    savedAt?: number;
  };
}

/** 可替换的恢复资料存储合同。 */
export interface SyncStorage {
  /** 读取某个 scope 下的恢复资料。 */
  load(scope: SyncStorageScope): Promise<SyncStoredState | undefined>;
  /** 保存某个 scope 下的恢复资料。 */
  save(scope: SyncStorageScope, state: SyncStoredState): Promise<void>;
  /** 清空某个 scope 下的恢复资料。 */
  clear(scope: SyncStorageScope): Promise<void>;
  /** 释放 storage 资源。 */
  dispose?(): void | Promise<void>;
}

/** session 在不同错误场景下采用的恢复策略。 */
export interface ResyncPolicy {
  onAckRejected: "refetch";
  onPatchFailure: "refetch";
  onReconnect: "refetch";
  onDecodeError: "fail-and-refetch";
}

/** 默认恢复策略。 */
export const DEFAULT_RESYNC_POLICY: ResyncPolicy = {
  onAckRejected: "refetch",
  onPatchFailure: "refetch",
  onReconnect: "refetch",
  onDecodeError: "fail-and-refetch"
};

/** session 的 storage 输入形态。 */
export interface SyncSessionStorageScopeInput {
  authorityKey: string;
}

/** 创建 session 时使用的最小入参。 */
export interface CreateSyncSessionOptions {
  documentId: string;
  outlet: SyncOutlet;
  storage?: false | SyncStorage;
  storageScope?: SyncSessionStorageScopeInput;
  resyncPolicy?: Partial<ResyncPolicy>;
}

/** 对外暴露的同步 session 合同。 */
export interface SyncSession {
  /** 建立同步会话，并拉取 authority 当前快照。 */
  connect(): Promise<void>;
  /** 强制整图重同步。 */
  resync(): Promise<DocumentSnapshot>;
  /** 提交一条正式同步命令。 */
  submitCommand(command: SyncCommand): Promise<SyncAck>;
  /** 读取当前 session 持有的文档快照。 */
  getDocumentSnapshot(): DocumentSnapshot | undefined;
  /** 订阅当前文档事实视图。 */
  subscribeDocument(
    listener: (snapshot: DocumentSnapshot) => void
  ): () => void;
  /** 订阅运行反馈。 */
  subscribeRuntimeFeedback(
    listener: (feedback: RuntimeFeedback) => void
  ): () => void;
  /** 读取当前连接状态。 */
  getConnectionStatus(): ConnectionStatus;
  /** 订阅连接状态变化。 */
  subscribeConnectionStatus(
    listener: (status: ConnectionStatus) => void
  ): () => void;
  /** 释放 session 持有的全部资源。 */
  dispose(): Promise<void>;
}
