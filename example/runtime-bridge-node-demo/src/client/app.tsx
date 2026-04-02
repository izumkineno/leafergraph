import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Debug } from "leafergraph";
import { leaferGraphBasicKitPlugin } from "@leafergraph/basic-kit";
import { createLeaferGraph, type LeaferGraph } from "@leafergraph/runtime-bridge";
import { LeaferGraphRuntimeBridgeClient } from "@leafergraph/runtime-bridge/client";
import {
  createGraphOperationsFromInteractionCommit,
  type GraphOperationApplyResult,
  type LeaferGraphHistoryEvent,
  type LeaferGraphInteractionCommitEvent,
  type RuntimeFeedbackEvent
} from "@leafergraph/runtime-bridge/portable";
import {
  createRuntimeBridgeNodeDemoDocument,
  RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS
} from "../shared/document";
import { formatDemoPayload, formatDemoTimestamp } from "../shared/log_format";
import {
  resolveRuntimeBridgeDemoWebSocketUrl,
  WebSocketRuntimeBridgeTransport,
  type WebSocketRuntimeBridgeTransportStatus
} from "./websocket_transport";
import "./app.css";

type DemoLogEntry = {
  id: number;
  at: string;
  channel: "system" | "transport" | "history" | "runtime" | "interaction";
  title: string;
  detail: string;
};

type DemoClientRuntime = {
  graph: LeaferGraph;
  bridgeClient: LeaferGraphRuntimeBridgeClient;
  transport: WebSocketRuntimeBridgeTransport;
  cleanup: Array<() => void>;
};

type DemoLeaferDebugConfig = {
  enable: boolean;
  showWarn: boolean;
  filter: string | readonly string[];
  exclude: string | readonly string[];
  showRepaint: boolean | string;
  showBounds: boolean | string | "hit";
};

const LEAFER_DEBUG_NAME_OPTIONS = [
  { value: "", label: "无" },
  { value: "RunTime", label: "RunTime" },
  { value: "Renderer", label: "Renderer" },
  { value: "Leafer", label: "Leafer" },
  { value: "Life", label: "Life" },
  { value: "setAttr", label: "setAttr" }
] as const;

const initialTransportStatus: WebSocketRuntimeBridgeTransportStatus = {
  state: "idle",
  url: resolveRuntimeBridgeDemoWebSocketUrl(),
  lastError: null
};

const DEMO_DEFAULT_LEAFER_DEBUG_CONFIG: DemoLeaferDebugConfig = {
  enable: false,
  showWarn: true,
  filter: [],
  exclude: [],
  showRepaint: false,
  showBounds: false
};

let logEntrySeed = 1;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function cloneDemoLeaferDebugList(
  value: string | readonly string[]
): string | string[] {
  return typeof value === "string" ? value : [...value];
}

function cloneDemoLeaferDebugConfig(
  config: DemoLeaferDebugConfig
): DemoLeaferDebugConfig {
  return {
    ...config,
    filter: cloneDemoLeaferDebugList(config.filter),
    exclude: cloneDemoLeaferDebugList(config.exclude)
  };
}

function resolveBooleanSelectValue(value: boolean): "on" | "off" {
  return value ? "on" : "off";
}

function resolveLeaferDebugNameSelectValue(
  value: DemoLeaferDebugConfig["filter"] | DemoLeaferDebugConfig["exclude"]
): string {
  if (typeof value === "string") {
    return value;
  }

  return value[0] ?? "";
}

function resolveLeaferDebugBoundsSelectValue(
  value: DemoLeaferDebugConfig["showBounds"]
): "off" | "bounds" | "hit" {
  if (value === "hit") {
    return "hit";
  }

  return value ? "bounds" : "off";
}

function resolveTransportStateLabel(
  state: WebSocketRuntimeBridgeTransportStatus["state"]
): string {
  switch (state) {
    case "connected":
      return "已连接";
    case "connecting":
      return "连接中";
    case "disconnecting":
      return "断开中";
    case "idle":
    default:
      return "未连接";
  }
}

function resolveLogChannelLabel(channel: DemoLogEntry["channel"]): string {
  switch (channel) {
    case "system":
      return "系统";
    case "transport":
      return "传输";
    case "history":
      return "历史";
    case "runtime":
      return "运行时";
    case "interaction":
    default:
      return "交互";
  }
}

function captureDemoLeaferDebugConfig(): DemoLeaferDebugConfig {
  return {
    enable: Debug.enable,
    showWarn: Debug.showWarn,
    filter: [...Debug.filterList],
    exclude: [...Debug.excludeList],
    showRepaint: Debug.showRepaint,
    showBounds: Debug.showBounds
  };
}

function applyDemoLeaferDebugConfig(config: DemoLeaferDebugConfig): void {
  Debug.enable = config.enable;
  Debug.showWarn = config.showWarn;
  Debug.filter = cloneDemoLeaferDebugList(config.filter);
  Debug.exclude = cloneDemoLeaferDebugList(config.exclude);
  Debug.showRepaint = config.showRepaint;
  Debug.showBounds = config.showBounds;
}

/**
 * backend-first demo 调试台。
 *
 * @returns 页面 JSX。
 */
export function App() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<DemoClientRuntime | null>(null);
  const initialDebugConfigRef = useRef<DemoLeaferDebugConfig | null>(null);
  const [transportStatus, setTransportStatus] = useState(initialTransportStatus);
  const [logs, setLogs] = useState<DemoLogEntry[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [currentRevision, setCurrentRevision] = useState<string | number>(1);
  const [ready, setReady] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [leaferDebugConfig, setLeaferDebugConfig] = useState<DemoLeaferDebugConfig>(
    cloneDemoLeaferDebugConfig(DEMO_DEFAULT_LEAFER_DEBUG_CONFIG)
  );

  const appendLog = (
    channel: DemoLogEntry["channel"],
    title: string,
    detail: unknown
  ) => {
    const nextEntry: DemoLogEntry = {
      id: logEntrySeed,
      at: formatDemoTimestamp(),
      channel,
      title,
      detail: formatDemoPayload(detail)
    };

    logEntrySeed += 1;
    setLogs((previous) => [nextEntry, ...previous].slice(0, 120));
  };

  useEffect(() => {
    initialDebugConfigRef.current = captureDemoLeaferDebugConfig();
    applyDemoLeaferDebugConfig(DEMO_DEFAULT_LEAFER_DEBUG_CONFIG);
    setLeaferDebugConfig(cloneDemoLeaferDebugConfig(DEMO_DEFAULT_LEAFER_DEBUG_CONFIG));

    const container = canvasRef.current;
    if (!container) {
      return;
    }

    let disposed = false;

    const initialize = async () => {
      try {
        const graph = createLeaferGraph(container, {
          document: createRuntimeBridgeNodeDemoDocument(),
          plugins: [leaferGraphBasicKitPlugin],
          themeMode: "light"
        });

        await graph.ready;

        if (disposed) {
          graph.destroy();
          return;
        }

        const transport = new WebSocketRuntimeBridgeTransport({
          url: resolveRuntimeBridgeDemoWebSocketUrl()
        });
        const bridgeClient = new LeaferGraphRuntimeBridgeClient({
          graph,
          transport
        });

        const syncRevision = () => {
          if (!disposed) {
            setCurrentRevision(graph.getGraphDocument().revision);
          }
        };

        const syncRevisionSoon = () => {
          window.setTimeout(syncRevision, 24);
        };

        const cleanup: Array<() => void> = [];
        cleanup.push(
          transport.subscribeStatus((status) => {
            if (disposed) {
              return;
            }

            setTransportStatus(status);
            setLastError(status.lastError);
          })
        );
        cleanup.push(
          transport.subscribeDebug((event) => {
            if (disposed) {
              return;
            }

            appendLog("transport", event.type, event.detail ?? event.type);
            if (
              event.type === "inbound.response" ||
              event.type === "inbound.bridge.event"
            ) {
              syncRevisionSoon();
            }
          })
        );
        cleanup.push(
          graph.subscribeRuntimeFeedback((event: RuntimeFeedbackEvent) => {
            appendLog("runtime", event.type, event);
          })
        );
        cleanup.push(
          bridgeClient.subscribeHistory((event: LeaferGraphHistoryEvent) => {
            appendLog("history", event.type, event);
            syncRevisionSoon();
          })
        );
        cleanup.push(
          graph.subscribeInteractionCommit((event: LeaferGraphInteractionCommitEvent) => {
            appendLog("interaction", event.type, event);

            if (!bridgeClient.isConnected()) {
              appendLog(
                "transport",
                "interaction.skipped",
                "桥接未连接，本次只修改了本地图。"
              );
              return;
            }

            const operations = createGraphOperationsFromInteractionCommit(event, {
              source: "bridge.interaction"
            });
            if (operations.length === 0) {
              return;
            }

            void bridgeClient
              .submitOperations(operations)
              .then((results: readonly GraphOperationApplyResult[]) => {
                appendLog("transport", "operations.submitted", results);
                syncRevisionSoon();
              })
              .catch((error: unknown) => {
                const message = toErrorMessage(error);
                setLastError(message);
                appendLog("transport", "operations.error", message);
              });
          })
        );

        runtimeRef.current = {
          graph,
          bridgeClient,
          transport,
          cleanup
        };
        setReady(true);
        setCurrentRevision(graph.getGraphDocument().revision);
        appendLog("system", "graph.ready", {
          defaultBridgeUrl: transport.getStatus().url,
          demoNodes: RUNTIME_BRIDGE_NODE_DEMO_NODE_IDS
        });
      } catch (error) {
        const message = toErrorMessage(error);
        setLastError(message);
        appendLog("system", "graph.init.error", message);
      }
    };

    void initialize();

    return () => {
      disposed = true;
      setReady(false);
      const runtime = runtimeRef.current;
      runtimeRef.current = null;
      if (!runtime) {
        return;
      }

      for (const dispose of runtime.cleanup) {
        dispose();
      }

      void runtime.transport.disconnect().catch(() => undefined);
      runtime.graph.destroy();

      if (initialDebugConfigRef.current) {
        applyDemoLeaferDebugConfig(initialDebugConfigRef.current);
      }
    };
  }, []);

  const runAction = async (label: string, action: () => Promise<void>) => {
    setBusyAction(label);
    try {
      await action();
      appendLog("system", label, "已完成");
    } catch (error) {
      const message = toErrorMessage(error);
      setLastError(message);
      appendLog("system", `${label}.error`, message);
    } finally {
      setBusyAction(null);
    }
  };

  const connect = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    void runAction("连接", async () => {
      await runtime.bridgeClient.connect();
      setCurrentRevision(runtime.graph.getGraphDocument().revision);
    });
  };

  const disconnect = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    void runAction("断开", async () => {
      await runtime.bridgeClient.disconnect();
    });
  };

  const play = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    void runAction("运行", async () => {
      await runtime.bridgeClient.play();
    });
  };

  const step = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    void runAction("单步", async () => {
      await runtime.bridgeClient.step();
    });
  };

  const stop = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    void runAction("停止", async () => {
      await runtime.bridgeClient.stop();
    });
  };

  const resyncSnapshot = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    void runAction("重拉快照", async () => {
      await runtime.bridgeClient.requestSnapshot();
      setCurrentRevision(runtime.graph.getGraphDocument().revision);
    });
  };

  const updateLeaferDebugConfig = (patch: Partial<DemoLeaferDebugConfig>) => {
    setLeaferDebugConfig((currentConfig) => {
      const nextConfig = cloneDemoLeaferDebugConfig({
        ...currentConfig,
        ...patch
      });
      applyDemoLeaferDebugConfig(nextConfig);
      appendLog("system", "leafer.debug.updated", nextConfig);
      return nextConfig;
    });
  };

  return (
    <div className="demo-shell">
      <header className="demo-topbar">
        <div className="demo-heading">
          <p className="eyebrow">节点权威端 Demo</p>
          <h1>Runtime Bridge 后端控制台</h1>
          <p className="subtitle">
            图的真源运行在 Node 端。浏览器只负责预览、交互提交与控制命令转发。
          </p>
        </div>
        <div className="demo-toolbar-side">
          <div className="demo-actions">
            <button disabled={!ready || busyAction !== null} onClick={connect}>
              连接
            </button>
            <button
              disabled={
                !ready || transportStatus.state !== "connected" || busyAction !== null
              }
              onClick={disconnect}
            >
              断开
            </button>
            <button
              disabled={
                !ready || transportStatus.state !== "connected" || busyAction !== null
              }
              onClick={play}
            >
              运行
            </button>
            <button
              disabled={
                !ready || transportStatus.state !== "connected" || busyAction !== null
              }
              onClick={step}
            >
              单步
            </button>
            <button
              disabled={
                !ready || transportStatus.state !== "connected" || busyAction !== null
              }
              onClick={stop}
            >
              停止
            </button>
            <button
              disabled={
                !ready || transportStatus.state !== "connected" || busyAction !== null
              }
              onClick={resyncSnapshot}
            >
              重拉快照
            </button>
          </div>

          <div className="demo-debug-panel">
            <p className="demo-debug-title">Leafer 调试</p>
            <div className="demo-debug-grid">
              <label className="demo-debug-field">
                <span className="demo-debug-label">启用</span>
                <select
                  className="demo-debug-select"
                  disabled={!ready || busyAction !== null}
                  value={resolveBooleanSelectValue(leaferDebugConfig.enable)}
                  onInput={(event) => {
                    updateLeaferDebugConfig({
                      enable: event.currentTarget.value === "on"
                    });
                  }}
                >
                  <option value="off">关</option>
                  <option value="on">开</option>
                </select>
              </label>

              <label className="demo-debug-field">
                <span className="demo-debug-label">警告</span>
                <select
                  className="demo-debug-select"
                  disabled={!ready || busyAction !== null}
                  value={resolveBooleanSelectValue(leaferDebugConfig.showWarn)}
                  onInput={(event) => {
                    updateLeaferDebugConfig({
                      showWarn: event.currentTarget.value === "on"
                    });
                  }}
                >
                  <option value="on">开</option>
                  <option value="off">关</option>
                </select>
              </label>

              <label className="demo-debug-field">
                <span className="demo-debug-label">过滤</span>
                <select
                  className="demo-debug-select"
                  disabled={!ready || busyAction !== null}
                  value={resolveLeaferDebugNameSelectValue(leaferDebugConfig.filter)}
                  onInput={(event) => {
                    updateLeaferDebugConfig({
                      filter: event.currentTarget.value
                    });
                  }}
                >
                  {LEAFER_DEBUG_NAME_OPTIONS.map((option) => (
                    <option key={`filter-${option.value || "none"}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="demo-debug-field">
                <span className="demo-debug-label">排除</span>
                <select
                  className="demo-debug-select"
                  disabled={!ready || busyAction !== null}
                  value={resolveLeaferDebugNameSelectValue(leaferDebugConfig.exclude)}
                  onInput={(event) => {
                    updateLeaferDebugConfig({
                      exclude: event.currentTarget.value
                    });
                  }}
                >
                  {LEAFER_DEBUG_NAME_OPTIONS.map((option) => (
                    <option key={`exclude-${option.value || "none"}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="demo-debug-field">
                <span className="demo-debug-label">重绘</span>
                <select
                  className="demo-debug-select"
                  disabled={!ready || busyAction !== null}
                  value={resolveBooleanSelectValue(
                    Boolean(leaferDebugConfig.showRepaint)
                  )}
                  onInput={(event) => {
                    updateLeaferDebugConfig({
                      showRepaint: event.currentTarget.value === "on"
                    });
                  }}
                >
                  <option value="off">关</option>
                  <option value="on">开</option>
                </select>
              </label>

              <label className="demo-debug-field">
                <span className="demo-debug-label">包围盒</span>
                <select
                  className="demo-debug-select"
                  disabled={!ready || busyAction !== null}
                  value={resolveLeaferDebugBoundsSelectValue(
                    leaferDebugConfig.showBounds
                  )}
                  onInput={(event) => {
                    const value = event.currentTarget.value as
                      | "off"
                      | "bounds"
                      | "hit";
                    updateLeaferDebugConfig({
                      showBounds:
                        value === "hit" ? "hit" : value === "bounds"
                    });
                  }}
                >
                  <option value="off">关</option>
                  <option value="bounds">边界</option>
                  <option value="hit">命中</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </header>

      <section className="demo-status-grid">
        <article className="status-card">
          <span className="status-label">连接状态</span>
          <strong className={`status-value status-${transportStatus.state}`}>
            {resolveTransportStateLabel(transportStatus.state)}
          </strong>
        </article>
        <article className="status-card">
          <span className="status-label">文档版本</span>
          <strong className="status-value">{String(currentRevision)}</strong>
        </article>
        <article className="status-card">
          <span className="status-label">桥接地址</span>
          <strong className="status-value status-url">{transportStatus.url}</strong>
        </article>
        <article className="status-card">
          <span className="status-label">最近错误</span>
          <strong className="status-value status-error">
            {lastError ?? "无"}
          </strong>
        </article>
        <article className="status-card">
          <span className="status-label">Leafer 调试</span>
          <strong
            className={`status-value ${leaferDebugConfig.enable ? "status-connected" : "status-idle"}`}
          >
            {leaferDebugConfig.enable ? "已启用" : "已关闭"}
          </strong>
        </article>
      </section>

      <main className="demo-main">
        <section className="canvas-card">
          <div className="canvas-heading">
            <div>
              <p className="eyebrow">权威端镜像</p>
              <h2>共享图画布</h2>
            </div>
            <span className="canvas-hint">
              拖动节点、折叠节点、修改控件值，都可以触发正式 operation。
            </span>
          </div>
          <div className="canvas-frame" ref={canvasRef} />
        </section>

        <aside className="log-card">
          <div className="log-heading">
            <div>
              <p className="eyebrow">运行反馈</p>
              <h2>桥接事件日志</h2>
            </div>
            <span className="log-count">{logs.length} 条</span>
          </div>
          <div className="log-list">
            {logs.map((entry) => (
              <article className={`log-entry log-${entry.channel}`} key={entry.id}>
                <div className="log-meta">
                  <span>{entry.at}</span>
                  <span>{resolveLogChannelLabel(entry.channel)}</span>
                </div>
                <h3>{entry.title}</h3>
                <pre>{entry.detail}</pre>
              </article>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

/**
 * 挂载 demo 应用。
 *
 * @param target - 根容器。
 * @returns 无返回值。
 */
export function mountRuntimeBridgeNodeDemo(target: HTMLElement): void {
  render(<App />, target);
}
