import type { DevNodeContext } from "@leafergraph/authoring";
import type {
  LeaferGraphActionExecutionOptions,
  LeaferGraphExecutionContext,
  LeaferGraphTimerRuntimePayload
} from "@leafergraph/execution";
import { AUTHORING_BASIC_STATUS_WIDGET_NAME } from "./shared";

type GenericContext = DevNodeContext<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>
>;

export function toDisplayText(value: unknown, maxLength = 120): string {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")
      : String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value instanceof ArrayBuffer) {
    return `ArrayBuffer(${value.byteLength})`;
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return `Blob(${value.type || "application/octet-stream"}, ${value.size} bytes)`;
  }
  try {
    const serialized = JSON.stringify(value);
    if (!serialized) {
      return String(value);
    }
    return serialized.length > maxLength
      ? `${serialized.slice(0, maxLength - 1)}…`
      : serialized;
  } catch {
    return String(value);
  }
}

export function cloneStructuredValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // fall through
    }
  }

  if (value === undefined || value === null) {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

export function readWidgetString(
  ctx: GenericContext,
  name: string,
  fallback = ""
): string {
  const widgetValue = ctx.getWidget(name);
  if (typeof widgetValue === "string") {
    return widgetValue;
  }

  const propValue = ctx.props[name];
  return typeof propValue === "string" ? propValue : fallback;
}

export function readWidgetNumber(
  ctx: GenericContext,
  name: string,
  fallback = 0
): number {
  const widgetValue = ctx.getWidget(name);
  const propValue = widgetValue ?? ctx.props[name];
  const numericValue =
    typeof propValue === "number" ? propValue : Number(propValue ?? fallback);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function readWidgetBoolean(
  ctx: GenericContext,
  name: string,
  fallback = false
): boolean {
  const widgetValue = ctx.getWidget(name);
  const propValue = widgetValue ?? ctx.props[name];
  if (typeof propValue === "boolean") {
    return propValue;
  }
  if (typeof propValue === "string") {
    return propValue === "true";
  }
  return fallback;
}

export function syncWidgetAndProp(
  ctx: GenericContext,
  name: string,
  value: unknown
): void {
  ctx.setProp(name, value);
  try {
    ctx.setWidget(name, value);
  } catch {
    // Nodes do not need to declare a same-name widget for every property.
  }
}

export function updateStatus(
  ctx: GenericContext,
  value: unknown
): void {
  try {
    /**
     * 状态面板是可拉伸的展示区，字符串一旦在这里被二次截断，
     * 后续即使把节点拉高，也无法再恢复完整内容。
     * 因此这里对“已经整理好的字符串状态”直接原样写入，
     * 只在非字符串值时做一次兜底格式化。
     */
    ctx.setWidget(
      AUTHORING_BASIC_STATUS_WIDGET_NAME,
      typeof value === "string" ? value : toDisplayText(value, 180)
    );
  } catch {
    // Some nodes intentionally omit the shared status widget.
  }
}

export function parseJsonValue<T>(
  text: string,
  fallback: T
): {
  ok: boolean;
  value: T;
  error?: string;
} {
  if (!text.trim()) {
    return {
      ok: true,
      value: fallback
    };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(text) as T
    };
  } catch (error) {
    return {
      ok: false,
      value: fallback,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function getActionOptions(
  options: Record<string, unknown> | undefined
): LeaferGraphActionExecutionOptions | undefined {
  return options as LeaferGraphActionExecutionOptions | undefined;
}

export function getTriggeredInputSlot(
  options: Record<string, unknown> | undefined
): number | undefined {
  return getActionOptions(options)?.propagation?.targetSlot;
}

export function getExecutionContext(
  ctx: GenericContext,
  options?: Record<string, unknown>
): LeaferGraphExecutionContext | undefined {
  return ctx.execution ?? getActionOptions(options)?.executionContext;
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
