import {
  NodeRegistry,
  createNodeState,
  type GraphLink,
  type NodeDefinition,
  type NodeInit,
  type NodeRuntimeState,
  type WidgetDefinition,
  type WidgetDefinitionReader
} from "@leafergraph/node";

export function createWidgetReader(
  definitions: WidgetDefinition[] = []
): WidgetDefinitionReader {
  const definitionMap = new Map(definitions.map((definition) => [definition.type, definition]));
  return {
    get(type) {
      return definitionMap.get(type);
    }
  };
}

export function createNodeRegistry(definitions: NodeDefinition[] = []): NodeRegistry {
  return new NodeRegistry(
    createWidgetReader([
      { type: "input" },
      { type: "toggle" },
      { type: "button" }
    ]),
    definitions
  );
}

export function createRuntimeNode(
  registry: NodeRegistry,
  init: NodeInit
): NodeRuntimeState {
  return createNodeState(registry, init);
}

export function createGraphLinks(links: GraphLink[]): Map<string, GraphLink> {
  return new Map(links.map((link) => [link.id, link]));
}

export class ManualTimerScheduler {
  private nextId = 1;
  private now = 0;
  private timers = new Map<number, { dueAt: number; callback: () => void }>();

  readonly setTimeout = ((callback: () => void, delay?: number) => {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.set(id, {
      dueAt: this.now + Math.max(0, Number(delay ?? 0)),
      callback
    });
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  readonly clearTimeout = ((handle: ReturnType<typeof setTimeout>) => {
    this.timers.delete(handle as unknown as number);
  }) as typeof clearTimeout;

  elapse(durationMs: number): void {
    this.now += Math.max(0, durationMs);
  }

  tick(durationMs: number): void {
    this.elapse(durationMs);

    while (true) {
      const readyTimers = [...this.timers.entries()]
        .filter(([, timer]) => timer.dueAt <= this.now)
        .sort((left, right) => left[1].dueAt - right[1].dueAt || left[0] - right[0]);

      if (!readyTimers.length) {
        return;
      }

      for (const [id, timer] of readyTimers) {
        this.timers.delete(id);
        timer.callback();
      }
    }
  }
}
