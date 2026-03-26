/**
 * 最小图示例页面壳层组件。
 *
 * @remarks
 * 负责组合控制面板、日志面板和画布卡片，
 * 不直接持有 `LeaferGraph` 实例，图生命周期统一收口到 `useExampleGraph()`。
 */
import type { JSX } from "preact";

import {
  ExampleControlPanel,
  type ExampleActionButtonConfig
} from "../components/control_panel";
import { ExampleStageCard } from "../components/stage_card";
import { useExampleGraph } from "../graph/use_example_graph";

const EXAMPLE_DESCRIPTION =
  "这个工程直接使用 leafergraph 主包，不经过 editor 壳层。右侧画布会恢复一条最小执行链，并把运行反馈实时写回左侧面板。";

const EXAMPLE_STAGE_TITLE = "Graph Stage";
const EXAMPLE_STAGE_SUBTITLE =
  "最小运行链：system/on-play -> example/counter -> example/watch";

/**
 * 最小图示例根组件。
 *
 * @returns 当前示例工程的完整页面结构。
 */
export function App(): JSX.Element {
  const { stageRef, logs, actions, chainSteps, stageBadges } =
    useExampleGraph();

  const actionButtons: readonly ExampleActionButtonConfig[] = [
    {
      id: "play",
      label: "执行 Play",
      variant: "accent",
      onClick: actions.play
    },
    {
      id: "step",
      label: "单步 Step",
      onClick: actions.step
    },
    {
      id: "stop",
      label: "停止 Stop",
      onClick: actions.stop
    },
    {
      id: "fit",
      label: "适配视图",
      onClick: actions.fit
    },
    {
      id: "reset",
      label: "恢复示例图",
      onClick: actions.reset
    },
    {
      id: "clear-log",
      label: "清空日志",
      onClick: actions.clearLog
    }
  ];

  return (
    <div class="example-shell">
      <ExampleControlPanel
        description={EXAMPLE_DESCRIPTION}
        actionButtons={actionButtons}
        chainSteps={chainSteps}
        logs={logs}
      />
      <ExampleStageCard
        title={EXAMPLE_STAGE_TITLE}
        subtitle={EXAMPLE_STAGE_SUBTITLE}
        badges={stageBadges}
      >
        <div ref={stageRef} class="example-stage" />
      </ExampleStageCard>
    </div>
  );
}
