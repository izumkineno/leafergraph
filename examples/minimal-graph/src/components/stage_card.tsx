/**
 * 最小图示例画布卡片组件。
 *
 * @remarks
 * 负责渲染右侧画布容器、标题和 badge，
 * 真正的图挂载节点通过 children 传入，避免组件直接依赖 `ref` 类型细节。
 */
import type { ComponentChildren, JSX } from "preact";

import type { ExampleStageBadge } from "../graph/use_example_graph";

/** 画布卡片组件的最小输入。 */
export interface ExampleStageCardProps {
  /** 右侧卡片标题。 */
  title: string;
  /** 右侧卡片副标题。 */
  subtitle: string;
  /** 右侧卡片 badge 列表。 */
  badges: readonly ExampleStageBadge[];
  /** 真正的图挂载节点。 */
  children: ComponentChildren;
}

/**
 * 右侧画布卡片。
 *
 * @param props - 卡片头部文案、badge 和画布宿主节点。
 * @returns 右侧画布卡片结构。
 */
export function ExampleStageCard(
  props: ExampleStageCardProps
): JSX.Element {
  return (
    <section class="example-stage-card">
      <header class="example-stage-header">
        <div class="example-stage-title-group">
          <h2 class="example-stage-title">{props.title}</h2>
          <p class="example-stage-subtitle">{props.subtitle}</p>
        </div>
        <div class="example-stage-badges">
          {props.badges.map((badge) => (
            <span key={badge.id} class="example-badge">
              {badge.label}
            </span>
          ))}
        </div>
      </header>
      {props.children}
    </section>
  );
}
