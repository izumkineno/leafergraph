import { describe, expect, test } from "bun:test";

import type { LeaferGraphInteractionActivityState } from "leafergraph";
import {
  canFlushDeferredAuthorityDocumentProjection,
  isAuthorityDocumentProjectionInteractionActive
} from "../src/ui/viewport/authority_document_projection_gate";

const idleInteractionState: LeaferGraphInteractionActivityState = {
  active: false,
  mode: "idle"
};

describe("authority_document_projection_gate", () => {
  test("主包拖拽交互活跃时应阻塞 authority 文档投影", () => {
    expect(
      isAuthorityDocumentProjectionInteractionActive({
        graphInteractionState: {
          active: true,
          mode: "node-drag"
        },
        hasPendingMarqueeSelection: false,
        hasActiveMarqueeSelection: false,
        hasReconnectState: false
      })
    ).toBe(true);
  });

  test("editor 本地框选或重连会话活跃时也应阻塞 authority 文档投影", () => {
    expect(
      isAuthorityDocumentProjectionInteractionActive({
        graphInteractionState: idleInteractionState,
        hasPendingMarqueeSelection: true,
        hasActiveMarqueeSelection: false,
        hasReconnectState: false
      })
    ).toBe(true);

    expect(
      isAuthorityDocumentProjectionInteractionActive({
        graphInteractionState: idleInteractionState,
        hasPendingMarqueeSelection: false,
        hasActiveMarqueeSelection: false,
        hasReconnectState: true
      })
    ).toBe(true);
  });

  test("存在缓存 authority 文档且 pending 已清空时才允许 flush", () => {
    expect(
      canFlushDeferredAuthorityDocumentProjection({
        graphInteractionState: idleInteractionState,
        hasPendingMarqueeSelection: false,
        hasActiveMarqueeSelection: false,
        hasReconnectState: false,
        hasPendingAuthorityDocument: true,
        pendingOperationCount: 0
      })
    ).toBe(true);

    expect(
      canFlushDeferredAuthorityDocumentProjection({
        graphInteractionState: idleInteractionState,
        hasPendingMarqueeSelection: false,
        hasActiveMarqueeSelection: false,
        hasReconnectState: false,
        hasPendingAuthorityDocument: true,
        pendingOperationCount: 1
      })
    ).toBe(false);

    expect(
      canFlushDeferredAuthorityDocumentProjection({
        graphInteractionState: idleInteractionState,
        hasPendingMarqueeSelection: false,
        hasActiveMarqueeSelection: false,
        hasReconnectState: false,
        hasPendingAuthorityDocument: false,
        pendingOperationCount: 0
      })
    ).toBe(false);
  });
});
