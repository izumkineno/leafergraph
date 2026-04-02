import type {
  GraphOperation,
  GraphOperationSource,
  LeaferGraphInteractionCommitEvent
} from "@leafergraph/contracts";

export interface CreateGraphOperationsFromInteractionCommitContext {
  event: LeaferGraphInteractionCommitEvent;
  index: number;
  source: GraphOperationSource;
  timestamp: number;
}

export interface CreateGraphOperationsFromInteractionCommitOptions {
  source?: GraphOperationSource;
  timestamp?: number;
  operationIdPrefix?: string;
  createOperationId?(
    context: CreateGraphOperationsFromInteractionCommitContext
  ): string;
}

/**
 * 把一次交互提交事件翻译成正式图操作数组。
 *
 * @param event - 交互提交事件。
 * @param options - 操作元信息生成控制项。
 * @returns 正式图操作数组。
 */
export function createGraphOperationsFromInteractionCommit(
  event: LeaferGraphInteractionCommitEvent,
  options: CreateGraphOperationsFromInteractionCommitOptions = {}
): GraphOperation[] {
  const source = options.source ?? "interaction.commit";
  const timestamp = options.timestamp ?? Date.now();
  const operationIdPrefix =
    options.operationIdPrefix ?? `${source}:${event.type}:${timestamp}`;
  const createOperationId =
    options.createOperationId ??
    ((context: CreateGraphOperationsFromInteractionCommitContext) =>
      `${operationIdPrefix}:${context.index}`);

  const createBase = (index: number) => ({
    operationId: createOperationId({
      event,
      index,
      source,
      timestamp
    }),
    timestamp,
    source
  });

  switch (event.type) {
    case "node.move.commit":
      return event.entries.map((entry, index) => ({
        ...createBase(index),
        type: "node.move",
        nodeId: entry.nodeId,
        input: {
          x: entry.after.x,
          y: entry.after.y
        }
      }));
    case "node.resize.commit":
      return [
        {
          ...createBase(0),
          type: "node.resize",
          nodeId: event.nodeId,
          input: {
            width: event.after.width,
            height: event.after.height
          }
        }
      ];
    case "link.create.commit":
      return [
        {
          ...createBase(0),
          type: "link.create",
          input: structuredClone(event.input)
        }
      ];
    case "node.collapse.commit":
      return [
        {
          ...createBase(0),
          type: "node.collapse",
          nodeId: event.nodeId,
          collapsed: event.afterCollapsed
        }
      ];
    case "node.widget.commit":
      return [
        {
          ...createBase(0),
          type: "node.widget.value.set",
          nodeId: event.nodeId,
          widgetIndex: event.widgetIndex,
          value: structuredClone(event.afterValue)
        }
      ];
    default:
      return [];
  }
}
