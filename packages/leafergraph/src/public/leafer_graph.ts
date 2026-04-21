/**
 * 主包公共 façade 实现。
 *
 * @remarks
 * 负责承载 `LeaferGraph` 类与 `createLeaferGraph(...)` 工厂，
 * 并把主包外部 API 统一委托到内部运行时宿主。
 */

import type { App, Group } from "leafer-ui";
import "@leafer-in/resize";
import "@leafer-in/state";
import "@leafer-in/view";
import type { LeaferGraphOptions } from "@leafergraph/core/contracts";
import type { LeaferGraphEntryRuntime } from "../graph/assembly/entry";
import { createLeaferGraphEntryRuntime } from "../graph/assembly/entry";
import type { LeaferGraphConnectionFacade } from "./facade/connection";
import type { LeaferGraphDocumentFacade } from "./facade/document";
import type { LeaferGraphExecutionFacade } from "./facade/execution";
import { installLeaferGraphFacade } from "./facade/install";
import type { LeaferGraphMutationFacade } from "./facade/mutations";
import type { LeaferGraphQueryFacade } from "./facade/query";
import type { LeaferGraphRegistryFacade } from "./facade/registry";
import type { LeaferGraphSelectionFacade } from "./facade/selection";
import type { LeaferGraphSubscriptionFacade } from "./facade/subscriptions";
import type { LeaferGraphViewFacade } from "./facade/view";

interface LeaferGraphInternalState {
  apiHost: LeaferGraphEntryRuntime["apiHost"];
  defaultFitViewPadding: number;
}

const leaferGraphInternalState = new WeakMap<LeaferGraph, LeaferGraphInternalState>();

/**
 * 读取一个 `LeaferGraph` 实例的内部状态。
 *
 * @param graph - 当前图实例。
 * @returns 内部状态对象。
 */
function getLeaferGraphInternalState(graph: LeaferGraph): LeaferGraphInternalState {
  const state = leaferGraphInternalState.get(graph);
  if (state) {
    return state;
  }

  const fallbackState = graph as unknown as Partial<LeaferGraphInternalState>;
  if (fallbackState.apiHost) {
    return {
      apiHost: fallbackState.apiHost,
      defaultFitViewPadding: fallbackState.defaultFitViewPadding ?? 0
    };
  }

  throw new Error("LeaferGraph 内部状态尚未初始化");
}

/**
 * 读取 `LeaferGraph` 当前绑定的 API 宿主。
 *
 * @param graph - 当前图实例。
 * @returns API 宿主对象。
 */
export function getLeaferGraphApiHost(
  graph: LeaferGraph
): LeaferGraphEntryRuntime["apiHost"] {
  return getLeaferGraphInternalState(graph).apiHost;
}

/**
 * 读取 `LeaferGraph` 的默认 `fitView` 内边距。
 *
 * @param graph - 当前图实例。
 * @returns 默认内边距值。
 */
export function getLeaferGraphDefaultFitViewPadding(graph: LeaferGraph): number {
  return getLeaferGraphInternalState(graph).defaultFitViewPadding;
}

/**
 * LeaferGraph 主包运行时。
 *
 * @remarks
 * 当前既提供插件安装入口，也负责节点图渲染与交互。
 */
export class LeaferGraph {
  readonly container: HTMLElement;
  readonly app: App;
  readonly root: Group;
  readonly linkLayer: Group;
  readonly nodeLayer: Group;
  readonly ready: Promise<void>;
  private readonly apiHost: LeaferGraphEntryRuntime["apiHost"];
  private readonly defaultFitViewPadding: number;

  /**
   * 创建图宿主，并在内部异步完成模块与插件安装。
   *
   * @param container - 图容器节点。
   * @param options - 图初始化选项。
   * @returns 无返回值。
   */
  constructor(container: HTMLElement, options: LeaferGraphOptions = {}) {
    this.container = container;
    const runtime = createLeaferGraphEntryRuntime(container, options);
    this.app = runtime.app;
    this.root = runtime.root;
    this.linkLayer = runtime.linkLayer;
    this.nodeLayer = runtime.nodeLayer;
    this.ready = runtime.ready;
    this.apiHost = runtime.apiHost;
    this.defaultFitViewPadding = runtime.defaultFitViewPadding;
    leaferGraphInternalState.set(this, {
      apiHost: this.apiHost,
      defaultFitViewPadding: this.defaultFitViewPadding
    });
  }

  /**
   * 销毁宿主实例，并清理全部全局事件与 widget 生命周期。
   *
   * @returns 无返回值。
   */
  destroy(): void {
    getLeaferGraphApiHost(this).destroy();
  }
}

export interface LeaferGraph
  extends LeaferGraphRegistryFacade,
    LeaferGraphViewFacade,
    LeaferGraphSelectionFacade,
    LeaferGraphQueryFacade,
    LeaferGraphExecutionFacade,
    LeaferGraphSubscriptionFacade,
    LeaferGraphDocumentFacade,
    LeaferGraphConnectionFacade,
    LeaferGraphMutationFacade {}

installLeaferGraphFacade(LeaferGraph);

/**
 * 创建 `LeaferGraph` 的便捷工厂函数。
 *
 * @param container - 图容器节点。
 * @param options - 图初始化选项。
 * @returns 新建的图实例。
 */
export function createLeaferGraph(
  container: HTMLElement,
  options?: LeaferGraphOptions
): LeaferGraph {
  return new LeaferGraph(container, options);
}
