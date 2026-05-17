/**
 * `@leafergraph/api-host` 内部 `LeaferGraph` 兼容桥接。
 *
 * @remarks
 * 这个包只需要一个很薄的图实例视图，用来让 public façade 方法可以
 * 在测试和根包适配层里运行。真实的根类仍然由 `leafergraph` 拥有。
 */

import type { LeaferGraphApiHost } from "./graph_api_host";

interface LeaferGraphInternalState {
  apiHost: LeaferGraphApiHost<any, any, any>;
  defaultFitViewPadding: number;
}

const leaferGraphInternalState = new WeakMap<LeaferGraph, LeaferGraphInternalState>();

interface LeaferGraphLayerLike {
  findId?(id: string): unknown;
  findOne?(query: { id?: string }): unknown;
  children?: unknown[];
  id?: string;
  name?: string;
}

/**
 * `LeaferGraph` 兼容接口。
 */
export interface LeaferGraph {
  apiHost?: LeaferGraphApiHost<any, any, any>;
  defaultFitViewPadding?: number;
  nodeLayer: LeaferGraphLayerLike;
  linkLayer: LeaferGraphLayerLike;
}

/**
 * 绑定内部状态，供测试或适配层显式写入。
 */
export function setLeaferGraphInternalState(
  graph: LeaferGraph,
  state: LeaferGraphInternalState
): void {
  leaferGraphInternalState.set(graph, state);
}

/**
 * 读取一个 `LeaferGraph` 实例绑定的 API 宿主。
 */
export function getLeaferGraphApiHost(graph: LeaferGraph): LeaferGraphApiHost<any, any, any> {
  const state = leaferGraphInternalState.get(graph);
  if (state) {
    return state.apiHost;
  }

  const fallback = graph as LeaferGraph & Partial<LeaferGraphInternalState>;
  if (fallback.apiHost) {
    return fallback.apiHost;
  }

  throw new Error("LeaferGraphApiHost 尚未绑定");
}

/**
 * 读取 `LeaferGraph` 的默认 `fitView` 内边距。
 */
export function getLeaferGraphDefaultFitViewPadding(graph: LeaferGraph): number {
  const state = leaferGraphInternalState.get(graph);
  if (state) {
    return state.defaultFitViewPadding;
  }

  const fallback = graph as LeaferGraph & Partial<LeaferGraphInternalState>;
  return fallback.defaultFitViewPadding ?? 0;
}
