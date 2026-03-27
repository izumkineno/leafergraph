/**
 * Tauri authority demo 画布卡片组件。
 *
 * @remarks
 * 负责渲染右侧画布容器、标题和 badge，
 * 真正的图挂载节点通过 children 传入，避免组件直接依赖 ref 细节。
 */
import type { ComponentChildren, JSX } from "preact";

import type { DemoStageBadge } from "../graph/use_tauri_sync_graph";

/** 画布卡片组件的最小输入。 */
export interface DemoStageCardProps {
  /** 右侧卡片标题。 */
  title: string;
  /** 右侧卡片副标题。 */
  subtitle: string;
  /** 右侧卡片 badge 列表。 */
  badges: readonly DemoStageBadge[];
  /** 实际图挂载节点。 */
  children: ComponentChildren;
}

/**
 * 右侧画布卡片。
 *
 * @param props - 卡片标题、badge 与画布宿主节点。
 * @returns 右侧画布卡片结构。
 */
export function DemoStageCard(
  props: DemoStageCardProps
): JSX.Element {
  return (
    <section class="demo-stage-card">
      <header class="demo-stage-header">
        <div class="demo-stage-title-group">
          <h2 class="demo-stage-title">{props.title}</h2>
          <p class="demo-stage-subtitle">{props.subtitle}</p>
        </div>
        <div class="demo-stage-badges">
          {props.badges.map((badge) => (
            <span key={badge.id} class="demo-badge">
              {badge.label}
            </span>
          ))}
        </div>
      </header>
      {props.children}
    </section>
  );
}
