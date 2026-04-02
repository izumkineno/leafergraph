import type {
  GraphOperation,
  GraphOperationApplyResult
} from "@leafergraph/contracts";
import type { LeaferGraph } from "leafergraph";
import type { GraphDocument } from "@leafergraph/runtime-bridge/portable";
import type { RuntimeBridgeControlCommand } from "@leafergraph/runtime-bridge/transport";
import type { RuntimeBridgeInboundEvent } from "@leafergraph/runtime-bridge/transport";
import type {
  LeaferGraphHistoryEvent,
  RuntimeFeedbackEvent
} from "@leafergraph/runtime-bridge/portable";
import { createRuntimeBridgeNodeDemoDocument } from "../shared/document";
import {
  createRuntimeBridgeDemoContainer,
  ensureRuntimeBridgeDemoHeadlessDom
} from "./happy_dom";
import {
  formatControlCommandBehavior,
  formatDocumentSummary,
  formatGraphOperationBehavior,
  formatGraphOperationResult,
  formatHistoryEventBehavior,
  formatInboundEventBehavior,
  formatRuntimeFeedbackBehavior,
  logRuntimeBridgeServer,
  logRuntimeBridgeServerError
} from "./logging";

/**
 * 单文档 Node authority。
 *
 * @remarks
 * 使用 headless `LeaferGraph` 作为唯一真源，
 * 并把 snapshot / operation / control / runtime feedback 全部收口在这里。
 */
export class RuntimeBridgeNodeAuthority {
  private readonly graph: LeaferGraph;
  private readonly container: HTMLDivElement;
  private readonly listeners = new Set<(event: RuntimeBridgeInboundEvent) => void>();
  private readonly disposeRuntimeFeedback: () => void;
  private readonly disposeHistory: () => void;

  private constructor(graph: LeaferGraph, container: HTMLDivElement) {
    this.graph = graph;
    this.container = container;
    this.disposeRuntimeFeedback = this.graph.subscribeRuntimeFeedback(
      (feedback: RuntimeFeedbackEvent) => {
        logRuntimeBridgeServer(
          "authority",
          "runtime.feedback",
          formatRuntimeFeedbackBehavior(feedback)
        );
        this.emit({
          type: "runtime.feedback",
          feedback
        });
      }
    );
    this.disposeHistory = this.graph.subscribeHistory((event: LeaferGraphHistoryEvent) => {
      logRuntimeBridgeServer(
        "authority",
        "history.event",
        formatHistoryEventBehavior(event)
      );
      this.emit({
        type: "history.event",
        event
      });
    });
  }

  /**
   * 创建 authority 实例。
   *
   * @returns 初始化完成后的 authority。
   */
  static async create(): Promise<RuntimeBridgeNodeAuthority> {
    ensureRuntimeBridgeDemoHeadlessDom();
    const [{ createLeaferGraph }, { leaferGraphBasicKitPlugin }] = await Promise.all([
      import("@leafergraph/runtime-bridge"),
      import("@leafergraph/basic-kit")
    ]);
    const container = createRuntimeBridgeDemoContainer();
    const graph = createLeaferGraph(container, {
      document: createRuntimeBridgeNodeDemoDocument(),
      plugins: [leaferGraphBasicKitPlugin],
      themeMode: "light"
    });

    await graph.ready;
    logRuntimeBridgeServer(
      "authority",
      "ready",
      formatDocumentSummary(graph.getGraphDocument())
    );
    return new RuntimeBridgeNodeAuthority(graph, container);
  }

  /**
   * 读取当前 authority 文档快照。
   *
   * @returns 当前正式文档。
   */
  requestSnapshot(): GraphDocument {
    const snapshot = structuredClone(this.graph.getGraphDocument());
    logRuntimeBridgeServer(
      "authority",
      "snapshot.request",
      formatDocumentSummary(snapshot)
    );
    return snapshot;
  }

  /**
   * 顺序提交一批正式图操作。
   *
   * @param operations - 待提交的操作数组。
   * @returns 每条操作的应用结果。
   */
  submitOperations(
    operations: readonly GraphOperation[]
  ): readonly GraphOperationApplyResult[] {
    const beforeDocument = this.graph.getGraphDocument();
    const results: GraphOperationApplyResult[] = [];
    const changedOperations: GraphOperation[] = [];

    logRuntimeBridgeServer(
      "authority",
      "operations.submit",
      `count=${operations.length} revision=${String(beforeDocument.revision)}`
    );

    for (const [index, operation] of operations.entries()) {
      logRuntimeBridgeServer(
        "authority",
        `operation[${index}]`,
        formatGraphOperationBehavior(operation)
      );
      const result = this.graph.applyGraphOperation(structuredClone(operation));
      results.push(result);
      logRuntimeBridgeServer(
        "authority",
        `result[${index}]`,
        formatGraphOperationResult(result)
      );

      if (result.accepted && result.changed) {
        changedOperations.push(structuredClone(result.operation));
      }
    }

    if (changedOperations.length > 0) {
      const afterDocument = this.graph.getGraphDocument();
      logRuntimeBridgeServer(
        "authority",
        "operations.changed",
        `${String(beforeDocument.revision)} -> ${String(afterDocument.revision)} changed=${changedOperations.length}`
      );
      this.emit({
        type: "document.diff",
        diff: {
          documentId: afterDocument.documentId,
          baseRevision: beforeDocument.revision,
          revision: afterDocument.revision,
          emittedAt: Date.now(),
          operations: changedOperations,
          fieldChanges: []
        }
      });
    } else {
      logRuntimeBridgeServer(
        "authority",
        "operations.no-change",
        "本批操作没有形成有效文档变更"
      );
    }

    return results;
  }

  /**
   * 分发一条控制命令到 authority 图实例。
   *
   * @param command - 控制命令。
   * @returns 无返回值。
   */
  sendControl(command: RuntimeBridgeControlCommand): void {
    let handled = false;

    logRuntimeBridgeServer(
      "authority",
      "control.receive",
      formatControlCommandBehavior(command)
    );

    switch (command.type) {
      case "play":
        handled = this.graph.play();
        break;
      case "step":
        handled = this.graph.step();
        break;
      case "stop":
        handled = this.graph.stop();
        break;
      case "play-from-node":
        handled = this.graph.playFromNode(command.nodeId);
        break;
      default:
        handled = false;
        break;
    }

    if (!handled) {
      logRuntimeBridgeServerError(
        "authority",
        "control.rejected",
        formatControlCommandBehavior(command)
      );
      throw new Error(`Authority rejected control command: ${command.type}`);
    }

    logRuntimeBridgeServer(
      "authority",
      "control.applied",
      formatControlCommandBehavior(command)
    );
  }

  /**
   * 订阅 authority 发出的 bridge 事件。
   *
   * @param listener - 事件监听器。
   * @returns 取消订阅函数。
   */
  subscribe(listener: (event: RuntimeBridgeInboundEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 销毁 authority。
   *
   * @returns 无返回值。
   */
  destroy(): void {
    logRuntimeBridgeServer("authority", "destroy");
    this.disposeRuntimeFeedback();
    this.disposeHistory();
    this.listeners.clear();
    this.graph.destroy();
    this.container.remove();
  }

  private emit(event: RuntimeBridgeInboundEvent): void {
    logRuntimeBridgeServer(
      "authority",
      "emit",
      formatInboundEventBehavior(event)
    );
    const snapshot = cloneBridgeEventForDelivery(event);
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

function cloneBridgeEventForDelivery(
  event: RuntimeBridgeInboundEvent
): RuntimeBridgeInboundEvent {
  try {
    return structuredClone(event);
  } catch {
    const seen = new WeakSet<object>();
    return JSON.parse(
      JSON.stringify(event, (_key, value) => {
        if (typeof value === "function") {
          return `[Function ${value.name || "anonymous"}]`;
        }

        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return "[Circular]";
          }
          seen.add(value);
        }

        return value;
      })
    ) as RuntimeBridgeInboundEvent;
  }
}
