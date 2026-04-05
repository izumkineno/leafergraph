/**
 * Web Crawler Nodes 项目级信息集中存放。
 */
import type {
  LeaferGraphExecutionContext,
  LeaferGraphTimerRuntimePayload
} from "@leafergraph/execution";

export const WEB_CRAWLER_NODES_PACKAGE_NAME = "@leafergraph/web-crawler-nodes";
export const WEB_CRAWLER_NODES_VERSION = "0.1.0";
export const WEB_CRAWLER_NODES_SCOPE = {
  namespace: "web-crawler",
  group: "Web Crawler"
} as const;

export const WEB_CRAWLER_NODES_DEFAULT_WIDTH = 288;
export const WEB_CRAWLER_NODES_DEFAULT_MIN_HEIGHT = 184;

export const WEB_CRAWLER_CRAWLER_LOCAL_TYPE = "crawler";
export const WEB_CRAWLER_PARSER_LOCAL_TYPE = "parser";
export const WEB_CRAWLER_ARRAY_LIST_LOCAL_TYPE = "array-list";
export const WEB_CRAWLER_PROGRESS_RING_WIDGET_TYPE = "progress-ring";

export const WEB_CRAWLER_NODES_BUNDLE_ID =
  `${WEB_CRAWLER_NODES_PACKAGE_NAME}/nodes`;
export const WEB_CRAWLER_NODES_BUNDLE_NAME = "Web Crawler Nodes Bundle";

export function resolveCrawlerNodeType(localType: string): string {
  return `${WEB_CRAWLER_NODES_SCOPE.namespace}/${localType}`;
}

export const WEB_CRAWLER_CRAWLER_TYPE =
  resolveCrawlerNodeType(WEB_CRAWLER_CRAWLER_LOCAL_TYPE);
export const WEB_CRAWLER_PARSER_TYPE =
  resolveCrawlerNodeType(WEB_CRAWLER_PARSER_LOCAL_TYPE);
export const WEB_CRAWLER_ARRAY_LIST_TYPE =
  resolveCrawlerNodeType(WEB_CRAWLER_ARRAY_LIST_LOCAL_TYPE);

export const webCrawlerNodesQuickCreateNodeType = WEB_CRAWLER_CRAWLER_TYPE;

export function readWidgetString(
  ctx: { getWidget: (name: string, defaultValue: unknown) => unknown },
  name: string,
  defaultValue: string
): string {
  const value = ctx.getWidget(name, defaultValue);
  return String(value ?? defaultValue);
}

export function updateStatus(
  ctx: { setWidget: (name: string, value: unknown) => void },
  text: string
): void {
  ctx.setWidget("status", text);
}

// 长任务执行辅助函数，参考 authoring-basic-nodes 实现
export function getExecutionContext(
  ctx: { execution?: LeaferGraphExecutionContext },
  options?: Record<string, unknown>
): LeaferGraphExecutionContext | undefined {
  return ctx.execution ?? (options as { executionContext?: LeaferGraphExecutionContext })?.executionContext;
}

export function getTimerRuntimePayload(
  execution: LeaferGraphExecutionContext | undefined
): LeaferGraphTimerRuntimePayload | undefined {
  const payload = execution?.payload;
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  return payload as LeaferGraphTimerRuntimePayload;
}

export function isGraphExecution(
  execution: LeaferGraphExecutionContext | undefined
): execution is LeaferGraphExecutionContext & {
  source: "graph-play" | "graph-step";
} {
  return (
    execution?.source === "graph-play" ||
    execution?.source === "graph-step"
  );
}

export function isTimerTickExecution(
  execution: LeaferGraphExecutionContext | undefined,
  nodeId: string,
  timerId?: string
): boolean {
  const payload = getTimerRuntimePayload(execution);
  if (payload?.timerTickNodeId !== nodeId) {
    return false;
  }

  if (timerId !== undefined) {
    return payload.timerTickTimerId === timerId;
  }

  return true;
}

export function getTimerTickId(
  execution: LeaferGraphExecutionContext | undefined
): string | undefined {
  return getTimerRuntimePayload(execution)?.timerTickTimerId;
}

export function preserveRunningExecutionState(
  ctx: { node: { data?: Record<string, unknown> } }
): void {
  if (!ctx.node.data || typeof ctx.node.data !== "object") {
    ctx.node.data = {};
  }

  (ctx.node.data as Record<string, unknown>)["__leafergraphExecutionStateOverride"] = {
    status: "running"
  };
}

let crawlerTicketSequence = 0;

export function createCrawlerTicketId(nodeId: string): string {
  crawlerTicketSequence += 1;
  return `${nodeId}:crawler:${crawlerTicketSequence}`;
}

/**
 * 设置节点标题。
 *
 * @param node - 节点。
 * @param title - 新标题。
 * @returns 无返回值。
 */
export function setNodeTitle(node: { title: string }, title: string): void {
  node.title = title;
}
