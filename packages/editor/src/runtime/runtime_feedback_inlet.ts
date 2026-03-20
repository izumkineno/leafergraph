import type { RuntimeFeedbackEvent } from "leafergraph";

/** editor 侧统一的运行反馈输入通道。 */
export interface EditorRuntimeFeedbackInlet {
  /**
   * 订阅外部运行反馈事件。
   *
   * @returns 取消订阅函数
   */
  subscribe(listener: (event: RuntimeFeedbackEvent) => void): () => void;
}

/** 可手动推送事件的最小 inlet，便于调试和测试注入。 */
export interface ManualEditorRuntimeFeedbackInlet
  extends EditorRuntimeFeedbackInlet {
  emit(event: RuntimeFeedbackEvent): void;
}

/** 创建一个内存态手动反馈 inlet。 */
export function createManualRuntimeFeedbackInlet(): ManualEditorRuntimeFeedbackInlet {
  const listeners = new Set<(event: RuntimeFeedbackEvent) => void>();

  return {
    subscribe(listener: (event: RuntimeFeedbackEvent) => void): () => void {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    emit(event: RuntimeFeedbackEvent): void {
      for (const listener of listeners) {
        listener(event);
      }
    }
  };
}
