import type {
  RuntimeBridgeCatalogEntry,
  RuntimeBridgeCatalogStore,
  RuntimeBridgeSessionExtensionState,
  RuntimeBridgeSessionExtensionStore
} from "@leafergraph/runtime-bridge";

/**
 * demo 使用的内存目录 store。
 */
export class DemoInMemoryCatalogStore implements RuntimeBridgeCatalogStore {
  private readonly entries = new Map<string, RuntimeBridgeCatalogEntry>();

  async listEntries(): Promise<readonly RuntimeBridgeCatalogEntry[]> {
    return [...this.entries.values()].map((entry) => structuredClone(entry));
  }

  async getEntry(entryId: string): Promise<RuntimeBridgeCatalogEntry | undefined> {
    const entry = this.entries.get(entryId);
    return entry ? structuredClone(entry) : undefined;
  }

  async putEntry(entry: RuntimeBridgeCatalogEntry): Promise<void> {
    this.entries.set(entry.entryId, structuredClone(entry));
  }

  async deleteEntry(entryId: string): Promise<void> {
    this.entries.delete(entryId);
  }
}

/**
 * demo 使用的内存会话状态 store。
 */
export class DemoInMemorySessionExtensionStore
  implements RuntimeBridgeSessionExtensionStore
{
  private readonly states = new Map<string, RuntimeBridgeSessionExtensionState>();

  async getSessionState(
    sessionId: string
  ): Promise<RuntimeBridgeSessionExtensionState> {
    const currentState = this.states.get(sessionId);
    if (currentState) {
      return structuredClone(currentState);
    }

    return {
      activeNodeEntryIds: [],
      activeComponentEntryIds: [],
      currentBlueprintId: null
    };
  }

  async setSessionState(
    sessionId: string,
    state: RuntimeBridgeSessionExtensionState
  ): Promise<void> {
    this.states.set(sessionId, structuredClone(state));
  }
}
