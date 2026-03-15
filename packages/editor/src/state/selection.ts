import type { LeaferGraph } from "leafergraph";

/**
 * editor 当前阶段的最小节点选区控制器。
 *
 * 这一层先处理“最小多选节点模型”：
 * 1. 保存当前选中的节点 ID 集合
 * 2. 维护“主选中节点”语义，供删除、复制、粘贴等单节点命令复用
 * 3. 调用主包 `setNodeSelected(...)` 同步节点视觉状态
 * 4. 为 GraphViewport 提供稳定、可复用的选区读写接口
 *
 * 之所以先停在“最小多选模型”，而不是一步做成完整选区系统，是因为当前项目仍在
 * “最小编辑交互闭环”阶段。先把选区语义从视图接线里剥离出来，后面再继续扩展：
 * - 框选
 * - 命令层
 * - 历史记录
 */
export interface EditorNodeSelectionController {
  /** 当前主选中节点 ID，没有选中节点时返回 `null`。 */
  readonly primarySelectedNodeId: string | null;
  /**
   * 为兼容当前 editor 里仍以单节点命令为主的调用点，
   * 暂时保留 `selectedNodeId` 作为主选中节点别名。
   */
  readonly selectedNodeId: string | null;
  /** 当前选中的全部节点 ID，顺序与选中历史一致，最后一个永远是主选中节点。 */
  readonly selectedNodeIds: readonly string[];
  /** 判断某个节点是否处于当前选中态。 */
  isSelected(nodeId: string): boolean;
  /** 判断当前是否存在多选。 */
  hasMultipleSelected(): boolean;
  /** 用一组节点 ID 整体替换当前选区。 */
  setMany(nodeIds: readonly string[]): void;
  /** 用新的节点 ID 替换当前选区，传 `null` 表示清空选区。 */
  select(nodeId: string | null): void;
  /** 追加一个节点到当前选区，并把它提升为主选中节点。 */
  add(nodeId: string): void;
  /** 将某个节点从当前选区移除。 */
  remove(nodeId: string): void;
  /** 切换某个节点的选中态。 */
  toggle(nodeId: string): void;
  /** 清空当前选区。 */
  clear(): void;
  /** 如果当前选区中包含某个节点，则把它移出选区。 */
  clearIfContains(nodeId: string): void;
  /** 订阅选区变化。 */
  subscribe(listener: (selectedNodeIds: readonly string[]) => void): () => void;
}

/**
 * 创建 editor 的最小节点选区控制器。
 *
 * 当前实现刻意保持宿主无关逻辑很薄，只依赖主包已经暴露的
 * `setNodeSelected(...)`，这样可以让 editor 自己维护“选区语义”，
 * 同时复用主包节点壳现成的视觉反馈。
 */
export function createEditorNodeSelection(
  graph: LeaferGraph
): EditorNodeSelectionController {
  let selectedNodeIds: string[] = [];
  const listeners = new Set<(selectedNodeIds: readonly string[]) => void>();

  const syncNodeSelectedState = (nodeId: string, selected: boolean): void => {
    graph.setNodeSelected(nodeId, selected);
  };

  /**
   * 统一提交下一份选区快照，只同步真正发生变化的节点。
   * 这样后续把控制器扩展成多选，也不会引入多余的视觉重绘。
   */
  const commitSelection = (nextSelectedNodeIds: readonly string[]): void => {
    const uniqueNextSelectedNodeIds = Array.from(new Set(nextSelectedNodeIds));
    const prevSelectedNodeIdSet = new Set(selectedNodeIds);
    const nextSelectedNodeIdSet = new Set(uniqueNextSelectedNodeIds);

    for (const nodeId of selectedNodeIds) {
      if (!nextSelectedNodeIdSet.has(nodeId)) {
        syncNodeSelectedState(nodeId, false);
      }
    }

    for (const nodeId of uniqueNextSelectedNodeIds) {
      if (!prevSelectedNodeIdSet.has(nodeId)) {
        syncNodeSelectedState(nodeId, true);
      }
    }

    selectedNodeIds = [...uniqueNextSelectedNodeIds];

    for (const listener of listeners) {
      listener(selectedNodeIds);
    }
  };

  return {
    get primarySelectedNodeId(): string | null {
      return selectedNodeIds.at(-1) ?? null;
    },

    get selectedNodeId(): string | null {
      return this.primarySelectedNodeId;
    },

    get selectedNodeIds(): readonly string[] {
      return selectedNodeIds;
    },

    isSelected(nodeId: string): boolean {
      return selectedNodeIds.includes(nodeId);
    },

    hasMultipleSelected(): boolean {
      return selectedNodeIds.length > 1;
    },

    setMany(nodeIds: readonly string[]): void {
      commitSelection(nodeIds);
    },

    select(nodeId: string | null): void {
      commitSelection(nodeId ? [nodeId] : []);
    },

    add(nodeId: string): void {
      if (!nodeId) {
        return;
      }

      const nextSelectedNodeIds = selectedNodeIds.filter(
        (selectedNodeId) => selectedNodeId !== nodeId
      );
      nextSelectedNodeIds.push(nodeId);
      commitSelection(nextSelectedNodeIds);
    },

    remove(nodeId: string): void {
      if (!this.isSelected(nodeId)) {
        return;
      }

      commitSelection(
        selectedNodeIds.filter((selectedNodeId) => selectedNodeId !== nodeId)
      );
    },

    toggle(nodeId: string): void {
      if (this.isSelected(nodeId)) {
        this.remove(nodeId);
        return;
      }

      this.add(nodeId);
    },

    clear(): void {
      commitSelection([]);
    },

    clearIfContains(nodeId: string): void {
      if (this.isSelected(nodeId)) {
        this.remove(nodeId);
      }
    },

    subscribe(listener: (selectedNodeIds: readonly string[]) => void): () => void {
      listeners.add(listener);
      listener(selectedNodeIds);

      return () => {
        listeners.delete(listener);
      };
    }
  };
}
