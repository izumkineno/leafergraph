import type { App, Group } from "leafer-ui";
import type { NodeRuntimeState } from "@leafergraph/node";
import type { LeaferGraphWidgetPointerEvent } from "../widgets/widget_interaction";

/**
 * `@leafer-in/view` 通过副作用扩展方式把 `zoom(...)` 方法挂到 Leafer 实例上。
 * TypeScript 无法自动感知这个运行时扩展，因此这里补一个最小本地类型。
 */
interface LeaferGraphZoomableTree {
  zoom(
    zoomType: unknown,
    optionsOrPadding?:
      | {
          padding?: number;
          scroll?: "x" | "y" | boolean;
          transition?: unknown;
        }
      | number,
    scroll?: "x" | "y" | boolean,
    transition?: unknown
  ): unknown;
}

/**
 * 主包当前依赖的 Leafer 宿主坐标转换能力。
 * Leafer 文档中 `getWorldPointByClient(...)` 挂在 `App / Leafer` 实例上，
 * 因此这里单独补一份最小本地类型。
 */
interface LeaferGraphCoordinateHost {
  getPagePointByClient(
    clientPoint: { clientX: number; clientY: number },
    updateClient?: boolean
  ): { x: number; y: number };
}

type LeaferGraphViewNodeState = NodeRuntimeState;

type LeaferGraphViewNodeViewState<
  TNodeState extends LeaferGraphViewNodeState
> = {
  state: TNodeState;
  view: Group;
};

interface LeaferGraphViewHostOptions<
  TNodeState extends LeaferGraphViewNodeState,
  TNodeViewState extends LeaferGraphViewNodeViewState<TNodeState>
> {
  app: App;
  graphNodes: Map<string, TNodeState>;
  nodeViews: Map<string, TNodeViewState>;
  applyNodeSelectionStyles(state: TNodeViewState): void;
  requestRender(): void;
}

/**
 * 视图桥接宿主。
 * 当前集中承接：
 * 1. 节点置顶顺序
 * 2. 选中态写回与视觉同步
 * 3. 多选拖拽时的选区解析
 * 4. client/page 坐标转换
 * 5. fitView 这类纯视图级操作
 */
export class LeaferGraphViewHost<
  TNodeState extends LeaferGraphViewNodeState,
  TNodeViewState extends LeaferGraphViewNodeViewState<TNodeState>
> {
  private readonly options: LeaferGraphViewHostOptions<TNodeState, TNodeViewState>;
  private nodeZIndexSeed = 0;

  constructor(options: LeaferGraphViewHostOptions<TNodeState, TNodeViewState>) {
    this.options = options;
  }

  /**
   * 让当前画布内容适配到可视区域内。
   * 优先以节点视图为参考对象，避免把背景或未来的屏幕层 overlay 一起纳入适配范围。
   */
  fitView(padding: number): boolean {
    const views = [...this.options.nodeViews.values()].map((state) => state.view);
    if (!views.length) {
      return false;
    }

    (this.options.app.tree as typeof this.options.app.tree & LeaferGraphZoomableTree).zoom(
      views,
      {
        padding
      }
    );
    this.options.requestRender();
    return true;
  }

  /**
   * 设置单个节点的选中态。
   * 当前阶段的实现尽量轻量：只更新运行时 flag，并把视觉反馈直接同步到现有图元，
   * 不触发整节点重建，从而避免菜单绑定和拖拽状态被打断。
   */
  setNodeSelected(nodeId: string, selected: boolean): boolean {
    const state = this.options.nodeViews.get(nodeId);
    if (!state) {
      return false;
    }

    const nextSelected = Boolean(selected);
    if (Boolean(state.state.flags.selected) === nextSelected) {
      return true;
    }

    state.state.flags.selected = nextSelected;
    this.options.applyNodeSelectionStyles(state);
    this.options.requestRender();
    return true;
  }

  /**
   * 解析一次拖拽应当带上的节点集合。
   * 当前保持与常见节点编辑器一致：
   * 点击已选中的多选节点时，整体拖拽当前选区；否则只拖当前节点。
   */
  resolveDraggedNodeIds(nodeId: string): string[] {
    const selectedNodeIds = this.listSelectedNodeIds();

    if (selectedNodeIds.length > 1 && selectedNodeIds.includes(nodeId)) {
      return selectedNodeIds;
    }

    return [nodeId];
  }

  /**
   * 将节点图元提升到当前节点层的最前面。
   * 通过递增 zIndex 来稳定排序，避免反复移除/插入子节点带来的抖动。
   */
  bringNodeViewToFront(state: TNodeViewState): void {
    this.nodeZIndexSeed += 1;
    state.view.zIndex = this.nodeZIndexSeed;
  }

  /** 把浏览器 client 坐标换成 Leafer page 坐标。 */
  getPagePointByClient(event: Pick<PointerEvent, "clientX" | "clientY">): {
    x: number;
    y: number;
  } {
    return (this.options.app as typeof this.options.app & LeaferGraphCoordinateHost).getPagePointByClient(
      {
        clientX: event.clientX,
        clientY: event.clientY
      },
      true
    );
  }

  /**
   * 把 Leafer 指针事件统一转换成 page 坐标。
   * 节点布局、拖拽和 resize 都挂在 `app.tree / zoomLayer` 下，
   * 因此这类“写回节点位置”的交互必须以 page 坐标为准。
   */
  getPagePointFromGraphEvent(
    event: LeaferGraphWidgetPointerEvent
  ): { x: number; y: number } {
    const clientX = event.origin?.clientX;
    const clientY = event.origin?.clientY;

    if (typeof clientX === "number" && typeof clientY === "number") {
      return this.getPagePointByClient({ clientX, clientY });
    }

    const eventWithPagePoint = event as LeaferGraphWidgetPointerEvent & {
      getPagePoint?: () => { x: number; y: number };
    };

    return eventWithPagePoint.getPagePoint
      ? eventWithPagePoint.getPagePoint()
      : { x: event.x, y: event.y };
  }

  /** 整图重建前重置纯视图级运行时状态。 */
  resetViewState(): void {
    this.nodeZIndexSeed = 0;
  }

  /** 列出当前处于选中态的节点 ID。 */
  private listSelectedNodeIds(): string[] {
    const selectedNodeIds: string[] = [];

    for (const [nodeId, node] of this.options.graphNodes) {
      if (node.flags.selected) {
        selectedNodeIds.push(nodeId);
      }
    }

    return selectedNodeIds;
  }
}
