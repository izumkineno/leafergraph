/**
 * 图交互提交桥模块。
 *
 * @remarks
 * 负责把 LeaferGraph 交互层产生的提交意图翻译成 editor 命令或正式 `GraphOperation`，
 * 让交互侧不直接依赖命令总线的实现细节。
 */
import type {
  LeaferGraphInteractionCommitEvent,
  LeaferGraphUpdateNodeInput
} from "leafergraph";
import {
  createLinkCreateOperation,
  createNodeMoveOperation,
  createNodeResizeOperation,
  createNodeUpdateOperation,
  ensureLinkCreateInputId
} from "../commands/graph_operation_utils";
import { createWidgetCommitUpdateInputs } from "./widget_commit_update";
import type {
  EditorCommandExecution,
  EditorCommandHistoryPayload,
  EditorCommandRequest
} from "../commands/command_bus";
import type {
  EditorGraphDocumentSession,
  EditorGraphOperationSubmission
} from "../session/graph_document_session";

/** 交互提交桥创建参数。 */
export interface CreateGraphInteractionCommitBridgeOptions {
  session: EditorGraphDocumentSession;
  rollbackToAuthorityDocument(): void;
}

/** GraphViewport 侧可复用的交互提交桥。 */
export interface GraphInteractionCommitBridge {
  submit(event: LeaferGraphInteractionCommitEvent): EditorCommandExecution | null;
}

function cloneUpdateInput(
  input: LeaferGraphUpdateNodeInput
): LeaferGraphUpdateNodeInput {
  return structuredClone(input);
}

function resolveRequestSummary(request: EditorCommandRequest): string {
  switch (request.type) {
    case "interaction.move":
      return request.nodeIds.length > 1
        ? `移动 ${request.nodeIds.length} 个节点`
        : `移动节点 ${request.nodeIds[0] ?? ""}`;
    case "interaction.resize":
      return `调整节点 ${request.nodeId} 尺寸`;
    case "interaction.collapse":
      return `${request.collapsed ? "折叠" : "展开"}节点 ${request.nodeId}`;
    case "interaction.widget-commit":
      return `提交节点 ${request.nodeId} 的 Widget ${request.widgetIndex}`;
    case "link.create":
      return "创建连线";
    default:
      return "提交交互操作";
  }
}

function collectPendingOperationIds(
  session: EditorGraphDocumentSession,
  pendingBefore: ReadonlySet<string>,
  submissions: readonly EditorGraphOperationSubmission[]
): string[] {
  const operationIdSet = new Set(
    submissions.map((submission) => submission.applyResult.operation.operationId)
  );

  return session.pendingOperationIds.filter(
    (operationId) =>
      !pendingBefore.has(operationId) && operationIdSet.has(operationId)
  );
}

function createAuthorityState(
  session: EditorGraphDocumentSession,
  pendingBefore: ReadonlySet<string>,
  submissions: readonly EditorGraphOperationSubmission[],
  onRejected: () => void
): EditorCommandExecution["authority"] {
  const pendingOperationIds = collectPendingOperationIds(
    session,
    pendingBefore,
    submissions
  );
  const operationIds = submissions.map(
    (submission) => submission.applyResult.operation.operationId
  );
  const confirmation = Promise.all(
    submissions.map((submission) => submission.confirmation)
  );

  void confirmation.then((confirmations) => {
    if (confirmations.some((item) => !item.accepted)) {
      onRejected();
    }
  });

  if (pendingOperationIds.length > 0) {
    return {
      status: "pending",
      operationIds,
      pendingOperationIds,
      reason: "等待 authority 确认",
      confirmation
    };
  }

  const applyResults = submissions.map((submission) => submission.applyResult);
  if (applyResults.some((result) => !result.accepted)) {
    onRejected();
    return {
      status: "rejected",
      operationIds,
      reason:
        applyResults.find((result) => !result.accepted)?.reason ??
        "命令执行未被 authority 接受",
      confirmation
    };
  }

  if (applyResults.some((result) => result.changed)) {
    return {
      status: "confirmed",
      operationIds,
      confirmation
    };
  }

  return {
    status: "confirmed",
    operationIds,
    reason: "操作已接受，但没有产生状态变化",
    confirmation
  };
}

function createExecution(
  request: EditorCommandRequest,
  submissions: readonly EditorGraphOperationSubmission[],
  historyPayload: EditorCommandHistoryPayload | undefined,
  pendingBefore: ReadonlySet<string>,
  options: CreateGraphInteractionCommitBridgeOptions
): EditorCommandExecution {
  const applyResults = submissions.map((submission) => submission.applyResult);
  const applyChanged =
    applyResults.length > 0 && applyResults.some((result) => result.changed);
  const success =
    applyResults.length > 0 && applyResults.every((result) => result.accepted);
  const changed = Boolean(historyPayload && applyResults.length);
  const authority = createAuthorityState(
    options.session,
    pendingBefore,
    submissions,
    options.rollbackToAuthorityDocument
  );

  return {
    request,
    result: true,
    operations: applyResults.map((result) => structuredClone(result.operation)),
    documentRecorded:
      authority.status !== "pending" && (!success || applyChanged),
    historyPayload,
    authority,
    success,
    changed,
    recordable: Boolean(historyPayload && applyResults.length),
    summary: resolveRequestSummary(request),
    timestamp: Date.now()
  };
}

/**
 * 创建 editor 交互提交桥。
 *
 * @remarks
 * 它只负责把主包的交互提交事件
 * 统一转换成正式 `GraphOperation + history payload + authority state`。
 */
export function createGraphInteractionCommitBridge(
  options: CreateGraphInteractionCommitBridgeOptions
): GraphInteractionCommitBridge {
  return {
    submit(event: LeaferGraphInteractionCommitEvent): EditorCommandExecution | null {
      const pendingBefore = new Set(options.session.pendingOperationIds);

      switch (event.type) {
        case "node.move.commit": {
          if (!event.entries.length) {
            return null;
          }

          const submissions = event.entries.map((entry) =>
            options.session.submitOperationWithAuthority(
              createNodeMoveOperation(entry.nodeId, entry.after, "editor.interaction")
            )
          );

          return createExecution(
            {
              type: "interaction.move",
              nodeIds: event.entries.map((entry) => entry.nodeId)
            },
            submissions,
            {
              kind: "move-nodes",
              positions: event.entries.map((entry) => ({
                nodeId: entry.nodeId,
                beforePosition: structuredClone(entry.before),
                afterPosition: structuredClone(entry.after)
              }))
            },
            pendingBefore,
            options
          );
        }
        case "node.resize.commit": {
          const submissions = [
            options.session.submitOperationWithAuthority(
              createNodeResizeOperation(event.nodeId, event.after, "editor.interaction")
            )
          ];

          return createExecution(
            {
              type: "interaction.resize",
              nodeId: event.nodeId
            },
            submissions,
            {
              kind: "resize-node",
              nodeId: event.nodeId,
              beforeSize: structuredClone(event.before),
              afterSize: structuredClone(event.after)
            },
            pendingBefore,
            options
          );
        }
        case "node.collapse.commit": {
          const beforeInput = cloneUpdateInput({
            flags: { collapsed: event.beforeCollapsed }
          });
          const afterInput = cloneUpdateInput({
            flags: { collapsed: event.afterCollapsed }
          });
          const submissions = [
            options.session.submitOperationWithAuthority(
              createNodeUpdateOperation(
                event.nodeId,
                afterInput,
                "editor.interaction"
              )
            )
          ];

          return createExecution(
            {
              type: "interaction.collapse",
              nodeId: event.nodeId,
              collapsed: event.afterCollapsed
            },
            submissions,
            {
              kind: "update-node",
              nodeId: event.nodeId,
              beforeInput,
              afterInput
            },
            pendingBefore,
            options
          );
        }
        case "node.widget.commit": {
          const { beforeInput, afterInput } = createWidgetCommitUpdateInputs({
            document: options.session.currentDocument,
            nodeId: event.nodeId,
            beforeWidgets: event.beforeWidgets,
            afterWidgets: event.afterWidgets
          });
          const submissions = [
            options.session.submitOperationWithAuthority(
              createNodeUpdateOperation(
                event.nodeId,
                afterInput,
                "editor.interaction"
              )
            )
          ];

          return createExecution(
            {
              type: "interaction.widget-commit",
              nodeId: event.nodeId,
              widgetIndex: event.widgetIndex
            },
            submissions,
            {
              kind: "update-node",
              nodeId: event.nodeId,
              beforeInput,
              afterInput
            },
            pendingBefore,
            options
          );
        }
        case "link.create.commit": {
          const nextInput = ensureLinkCreateInputId(event.input);
          const submission = options.session.submitOperationWithAuthority(
            createLinkCreateOperation(nextInput, "editor.interaction")
          );

          return createExecution(
            {
              type: "link.create",
              input: structuredClone(nextInput)
            },
            [submission],
            {
              kind: "create-links",
              links: [
                {
                  id: nextInput.id ?? "",
                  source: structuredClone(nextInput.source),
                  target: structuredClone(nextInput.target),
                  label: nextInput.label,
                  data: structuredClone(nextInput.data)
                }
              ]
            },
            pendingBefore,
            options
          );
        }
      }
    }
  };
}
