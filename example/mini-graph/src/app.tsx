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
import { useRef, useState } from "preact/hooks";
import "./app.css";
import {
  type ExampleAuthoringBundleStatus,
  type ExampleGraphStatus,
  type ExampleLinkPropagationAnimationOption,
  useExampleGraph,
} from "./graph/use_example_graph";

interface ActionItem {
  id: string;
  label: string;
  accent: boolean;
  disabled?: boolean;
  title?: string;
  onClick(): void;
}

/** 日志时间统一格式化为 `HH:mm:ss`。 */
const LOG_TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 *  把内部状态枚举映射成页面要显示的短标签。
 *
 * @param status - 状态。
 * @returns 处理后的结果。
 */
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

/**
 *  根据当前状态输出一条更可读的中文说明。
 *
 * @param status - 状态。
 * @param errorMessage - 错误消息。
 * @returns 处理后的结果。
 */
function resolveStatusCopy(
  status: ExampleGraphStatus,
  errorMessage: string,
): string {
  switch (status) {
    case "ready":
      return "默认空画布已就绪";
    case "error":
      return errorMessage || "LeaferGraph 初始化失败";
    default:
      return "正在创建图实例并准备空画布";
  }
}

/**
 *  格式化单条日志显示时间。
 *
 * @param timestamp - `timestamp`。
 * @returns 处理后的结果。
 */
function formatLogTime(timestamp: number): string {
  return LOG_TIME_FORMATTER.format(timestamp);
}

/**
 *  根据 authoring 注册状态返回按钮文案。
 *
 * @param status - 状态。
 * @param registeredCount - `registeredCount` 参数。
 * @returns 处理后的结果。
 */
function resolveRegisterButtonLabel(
  status: ExampleAuthoringBundleStatus,
  registeredCount: number,
): string {
  switch (status) {
    case "registering":
      return "Registering JS...";
    case "registered":
      return registeredCount > 0
        ? "Select Another JS Bundle"
        : "Select JS Bundle";
    case "error":
      return "Retry JS Bundle";
    default:
      return "Select JS Bundle";
  }
}

/**
 * 解析动画预设`Select` 值。
 *
 * @param preset - 预设。
 * @returns 处理后的结果。
 */
function resolveAnimationPresetSelectValue(
  preset: ExampleLinkPropagationAnimationOption,
): "off" | "performance" | "balanced" | "expressive" {
  return preset === false ? "off" : preset;
}

/**
 * 渲染当前示例应用。
 *
 * @returns 处理后的结果。
 */
export function App() {
  const bundleInputRef = useRef<HTMLInputElement | null>(null);
  const [isChainCollapsed, setIsChainCollapsed] = useState(false);
  const [isLogCollapsed, setIsLogCollapsed] = useState(false);

  // 页面层只消费 hook 投影后的数据，不直接操作图实例。
  const {
    actions,
    authoringBundleStatus,
    chainSteps,
    errorMessage,
    historyState,
    linkPropagationAnimationPreset,
    logs,
    registeredBundleCount,
    stageBadges,
    stageRef,
    status,
  } = useExampleGraph();

  // 把按钮配置抽成结构化数组，方便后续继续增删动作时保持页面清晰。
  const actionItems: readonly ActionItem[] = [
    {
      id: "register-bundle",
      label: resolveRegisterButtonLabel(
        authoringBundleStatus,
        registeredBundleCount,
      ),
      accent: false,
      disabled: status !== "ready" || authoringBundleStatus === "registering",
      onClick() {
        bundleInputRef.current?.click();
      },
    },
    {
      id: "undo",
      label: "Undo",
      accent: false,
      disabled: status !== "ready" || !historyState.canUndo,
      title: historyState.nextUndoLabel,
      onClick: actions.undo,
    },
    {
      id: "redo",
      label: "Redo",
      accent: false,
      disabled: status !== "ready" || !historyState.canRedo,
      title: historyState.nextRedoLabel,
      onClick: actions.redo,
    },
    { id: "play", label: "Play", accent: true, onClick: actions.play },
    { id: "stop", label: "Stop", accent: false, onClick: actions.stop },
    { id: "reset", label: "Reset", accent: false, onClick: actions.reset },
  ];

  return (
    <main class="page-shell">
      <header class="toolbar" aria-live="polite">
        <div class="toolbar-copy">
          <p class="eyebrow">LeaferGraph Mini Demo</p>
          <h1>最小空画布 Demo</h1>
          <p class="toolbar-description">
            这里直接通过公开 API 启动一个默认空画布，并让画布尽量占满页面。
            当前默认不注入任何节点；可以先选择编译后的单文件 JS bundle 来注册
            authoring 库，再继续扩展图内容。顶部默认使用更容易观察的
            Expressive 连线动画预设，也可以继续切换其它运行时动画预设，
            用来对比性能优先和平衡表现两类反馈。
            右键画布即可验证 Leafer-first 上下文菜单，并直接插入动画示例链，
            或从当前注册表继续添加 System / Example 节点。
          </p>
        </div>

        <div class="toolbar-side">
          <div class="toolbar-actions">
            <label class="toolbar-select-wrap">
              <span class="toolbar-select-label">Link Animation</span>
              <select
                class="toolbar-select"
                value={resolveAnimationPresetSelectValue(
                  linkPropagationAnimationPreset,
                )}
                disabled={status !== "ready"}
                onInput={(event) => {
                  const value = event.currentTarget.value as
                    | "off"
                    | "performance"
                    | "balanced"
                    | "expressive";
                  actions.setLinkPropagationAnimationPreset(
                    value === "off" ? false : value,
                  );
                }}
              >
                <option value="performance">Performance</option>
                <option value="balanced">Balanced</option>
                <option value="expressive">Expressive</option>
                <option value="off">Off</option>
              </select>
            </label>

            {actionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                class={`toolbar-button ${item.accent ? "toolbar-button--accent" : ""}`}
                disabled={item.disabled}
                title={item.title}
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
              <span class="stage-badge">Leafer Menu</span>
              <span class="stage-badge">
                Animation {resolveAnimationPresetSelectValue(linkPropagationAnimationPreset)}
              </span>
              <span class="stage-badge">
                Bundles {registeredBundleCount}
              </span>
              <span class="stage-badge">
                History {historyState.undoCount}/{historyState.redoCount}
              </span>
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
        <input
          ref={bundleInputRef}
          type="file"
          class="bundle-file-input"
          accept=".js,.mjs,text/javascript,application/javascript"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (!file) {
              return;
            }

            void actions.registerAuthoringBundle(file);
          }}
        />

        {/* 这个 div 是 LeaferGraph 实例真正挂载的容器。 */}
        <div class="graph-host" ref={stageRef} />

        {/* 左上角浮层：固定展示当前 demo 的空画布说明。 */}
        <aside
          class={`graph-overlay graph-overlay--chain ${isChainCollapsed ? "graph-overlay--collapsed" : ""}`}
        >
          <div class="overlay-header">
            <p class="overlay-label">Canvas Notes</p>
            <div class="overlay-actions">
              <span class="overlay-count">{chainSteps.length}</span>
              <button
                type="button"
                class="overlay-toggle"
                aria-expanded={!isChainCollapsed}
                aria-controls="mini-graph-canvas-notes"
                onClick={() => {
                  setIsChainCollapsed((currentValue) => !currentValue);
                }}
              >
                {isChainCollapsed ? "展开" : "折叠"}
              </button>
            </div>
          </div>

          {!isChainCollapsed ? (
            <ol id="mini-graph-canvas-notes" class="chain-list">
              {chainSteps.map((step) => (
                <li key={step.id} class="chain-item">
                  <p class="chain-item-title">{step.title}</p>
                  <p class="chain-item-description">{step.description}</p>
                </li>
              ))}
            </ol>
          ) : null}
        </aside>

        {/* 右下角浮层：展示运行反馈和初始化错误。 */}
        <aside
          class={`graph-overlay graph-overlay--log ${isLogCollapsed ? "graph-overlay--collapsed" : ""}`}
        >
          <div class="overlay-header">
            <p class="overlay-label">Runtime Log</p>
            <div class="overlay-actions">
              <span class="overlay-count">{logs.length}</span>
              <button
                type="button"
                class="overlay-toggle"
                aria-expanded={!isLogCollapsed}
                aria-controls="mini-graph-runtime-log"
                onClick={() => {
                  setIsLogCollapsed((currentValue) => !currentValue);
                }}
              >
                {isLogCollapsed ? "展开" : "折叠"}
              </button>
            </div>
          </div>

          {!isLogCollapsed ? (
            <>
              {errorMessage ? (
                <p class="overlay-error" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              {logs.length > 0 ? (
                <ol id="mini-graph-runtime-log" class="log-list">
                  {logs.map((entry) => (
                    <li
                      key={entry.id}
                      class="log-item"
                    >
                      <span class="log-time">{formatLogTime(entry.timestamp)}</span>
                      <span class="log-message">{entry.message}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p class="overlay-empty">
                  等待运行反馈。当前默认没有节点，可以先选择编译后的 JS bundle 来注册，然后右键画布从注册表添加节点。
                </p>
              )}
            </>
          ) : (
            <p class="overlay-empty overlay-empty--compact">
              {logs.length > 0
                ? "运行日志已折叠"
                : "暂无运行日志"}
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}
