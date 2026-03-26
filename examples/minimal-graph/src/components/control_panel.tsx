/**
 * 最小图示例控制面板组件。
 *
 * @remarks
 * 负责组织左侧说明、动作按钮、执行链说明和运行日志区域；
 * 组件本身只消费 props，不直接接触图实例。
 */
import type { JSX } from "preact";

import type {
  ExampleChainStep,
  ExampleLogEntry
} from "../graph/use_example_graph";
import { ExampleRuntimeLog } from "./runtime_log";

/** 控制面板中一枚动作按钮的最小配置。 */
export interface ExampleActionButtonConfig {
  /** 当前按钮的稳定标识。 */
  id: string;
  /** 当前按钮展示文案。 */
  label: string;
  /** 当前按钮的视觉变体。 */
  variant?: "default" | "accent";
  /** 当前按钮点击后的处理函数。 */
  onClick(): void;
}

/** 控制面板组件的最小输入。 */
export interface ExampleControlPanelProps {
  /** 示例工程的总说明文案。 */
  description: string;
  /** 当前可执行的动作按钮列表。 */
  actionButtons: readonly ExampleActionButtonConfig[];
  /** 当前最小执行链的阅读步骤。 */
  chainSteps: readonly ExampleChainStep[];
  /** 当前运行日志列表。 */
  logs: readonly ExampleLogEntry[];
}

/**
 * 左侧控制面板。
 *
 * @param props - 面板展示所需的说明、动作和日志数据。
 * @returns 左侧说明与控制区域。
 */
export function ExampleControlPanel(
  props: ExampleControlPanelProps
): JSX.Element {
  return (
    <aside class="example-panel">
      <span class="example-eyebrow">Minimal Runtime</span>
      <div class="example-section">
        <h1 class="example-title">LeaferGraph 最小图示例</h1>
        <p class="example-description">{props.description}</p>
      </div>
      <section class="example-section">
        <h2 class="example-section-title">运行操作</h2>
        <div class="example-button-grid">
          {props.actionButtons.map((button) => (
            <button
              key={button.id}
              class={`example-button${
                button.variant === "accent" ? " example-button--accent" : ""
              }`}
              onClick={button.onClick}
            >
              {button.label}
            </button>
          ))}
        </div>
      </section>
      <section class="example-section">
        <h2 class="example-section-title">当前链路</h2>
        <ol class="example-list">
          {props.chainSteps.map((step) => (
            <li key={step.id}>
              <code>{step.title}</code>
              {" "}
              {step.description}
            </li>
          ))}
        </ol>
      </section>
      <section class="example-section">
        <h2 class="example-section-title">运行反馈</h2>
        <p class="example-note">
          下方日志直接来自
          {" "}
          <code>graph.subscribeRuntimeFeedback(...)</code>
          。
        </p>
        <ExampleRuntimeLog logs={props.logs} />
      </section>
    </aside>
  );
}
