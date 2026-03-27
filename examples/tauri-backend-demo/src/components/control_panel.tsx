/**
 * Tauri authority demo 控制面板组件。
 *
 * @remarks
 * 负责组织左侧说明、状态摘要、动作按钮、链路说明和运行日志；
 * 组件本身只消费 props，不直接接触图实例或 Tauri API。
 */
import type { JSX } from "preact";

import type {
  DemoChainStep,
  DemoLogEntry,
  DemoStatusItem
} from "../graph/use_tauri_sync_graph";
import { DemoRuntimeLog } from "./runtime_log";

/** 控制面板中一枚动作按钮的最小配置。 */
export interface DemoActionButtonConfig {
  /** 当前按钮的稳定标识。 */
  id: string;
  /** 当前按钮展示文案。 */
  label: string;
  /** 当前按钮的视觉变体。 */
  variant?: "default" | "accent";
  /** 当前按钮是否处于禁用态。 */
  disabled?: boolean;
  /** 当前按钮的短提示。 */
  hint?: string;
  /** 当前按钮点击后的处理函数。 */
  onClick(): void;
}

/** 控制面板组件的最小输入。 */
export interface DemoControlPanelProps {
  /** 当前 demo 总说明。 */
  description: string;
  /** 当前动作按钮集合。 */
  actionButtons: readonly DemoActionButtonConfig[];
  /** 当前最小执行链说明。 */
  chainSteps: readonly DemoChainStep[];
  /** 当前运行日志列表。 */
  logs: readonly DemoLogEntry[];
  /** 当前状态摘要。 */
  statusItems: readonly DemoStatusItem[];
  /** 按钮区下方的一行交互提示。 */
  actionHint: string;
}

/**
 * 左侧控制面板。
 *
 * @param props - 当前页面需要展示的说明、按钮、状态和日志。
 * @returns 左侧说明与交互区域。
 */
export function DemoControlPanel(
  props: DemoControlPanelProps
): JSX.Element {
  return (
    <aside class="demo-panel">
      <span class="demo-eyebrow">Tauri Backend Authority</span>
      <div class="demo-section">
        <h1 class="demo-title">LeaferGraph Sync Demo</h1>
        <p class="demo-description">{props.description}</p>
      </div>
      <section class="demo-section">
        <h2 class="demo-section-title">当前状态</h2>
        <div class="demo-status-grid">
          {props.statusItems.map((item) => (
            <article key={item.id} class="demo-status-card">
              <span class="demo-status-label">{item.label}</span>
              <strong class="demo-status-value">{item.value}</strong>
            </article>
          ))}
        </div>
      </section>
      <section class="demo-section">
        <h2 class="demo-section-title">运行操作</h2>
        <div class="demo-button-grid">
          {props.actionButtons.map((button) => (
            <button
              key={button.id}
              class={`demo-button${
                button.variant === "accent" ? " demo-button--accent" : ""
              }`}
              type="button"
              disabled={button.disabled}
              title={button.hint}
              onClick={button.onClick}
            >
              {button.label}
            </button>
          ))}
        </div>
        <p class="demo-button-hint">{props.actionHint}</p>
      </section>
      <section class="demo-section">
        <h2 class="demo-section-title">Authority 链路</h2>
        <ol class="demo-list">
          {props.chainSteps.map((step) => (
            <li key={step.id}>
              <code>{step.title}</code>
              {" "}
              {step.description}
            </li>
          ))}
        </ol>
      </section>
      <section class="demo-section">
        <h2 class="demo-section-title">运行反馈</h2>
        <p class="demo-note">
          日志来自
          {" "}
          <code>SyncSession.subscribeRuntimeFeedback(...)</code>
          {" "}
          与 Tauri 后端事件推送。
        </p>
        <DemoRuntimeLog logs={props.logs} />
      </section>
    </aside>
  );
}
