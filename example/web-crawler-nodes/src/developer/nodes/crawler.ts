import {
  BaseNode,
  type DevNodeContext,
  type NodeInputs,
  type NodeOutputs,
  type NodeProps
} from "@leafergraph/authoring";
import {
  createCrawlerTicketId,
  getExecutionContext,
  getTimerRuntimePayload,
  getTimerTickId,
  isGraphExecution,
  isTimerTickExecution,
  preserveRunningExecutionState,
  readWidgetString,
  setNodeTitle,
  updateStatus
} from "../shared";
import {
  WEB_CRAWLER_CRAWLER_DEFAULT_URL,
  WEB_CRAWLER_CRAWLER_META
} from "../../shared/node_meta";

interface CrawlerTicket {
  id: string;
  url: string;
  runId?: string;
  startedAt: number;
  completed?: boolean;
  failedMessage?: string;
}

interface CrawlerNodeState extends Record<string, unknown> {
  deliveredCount: number;
  droppedCount: number;
  active: CrawlerTicket | null;
  lastDom: string;
  lastStatus: number | undefined;
}

const CRAWLER_POLL_INTERVAL_MS = 120;
const CRAWLER_MIN_RING_VISIBLE_MS = 320;

function formatCrawlerStatus(options: {
  url: string;
  active: CrawlerTicket | null;
  droppedCount: number;
  lastDom: string;
  mode?: "ready" | "running" | "done" | "dropped" | "error";
}): string {
  const mode = options.mode ?? (options.active ? "running" : "ready");
  const droppedLine = `Dropped: ${options.droppedCount}`;
  const urlLine = `URL: ${options.url}`;
  switch (mode) {
    case "running":
      return `RUNNING\n${urlLine}\n${droppedLine}`;
    case "done":
      return `DONE\n${urlLine}\nSize: ${options.lastDom.length} bytes\n${droppedLine}`;
    case "dropped":
      return `DROPPED\n${urlLine}\n${droppedLine}`;
    default:
      return `READY\n${urlLine}\n${droppedLine}`;
  }
}

function syncCrawlerRunState(
  ctx: DevNodeContext<NodeProps, NodeInputs, NodeOutputs, CrawlerNodeState>,
  runId: string | undefined
): boolean {
  if (!runId) {
    return false;
  }

  const activeRunId = ctx.state.active?.runId;
  if (!activeRunId || activeRunId === runId) {
    return false;
  }

  ctx.state.active = null;
  return true;
}

export class CrawlerNode extends BaseNode<
  { url: string },
  { start: unknown },
  { dom: string },
  CrawlerNodeState
> {
  static defaultUrl = WEB_CRAWLER_CRAWLER_DEFAULT_URL;
  static meta = WEB_CRAWLER_CRAWLER_META;

  createState(): CrawlerNodeState {
    return {
      deliveredCount: 0,
      droppedCount: 0,
      active: null,
      lastDom: "",
      lastStatus: undefined
    };
  }

  onExecute(
    ctx: DevNodeContext<
      { url: string },
      { start: unknown },
      { dom: string },
      CrawlerNodeState
    >
  ) {
    const url = readWidgetString(ctx, "url", CrawlerNode.defaultUrl);
    ctx.setProp("url", url);
    setNodeTitle(ctx.node, `Crawler ${url}`);

    const execution = getExecutionContext(ctx);
    syncCrawlerRunState(ctx, execution?.runId);
    if (isTimerTickExecution(execution, ctx.node.id)) {
      const ticketId = getTimerTickId(execution);
      if (ticketId && ctx.state.active?.id === ticketId) {
        return this.resumeFetch(url, ctx, ctx.state.active, execution);
      }
    }

    if (execution?.source === "node-play") {
      return this.startFetch(url, ctx, execution);
    }

    updateStatus(
      ctx,
      formatCrawlerStatus({
        url: ctx.state.active?.url ?? url,
        active: ctx.state.active,
        droppedCount: ctx.state.droppedCount,
        lastDom: ctx.state.lastDom
      })
    );
  }

  private async doFetch(
    ticket: CrawlerTicket,
    ctx: DevNodeContext<
      { url: string },
      { start: unknown },
      { dom: string },
      CrawlerNodeState
    >,
    waitForGraphTick: boolean
  ): Promise<void> {
    try {
      const response = await fetch(ticket.url);
      const dom = await response.text();
      if (ctx.state.active !== ticket) {
        return;
      }

      ctx.state.lastDom = dom;
      ctx.state.lastStatus = response.status;
      if (waitForGraphTick) {
        ticket.completed = true;
        return;
      }

      ctx.state.active = null;
      ctx.state.deliveredCount += 1;
      ctx.setOutput("dom", dom);
      updateStatus(
        ctx,
        formatCrawlerStatus({
          url: ticket.url,
          active: null,
          droppedCount: ctx.state.droppedCount,
          lastDom: dom,
          mode: "done"
        })
      );
      setNodeTitle(ctx.node, "Crawler done");
    } catch (error) {
      if (ctx.state.active === ticket) {
        if (waitForGraphTick) {
          ticket.failedMessage =
            error instanceof Error ? error.message : String(error);
          ticket.completed = true;
          return;
        }

        ctx.state.active = null;
      }
      const message = error instanceof Error ? error.message : String(error);
      updateStatus(
        ctx,
        `❌ Fetch error\n${message}`
      );
      setNodeTitle(ctx.node, "Crawler error");
      throw error;
    }
  }

  private registerPollTimer(
    ctx: DevNodeContext<
      { url: string },
      { start: unknown },
      { dom: string },
      CrawlerNodeState
    >,
    ticket: CrawlerTicket,
    execution: ReturnType<typeof getExecutionContext>
  ): boolean {
    const runtimePayload = getTimerRuntimePayload(execution);
    if (
      !isGraphExecution(execution) ||
      !execution.runId ||
      !runtimePayload?.registerGraphTimer
    ) {
      return false;
    }

    runtimePayload.registerGraphTimer({
      nodeId: ctx.node.id,
      runId: execution.runId,
      source: execution.source,
      startedAt: execution.startedAt,
      intervalMs: CRAWLER_POLL_INTERVAL_MS,
      immediate: false,
      timerId: ticket.id,
      mode: "timeout"
    });
    return true;
  }

  private resumeFetch(
    url: string,
    ctx: DevNodeContext<
      { url: string },
      { start: unknown },
      { dom: string },
      CrawlerNodeState
    >,
    ticket: CrawlerTicket,
    execution: ReturnType<typeof getExecutionContext>
  ): void {
    if (ticket.failedMessage) {
      ctx.state.active = null;
      updateStatus(
        ctx,
        `❌ Fetch error\n${ticket.failedMessage}`
      );
      setNodeTitle(ctx.node, "Crawler error");
      throw new Error(ticket.failedMessage);
    }

    if (ticket.completed) {
      const elapsedMs = Date.now() - ticket.startedAt;
      if (
        elapsedMs < CRAWLER_MIN_RING_VISIBLE_MS &&
        this.registerPollTimer(ctx, ticket, execution)
      ) {
        preserveRunningExecutionState(ctx);
        updateStatus(
          ctx,
          formatCrawlerStatus({
            url,
            active: ticket,
            droppedCount: ctx.state.droppedCount,
            lastDom: ctx.state.lastDom,
            mode: "running"
          })
        );
        return;
      }

      ctx.state.active = null;
      ctx.state.deliveredCount += 1;
      ctx.setOutput("dom", ctx.state.lastDom);
      updateStatus(
        ctx,
        formatCrawlerStatus({
          url: ticket.url,
          active: null,
          droppedCount: ctx.state.droppedCount,
          lastDom: ctx.state.lastDom,
          mode: "done"
        })
      );
      setNodeTitle(ctx.node, "Crawler done");
      return;
    }

    if (this.registerPollTimer(ctx, ticket, execution)) {
      preserveRunningExecutionState(ctx);
    }
    updateStatus(
      ctx,
      formatCrawlerStatus({
        url,
        active: ticket,
        droppedCount: ctx.state.droppedCount,
        lastDom: ctx.state.lastDom,
        mode: "running"
      })
    );
  }

  private startFetch(
    url: string,
    ctx: DevNodeContext<
      { url: string },
      { start: unknown },
      { dom: string },
      CrawlerNodeState
    >,
    execution: ReturnType<typeof getExecutionContext>
  ): Promise<void> | void {
    syncCrawlerRunState(ctx, execution?.runId);

    if (ctx.state.active) {
      preserveRunningExecutionState(ctx);
      ctx.state.droppedCount += 1;
      updateStatus(
        ctx,
        formatCrawlerStatus({
          url,
          active: ctx.state.active,
          droppedCount: ctx.state.droppedCount,
          lastDom: ctx.state.lastDom,
          mode: "dropped"
        })
      );
      return;
    }

    const ticket: CrawlerTicket = {
      id: createCrawlerTicketId(ctx.node.id),
      url,
      runId: execution?.runId,
      startedAt: Date.now()
    };
    ctx.state.active = ticket;
    setNodeTitle(ctx.node, `Crawler ${url}`);

    updateStatus(
      ctx,
      formatCrawlerStatus({
        url,
        active: ctx.state.active,
        droppedCount: ctx.state.droppedCount,
        lastDom: ctx.state.lastDom,
        mode: "running"
      })
    );

    if (this.registerPollTimer(ctx, ticket, execution)) {
      preserveRunningExecutionState(ctx);
      void this.doFetch(ticket, ctx, true);
      return;
    }

    return this.doFetch(ticket, ctx, false);
  }

  onAction(
    action: string,
    _param: unknown,
    options: Record<string, unknown> | undefined,
    ctx: DevNodeContext<
      { url: string },
      { start: unknown },
      { dom: string },
      CrawlerNodeState
    >
  ) {
    if (action !== "url" && action !== "start") {
      return;
    }

    const url = readWidgetString(ctx, "url", CrawlerNode.defaultUrl);
    ctx.setProp("url", url);

    if (action === "start") {
      const execution = getExecutionContext(ctx, options);
      return this.startFetch(url, ctx, execution);
    }

    setNodeTitle(ctx.node, `Crawler ${url}`);
    updateStatus(
      ctx,
      formatCrawlerStatus({
        url: ctx.state.active?.url ?? url,
        active: ctx.state.active,
        droppedCount: ctx.state.droppedCount,
        lastDom: ctx.state.lastDom
      })
    );
  }
}
