/**
 * 图场景运行时宿主模块。
 *
 * @remarks
 * 负责把场景刷新、连线刷新与正式图变更收敛为统一运行时壳面。
 */

import type { GraphLink, NodeRuntimeState } from "@leafergraph/node";
import type { GraphDragNodePosition } from "../../interaction/graph_interaction_runtime_host";
import type {
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphUpdateDocumentInput,
  LeaferGraphMoveNodeInput,
  LeaferGraphNodeStateChangeReason,
  LeaferGraphResizeNodeInput,
  LeaferGraphUpdateNodeInput
} from "@leafergraph/contracts";
import type { GraphDocumentRootState } from "../types";

type LeaferGraphSceneRuntimeNodeViewState<
  TNodeState extends NodeRuntimeState = NodeRuntimeState
> = {
  state: TNodeState;
};

type InternalGraphOperationApplyResult<
  TNodeState extends NodeRuntimeState
> = GraphOperationApplyResult & {
  node?: TNodeState;
  link?: GraphLink;
};

let graphOperationSeed = 1;

/**
 * 场景运行时层依赖的场景桥接能力。
 *
 * @remarks
 * 这里聚焦的是“已经存在的节点/连线视图怎么被局部刷新”，
 * 不承担正式图状态创建和删除职责。
 */
interface LeaferGraphSceneRuntimeSceneHostLike<TNodeViewState> {
  refreshNodeView(state: TNodeViewState): void;
  updateConnectedLinks(nodeId: string): void;
  updateConnectedLinksForNodes(nodeIds: readonly string[]): void;
  setNodeWidgetValue(
    nodeId: string,
    widgetIndex: number,
    newValue: unknown
  ): boolean;
}

/**
 * 场景运行时层依赖的图变更能力。
 *
 * @remarks
 * 这部分能力全部来自图变更宿主，负责节点和连线的正式增删改移。
 * 运行时桥接层把它们与场景刷新能力合并后，对上层暴露成更平整的一组 API。
 */
interface LeaferGraphSceneRuntimeMutationHostLike<
  TNodeState extends NodeRuntimeState
> {
  findLinksByNode(nodeId: string): GraphLink[];
  getLink(linkId: string): GraphLink | undefined;
  createNode(input: LeaferGraphCreateNodeInput): TNodeState;
  removeNode(nodeId: string): boolean;
  updateNode(
    nodeId: string,
    input: LeaferGraphUpdateNodeInput
  ): TNodeState | undefined;
  moveNode(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): TNodeState | undefined;
  resizeNode(
    nodeId: string,
    size: LeaferGraphResizeNodeInput
  ): TNodeState | undefined;
  createLink(input: LeaferGraphCreateLinkInput): GraphLink;
  removeLink(linkId: string): boolean;
  moveNodesByDelta(
    positions: readonly GraphDragNodePosition[],
    deltaX: number,
    deltaY: number
  ): string[];
}

/**
 * 场景运行时桥接宿主依赖项。
 *
 * @remarks
 * `graphNodes` 和 `nodeViews` 让运行时宿主能统一做“刷新全部节点/连线”这类批量动作，
 * 而不需要再让上层自己维护节点集合。
 */
interface LeaferGraphSceneRuntimeHostOptions<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphSceneRuntimeNodeViewState<TNodeState>
> {
  graphDocument: GraphDocumentRootState;
  graphNodes: Map<string, TNodeState>;
  nodeViews: Map<string, TNodeViewState>;
  sceneHost: LeaferGraphSceneRuntimeSceneHostLike<TNodeViewState>;
  mutationHost: LeaferGraphSceneRuntimeMutationHostLike<TNodeState>;
  requestRender(): void;
  notifyNodeStateChanged?(
    nodeId: string,
    reason: LeaferGraphNodeStateChangeReason
  ): void;
}

/**
 * 场景运行时桥接宿主。
 * 这一层把“局部场景刷新”和“正式图变更”合成一个统一壳面，
 * 让外围宿主不再分别依赖 `sceneHost` 和 `mutationHost` 两条链。
 */
export class LeaferGraphSceneRuntimeHost<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphSceneRuntimeNodeViewState<TNodeState>
> {
  private readonly options: LeaferGraphSceneRuntimeHostOptions<
    TNodeState,
    TNodeViewState
  >;

  /**
   * 初始化 LeaferGraphSceneRuntimeHost 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(
    options: LeaferGraphSceneRuntimeHostOptions<TNodeState, TNodeViewState>
  ) {
    this.options = options;
  }

  /**
   * 刷新单个节点视图。
   *
   * @param state - 待刷新的节点视图状态。
   *
   * @returns 无返回值。
   */
  refreshNodeView(state: TNodeViewState): void {
    this.options.sceneHost.refreshNodeView(state);
  }

  /**
   * 批量刷新当前场景里的全部节点视图。
   *
   * @remarks
   * 主要给主题切换、全局样式变更等“全量节点壳需要重新生成”的场景使用。
   *
   * @returns 无返回值。
   */
  refreshAllNodeViews(): void {
    for (const state of this.options.nodeViews.values()) {
      this.options.sceneHost.refreshNodeView(state);
    }
  }

  /**
   * 刷新与单个节点相关的连线。
   *
   * @param nodeId - 目标节点 ID。
   *
   * @returns 无返回值。
   */
  updateConnectedLinks(nodeId: string): void {
    this.options.sceneHost.updateConnectedLinks(nodeId);
  }

  /**
   * 批量刷新与一组节点相关的连线。
   *
   * @param nodeIds - 参与刷新的节点 ID 列表。
   *
   * @returns 无返回值。
   */
  updateConnectedLinksForNodes(nodeIds: readonly string[]): void {
    this.options.sceneHost.updateConnectedLinksForNodes(nodeIds);
  }

  /**
   * 刷新当前图里全部节点关联连线。
   *
   * @remarks
   * 当前直接以全部节点 ID 作为输入，让底层连线宿主自行去重和收敛。
   * 这样主题切换和全图恢复后都能复用同一条刷新路径。
   *
   * @returns 无返回值。
   */
  refreshAllConnectedLinks(): void {
    this.options.sceneHost.updateConnectedLinksForNodes([
      ...this.options.graphNodes.keys()
    ]);
  }

  /**
   * 请求当前画布刷新一帧。
   *
   * @remarks
   * 这一层只负责把请求转发给画布宿主，不自行决定渲染策略。
   *
   * @returns 无返回值。
   */
  requestRender(): void {
    this.options.requestRender();
  }

  /**
   * 更新某个节点某个 Widget 的值，并触发 renderer 的 `update`。
   *
   * @param nodeId - 目标节点 ID。
   * @param widgetIndex - Widget 索引。
   * @param newValue - 待写回的新值。
   *
   * @returns 对应的判断结果。
   */
  setNodeWidgetValue(
    nodeId: string,
    widgetIndex: number,
    newValue: unknown
  ): boolean {
    if (
      this.options.sceneHost.setNodeWidgetValue(nodeId, widgetIndex, newValue)
    ) {
      this.options.notifyNodeStateChanged?.(nodeId, "widget-value");
      return true;
    }

    return false;
  }

  /**
   * 根据节点 ID 查询当前图中的所有关联连线。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 关联连线安全副本列表。
   */
  findLinksByNode(nodeId: string): GraphLink[] {
    return this.options.mutationHost.findLinksByNode(nodeId);
  }

  /**
   * 根据连线 ID 读取当前图中的正式连线快照。
   *
   * @param linkId - 目标连线 ID。
   * @returns 连线安全副本；未命中时返回 `undefined`。
   */
  getLink(linkId: string): GraphLink | undefined {
    return this.options.mutationHost.getLink(linkId);
  }

  /**
   * 统一应用一条正式图操作。
   *
   * @param operation - 待应用的正式操作。
   * @returns 标准化后的操作应用结果。
   */
  applyGraphOperation(operation: GraphOperation): GraphOperationApplyResult {
    return this.applyGraphOperationInternal(operation);
  }

  /**
   * 创建一个新的节点实例并立即挂到主包场景中。
   *
   * @param input - 节点创建输入。
   * @returns 新创建的节点状态。
   */
  createNode(input: LeaferGraphCreateNodeInput): TNodeState {
    const result = this.applyGraphOperationInternal(
      createGraphOperation("api", {
        type: "node.create",
        input: structuredClone(input)
      })
    );

    if (!result.accepted || !result.node) {
      throw new Error(result.reason ?? "创建节点失败");
    }

    return result.node;
  }

  /**
   * 删除一个节点，并同步清理它的全部关联连线与视图。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 是否成功删除。
   */
  removeNode(nodeId: string): boolean {
    const result = this.applyGraphOperationInternal(
      createGraphOperation("api", {
        type: "node.remove",
        nodeId
      })
    );

    return result.accepted && result.changed;
  }

  /**
   * 更新一个既有节点的静态内容与布局。
   *
   * @param nodeId - 目标节点 ID。
   * @param input - 待应用的节点补丁。
   * @returns 更新后的节点；节点不存在时返回 `undefined`。
   */
  updateNode(
    nodeId: string,
    input: LeaferGraphUpdateNodeInput
  ): TNodeState | undefined {
    const result = this.applyGraphOperationInternal(
      createGraphOperation("api", {
        type: "node.update",
        nodeId,
        input: structuredClone(input)
      })
    );

    return result.accepted ? result.node : undefined;
  }

  /**
   * 移动一个节点到新的图坐标。
   *
   * @param nodeId - 目标节点 ID。
   * @param position - 节点目标坐标。
   * @returns 更新后的节点；节点不存在时返回 `undefined`。
   */
  moveNode(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): TNodeState | undefined {
    const result = this.applyGraphOperationInternal(
      createGraphOperation("api", {
        type: "node.move",
        nodeId,
        input: structuredClone(position)
      })
    );

    return result.accepted ? result.node : undefined;
  }

  /**
   * 调整一个节点的显式宽高。
   *
   * @param nodeId - 目标节点 ID。
   * @param size - 节点目标尺寸。
   * @returns 更新后的节点；节点不存在时返回 `undefined`。
   */
  resizeNode(
    nodeId: string,
    size: LeaferGraphResizeNodeInput
  ): TNodeState | undefined {
    const result = this.applyGraphOperationInternal(
      createGraphOperation("api", {
        type: "node.resize",
        nodeId,
        input: structuredClone(size)
      })
    );

    return result.accepted ? result.node : undefined;
  }

  /**
   * 创建一条正式连线并加入当前图状态。
   *
   * @param input - 连线创建输入。
   * @returns 连线安全副本。
   *
   * @param source - 当前来源对象。
   */
  createLink(input: LeaferGraphCreateLinkInput, source = "api"): GraphLink {
    const result = this.applyGraphOperationInternal(
      createGraphOperation(source, {
        type: "link.create",
        input: structuredClone(input)
      })
    );

    if (!result.accepted || !result.link) {
      throw new Error(result.reason ?? "创建连线失败");
    }

    return result.link;
  }

  /**
   * 删除一条既有连线。
   *
   * @param linkId - 目标连线 ID。
   * @returns 是否成功删除。
   */
  removeLink(linkId: string): boolean {
    const result = this.applyGraphOperationInternal(
      createGraphOperation("api", {
        type: "link.remove",
        linkId
      })
    );

    return result.accepted && result.changed;
  }

  /**
   * 按位移量批量移动一组选中节点，并保留它们的相对布局。
   *
   * @param positions - 拖拽起点时的节点位置快照。
   * @param deltaX - 当前横向位移。
   * @param deltaY - 当前纵向位移。
   *
   * @returns 无返回值。
   */
  moveNodesByDelta(
    positions: readonly GraphDragNodePosition[],
    deltaX: number,
    deltaY: number
  ): void {
    const movedNodeIds = this.options.mutationHost.moveNodesByDelta(
      positions,
      deltaX,
      deltaY
    );

    for (const nodeId of movedNodeIds) {
      this.options.notifyNodeStateChanged?.(nodeId, "moved");
    }
  }

  /**
   * 统一应用一条正式图操作，并在内部保留创建出的节点或连线结果。
   *
   * @param operation - 待应用的正式操作。
   * @returns 带内部实体引用的应用结果。
   */
  private applyGraphOperationInternal(
    operation: GraphOperation
  ): InternalGraphOperationApplyResult<TNodeState> {
    // 先读取当前目标状态与上下文约束，避免处理中出现不一致的中间态。
    try {
      switch (operation.type) {
        case "document.update": {
          const changed = hasDocumentRootPatch(operation.input);
          if (changed) {
            patchGraphDocumentRoot(this.options.graphDocument, operation.input);
          }
          return {
            accepted: true,
            changed,
            operation,
            affectedNodeIds: [],
            affectedLinkIds: [],
            reason: changed ? undefined : "文档根字段补丁为空"
          };
        }
        case "node.create": {
          const node = this.options.mutationHost.createNode(operation.input);
          this.options.notifyNodeStateChanged?.(node.id, "created");
          return {
            accepted: true,
            changed: true,
            operation,
            affectedNodeIds: [node.id],
            affectedLinkIds: [],
            node
          };
        }
        case "node.update": {
          const currentNode = this.options.graphNodes.get(operation.nodeId);
          if (!currentNode) {
            return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
          }

          const before = createComparableNodeSnapshot(currentNode);
          const node = this.options.mutationHost.updateNode(
            operation.nodeId,
            operation.input
          );
          if (!node) {
            return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
          }

          const changed = !isStructurallyEqual(
            before,
            createComparableNodeSnapshot(node)
          );
          if (changed) {
            this.options.notifyNodeStateChanged?.(operation.nodeId, "updated");
          }

          return {
            accepted: true,
            changed,
            operation,
            affectedNodeIds: [operation.nodeId],
            affectedLinkIds: [],
            reason: changed ? undefined : "节点补丁没有产生变化",
            node
          };
        }
        case "node.move": {
          const currentNode = this.options.graphNodes.get(operation.nodeId);
          if (!currentNode) {
            return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
          }

          const before = {
            x: currentNode.layout.x,
            y: currentNode.layout.y
          };
          const node = this.options.mutationHost.moveNode(
            operation.nodeId,
            operation.input
          );
          if (!node) {
            return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
          }

          const changed =
            before.x !== node.layout.x || before.y !== node.layout.y;
          if (changed) {
            this.options.notifyNodeStateChanged?.(operation.nodeId, "moved");
          }

          return {
            accepted: true,
            changed,
            operation,
            affectedNodeIds: [operation.nodeId],
            affectedLinkIds: [],
            reason: changed ? undefined : "节点位置没有变化",
            node
          };
        }
        case "node.resize": {
          const currentNode = this.options.graphNodes.get(operation.nodeId);
          if (!currentNode) {
            return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
          }

          const before = {
            width: currentNode.layout.width,
            height: currentNode.layout.height
          };
          const node = this.options.mutationHost.resizeNode(
            operation.nodeId,
            operation.input
          );
          if (!node) {
            // 再执行核心更新步骤，并同步派生副作用与收尾状态。
            return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
          }

          const changed =
            before.width !== node.layout.width ||
            before.height !== node.layout.height;
          if (changed) {
            this.options.notifyNodeStateChanged?.(operation.nodeId, "resized");
          }

          return {
            accepted: true,
            changed,
            operation,
            affectedNodeIds: [operation.nodeId],
            affectedLinkIds: [],
            reason: changed ? undefined : "节点尺寸没有变化或当前不允许调整",
            node
          };
        }
        case "node.remove": {
          const node = this.options.graphNodes.get(operation.nodeId);
          if (!node) {
            return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
          }

          const relatedLinks = this.options.mutationHost.findLinksByNode(node.id);
          const removed = this.options.mutationHost.removeNode(operation.nodeId);
          if (!removed) {
            return rejectGraphOperation(operation, `节点删除失败：${operation.nodeId}`);
          }

          this.options.notifyNodeStateChanged?.(operation.nodeId, "removed");
          return {
            accepted: true,
            changed: true,
            operation,
            affectedNodeIds: [operation.nodeId],
            affectedLinkIds: relatedLinks.map((link) => link.id)
          };
        }
        case "link.create": {
          const link = this.options.mutationHost.createLink(operation.input);
          return {
            accepted: true,
            changed: true,
            operation,
            affectedNodeIds: uniqueNodeIds([
              link.source.nodeId,
              link.target.nodeId
            ]),
            affectedLinkIds: [link.id],
            link
          };
        }
        case "link.remove": {
          const currentLink = this.options.mutationHost.getLink(operation.linkId);
          if (!currentLink) {
            return rejectGraphOperation(operation, `连线不存在：${operation.linkId}`);
          }

          const removed = this.options.mutationHost.removeLink(operation.linkId);
          if (!removed) {
            return rejectGraphOperation(operation, `连线删除失败：${operation.linkId}`);
          }

          return {
            accepted: true,
            changed: true,
            operation,
            affectedNodeIds: uniqueNodeIds([
              currentLink.source.nodeId,
              currentLink.target.nodeId
            ]),
            affectedLinkIds: [operation.linkId]
          };
        }
        case "link.reconnect": {
          const currentLink = this.options.mutationHost.getLink(operation.linkId);
          if (!currentLink) {
            return rejectGraphOperation(operation, `连线不存在：${operation.linkId}`);
          }

          const nextInput: LeaferGraphCreateLinkInput = {
            id: currentLink.id,
            source: operation.input.source ?? currentLink.source,
            target: operation.input.target ?? currentLink.target,
            label: currentLink.label,
            data: currentLink.data
          };

          if (isSameLinkEndpoint(currentLink, nextInput)) {
            return {
              accepted: true,
              changed: false,
              operation,
              affectedNodeIds: uniqueNodeIds([
                currentLink.source.nodeId,
                currentLink.target.nodeId
              ]),
              affectedLinkIds: [currentLink.id],
              reason: "连线端点没有变化",
              link: currentLink
            };
          }

          if (!this.options.mutationHost.removeLink(operation.linkId)) {
            return rejectGraphOperation(operation, `连线删除失败：${operation.linkId}`);
          }

          try {
            const link = this.options.mutationHost.createLink(nextInput);
            return {
              accepted: true,
              changed: true,
              operation,
              affectedNodeIds: uniqueNodeIds([
                currentLink.source.nodeId,
                currentLink.target.nodeId,
                link.source.nodeId,
                link.target.nodeId
              ]),
              affectedLinkIds: [link.id],
              link
            };
          } catch (error) {
            try {
              this.options.mutationHost.createLink(currentLink);
            } catch {
              // 当前阶段优先保留第一次失败作为真正根因。
            }

            return rejectGraphOperation(
              operation,
              error instanceof Error ? error.message : "连线重连失败"
            );
          }
        }
      }
    } catch (error) {
      return rejectGraphOperation(
        operation,
        error instanceof Error ? error.message : "图操作应用失败"
      );
    }
  }
}

/**
 * 创建图`Operation`。
 *
 * @param source - 当前来源对象。
 * @param input - 输入参数。
 * @returns 创建后的结果对象。
 */
function createGraphOperation(
  source: string,
  input: GraphOperationInput
): GraphOperation {
  const type = input.type;
  const operationId = `op:${type}:${Date.now()}:${graphOperationSeed}`;
  graphOperationSeed += 1;

  return {
    ...input,
    operationId,
    timestamp: Date.now(),
    source
  } as GraphOperation;
}

/**
 * 处理 `rejectGraphOperation` 相关逻辑。
 *
 * @param operation - `operation`。
 * @param reason - `reason`。
 * @returns 处理后的结果。
 */
function rejectGraphOperation(
  operation: GraphOperation,
  reason: string
): GraphOperationApplyResult {
  return {
    accepted: false,
    changed: false,
    operation,
    affectedNodeIds: [],
    affectedLinkIds: [],
    reason
  };
}

type GraphOperationInput = {
  [TType in GraphOperation["type"]]: Omit<
    Extract<GraphOperation, { type: TType }>,
    "operationId" | "timestamp" | "source"
  >;
}[GraphOperation["type"]];

/**
 * 创建`Comparable` 节点快照。
 *
 * @param node - 节点。
 * @returns 创建后的结果对象。
 */
function createComparableNodeSnapshot<TNodeState extends NodeRuntimeState>(
  node: TNodeState
): unknown {
  return structuredClone({
    id: node.id,
    type: node.type,
    title: node.title,
    layout: node.layout,
    flags: node.flags,
    properties: node.properties,
    propertySpecs: node.propertySpecs,
    inputs: node.inputs,
    outputs: node.outputs,
    widgets: node.widgets,
    data: node.data
  });
}

/**
 * 处理 `isStructurallyEqual` 相关逻辑。
 *
 * @param left - `left`。
 * @param right - `right`。
 * @returns 对应的判断结果。
 */
function isStructurallyEqual(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return left === right;
  }
}

/**
 * 处理 `uniqueNodeIds` 相关逻辑。
 *
 * @param nodeIds - 节点 ID 列表。
 * @returns 处理后的结果。
 */
function uniqueNodeIds(nodeIds: readonly string[]): string[] {
  return [...new Set(nodeIds.filter(Boolean))];
}

/**
 * 判断是否存在文档根节点`Patch`。
 *
 * @param input - 输入参数。
 * @returns 对应的判断结果。
 */
function hasDocumentRootPatch(input: LeaferGraphUpdateDocumentInput): boolean {
  return (
    input.appKind !== undefined ||
    input.meta !== undefined ||
    input.capabilityProfile !== undefined ||
    input.adapterBinding !== undefined
  );
}

/**
 * 修补图文档根节点。
 *
 * @param document - 文档。
 * @param input - 输入参数。
 * @returns 无返回值。
 */
function patchGraphDocumentRoot(
  document: GraphDocumentRootState,
  input: LeaferGraphUpdateDocumentInput
): void {
  if (input.appKind !== undefined) {
    document.appKind = input.appKind;
  }

  if (input.meta !== undefined) {
    document.meta = input.meta ? structuredClone(input.meta) : undefined;
  }

  if (input.capabilityProfile !== undefined) {
    document.capabilityProfile = input.capabilityProfile
      ? structuredClone(input.capabilityProfile)
      : undefined;
  }

  if (input.adapterBinding !== undefined) {
    document.adapterBinding = input.adapterBinding
      ? structuredClone(input.adapterBinding)
      : undefined;
  }
}

/**
 * 处理 `isSameLinkEndpoint` 相关逻辑。
 *
 * @param left - `left`。
 * @param right - `right`。
 * @returns 对应的判断结果。
 */
function isSameLinkEndpoint(
  left: Pick<GraphLink, "source" | "target">,
  right: Pick<GraphLink, "source" | "target">
): boolean {
  return (
    left.source.nodeId === right.source.nodeId &&
    (left.source.slot ?? 0) === (right.source.slot ?? 0) &&
    left.target.nodeId === right.target.nodeId &&
    (left.target.slot ?? 0) === (right.target.slot ?? 0)
  );
}
