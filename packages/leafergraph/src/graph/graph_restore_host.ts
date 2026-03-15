import {
  createNodeState,
  type LeaferGraphData,
  type LeaferGraphLinkData,
  type NodeRegistry,
  type NodeRuntimeState,
  type NodeSerializeResult
} from "@leafergraph/node";
import { normalizeGraphLinkData } from "./graph_mutation_host";

type LeaferGraphRestorableNodeState = NodeRuntimeState;

interface LeaferGraphRestoreHostOptions<
  TNodeState extends LeaferGraphRestorableNodeState,
  TNodeViewState
> {
  nodeRegistry: NodeRegistry;
  graphNodes: Map<string, TNodeState>;
  graphLinks: Map<string, LeaferGraphLinkData>;
  nodeViews: Map<string, TNodeViewState>;
  linkViews: unknown[];
  clearInteractionState(): void;
  resetRuntimeState(): void;
  destroyNodeViewWidgets(state: TNodeViewState): void;
  clearNodeLayer(): void;
  clearLinkLayer(): void;
  mountNodeView(node: TNodeState): TNodeViewState;
  mountLinkView(link: LeaferGraphLinkData): unknown | null;
}

/**
 * 图恢复宿主。
 * 当前专门负责“把一份正式 graph 输入恢复成运行时场景”，
 * 包括启动期空图回退、整图清空、节点快照恢复和连线挂载。
 */
export class LeaferGraphRestoreHost<
  TNodeState extends LeaferGraphRestorableNodeState,
  TNodeViewState
> {
  private readonly options: LeaferGraphRestoreHostOptions<
    TNodeState,
    TNodeViewState
  >;

  constructor(
    options: LeaferGraphRestoreHostOptions<TNodeState, TNodeViewState>
  ) {
    this.options = options;
  }

  /**
   * 根据正式图输入重建整个主包场景。
   * 未提供 graph 时自动回退到空图，避免启动期再散落一层空值判断。
   */
  restoreGraph(graph?: LeaferGraphData): void {
    const resolvedGraph = this.resolveGraphData(graph);

    for (const state of this.options.nodeViews.values()) {
      this.options.destroyNodeViewWidgets(state);
    }

    this.options.clearInteractionState();
    this.options.resetRuntimeState();
    this.options.graphNodes.clear();
    this.options.graphLinks.clear();
    this.options.nodeViews.clear();
    this.options.linkViews.length = 0;
    this.options.clearNodeLayer();
    this.options.clearLinkLayer();

    const localNodes = resolvedGraph.nodes.map((node) =>
      this.createGraphNodeStateFromSnapshot(this.normalizeGraphNodeSnapshot(node))
    );

    for (const node of localNodes) {
      this.options.graphNodes.set(node.id, node);
      this.options.mountNodeView(node);
    }

    for (const link of resolvedGraph.links ?? []) {
      this.options.mountLinkView(normalizeGraphLinkData(link));
    }
  }

  /** 把启动输入规整成正式图结构；未提供时统一回退为空图。 */
  private resolveGraphData(graph?: LeaferGraphData): LeaferGraphData {
    if (graph) {
      return {
        nodes: graph.nodes,
        links: graph.links ?? [],
        meta: graph.meta
      };
    }

    return {
      nodes: [],
      links: []
    };
  }

  /**
   * 将图数据中的节点快照归一成正式恢复输入。
   * 这里显式要求节点必须提供 `type`，避免无效数据静默落图。
   */
  private normalizeGraphNodeSnapshot(
    node: NodeSerializeResult
  ): NodeSerializeResult {
    const type = node.type?.trim();
    if (!type) {
      throw new Error(`节点缺少 type：${node.id}`);
    }

    return {
      ...node,
      type,
      layout: {
        ...node.layout
      }
    };
  }

  /** 将正式图快照恢复为运行时节点实例。 */
  private createGraphNodeStateFromSnapshot(
    node: NodeSerializeResult
  ): TNodeState {
    const type = node.type?.trim();
    if (!type) {
      throw new Error(`节点 type 不能为空：${node.id}`);
    }

    return createNodeState(this.options.nodeRegistry, {
      id: node.id,
      type,
      title: node.title,
      layout: node.layout,
      properties: node.properties,
      propertySpecs: node.propertySpecs,
      inputs: node.inputs,
      outputs: node.outputs,
      widgets: node.widgets,
      flags: node.flags,
      data: node.data
    }) as TNodeState;
  }
}
