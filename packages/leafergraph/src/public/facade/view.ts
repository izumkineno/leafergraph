/**
 * public façade 的视图与主题方法组。
 */

import type { App, Group } from "leafer-ui";
import type { LeaferGraphThemeMode } from "@leafergraph/theme";
import {
  getLeaferGraphApiHost,
  getLeaferGraphDefaultFitViewPadding
} from "../leafer_graph";
import type { LeaferGraph } from "../leafer_graph";

/**
 * 允许页面层继续挂接的交互目标最小接口。
 */
export interface LeaferGraphInteractionTargetLike {
  name?: string;
  parent?: unknown | null;
  on_?: App["on_"];
  off_?: App["off_"];
}

/**
 * `LeaferGraph` 的视图与主题 façade。
 */
export interface LeaferGraphViewFacade {
  setThemeMode(mode: LeaferGraphThemeMode): void;
  getNodeView(nodeId: string): Group | undefined;
  getLinkView(linkId: string): LeaferGraphInteractionTargetLike | undefined;
  fitView(padding?: number): boolean;
}

/**
 * 运行时切换主包主题，并局部刷新现有节点壳与 Widget。
 *
 * @param this - 当前图实例。
 * @param mode - 新的主题模式。
 * @returns 无返回值。
 */
function setLeaferGraphThemeMode(
  this: LeaferGraph,
  mode: LeaferGraphThemeMode
): void {
  getLeaferGraphApiHost(this).setThemeMode(mode);
}

/**
 * 获取某个节点对应的 Leafer 视图宿主。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @returns 节点视图对象。
 */
function getLeaferGraphNodeView(
  this: LeaferGraph,
  nodeId: string
): Group | undefined {
  return getLeaferGraphApiHost(this).getNodeView(nodeId);
}

/**
 * 获取某条连线对应的 Leafer 视图宿主。
 *
 * @param this - 当前图实例。
 * @param linkId - 目标连线 ID。
 * @returns 连线视图对象。
 */
function getLeaferGraphLinkView(
  this: LeaferGraph,
  linkId: string
): LeaferGraphInteractionTargetLike | undefined {
  return getLeaferGraphApiHost(this).getLinkView(linkId);
}

/**
 * 让当前画布内容适配到可视区域内。
 *
 * @param this - 当前图实例。
 * @param padding - 可选内边距。
 * @returns 是否成功完成适配。
 */
function fitLeaferGraphView(this: LeaferGraph, padding?: number): boolean {
  return getLeaferGraphApiHost(this).fitView(
    padding ?? getLeaferGraphDefaultFitViewPadding(this)
  );
}

export const leaferGraphViewFacadeMethods: LeaferGraphViewFacade = {
  setThemeMode: setLeaferGraphThemeMode,
  getNodeView: getLeaferGraphNodeView,
  getLinkView: getLeaferGraphLinkView,
  fitView: fitLeaferGraphView
};
