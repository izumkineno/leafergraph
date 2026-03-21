const SYSTEM_TIMER_DEFAULT_INTERVAL_MS = 1000;
const SYSTEM_TIMER_INTERVAL_WIDGET_NAME = "intervalMs";
const SYSTEM_TIMER_IMMEDIATE_WIDGET_NAME = "immediate";

function clone(value) {
  return structuredClone(value);
}

function ensureNodeProperties(node) {
  node.properties ??= {};
  return node.properties;
}

function resolveFirstDefinedInputValue(inputValues) {
  for (const value of inputValues) {
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function formatAuthorityRuntimeValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : "EMPTY";
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (value === undefined) {
    return "EMPTY";
  }

  if (value === null) {
    return "NULL";
  }

  return "OBJECT";
}

function resolveTimerIntervalMs(value) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    return SYSTEM_TIMER_DEFAULT_INTERVAL_MS;
  }

  return Math.max(1, Math.floor(nextValue));
}

function resolveTimerImmediate(value) {
  if (typeof value === "boolean") {
    return value;
  }

  return true;
}

function resolveTimerWidgetValue(node, widgetName) {
  for (const widget of node.widgets ?? []) {
    if (widget?.name === widgetName) {
      return widget.value;
    }
  }

  return undefined;
}

function syncTimerWidgetValue(node, widgetName, value) {
  for (const widget of node.widgets ?? []) {
    if (widget?.name === widgetName) {
      widget.value = value;
      return;
    }
  }
}

function createAuthorityExecutionContextPayload(context) {
  return {
    source: context.source,
    runId: context.runId,
    entryNodeId: context.rootNodeId,
    stepIndex: context.sequence,
    startedAt: context.startedAt,
    payload: {
      authority: context.authorityName
    }
  };
}

function executeTimerNode(node, context) {
  const properties = ensureNodeProperties(node);
  const intervalMs = resolveTimerIntervalMs(
    resolveTimerWidgetValue(node, SYSTEM_TIMER_INTERVAL_WIDGET_NAME) ??
      properties.intervalMs
  );
  const immediate = resolveTimerImmediate(
    resolveTimerWidgetValue(node, SYSTEM_TIMER_IMMEDIATE_WIDGET_NAME) ??
      properties.immediate
  );
  const isGraphSource =
    context.source === "graph-play" || context.source === "graph-step";
  const canRegisterTimer =
    isGraphSource &&
    Boolean(context.runId) &&
    Boolean(context.timerRuntime?.registerTimer);
  const isPeriodicTick = context.timerRuntime?.timerTickNodeId === node.id;

  if (canRegisterTimer) {
    context.timerRuntime?.registerTimer?.({
      nodeId: node.id,
      source: context.source,
      runId: context.runId,
      startedAt: context.startedAt,
      intervalMs,
      immediate
    });
  }

  const shouldEmitTick =
    context.source === "node-play" ||
    isPeriodicTick ||
    immediate ||
    !canRegisterTimer;

  properties.intervalMs = intervalMs;
  properties.immediate = immediate;
  syncTimerWidgetValue(node, SYSTEM_TIMER_INTERVAL_WIDGET_NAME, intervalMs);
  syncTimerWidgetValue(node, SYSTEM_TIMER_IMMEDIATE_WIDGET_NAME, immediate);
  node.title = "Timer";

  if (!shouldEmitTick) {
    properties.status = `WAIT ${intervalMs}ms`;
    return {
      documentChanged: true,
      timerActivated: canRegisterTimer,
      outputPayloads: []
    };
  }

  const previousTick = Number(properties.runCount ?? 0);
  const nextTick = Number.isFinite(previousTick) ? previousTick + 1 : 1;
  const timestamp = Date.now();
  properties.runCount = nextTick;
  properties.status = `TICK ${nextTick}`;
  node.title = `Timer ${nextTick}`;

  return {
    documentChanged: true,
    timerActivated: canRegisterTimer,
    outputPayloads: [
      {
        slot: 0,
        payload: {
          timerNodeId: node.id,
          tick: nextTick,
          intervalMs,
          timestamp,
          source: context.source,
          runId: context.runId
        }
      }
    ]
  };
}

function executeCounterNode(node) {
  const properties = ensureNodeProperties(node);
  const previousCount = Number(properties.count ?? 0);
  const nextCount = Number.isFinite(previousCount) ? previousCount + 1 : 1;
  properties.count = nextCount;
  properties.subtitle = "可从节点菜单起跑，也可接到 On Play 作为图级入口";
  properties.status = `RUN ${nextCount}`;
  node.title = `Counter ${nextCount}`;
  return {
    documentChanged: true,
    outputPayloads: [
      {
        slot: 0,
        payload: nextCount
      }
    ]
  };
}

function executeDisplayNode(node, context) {
  const properties = ensureNodeProperties(node);
  const inputValue = resolveFirstDefinedInputValue(context.inputValues);
  const displayValue = formatAuthorityRuntimeValue(inputValue);
  properties.lastValue = inputValue === undefined ? undefined : clone(inputValue);
  properties.subtitle = "显示上游通过正式连线传播过来的值";
  properties.status = `VALUE ${displayValue}`;
  node.title = `Display ${displayValue}`;
  return {
    documentChanged: true,
    outputPayloads: []
  };
}

function createExecutors() {
  return {
    "system/timer": executeTimerNode,
    "template/execute-counter": executeCounterNode,
    "template/execute-display": executeDisplayNode
  };
}

module.exports = {
  createExecutors
};
