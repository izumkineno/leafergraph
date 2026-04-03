import type { GraphDocument, NodeSerializeResult } from "@leafergraph/node";

/**
 * 深度克隆对象。
 * 
 * @param obj - 要克隆的对象
 * @returns 克隆后的对象
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 生成唯一 ID。
 * 
 * @param prefix - ID 前缀
 * @returns 唯一 ID
 */
export function generateId(prefix: string = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 检查两个对象是否深度相等。
 * 
 * @param a - 第一个对象
 * @param b - 第二个对象
 * @returns 是否相等
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  
  if (typeof a === "object") {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    
    if (!Array.isArray(a) && !Array.isArray(b)) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      for (const key of keysA) {
        if (!keysB.includes(key) || !deepEqual(a[key], b[key])) return false;
      }
      return true;
    }
    
    return false;
  }
  
  return false;
}

/**
 * 从文档中查找节点。
 * 
 * @param document - 文档
 * @param nodeId - 节点 ID
 * @returns 找到的节点或 undefined
 */
export function findNodeById(document: GraphDocument, nodeId: string): NodeSerializeResult | undefined {
  return document.nodes.find(node => node.id === nodeId);
}

/**
 * 从文档中查找连线。
 * 
 * @param document - 文档
 * @param linkId - 连线 ID
 * @returns 找到的连线或 undefined
 */
export function findLinkById(document: GraphDocument, linkId: string): any | undefined {
  return document.links.find(link => link.id === linkId);
}

/**
 * 验证文档结构。
 * 
 * @param document - 文档
 * @returns 是否有效
 */
export function validateDocument(document: GraphDocument): boolean {
  if (!document || typeof document !== "object") return false;
  if (!document.documentId || typeof document.documentId !== "string") return false;
  if (typeof document.revision !== "number") return false;
  if (!Array.isArray(document.nodes)) return false;
  if (!Array.isArray(document.links)) return false;
  
  // 检查节点 ID 唯一性
  const nodeIds = new Set<string>();
  for (const node of document.nodes) {
    if (!node.id || typeof node.id !== "string") return false;
    if (nodeIds.has(node.id)) return false;
    nodeIds.add(node.id);
  }
  
  // 检查连线 ID 唯一性
  const linkIds = new Set<string>();
  for (const link of document.links) {
    if (!link.id || typeof link.id !== "string") return false;
    if (linkIds.has(link.id)) return false;
    linkIds.add(link.id);
  }
  
  return true;
}

/**
 * 合并两个文档。
 * 
 * @param base - 基础文档
 * @param update - 更新文档
 * @returns 合并后的文档
 */
export function mergeDocuments(base: GraphDocument, update: GraphDocument): GraphDocument {
  const merged: GraphDocument = {
    ...base,
    ...update,
    nodes: [...(base.nodes || []), ...(update.nodes || [])],
    links: [...(base.links || []), ...(update.links || [])]
  };
  
  // 去重节点
  const nodeMap = new Map<string, any>();
  for (const node of merged.nodes) {
    nodeMap.set(node.id, node);
  }
  merged.nodes = Array.from(nodeMap.values());
  
  // 去重连线
  const linkMap = new Map<string, any>();
  for (const link of merged.links) {
    linkMap.set(link.id, link);
  }
  merged.links = Array.from(linkMap.values());
  
  return merged;
}
