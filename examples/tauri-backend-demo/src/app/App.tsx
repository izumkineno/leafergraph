/**
 * Tauri authority demo 页面壳层组件。
 *
 * @remarks
 * 负责组合左侧说明面板、运行日志和右侧画布卡片，
 * 不直接持有 LeaferGraph 或 SyncSession 实例。
 */
import type { JSX } from "preact";

import {
  DemoControlPanel,
  type DemoActionButtonConfig
} from "../components/control_panel";
import { DemoStageCard } from "../components/stage_card";
import { useTauriSyncGraph } from "../graph/use_tauri_sync_graph";

const DEMO_DESCRIPTION =
  "这个示例把 leafergraph 画布、@leafergraph/sync 会话和 Tauri Rust authority 接到同一条最小链路里。右侧文档真相、运行推进和持久化都来自后端，前端只负责渲染与投影。";

const DEMO_STAGE_TITLE = "Graph Stage";
const DEMO_STAGE_SUBTITLE =
  "最小链路：system/on-play -> example/counter -> example/watch";

/**
 * Demo 根组件。
 *
 * @returns 当前 Tauri authority demo 的完整页面结构。
 */
export function App(): JSX.Element {
  const {
    stageRef,
    logs,
    actions,
    actionStates,
    actionHint,
    chainSteps,
    stageBadges,
    statusItems
  } = useTauriSyncGraph();

  const actionButtons: readonly DemoActionButtonConfig[] = [
    {
      id: "play",
      label: "执行 Play",
      variant: "accent",
      disabled: actionStates.play.disabled,
      hint: actionStates.play.hint,
      onClick: actions.play
    },
    {
      id: "step",
      label: "单步 Step",
      disabled: actionStates.step.disabled,
      hint: actionStates.step.hint,
      onClick: actions.step
    },
    {
      id: "stop",
      label: "停止 Stop",
      disabled: actionStates.stop.disabled,
      hint: actionStates.stop.hint,
      onClick: actions.stop
    },
    {
      id: "fit",
      label: "适配视图",
      disabled: actionStates.fit.disabled,
      hint: actionStates.fit.hint,
      onClick: actions.fit
    },
    {
      id: "reset",
      label: "恢复示例图",
      disabled: actionStates.reset.disabled,
      hint: actionStates.reset.hint,
      onClick: actions.reset
    },
    {
      id: "clear-log",
      label: "清空日志",
      disabled: actionStates.clearLog.disabled,
      hint: actionStates.clearLog.hint,
      onClick: actions.clearLog
    }
  ];

  return (
    <div class="demo-shell">
      <DemoControlPanel
        description={DEMO_DESCRIPTION}
        actionButtons={actionButtons}
        chainSteps={chainSteps}
        logs={logs}
        actionHint={actionHint}
        statusItems={statusItems}
      />
      <DemoStageCard
        title={DEMO_STAGE_TITLE}
        subtitle={DEMO_STAGE_SUBTITLE}
        badges={stageBadges}
      >
        <div ref={stageRef} class="demo-stage" />
      </DemoStageCard>
    </div>
  );
}
