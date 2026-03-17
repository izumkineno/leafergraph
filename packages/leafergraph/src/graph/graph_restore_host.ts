/**
 * 图恢复宿主模块。
 *
 * @remarks
 * 负责把正式图输入恢复成运行时节点、连线和场景状态。
 */

import {
  createNodeState,
  type GraphDocument,
  type GraphLink,
  type NodeRegistry,
  type NodeRuntimeState,
  type NodeSerializeResult
} from "@leafergraph/node";
import { normalizeGraphLinkData } from "./graph_mutation_host";

type LeaferGraphRestorableNodeState = NodeRuntimeState;

/**
 * 图恢复宿主依赖的外部桥接能力。
 *
 * @remarks
 * 恢复宿主本身只关心“清空旧状态后重新挂载正式图”，
 * 具体怎么销毁节点 Widget、怎么清空图层、怎么创建节点视图和连线视图，
 * 都通过这组回调下沉给更靠近场景层的宿主实现。
 *
 * @typeParam TNodeState - 主包内部使用的节点运行时状态。
 * @typeParam TNodeViewState - 节点对应的场景视图状态。
 */
interface LeaferGraphRestoreHostOptions<
  TNodeState extends LeaferGraphRestorableNodeState,
  TNodeViewState
> {
  nodeRegistry: NodeRegistry;
  graphNodes: Map<string, TNodeState>;
  graphLinks: Map<string, GraphLink>;
  nodeViews: Map<string, TNodeViewState>;
  linkViews: unknown[];
  clearInteractionState(): void;
  resetRuntimeState(): void;
  resetNodeExecutionStates(): void;
  resetGraphExecutionState(): void;
  destroyNodeViewWidgets(state: TNodeViewState): void;
  clearNodeLayer(): void;
  clearLinkLayer(): void;
  mountNodeView(node: TNodeState): TNodeViewState;
  mountLinkView(link: GraphLink): unknown | null;
  handleLinkRestored(link: GraphLink): void;
  requestRender(): void;
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
   * 根据正式文档输入重建整个主包场景。
   * 未提供 document 时自动回退到空文档，避免启动期再散落一层空值判断。
   *
   * @param document - 外部传入的正式文档快照；可为空，空时回退为空文档。
   */
  replaceGraphDocument(document?: GraphDocument): void {
    const resolvedDocument = this.resolveGraphDocument(document);

    // 先释放上一轮节点里残留的 Widget 生命周期，避免编辑器 DOM、事件监听和图元引用泄漏。
    for (const state of this.options.nodeViews.values()) {
      this.options.destroyNodeViewWidgets(state);
    }

    // 再统一清空运行时状态容器和图层，保证恢复过程从干净场景开始。
    this.options.clearInteractionState();
    this.options.resetRuntimeState();
    this.options.resetNodeExecutionStates();
    this.options.resetGraphExecutionState();
    this.options.graphNodes.clear();
    this.options.graphLinks.clear();
    this.options.nodeViews.clear();
    this.options.linkViews.length = 0;
    this.options.clearNodeLayer();
    this.options.clearLinkLayer();

    // 节点必须先恢复，因为连线挂载依赖节点视图和端口锚点已经存在。
    const localNodes = resolvedDocument.nodes.map((node) =>
      this.createGraphNodeStateFromSnapshot(this.normalizeGraphNodeSnapshot(node))
    );

    for (const node of localNodes) {
      this.options.graphNodes.set(node.id, node);
      this.options.mountNodeView(node);
    }

    // 连线统一在节点完成挂载后恢复，避免连线初始化时找不到端点。
    for (const link of resolvedDocument.links) {
      const normalizedLink = normalizeGraphLinkData(link);
      const mounted = this.options.mountLinkView(normalizedLink);
      if (!mounted) {
        continue;
      }

      // 恢复路径也要补发连接生命周期，避免“启动就存在的连线”和“运行时新建连线”表现不一致。
      this.options.handleLinkRestored(normalizedLink);
    }

    this.options.requestRender();
  }

  /**
   * 把启动输入规整成正式文档结构。
   *
   * @remarks
   * 当前主包已经收敛到正式 `document` 输入，因此这里不再接受 demo 级 nodes 输入。
   * 如果调用方没有提供 document，就统一回退为空文档，减少启动期额外分支。
   *
   * @param document - 外部传入的原始 document。
   * @returns 一个可直接进入恢复流程的正式文档结构。
   */
  private resolveGraphDocument(document?: GraphDocument): GraphDocument {
    if (document) {
      return {
        documentId: document.documentId || "local-document",
        revision: document.revision ?? 0,
        appKind: document.appKind || "leafergraph-local",
        nodes: document.nodes.map((node) => structuredClone(node)),
        links: (document.links ?? []).map((link) => structuredClone(link)),
        meta: document.meta ? structuredClone(document.meta) : undefined,
        capabilityProfile: document.capabilityProfile
          ? structuredClone(document.capabilityProfile)
          : undefined,
        adapterBinding: document.adapterBinding
          ? structuredClone(document.adapterBinding)
          : undefined
      };
    }

    return {
      documentId: "local-document",
      revision: 0,
      appKind: "leafergraph-local",
      nodes: [],
      links: []
    };
  }

  /**
   * 将图数据中的节点快照归一成正式恢复输入。
   * 这里显式要求节点必须提供 `type`，避免无效数据静默落图。
   *
   * @param node - 待校验和浅拷贝的节点快照。
   * @returns 适合继续进入节点恢复流程的节点快照副本。
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

  /**
   * 将正式图快照恢复为运行时节点实例。
   *
   * @remarks
   * 这里直接走 `createNodeState(...)`，保证启动恢复路径和后续正式创建路径共享同一套
   * 节点归一化逻辑，而不是单独维护第二份“从快照到运行时”的私有协议。
   *
   * @param node - 已经过基础校验的正式节点快照。
   * @returns 可放入主包 `graphNodes` 容器的节点运行时状态。
   */
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
