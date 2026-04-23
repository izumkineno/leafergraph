export interface ExampleRuntimeFeedbackSubscriptionDebug {
  phase: "idle" | "bootstrapping" | "subscribed" | "cleaned-up";
  activeCount: number;
  subscribeCount: number;
  unsubscribeCount: number;
}

/**
 * 统一管理 runtime feedback 订阅快照，避免重复订阅并让 DEV/test 能直接观察当前阶段。
 *
 * @returns 可读的订阅控制器。
 */
export function createRuntimeFeedbackSubscriptionTracker(): {
  beginBootstrap(): void;
  attach(unsubscribe: () => void): void;
  dispose(nextPhase?: ExampleRuntimeFeedbackSubscriptionDebug["phase"]): void;
  getSnapshot(): ExampleRuntimeFeedbackSubscriptionDebug;
} {
  let unsubscribe: (() => void) | null = null;
  const snapshot: ExampleRuntimeFeedbackSubscriptionDebug = {
    phase: "idle",
    activeCount: 0,
    subscribeCount: 0,
    unsubscribeCount: 0
  };

  const publish = (
    patch: Partial<ExampleRuntimeFeedbackSubscriptionDebug>
  ): void => {
    Object.assign(snapshot, patch);
  };

  return {
    beginBootstrap() {
      publish({ phase: "bootstrapping" });
    },
    attach(nextUnsubscribe) {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
        publish({
          activeCount: 0,
          unsubscribeCount: snapshot.unsubscribeCount + 1
        });
      }

      unsubscribe = nextUnsubscribe;
      publish({
        phase: "subscribed",
        activeCount: 1,
        subscribeCount: snapshot.subscribeCount + 1
      });
    },
    dispose(nextPhase = "cleaned-up") {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
        publish({
          unsubscribeCount: snapshot.unsubscribeCount + 1
        });
      }

      publish({
        phase: nextPhase,
        activeCount: 0
      });
    },
    getSnapshot() {
      return { ...snapshot };
    }
  };
}
