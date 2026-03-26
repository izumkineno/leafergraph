/**
 * authority 文档投影 gate 模块。
 *
 * @remarks
 * 负责在视口活跃交互期间阻断 authority 整图投影，避免 selection、reconnect 和 marquee 被异步刷新打断。
 */
import type { LeaferGraphInteractionActivityState } from "leafergraph";

export interface AuthorityDocumentProjectionInteractionInput {
  graphInteractionState: LeaferGraphInteractionActivityState;
  hasPendingMarqueeSelection: boolean;
  hasActiveMarqueeSelection: boolean;
  hasReconnectState: boolean;
}

export interface AuthorityDocumentProjectionFlushInput
  extends AuthorityDocumentProjectionInteractionInput {
  hasPendingAuthorityDocument: boolean;
  pendingOperationCount: number;
}

/** 判断当前是否存在会打断 authority 文档整图投影的活跃交互。 */
export function isAuthorityDocumentProjectionInteractionActive(
  input: AuthorityDocumentProjectionInteractionInput
): boolean {
  return (
    input.graphInteractionState.active ||
    input.hasPendingMarqueeSelection ||
    input.hasActiveMarqueeSelection ||
    input.hasReconnectState
  );
}

/** 判断一份已经缓存的 authority 文档当前是否允许安全 flush。 */
export function canFlushDeferredAuthorityDocumentProjection(
  input: AuthorityDocumentProjectionFlushInput
): boolean {
  return (
    input.hasPendingAuthorityDocument &&
    !isAuthorityDocumentProjectionInteractionActive(input) &&
    input.pendingOperationCount === 0
  );
}
