/**
 * 节点 flag 工具模块。
 *
 * @remarks
 * 负责 editor 在复制、序列化和恢复节点时对 flag 字段做最小清洗与规范化。
 */
import type { NodeFlags } from "@leafergraph/node";

/**
 * 去掉不应进入正式文档/粘贴快照的瞬时 editor 选中态。
 *
 * @remarks
 * `selected` 只属于当前视口交互状态，不应该随着复制、粘贴、
 * duplicate、history restore 或 authority 文档同步一起持久化。
 */
export function sanitizePersistedNodeFlags(
  flags: NodeFlags | undefined
): NodeFlags | undefined {
  if (!flags) {
    return undefined;
  }

  const nextFlags = structuredClone(flags);
  delete nextFlags.selected;
  return Object.keys(nextFlags).length ? nextFlags : undefined;
}
