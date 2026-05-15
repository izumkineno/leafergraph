/**
 * 图运行时历史捕获装配模块。
 *
 * @remarks
 * 负责把交互提交事件映射成正式 history record，
 * 让主装配器只保留“接线”而不继续持有整段 history capture 逻辑。
 */

import type { GraphDocument, NodeRegistry } from "@leafergraph/core/node";
import type { LeaferGraphInteractionCommitEvent } from "@leafergraph/core/contracts";
import type { GraphRuntimeState, LeaferGraphRenderableNodeState } from "../types";
import {
  createHistoryRecordEvent,
  createLeaferGraphHistorySource,
  createLinkCreateHistoryRecord,
  createNodeCollapseHistoryRecord,
  createNodeMoveCommitHistoryRecord,
  createNodeRenameHistoryRecord,
  createNodeResizeHistoryRecord,
  createNodeWidgetHistoryRecord,
  serializeRuntimeGraphDocument,
  type LeaferGraphHistorySource
} from "../history";
import type { LeaferGraphSceneRuntimeAssemblyResult } from "./scene";

const INTERACTION_COMMIT_SOURCE = "interaction.commit" as const;

/**
 * 图运行时历史捕获装配输入。
 */
export interface LeaferGraphRuntimeHistoryCaptureOptions<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  nodeRegistry: NodeRegistry;
  graphState: GraphRuntimeState<TNodeState>;
  sceneRuntime: Pick<
    LeaferGraphSceneRuntimeAssemblyResult<TNodeState>,
    "sceneRuntimeHost" | "interactionCommitSource"
  >;
}

/**
 * 图运行时历史捕获装配结果。
 */
export interface LeaferGraphRuntimeHistoryCapture {
  historySource: LeaferGraphHistorySource;
  getGraphDocument(): GraphDocument;
  destroyHistoryCapture(): void;
}

/**
 * 创建主包运行时的本地 history capture。
 *
 * @param options - history capture 装配输入。
 * @returns history capture 所需的最小宿主集合。
 */
export function createLeaferGraphRuntimeHistoryCapture<
  TNodeState extends LeaferGraphRenderableNodeState
>(
  options: LeaferGraphRuntimeHistoryCaptureOptions<TNodeState>
): LeaferGraphRuntimeHistoryCapture {
  const historySource = createLeaferGraphHistorySource();
  const getGraphDocument = () =>
    serializeRuntimeGraphDocument(options.nodeRegistry, options.graphState);
  const emitHistoryRecord = (
    record: ReturnType<typeof createNodeMoveCommitHistoryRecord>
  ): void => {
    if (record) {
      historySource.emit(createHistoryRecordEvent(record));
    }
  };
  const interactionCommitHandlers = {
    "node.move.commit": (event) => {
      emitHistoryRecord(
        createNodeMoveCommitHistoryRecord({
          entries: event.entries,
          source: INTERACTION_COMMIT_SOURCE
        })
      );
    },
    "node.resize.commit": (event) => {
      emitHistoryRecord(
        createNodeResizeHistoryRecord({
          nodeId: event.nodeId,
          before: event.before,
          after: event.after,
          source: INTERACTION_COMMIT_SOURCE
        })
      );
    },
    "node.collapse.commit": (event) => {
      emitHistoryRecord(
        createNodeCollapseHistoryRecord({
          nodeId: event.nodeId,
          beforeCollapsed: event.beforeCollapsed,
          afterCollapsed: event.afterCollapsed,
          source: INTERACTION_COMMIT_SOURCE
        })
      );
    },
    "node.widget.commit": (event) => {
      emitHistoryRecord(
        createNodeWidgetHistoryRecord({
          nodeId: event.nodeId,
          widgetIndex: event.widgetIndex,
          beforeValue: event.beforeValue,
          afterValue: event.afterValue,
          source: INTERACTION_COMMIT_SOURCE
        })
      );
    },
    "node.rename.commit": (event) => {
      emitHistoryRecord(
        createNodeRenameHistoryRecord({
          nodeId: event.nodeId,
          beforeTitle: event.beforeTitle,
          afterTitle: event.afterTitle,
          source: INTERACTION_COMMIT_SOURCE
        })
      );
    },
    "link.create.commit": (event) => {
      try {
        const link = options.sceneRuntime.sceneRuntimeHost.createLink(
          event.input,
          INTERACTION_COMMIT_SOURCE
        );
        historySource.emit(
          createHistoryRecordEvent(
            createLinkCreateHistoryRecord({
              link,
              source: INTERACTION_COMMIT_SOURCE
            })
          )
        );
      } catch {
        // 当前阶段让正式交互事件继续可观测，但不重复抛出运行时错误。
      }
    }
  } satisfies {
    [TType in LeaferGraphInteractionCommitEvent["type"]]: (
      event: Extract<LeaferGraphInteractionCommitEvent, { type: TType }>
    ) => void;
  };

  const destroyHistoryCapture = options.sceneRuntime.interactionCommitSource.subscribe(
    (event) => {
      const handler = interactionCommitHandlers[event.type] as (
        nextEvent: LeaferGraphInteractionCommitEvent
      ) => void;
      handler(event);
    }
  );

  return {
    historySource,
    getGraphDocument,
    destroyHistoryCapture
  };
}
