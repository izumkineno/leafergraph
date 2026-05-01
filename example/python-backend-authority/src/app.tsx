import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { leaferGraphBasicKitPlugin } from "@leafergraph/core/basic-kit";
import type { RuntimeFeedbackEvent } from "@leafergraph/core/contracts";
import type { GraphDocument, NodeDefinition } from "@leafergraph/core/node";
import { createLeaferGraph, type LeaferGraph } from "leafergraph";
import "./app.css";

const BACKEND_BASE_URL = "http://127.0.0.1:8765";
const DEMO_GRAPH_ID = "timer-graph";
const NODE_TIMER_ID = "node-timer";
const NODE_PROCESSOR_ID = "node-processor";
const NODE_SINK_ID = "node-sink";
const TIMER_TYPE = "demo/timer";
const PROCESSOR_TYPE = "demo/processor";
const SINK_TYPE = "demo/sink";

const NODE_ORDER = [NODE_TIMER_ID, NODE_PROCESSOR_ID, NODE_SINK_ID] as const;

const DEFAULT_NODE_META = {
  [NODE_TIMER_ID]: { title: "Backend Timer", type: TIMER_TYPE },
  [NODE_PROCESSOR_ID]: { title: "Tick Processor", type: PROCESSOR_TYPE },
  [NODE_SINK_ID]: { title: "Tick Sink", type: SINK_TYPE },
} as const;

const NODE_DEFINITIONS: readonly NodeDefinition[] = [
  {
    type: TIMER_TYPE,
    title: DEFAULT_NODE_META[NODE_TIMER_ID].title,
    category: "Backend Timer Demo",
    description: "Pure backend timer authority entry node.",
    outputs: [{ name: "Tick", label: "Tick", type: "event", shape: "box" }],
    size: [228, 108],
  },
  {
    type: PROCESSOR_TYPE,
    title: DEFAULT_NODE_META[NODE_PROCESSOR_ID].title,
    category: "Backend Timer Demo",
    description: "Projects tick payloads from the backend.",
    inputs: [{ name: "Tick", label: "Tick", type: "event", shape: "box" }],
    outputs: [{ name: "Forward", label: "Forward", type: "event", shape: "box" }],
    size: [244, 112],
  },
  {
    type: SINK_TYPE,
    title: DEFAULT_NODE_META[NODE_SINK_ID].title,
    category: "Backend Timer Demo",
    description: "Consumes backend tick propagation.",
    inputs: [{ name: "Forward", label: "Forward", type: "event", shape: "box" }],
    size: [220, 108],
  },
] as const;

type ConnectionState = "connecting" | "open" | "error";
type CommandName = "start" | "stop" | "update-config";

type LogEntry = {
  id: number;
  timestamp: number;
  message: string;
};

type NodeViewState = {
  title: string;
  status: string;
  runCount: number;
};

type TimerConfigState = {
  intervalMs: string;
  payload: string;
  route: string;
};

type AnimationConfigState = {
  preset: false | "performance" | "balanced" | "expressive";
};

type RuntimeFeedbackEnvelope = {
  seq: number;
  runId: string;
  feedback: RuntimeFeedbackEvent;
};

type CommandAcknowledgement = {
  accepted: boolean;
  command: string;
  graphId: string;
  runId: string;
  seq: number;
};

function createEmptyDocument(): GraphDocument {
  return {
    documentId: "python-backend-authority-timer-demo",
    revision: 1,
    appKind: "leafergraph-local",
    nodes: [],
    links: [],
  };
}

function createInitialNodeViewState(): Record<string, NodeViewState> {
  return {
    [NODE_TIMER_ID]: {
      title: DEFAULT_NODE_META[NODE_TIMER_ID].title,
      status: "idle",
      runCount: 0,
    },
    [NODE_PROCESSOR_ID]: {
      title: DEFAULT_NODE_META[NODE_PROCESSOR_ID].title,
      status: "idle",
      runCount: 0,
    },
    [NODE_SINK_ID]: {
      title: DEFAULT_NODE_META[NODE_SINK_ID].title,
      status: "idle",
      runCount: 0,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeRuntimeFeedback(value: unknown): RuntimeFeedbackEvent | null {
  if (!isRecord(value) || typeof value.type !== "string" || !isRecord(value.event)) {
    return null;
  }

  switch (value.type) {
    case "graph.execution":
    case "node.execution":
    case "link.propagation":
      return value as unknown as RuntimeFeedbackEvent;
    default:
      return null;
  }
}

function normalizeEnvelope(value: unknown): RuntimeFeedbackEnvelope | null {
  if (!isRecord(value)) {
    return null;
  }

  const seq = value.seq;
  const runId = value.runId;
  const feedback = normalizeRuntimeFeedback(value.feedback);
  if (
    typeof seq !== "number" ||
    !Number.isInteger(seq) ||
    typeof runId !== "string" ||
    runId.length === 0 ||
    !feedback
  ) {
    return null;
  }

  return { seq, runId, feedback };
}

function normalizeAcknowledgement(value: unknown): CommandAcknowledgement | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.accepted !== true ||
    typeof value.command !== "string" ||
    typeof value.graphId !== "string" ||
    typeof value.runId !== "string" ||
    value.runId.length === 0 ||
    !Number.isInteger(value.seq)
  ) {
    return null;
  }

  return value as CommandAcknowledgement;
}

function formatRuntimeFeedback(event: RuntimeFeedbackEvent): string {
  if (event.type === "graph.execution") {
    return `graph.execution · ${event.event.type} · status=${event.event.state.status} · ticks=${event.event.state.stepCount}`;
  }

  if (event.type === "node.execution") {
    return `node.execution · ${event.event.nodeTitle} · status=${event.event.state.status} · runCount=${event.event.state.runCount}`;
  }

  if (event.type === "link.propagation") {
    return `link.propagation · ${event.event.sourceNodeId} → ${event.event.targetNodeId}`;
  }

  return `node.state · ${event.event.nodeId} · ${event.event.reason}`;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function parseIntervalMs(value: string): number {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    return 1000;
  }

  return Math.max(1, Math.floor(nextValue));
}

function registerTimerDemoNodes(graph: LeaferGraph): void {
  for (const definition of NODE_DEFINITIONS) {
    graph.registerNode(definition, { overwrite: true });
  }
}

function createTimerDemoLayout(graph: LeaferGraph): void {
  graph.createNode({
    id: NODE_TIMER_ID,
    type: TIMER_TYPE,
    title: DEFAULT_NODE_META[NODE_TIMER_ID].title,
    x: 48,
    y: 148,
  });
  graph.createNode({
    id: NODE_PROCESSOR_ID,
    type: PROCESSOR_TYPE,
    title: DEFAULT_NODE_META[NODE_PROCESSOR_ID].title,
    x: 336,
    y: 140,
  });
  graph.createNode({
    id: NODE_SINK_ID,
    type: SINK_TYPE,
    title: DEFAULT_NODE_META[NODE_SINK_ID].title,
    x: 656,
    y: 148,
  });
  graph.createLink({
    id: "link-timer-processor",
    source: { nodeId: NODE_TIMER_ID, slot: 0 },
    target: { nodeId: NODE_PROCESSOR_ID, slot: 0 },
  });
  graph.createLink({
    id: "link-processor-sink",
    source: { nodeId: NODE_PROCESSOR_ID, slot: 0 },
    target: { nodeId: NODE_SINK_ID, slot: 0 },
  });
}

export function App() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<LeaferGraph | null>(null);
  const nextLogIdRef = useRef(1);
  const [graphReady, setGraphReady] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [lastSeq, setLastSeq] = useState<number | null>(null);
  const [activeRunId, setActiveRunId] = useState<string>("run-000");
  const [graphStatus, setGraphStatus] = useState("idle");
  const [tickCount, setTickCount] = useState(0);
  const [recentRuntimeEvent, setRecentRuntimeEvent] = useState("No backend event yet");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [nodeStates, setNodeStates] = useState(createInitialNodeViewState);
  const [isSending, setIsSending] = useState(false);
  const uiLogEnabledRef = useRef(true);
  const [uiLogEnabled] = useState(true);
  const [timerConfig, setTimerConfig] = useState<TimerConfigState>({
    intervalMs: "1000",
    payload: '{ "message": "backend owned tick" }',
    route: "timer -> processor -> sink",
  });
  const [backendLogLevel, setBackendLogLevel] = useState<"DEBUG" | "INFO" | "ERROR">("INFO");
  const [animationConfig, setAnimationConfig] = useState<AnimationConfigState>({
    preset: "balanced",
  });

  const appendLog = (message: string): void => {
    if (!uiLogEnabledRef.current) {
      return;
    }

    const nextEntry: LogEntry = {
      id: nextLogIdRef.current,
      timestamp: Date.now(),
      message,
    };
    nextLogIdRef.current += 1;
    setLogs((current) => [...current.slice(-49), nextEntry]);
  };

  const changeLogLevel = async (level: "DEBUG" | "INFO" | "ERROR"): Promise<void> => {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/commands/set-log-level`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ level }),
      });
      if (!response.ok) {
        appendLog(`Failed to change backend log level to ${level}.`);
        return;
      }
      setBackendLogLevel(level);
      localStorage.setItem("backendLogLevel", level);
      appendLog(`Backend log level changed to ${level}.`);
    } catch (error) {
      appendLog(
        error instanceof Error
          ? `Failed to change backend log level: ${error.message}`
          : "Failed to change backend log level.",
      );
    }
  };

  const fetchLogLevel = async (): Promise<void> => {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/log-level`);
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { level?: string };
      if (data.level === "DEBUG" || data.level === "INFO" || data.level === "ERROR") {
        setBackendLogLevel(data.level);
        localStorage.setItem("backendLogLevel", data.level);
      }
    } catch {
      return;
    }
  };

  useEffect(() => {
    const savedLevel = localStorage.getItem("backendLogLevel");
    if (savedLevel === "DEBUG" || savedLevel === "INFO" || savedLevel === "ERROR") {
      setBackendLogLevel(savedLevel);
    }
    void fetchLogLevel();
  }, []);

  const customAnimationStyle = useMemo(() => {
    return animationConfig.preset;
  }, [animationConfig]);

  useEffect(() => {
    const stageHost = stageRef.current;
    if (!stageHost) {
      return;
    }

    let disposed = false;
    let unsubscribeRuntimeFeedback: (() => void) | null = null;

    const bootstrap = async (): Promise<void> => {
      const graph = createLeaferGraph(stageHost, {
        document: createEmptyDocument(),
        plugins: [leaferGraphBasicKitPlugin],
        config: {
          graph: {
            runtime: {
              linkPropagationAnimation: customAnimationStyle,
            },
          },
        },
      });
      graphRef.current = graph;
      await graph.ready;
      if (disposed) {
        graph.destroy();
        return;
      }

      registerTimerDemoNodes(graph);
      createTimerDemoLayout(graph);
      unsubscribeRuntimeFeedback = graph.subscribeRuntimeFeedback((event) => {
        appendLog(formatRuntimeFeedback(event));
        if (event.type === "graph.execution") {
          setGraphStatus(event.event.state.status);
          setTickCount(event.event.state.stepCount ?? 0);
          if (event.event.runId) {
            setActiveRunId(event.event.runId);
          }
          return;
        }

        if (event.type === "node.execution") {
          setNodeStates((current) => ({
            ...current,
            [event.event.nodeId]: {
              title: event.event.nodeTitle,
              status: event.event.state.status,
              runCount: event.event.state.runCount,
            },
          }));
        }
      });
      setGraphReady(true);
      appendLog("LeaferGraph stage is ready for backend-owned timer projection.");
    };

    void bootstrap();

    return () => {
      disposed = true;
      unsubscribeRuntimeFeedback?.();
      const graph = graphRef.current;
      graphRef.current = null;
      graph?.destroy();
    };
  }, [customAnimationStyle]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graphReady || !graph) {
      return;
    }

    const source = new EventSource(`${BACKEND_BASE_URL}/events`);
    setConnectionState("connecting");

    source.onopen = () => {
      setConnectionState("open");
      appendLog("SSE connected to Python backend.");
      void fetchLogLevel();
    };

    const handleRuntimeEvent = (message: MessageEvent<string>) => {
      const parsed = normalizeEnvelope(JSON.parse(message.data) as unknown);
      if (!parsed) {
        appendLog("Ignored malformed SSE envelope.");
        return;
      }
      setLastSeq(parsed.seq);
      setActiveRunId(parsed.runId);
      setRecentRuntimeEvent(formatRuntimeFeedback(parsed.feedback));
      if (
        parsed.feedback.type !== "graph.execution" &&
        parsed.feedback.type !== "node.execution" &&
        parsed.feedback.type !== "link.propagation"
      ) {
        appendLog(`Ignored unsupported runtime feedback ${parsed.feedback.type}.`);
        return;
      }
      graph.projectRuntimeFeedback(parsed.feedback);
    };

    source.addEventListener("runtime", handleRuntimeEvent);
    source.onerror = () => {
      setConnectionState("error");
      appendLog("SSE connection dropped. Waiting for the browser to reconnect.");
      void fetchLogLevel();
    };

    return () => {
      source.removeEventListener("runtime", handleRuntimeEvent);
      source.close();
    };
  }, [graphReady, customAnimationStyle]);

  const sendCommand = async (command: CommandName): Promise<void> => {
    setIsSending(true);
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/commands/${command}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          graphId: DEMO_GRAPH_ID,
          runId: activeRunId,
          config: {
            intervalMs: parseIntervalMs(timerConfig.intervalMs),
            payload: timerConfig.payload,
            route: timerConfig.route,
          },
        }),
      });
      const data = (await response.json()) as unknown;
      const acknowledgement = normalizeAcknowledgement(data);
      if (!response.ok || !acknowledgement) {
        appendLog(`Command ${command} failed.`);
        return;
      }
      setLastSeq(acknowledgement.seq);
      setActiveRunId(acknowledgement.runId);
      appendLog(
        `Accepted ${acknowledgement.command} with runId=${acknowledgement.runId} seq=${acknowledgement.seq}.`,
      );
    } catch (error) {
      appendLog(
        error instanceof Error
          ? `Command ${command} failed: ${error.message}`
          : `Command ${command} failed.`,
      );
    } finally {
      setIsSending(false);
    }
  };

  const nodeItems = useMemo(
    () =>
      NODE_ORDER.map((nodeId) => ({
        nodeId,
        ...nodeStates[nodeId],
      })),
    [nodeStates],
  );

  return (
    <div className="app-shell">
      <section className="hero">
        <h1>Python Backend Timer Authority Demo</h1>
        <p>
          The browser only sends remote commands to Python and only projects
          remote RuntimeFeedbackEvent payloads back through LeaferGraph. The
          timer, route, and tick lifecycle stay on the backend.
        </p>
      </section>

      <section className="status-grid">
        <article className="status-card">
          <h2>Connection</h2>
          <strong>{connectionState}</strong>
          <span>Python SSE stream</span>
        </article>
        <article className="status-card">
          <h2>Graph Status</h2>
          <strong>{graphStatus}</strong>
          <span>Projected runtime state</span>
        </article>
        <article className="status-card">
          <h2>Run ID</h2>
          <strong>{activeRunId}</strong>
          <span>Latest backend authority run</span>
        </article>
        <article className="status-card">
          <h2>Last Seq</h2>
          <strong>{lastSeq ?? "-"}</strong>
          <span>Latest accepted or streamed sequence</span>
        </article>
        <article className="status-card">
          <h2>Tick Count</h2>
          <strong>{tickCount}</strong>
          <span>Backend-driven cycle count</span>
        </article>
        <article className="status-card">
          <h2>Recent Event</h2>
          <strong>{recentRuntimeEvent}</strong>
          <span>Latest projected runtime feedback</span>
        </article>
      </section>

      <section className="main-grid">
        <div className="stage-panel">
          <h2>Graph Stage</h2>
          <div className="stage">
            <div
              className="stage-host"
              ref={stageRef}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
              }}
            />
          </div>
        </div>

        <div className="control-panel">
          <h2>Backend Controls</h2>
          <div className="control-form">
            <div className="field-grid">
              <label className="field">
                <span>Tick interval (ms)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={timerConfig.intervalMs}
                  onChange={(event) =>
                    setTimerConfig((current) => ({
                      ...current,
                      intervalMs: event.currentTarget.value,
                    }))
                  }
                />
                <small>Used by the Python backend timer runtime.</small>
              </label>
              <label className="field">
                <span>Route</span>
                <input
                  type="text"
                  value={timerConfig.route}
                  onChange={(event) =>
                    setTimerConfig((current) => ({
                      ...current,
                      route: event.currentTarget.value,
                    }))
                  }
                />
                <small>Example: timer → processor → sink.</small>
              </label>
            </div>
            <label className="field">
              <span>Payload</span>
              <textarea
                value={timerConfig.payload}
                onChange={(event) =>
                  setTimerConfig((current) => ({
                    ...current,
                    payload: event.currentTarget.value,
                  }))
                }
              />
              <small>
                Serialized payload the backend attaches to each tick.
              </small>
            </label>
          </div>

          <div className="button-row">
            <button
              disabled={!graphReady || isSending}
              onClick={() => void sendCommand("start")}
            >
              Start
            </button>
            <button
              className="secondary"
              disabled={!graphReady || isSending}
              onClick={() => void sendCommand("update-config")}
            >
              Apply Config
            </button>
            <button
              className="secondary"
              disabled={!graphReady || isSending}
              onClick={() => void sendCommand("stop")}
            >
              Stop
            </button>
          </div>

          <label className="field">
            <span>Backend Log Level</span>
            <select
              value={backendLogLevel}
              onChange={(event) =>
                void changeLogLevel(
                  event.currentTarget.value as "DEBUG" | "INFO" | "ERROR",
                )
              }
              disabled={!graphReady || isSending}
            >
              <option value="DEBUG">DEBUG (Detailed)</option>
              <option value="INFO">INFO (Normal)</option>
              <option value="ERROR">ERROR (Errors Only)</option>
            </select>
            <small>
              Adjusts backend logging immediately for all connected clients.
            </small>
          </label>

          <ul className="backend-notes">
            <li>
              Commands are sent to <code>/commands/start</code>,{" "}
              <code>/commands/update-config</code>, and{" "}
              <code>/commands/stop</code>.
            </li>
            <li>
              The backend owns tick scheduling, route selection, and stop
              cleanup.
            </li>
            <li>
              Transport envelopes are parsed as{" "}
              <code>{"{ seq, runId, feedback }"}</code>.
            </li>
            <li>
              Only <code>feedback</code> reaches{" "}
              <code>projectRuntimeFeedback(...)</code>.
            </li>
            <li>UI log capture is {uiLogEnabled ? "enabled" : "paused"}.</li>
          </ul>

          <h2 style={{ marginTop: "18px" }}>Animation Controls</h2>
          <div className="control-form">
            <label className="field">
              <span>Animation Preset</span>
              <select
                value={
                  animationConfig.preset === false
                    ? "off"
                    : animationConfig.preset
                }
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setAnimationConfig({
                    preset:
                      value === "off"
                        ? false
                        : (value as "performance" | "balanced" | "expressive"),
                  });
                }}
              >
                <option value="off">Off</option>
                <option value="performance">
                  Performance (16 pulses, 220ms)
                </option>
                <option value="balanced">Balanced (48 particles, 420ms)</option>
                <option value="expressive">
                  Expressive (24 pulses + 72 particles)
                </option>
              </select>
              <small>
                Performance: pulse waves only. Balanced: particles only.
                Expressive: both.
              </small>
            </label>
          </div>

          <h2 style={{ marginTop: "18px" }}>Projected Nodes</h2>
          <ul className="node-list">
            {nodeItems.map((node) => (
              <li key={node.nodeId}>
                <strong>{node.title}</strong>
                <span>
                  {node.nodeId} · status={node.status} · runCount=
                  {node.runCount}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="log-panel">
        <h2>Runtime Log</h2>
        <ul className="log-list">
          {logs.map((entry) => (
            <li key={entry.id}>
              <time>{formatTime(entry.timestamp)}</time>
              <span>{entry.message}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
