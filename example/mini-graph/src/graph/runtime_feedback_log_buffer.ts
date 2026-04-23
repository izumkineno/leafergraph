export interface RuntimeFeedbackLogBufferScheduler<Token> {
  schedule(callback: () => void, delayMs: number): Token;
  cancel(token: Token): void;
}

export interface RuntimeFeedbackLogBufferSnapshot {
  pendingCount: number;
  scheduled: boolean;
  flushCount: number;
  disposed: boolean;
}

export interface RuntimeFeedbackLogBuffer {
  enqueue(message: string): void;
  flushNow(): void;
  clear(): void;
  dispose(): void;
  getSnapshot(): RuntimeFeedbackLogBufferSnapshot;
}

export interface RuntimeFeedbackLogBufferOptions<Entry, Token> {
  maxEntries: number;
  flushDelayMs: number;
  scheduler: RuntimeFeedbackLogBufferScheduler<Token>;
  createEntry(message: string): Entry;
  applyEntries(
    createNextEntries: (currentEntries: readonly Entry[]) => Entry[]
  ): void;
}

/**
 * Coalesces high-frequency runtime feedback messages into bounded UI updates.
 *
 * The helper is intentionally UI-framework agnostic: the caller owns entry
 * creation and state application, while this buffer owns scheduling,
 * cancellation, entry retention, and post-dispose no-op semantics.
 *
 * @param options - Buffer limits, scheduler, and state application hooks.
 * @returns A small runtime feedback log buffer controller.
 */
export function createRuntimeFeedbackLogBuffer<Entry, Token>(
  options: RuntimeFeedbackLogBufferOptions<Entry, Token>
): RuntimeFeedbackLogBuffer {
  const maxEntries = Math.max(0, Math.floor(options.maxEntries));
  const flushDelayMs = Math.max(0, options.flushDelayMs);
  const pendingMessages: string[] = [];

  let disposed = false;
  let flushCount = 0;
  let hasScheduledFlush = false;
  let scheduledToken: Token | undefined;
  let schedulerVersion = 0;

  /**
   * Drops pending messages that could never be visible in the capped log.
   *
   * @returns No return value.
   */
  const trimPendingMessages = (): void => {
    const overflowCount = pendingMessages.length - maxEntries;
    if (overflowCount > 0) {
      pendingMessages.splice(0, overflowCount);
    }
  };

  /**
   * Cancels the current scheduler token and invalidates already-captured
   * callbacks, even if a test or browser race invokes them later.
   *
   * @returns No return value.
   */
  const cancelScheduledFlush = (): void => {
    if (!hasScheduledFlush || scheduledToken === undefined) {
      return;
    }

    const token = scheduledToken;
    hasScheduledFlush = false;
    scheduledToken = undefined;
    schedulerVersion += 1;
    options.scheduler.cancel(token);
  };

  /**
   * Applies pending messages as one newest-first log update.
   *
   * @returns No return value.
   */
  const flushPendingMessages = (): void => {
    if (disposed || pendingMessages.length === 0) {
      return;
    }

    if (maxEntries === 0) {
      pendingMessages.length = 0;
      return;
    }

    const messages = pendingMessages.splice(0, pendingMessages.length);
    const newEntries = messages.map(options.createEntry).reverse();

    options.applyEntries((currentEntries) =>
      [...newEntries, ...currentEntries].slice(0, maxEntries)
    );
    flushCount += 1;
  };

  /**
   * Schedules a flush if one is not already pending.
   *
   * @returns No return value.
   */
  const scheduleFlush = (): void => {
    if (disposed || hasScheduledFlush || pendingMessages.length === 0) {
      return;
    }

    const callbackVersion = schedulerVersion;
    scheduledToken = options.scheduler.schedule(() => {
      if (disposed || callbackVersion !== schedulerVersion) {
        return;
      }

      hasScheduledFlush = false;
      scheduledToken = undefined;
      flushPendingMessages();
    }, flushDelayMs);
    hasScheduledFlush = true;
  };

  return {
    enqueue(message) {
      if (disposed || maxEntries === 0) {
        return;
      }

      pendingMessages.push(message);
      trimPendingMessages();
      scheduleFlush();
    },
    flushNow() {
      if (disposed) {
        return;
      }

      cancelScheduledFlush();
      flushPendingMessages();
    },
    clear() {
      if (disposed) {
        return;
      }

      cancelScheduledFlush();
      pendingMessages.length = 0;
    },
    dispose() {
      if (disposed) {
        return;
      }

      cancelScheduledFlush();
      pendingMessages.length = 0;
      disposed = true;
      schedulerVersion += 1;
    },
    getSnapshot() {
      return {
        pendingCount: pendingMessages.length,
        scheduled: hasScheduledFlush,
        flushCount,
        disposed
      };
    }
  };
}
