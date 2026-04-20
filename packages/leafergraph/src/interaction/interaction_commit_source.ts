/**
 * 交互提交事件分发模块。
 *
 * @remarks
 * 负责把“本地交互已结束”的正式提交事件
 * 以最小订阅接口暴露给 editor。
 */

import type { LeaferGraphInteractionCommitEvent } from "@leafergraph/contracts";

/** 交互提交事件订阅源。 */
export interface LeaferGraphInteractionCommitSource {
  emit(event: LeaferGraphInteractionCommitEvent): void;
  subscribe(
    listener: (event: LeaferGraphInteractionCommitEvent) => void
  ): () => void;
}

/**
 * 创建一个最小交互提交事件源。
 *
 * @remarks
 * 这里刻意不耦合任何场景或 editor 语义，
 * 只负责分发已经归一化完成的提交事件。
 *
 * @returns 创建后的结果对象。
 */
export function createLeaferGraphInteractionCommitSource(): LeaferGraphInteractionCommitSource {
  const listeners = new Set<
    (event: LeaferGraphInteractionCommitEvent) => void
  >();

  return {
    emit(event: LeaferGraphInteractionCommitEvent): void {
      if (!listeners.size) {
        return;
      }

      const snapshot = structuredClone(event);
      for (const listener of listeners) {
        listener(snapshot);
      }
    },

    subscribe(
      listener: (event: LeaferGraphInteractionCommitEvent) => void
    ): () => void {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    }
  };
}
