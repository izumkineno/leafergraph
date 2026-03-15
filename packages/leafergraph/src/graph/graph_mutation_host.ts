import {
  configureNode,
  createNodeState,
  type LeaferGraphLinkData,
  type NodeRegistry,
  type NodeSlotSpec
} from "@leafergraph/node";
import type { GraphDragNodePosition } from "../interaction/graph_interaction_runtime_host";
import type {
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphMoveNodeInput,
  LeaferGraphNodeResizeConstraint,
  LeaferGraphNodeSlotInput,
  LeaferGraphResizeNodeInput,
  LeaferGraphUpdateNodeInput
} from "../api/graph_api_types";
import type {
  GraphNodeProperties,
  LeaferGraphRenderableNodeState
} from "./graph_runtime_types";

const DEFAULT_GRAPH_LINK_SLOT = 0;

let graphLinkSeed = 1;

type LeaferGraphMutableNodeState = LeaferGraphRenderableNodeState;

type LeaferGraphMutableNodeViewState<
  TNodeState extends LeaferGraphMutableNodeState
> = {
  state: TNodeState;
  view: {
    x?: number;
    y?: number;
  };
};

interface LeaferGraphMutationHostOptions<
  TNodeState extends LeaferGraphMutableNodeState,
  TNodeViewState extends LeaferGraphMutableNodeViewState<TNodeState>
> {
  nodeRegistry: NodeRegistry;
  graphNodes: Map<string, TNodeState>;
  graphLinks: Map<string, LeaferGraphLinkData>;
  nodeViews: Map<string, TNodeViewState>;
  mountNodeView(node: TNodeState): TNodeViewState;
  unmountNodeView(nodeId: string): TNodeViewState | undefined;
  refreshNodeView(state: TNodeViewState): void;
  mountLinkView(link: LeaferGraphLinkData): unknown | null;
  removeLinkInternal(linkId: string): boolean;
  updateConnectedLinks(nodeId: string): void;
  updateConnectedLinksForNodes(nodeIds: readonly string[]): void;
  handleNodeRemoved(nodeId: string): void;
  requestRender(): void;
  resolveNodeResizeConstraint(node: TNodeState): LeaferGraphNodeResizeConstraint;
}

/**
 * 归一化连线槽位序号。
 * 当前阶段未提供或非法时统一回退到第一个槽位。
 */
export function normalizeGraphLinkSlotIndex(slot: number | undefined): number {
  if (typeof slot !== "number" || !Number.isFinite(slot)) {
    return DEFAULT_GRAPH_LINK_SLOT;
  }

  return Math.max(DEFAULT_GRAPH_LINK_SLOT, Math.floor(slot));
}

/** 归一化并拷贝连线数据，避免外部对象后续修改直接污染运行时状态。 */
export function normalizeGraphLinkData(
  link: LeaferGraphCreateLinkInput
): LeaferGraphLinkData {
  return {
    id: link.id?.trim() || createGraphLinkId(link),
    source: {
      nodeId: link.source.nodeId,
      slot: normalizeGraphLinkSlotIndex(link.source.slot)
    },
    target: {
      nodeId: link.target.nodeId,
      slot: normalizeGraphLinkSlotIndex(link.target.slot)
    },
    label: link.label,
    data: link.data ? structuredClone(link.data) : undefined
  };
}

/** 图变更宿主，集中收口节点与连线的正式增删改移逻辑。 */
export class LeaferGraphMutationHost<
  TNodeState extends LeaferGraphMutableNodeState,
  TNodeViewState extends LeaferGraphMutableNodeViewState<TNodeState>
> {
  private readonly options: LeaferGraphMutationHostOptions<
    TNodeState,
    TNodeViewState
  >;

  constructor(
    options: LeaferGraphMutationHostOptions<TNodeState, TNodeViewState>
  ) {
    this.options = options;
  }

  /** 根据节点 ID 查询当前图中的所有关联连线。 */
  findLinksByNode(nodeId: string): LeaferGraphLinkData[] {
    const links: LeaferGraphLinkData[] = [];

    for (const link of this.options.graphLinks.values()) {
      if (link.source.nodeId === nodeId || link.target.nodeId === nodeId) {
        links.push(cloneGraphLinkData(link));
      }
    }

    return links;
  }

  /** 创建一个新的节点实例并立即挂到主包场景中。 */
  createNode(input: LeaferGraphCreateNodeInput): TNodeState {
    const node = this.createGraphNodeState(input);

    if (this.options.graphNodes.has(node.id)) {
      throw new Error(`节点已存在：${node.id}`);
    }

    this.options.graphNodes.set(node.id, node);
    this.options.mountNodeView(node);
    this.options.requestRender();
    return node;
  }

  /** 删除一个节点，并同步清理它的全部关联连线与视图。 */
  removeNode(nodeId: string): boolean {
    if (!this.options.graphNodes.has(nodeId)) {
      return false;
    }

    for (const link of this.findLinksByNode(nodeId)) {
      this.options.removeLinkInternal(link.id);
    }

    this.options.unmountNodeView(nodeId);
    this.options.graphNodes.delete(nodeId);
    this.options.handleNodeRemoved(nodeId);
    this.options.requestRender();
    return true;
  }

  /**
   * 更新一个既有节点的静态内容与布局。
   * 这一轮先保持边界清晰：允许更新标题、布局、属性、槽位与 widget，
   * 但不在这里处理“节点 ID / 类型切换”这类结构性重建。
   */
  updateNode(
    nodeId: string,
    input: LeaferGraphUpdateNodeInput
  ): TNodeState | undefined {
    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return undefined;
    }

    if (input.id && input.id !== nodeId) {
      throw new Error("当前阶段暂不支持通过 updateNode() 修改节点 ID");
    }

    configureNode(this.options.nodeRegistry, node, {
      type: node.type,
      title: input.title,
      layout: this.resolvePatchedNodeLayout(node, input),
      properties: this.resolvePatchedNodeProperties(node, input),
      propertySpecs: input.propertySpecs,
      inputs:
        input.inputs !== undefined ? toSlotSpecs(input.inputs) : undefined,
      outputs:
        input.outputs !== undefined ? toSlotSpecs(input.outputs) : undefined,
      widgets: this.resolvePatchedNodeWidgets(node, input),
      data: input.data
    });

    const state = this.options.nodeViews.get(nodeId);
    if (state) {
      this.options.refreshNodeView(state);
    } else {
      this.options.mountNodeView(node);
    }

    this.options.updateConnectedLinks(nodeId);
    this.options.requestRender();
    return node;
  }

  /** 移动一个节点到新的图坐标。 */
  moveNode(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): TNodeState | undefined {
    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return undefined;
    }

    if (!this.moveNodeInternally(nodeId, position)) {
      return node;
    }

    this.options.updateConnectedLinksForNodes([nodeId]);
    this.options.requestRender();
    return node;
  }

  /**
   * 调整一个节点的显式宽高。
   * 当前不做整体缩放，而是直接修改布局尺寸并局部重建节点壳，
   * 以保持端口、Widget 和连线锚点语义稳定。
   */
  resizeNode(
    nodeId: string,
    size: LeaferGraphResizeNodeInput
  ): TNodeState | undefined {
    const node = this.options.graphNodes.get(nodeId);
    const state = this.options.nodeViews.get(nodeId);

    if (!node || !state) {
      return node;
    }

    const constraint = this.options.resolveNodeResizeConstraint(node);
    if (!constraint.enabled) {
      return node;
    }

    const currentWidth = node.layout.width ?? constraint.defaultWidth;
    const currentHeight = node.layout.height ?? constraint.defaultHeight;
    let nextWidth = coerceFiniteNumber(size.width, currentWidth);
    let nextHeight = coerceFiniteNumber(size.height, currentHeight);

    if (constraint.lockRatio) {
      const ratio =
        constraint.defaultHeight > 0
          ? constraint.defaultWidth / constraint.defaultHeight
          : currentHeight > 0
            ? currentWidth / currentHeight
            : 1;
      const widthDelta = Math.abs(nextWidth - currentWidth);
      const heightDelta = Math.abs(nextHeight - currentHeight);
      const widthDriven = widthDelta >= heightDelta;

      if (widthDriven) {
        nextHeight = nextWidth / ratio;
      } else {
        nextWidth = nextHeight * ratio;
      }
    }

    nextWidth = snapToStep(nextWidth, constraint.snap);
    nextHeight = snapToStep(nextHeight, constraint.snap);

    nextWidth = clampToRange(
      nextWidth,
      constraint.minWidth,
      constraint.maxWidth
    );
    nextHeight = clampToRange(
      nextHeight,
      constraint.minHeight,
      constraint.maxHeight
    );

    if (node.layout.width === nextWidth && node.layout.height === nextHeight) {
      return node;
    }

    node.layout.width = Math.round(nextWidth);
    node.layout.height = Math.round(nextHeight);
    this.options.refreshNodeView(state);
    this.options.updateConnectedLinks(nodeId);
    this.options.requestRender();
    return node;
  }

  /**
   * 创建一条正式连线并加入当前图状态。
   * 连线端点必须指向已存在的节点，否则直接抛错，避免悄悄生成半无效状态。
   */
  createLink(input: LeaferGraphCreateLinkInput): LeaferGraphLinkData {
    const link = normalizeGraphLinkData(input);

    if (this.options.graphLinks.has(link.id)) {
      throw new Error(`连线已存在：${link.id}`);
    }

    if (!this.options.graphNodes.has(link.source.nodeId)) {
      throw new Error(`连线起点节点不存在：${link.source.nodeId}`);
    }

    if (!this.options.graphNodes.has(link.target.nodeId)) {
      throw new Error(`连线终点节点不存在：${link.target.nodeId}`);
    }

    const state = this.options.mountLinkView(link);
    if (!state) {
      throw new Error(`无法创建连线视图：${link.id}`);
    }

    this.options.requestRender();
    return cloneGraphLinkData(link);
  }

  /** 删除一条既有连线。 */
  removeLink(linkId: string): boolean {
    const removed = this.options.removeLinkInternal(linkId);

    if (removed) {
      this.options.requestRender();
    }

    return removed;
  }

  /**
   * 按位移量批量移动一组选中节点，并保留它们的相对布局。
   * 该逻辑仅负责拖拽链路使用，避免 editor 为多选拖拽重复维护一套节点同步协议。
   */
  moveNodesByDelta(
    positions: readonly GraphDragNodePosition[],
    deltaX: number,
    deltaY: number
  ): void {
    const movedNodeIds: string[] = [];

    for (const item of positions) {
      if (
        this.moveNodeInternally(item.nodeId, {
          x: item.startX + deltaX,
          y: item.startY + deltaY
        })
      ) {
        movedNodeIds.push(item.nodeId);
      }
    }

    if (!movedNodeIds.length) {
      return;
    }

    this.options.updateConnectedLinksForNodes(movedNodeIds);
    this.options.requestRender();
  }

  /**
   * 只回写节点坐标本身，不直接触发整批渲染。
   * `moveNode(...)` 和多选拖拽都会先走这条最小路径，再决定是否统一刷新连线。
   */
  private moveNodeInternally(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): boolean {
    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return false;
    }

    const nextX = position.x;
    const nextY = position.y;
    if (node.layout.x === nextX && node.layout.y === nextY) {
      return false;
    }

    node.layout.x = nextX;
    node.layout.y = nextY;

    const state = this.options.nodeViews.get(nodeId);
    if (state) {
      state.view.x = nextX;
      state.view.y = nextY;
    }

    return true;
  }

  /** 把节点补丁中的坐标与尺寸字段整理成 `configureNode()` 可消费的布局结构。 */
  private resolvePatchedNodeLayout(
    node: TNodeState,
    input: LeaferGraphUpdateNodeInput
  ): TNodeState["layout"] | undefined {
    if (
      input.x === undefined &&
      input.y === undefined &&
      input.width === undefined &&
      input.height === undefined
    ) {
      return undefined;
    }

    return {
      x: input.x ?? node.layout.x,
      y: input.y ?? node.layout.y,
      width: input.width ?? node.layout.width,
      height: input.height ?? node.layout.height
    };
  }

  /** 合并当前属性和外部补丁，保证展示层属性仍能走正式更新链路。 */
  private resolvePatchedNodeProperties(
    node: TNodeState,
    input: LeaferGraphUpdateNodeInput
  ): GraphNodeProperties {
    const properties: GraphNodeProperties = {
      ...node.properties,
      ...(input.properties ?? {})
    };

    if (input.subtitle !== undefined) {
      properties.subtitle = input.subtitle;
    }
    if (input.accent !== undefined) {
      properties.accent = input.accent;
    }
    if (input.category !== undefined) {
      properties.category = input.category;
    }
    if (input.status !== undefined) {
      properties.status = input.status;
    }

    return properties;
  }

  /** 解析节点 Widget 补丁。 */
  private resolvePatchedNodeWidgets(
    node: TNodeState,
    input: LeaferGraphUpdateNodeInput
  ): TNodeState["widgets"] | undefined {
    void node;
    return input.widgets;
  }

  /** 将页面层节点输入转换为真正的节点运行时实例。 */
  private createGraphNodeState(node: LeaferGraphCreateNodeInput): TNodeState {
    const type = node.type?.trim();
    if (!type) {
      throw new Error("节点 type 不能为空");
    }

    const properties: GraphNodeProperties = {
      ...(node.properties ?? {})
    };

    if (node.subtitle !== undefined) {
      properties.subtitle = node.subtitle;
    }
    if (node.accent !== undefined) {
      properties.accent = node.accent;
    }
    if (node.category !== undefined) {
      properties.category = node.category;
    }
    if (node.status !== undefined) {
      properties.status = node.status;
    }

    return createNodeState(this.options.nodeRegistry, {
      id: node.id,
      type,
      title: node.title,
      layout: {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height
      },
      properties,
      propertySpecs: node.propertySpecs,
      inputs:
        node.inputs !== undefined ? toSlotSpecs(node.inputs) : undefined,
      outputs:
        node.outputs !== undefined ? toSlotSpecs(node.outputs) : undefined,
      widgets: node.widgets,
      data: node.data
    }) as TNodeState;
  }
}

/**
 * 将旧字符串数组或正式槽位声明统一转换成槽位输入。
 * 这样图变更宿主本身就能同时兼容页面层数据和正式节点复制、导入路径。
 */
function toSlotSpecs(slots: LeaferGraphNodeSlotInput[]): NodeSlotSpec[] {
  return slots.map((slot) =>
    typeof slot === "string"
      ? { name: slot }
      : {
          ...slot,
          data: slot.data ? structuredClone(slot.data) : undefined
        }
  );
}

/** 为对外查询返回一份安全副本，避免外部绕过正式 API 直接改内部状态。 */
function cloneGraphLinkData(link: LeaferGraphLinkData): LeaferGraphLinkData {
  return {
    id: link.id,
    source: { ...link.source },
    target: { ...link.target },
    label: link.label,
    data: link.data ? structuredClone(link.data) : undefined
  };
}

/** 生成默认连线 ID，保证在未显式指定时也能稳定进入图状态。 */
function createGraphLinkId(link: LeaferGraphCreateLinkInput): string {
  const sourceSlot = normalizeGraphLinkSlotIndex(link.source.slot);
  const targetSlot = normalizeGraphLinkSlotIndex(link.target.slot);
  const id = `link:${link.source.nodeId}:${sourceSlot}->${link.target.nodeId}:${targetSlot}:${graphLinkSeed}`;
  graphLinkSeed += 1;
  return id;
}

/** 把任意输入约束成有限数字；非法时回退到给定值。 */
function coerceFiniteNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** 将值限制在给定区间内；未提供最大值时只做下界限制。 */
function clampToRange(value: number, min: number, max?: number): number {
  if (typeof max === "number" && Number.isFinite(max)) {
    return Math.min(Math.max(value, min), max);
  }

  return Math.max(value, min);
}

/** 按给定步长做吸附；非法或非正数步长会直接返回原值。 */
function snapToStep(value: number, step?: number): number {
  if (typeof step !== "number" || !Number.isFinite(step) || step <= 0) {
    return value;
  }

  return Math.round(value / step) * step;
}
