import type { App, Group } from "leafer-ui";
import type { LeaferGraphThemeMode } from "@leafergraph/core/theme";

/**
 * 视图层可直接读取的交互对象最小接口。
 */
export interface LeaferGraphInteractionTargetLike {
  name?: string;
  parent?: unknown | null;
  on_?: App["on_"];
  off_?: App["off_"];
}

/**
 * 默认入口对外暴露的最小视图契约。
 */
export interface LeaferGraphViewerFacade {
  setThemeMode(mode: LeaferGraphThemeMode): void;
  getNodeView(nodeId: string): Group | undefined;
  getLinkView(linkId: string): LeaferGraphInteractionTargetLike | undefined;
  fitView(padding?: number): boolean;
}
