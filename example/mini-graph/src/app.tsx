/**
 * demo 页面壳。
 *
 * 页面层只负责组织 UI：
 * - 顶部轻量信息与按钮
 * - 画布容器
 * - 链路说明浮层
 * - 运行日志浮层
 *
 * 真正的图生命周期与交互动作都收口在 `useExampleGraph()`。
 */
import "./app.css";
import {
  type ExampleGraphStatus,
  useExampleGraph
} from "./graph/use_example_graph";

interface ActionItem {
  id: string;
  label: string;
  accent: boolean;
  onClick(): void;
}

/** 日志时间统一格式化为 `HH:mm:ss`。 */
const LOG_TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

/** 把内部状态枚举映射成页面要显示的短标签。 */
function resolveStatusLabel(status: ExampleGraphStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "error":
      return "Error";
    default:
      return "Loading";
  }
}

/** 根据当前状态输出一条更可读的中文说明。 */
function resolveStatusCopy(
  status: ExampleGraphStatus,
  errorMessage: string
): string {
  switch (status) {
    case "ready":
      return "On Play -> Counter -> Watch";
    case "error":
      return errorMessage || "LeaferGraph 初始化失败";
    default:
      return "正在创建图实例并恢复默认链路";
  }
}

/** 格式化单条日志显示时间。 */
function formatLogTime(timestamp: number): string {
  return LOG_TIME_FORMATTER.format(timestamp);
}

export function App() {
  // 页面层只消费 hook 投影后的数据，不直接操作图实例。
  const { actions, chainSteps, errorMessage, logs, stageBadges, stageRef, status } =
    useExampleGraph();

  // 把按钮配置抽成结构化数组，方便后续继续增删动作时保持页面清晰。
  const actionItems: readonly ActionItem[] = [
    { id: "play", label: "Play", accent: true, onClick: actions.play },
    { id: "step", label: "Step", accent: false, onClick: actions.step },
    { id: "stop", label: "Stop", accent: false, onClick: actions.stop },
    { id: "fit", label: "Fit", accent: false, onClick: actions.fit },
    { id: "reset", label: "Reset", accent: false, onClick: actions.reset },
    {
      id: "clear-log",
      label: "Clear Log",
      accent: false,
      onClick: actions.clearLog
    }
  ];

  return (
    <main class="page-shell">
      <header class="toolbar" aria-live="polite">
        <div class="toolbar-copy">
          <p class="eyebrow">LeaferGraph Mini Demo</p>
          <h1>最小执行链 Demo</h1>
          <p class="toolbar-description">
            参考 VSCode 侧的 <code>minimal-graph</code>，这里直接通过公开 API
            恢复一条最小链路，并让画布尽量占满页面。
          </p>
        </div>

        <div class="toolbar-side">
          <div class="toolbar-actions">
            {actionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                class={`toolbar-button ${item.accent ? "toolbar-button--accent" : ""}`}
                onClick={item.onClick}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div class="toolbar-meta">
            <div class="status-row">
              <span class={`status-chip status-chip--${status}`}>
                {resolveStatusLabel(status)}
              </span>
              <span class="status-copy">
                {resolveStatusCopy(status, errorMessage)}
              </span>
            </div>

            <div class="badge-row">
              {stageBadges.map((badge) => (
                <span key={badge.id} class="stage-badge">
                  {badge.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section class="graph-card">
        {/* 这个 div 是 LeaferGraph 实例真正挂载的容器。 */}
        <div class="graph-host" ref={stageRef} />

        {/* 左上角浮层：固定展示当前 demo 的执行链结构。 */}
        <aside class="graph-overlay graph-overlay--chain">
          <p class="overlay-label">Execution Chain</p>
          <ol class="chain-list">
            {chainSteps.map((step) => (
              <li key={step.id} class="chain-item">
                <p class="chain-item-title">{step.title}</p>
                <p class="chain-item-description">{step.description}</p>
              </li>
            ))}
          </ol>
        </aside>

        {/* 右下角浮层：展示运行反馈和初始化错误。 */}
        <aside class="graph-overlay graph-overlay--log">
          <div class="overlay-header">
            <p class="overlay-label">Runtime Log</p>
            <span class="overlay-count">{logs.length}</span>
          </div>

          {errorMessage ? (
            <p class="overlay-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {logs.length > 0 ? (
            <ol class="log-list">
              {logs.map((entry) => (
                <li key={`${entry.timestamp}-${entry.message}`} class="log-item">
                  <span class="log-time">{formatLogTime(entry.timestamp)}</span>
                  <span class="log-message">{entry.message}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p class="overlay-empty">
              等待运行反馈。可以先点击 <code>Play</code> 或 <code>Step</code>。
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}
