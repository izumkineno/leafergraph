/**
 * 主包公共 façade 实现。
 *
 * @remarks
 * 负责承载 `LeaferGraph` 类与 `createLeaferGraph(...)` 工厂。
 * 默认入口保持 viewer-first：只公开最小视图契约，
 * 更完整的 API 宿主能力通过兼容子路径继续提供。
 */

import type { App, Group } from "leafer-ui";
import "@leafer-in/resize";
import "@leafer-in/state";
import "@leafer-in/view";
import { installLeaferGraphFacade } from "@leafergraph/api-host/facade/install";
import type { LeaferGraphConnectionFacade } from "@leafergraph/api-host/facade/connection";
import type { LeaferGraphDocumentFacade } from "@leafergraph/api-host/facade/document";
import type { LeaferGraphExecutionFacade } from "@leafergraph/api-host/facade/execution";
import type { LeaferGraphMutationFacade } from "@leafergraph/api-host/facade/mutations";
import type { LeaferGraphQueryFacade } from "@leafergraph/api-host/facade/query";
import type { LeaferGraphRegistryFacade } from "@leafergraph/api-host/facade/registry";
import type { LeaferGraphSelectionFacade } from "@leafergraph/api-host/facade/selection";
import type { LeaferGraphSubscriptionFacade } from "@leafergraph/api-host/facade/subscriptions";
import type { LeaferGraphOptions } from "@leafergraph/core/contracts";
import type { LeaferGraphEntryRuntime } from "../graph/assembly/entry";
import { createLeaferGraphEntryRuntime } from "../graph/assembly/entry";
import type {
  LeaferGraphInteractionTargetLike,
  LeaferGraphViewerFacade
} from "./viewer_model";

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
 * 当前默认入口仅保留 viewer-first 的最小公开面：
 * 场景挂载、节点/连线视图查询、主题切换与 fitView。
 */
export class LeaferGraph implements LeaferGraphViewerFacade {
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

  /**
   * 运行时切换主包主题，并局部刷新现有节点壳与 Widget。
   *
   * @param mode - 新的主题模式。
   * @returns 无返回值。
   */
  setThemeMode(mode: import("@leafergraph/core/theme").LeaferGraphThemeMode): void {
    getLeaferGraphApiHost(this).setThemeMode(mode);
  }

  /**
   * 获取某个节点对应的 Leafer 视图宿主。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 节点视图对象。
   */
  getNodeView(nodeId: string): Group | undefined {
    return getLeaferGraphApiHost(this).getNodeView(nodeId);
  }

  /**
   * 获取某条连线对应的 Leafer 视图宿主。
   *
   * @param linkId - 目标连线 ID。
   * @returns 连线视图对象。
   */
  getLinkView(linkId: string): LeaferGraphInteractionTargetLike | undefined {
    return getLeaferGraphApiHost(this).getLinkView(linkId);
  }

  /**
   * 让当前画布内容适配到可视区域内。
   *
   * @param padding - 可选内边距。
   * @returns 是否成功执行适配。
   */
  fitView(padding?: number): boolean {
    return getLeaferGraphApiHost(this).fitView(
      padding ?? getLeaferGraphDefaultFitViewPadding(this)
    );
  }
}

export interface LeaferGraph
  extends LeaferGraphRegistryFacade,
    LeaferGraphSelectionFacade,
    LeaferGraphQueryFacade,
    LeaferGraphExecutionFacade,
    LeaferGraphSubscriptionFacade,
    LeaferGraphDocumentFacade,
    LeaferGraphConnectionFacade,
    LeaferGraphMutationFacade {}

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

// 保留从 extracted api-host 安装的兼容 façade，确保旧入口仍可委托到新包实现。
installLeaferGraphFacade(LeaferGraph);
