import type { GraphDocument, NodeSerializeResult } from "@leafergraph/node";
import type { BatchResult } from "../types";

/**
 * Find 更新器。
 * 支持按 ID、路径、条件等方式查找和更新节点。
 */
export class FindUpdater {
  private document: GraphDocument;
  
  constructor(document: GraphDocument) {
    this.document = document;
  }
  
  /**
   * 按 ID 查找节点。
   * 
   * @param id - 节点 ID
   * @returns 找到的节点或 undefined
   */
  findById(id: string): NodeSerializeResult | undefined {
    return this.document.nodes.find(node => node.id === id);
  }
  
  /**
   * 按路径查找节点。
   * 路径格式：nodes[index] 或 nodes[id]
   * 
   * @param path - 节点路径
   * @returns 找到的节点或 undefined
   */
  findByPath(path: string): NodeSerializeResult | undefined {
    const parts = path.split('.');
    if (parts[0] !== 'nodes') {
      return undefined;
    }
    
    const identifier = parts[1];
    if (!identifier) {
      return undefined;
    }
    
    if (!isNaN(Number(identifier))) {
      // 按索引查找
      const index = Number(identifier);
      return this.document.nodes[index];
    } else {
      // 按 ID 查找
      return this.findById(identifier);
    }
  }
  
  /**
   * 按条件查找节点。
   * 
   * @param condition - 查找条件
   * @returns 找到的节点或 undefined
   */
  findByCondition(condition: (node: NodeSerializeResult) => boolean): NodeSerializeResult | undefined {
    return this.document.nodes.find(condition);
  }
  
  /**
   * 按条件查找所有匹配的节点。
   * 
   * @param condition - 查找条件
   * @returns 找到的节点数组
   */
  findAllByCondition(condition: (node: NodeSerializeResult) => boolean): NodeSerializeResult[] {
    return this.document.nodes.filter(condition);
  }
  
  /**
   * 按 ID 更新节点。
   * 
   * @param id - 节点 ID
   * @param changes - 变更内容
   * @returns 是否更新成功
   */
  updateById(id: string, changes: Partial<NodeSerializeResult>): boolean {
    const nodeIndex = this.document.nodes.findIndex(node => node.id === id);
    if (nodeIndex === -1) {
      return false;
    }
    
    const node = this.document.nodes[nodeIndex];
    this.document.nodes[nodeIndex] = {
      ...node,
      ...changes,
      ...(changes.layout ? { 
        layout: {
          ...node.layout,
          ...changes.layout
        }
      } : {})
    };
    
    return true;
  }
  
  /**
   * 按路径更新节点。
   * 
   * @param path - 节点路径
   * @param changes - 变更内容
   * @returns 是否更新成功
   */
  updateByPath(path: string, changes: Partial<NodeSerializeResult>): boolean {
    const parts = path.split('.');
    if (parts[0] !== 'nodes') {
      return false;
    }
    
    const identifier = parts[1];
    if (!identifier) {
      return false;
    }
    
    if (!isNaN(Number(identifier))) {
      // 按索引更新
      const index = Number(identifier);
      if (index < 0 || index >= this.document.nodes.length) {
        return false;
      }
      
      const node = this.document.nodes[index];
      this.document.nodes[index] = {
        ...node,
        ...changes,
        ...(changes.layout ? { 
          layout: {
            ...node.layout,
            ...changes.layout
          }
        } : {})
      };
    } else {
      // 按 ID 更新
      return this.updateById(identifier, changes);
    }
    
    return true;
  }
  
  /**
   * 按条件更新节点。
   * 
   * @param condition - 查找条件
   * @param changes - 变更内容
   * @returns 成功更新的节点数量
   */
  updateByCondition(condition: (node: NodeSerializeResult) => boolean, changes: Partial<NodeSerializeResult>): number {
    let count = 0;
    
    for (let i = 0; i < this.document.nodes.length; i++) {
      const node = this.document.nodes[i];
      if (condition(node)) {
        this.document.nodes[i] = {
          ...node,
          ...changes,
          ...(changes.layout ? { 
            layout: {
              ...node.layout,
              ...changes.layout
            }
          } : {})
        };
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * 批量更新节点。
   * 
   * @param updates - 更新操作数组
   * @returns 批处理结果
   */
  batchUpdate(updates: Array<{ id: string; changes: Partial<NodeSerializeResult> }>): BatchResult {
    const failures: Array<{ id: string; error: string }> = [];
    let successCount = 0;
    
    for (const update of updates) {
      if (this.updateById(update.id, update.changes)) {
        successCount++;
      } else {
        failures.push({ 
          id: update.id, 
          error: `节点不存在: ${update.id}` 
        });
      }
    }
    
    return {
      successCount,
      failureCount: failures.length,
      failures
    };
  }
  
  /**
   * 查找并更新节点的属性。
   * 
   * @param nodeId - 节点 ID
   * @param key - 属性键
   * @param value - 属性值
   * @returns 是否更新成功
   */
  setNodeProperty(nodeId: string, key: string, value: any): boolean {
    const node = this.findById(nodeId);
    if (!node) {
      return false;
    }
    
    if (!node.properties) {
      node.properties = {};
    }
    node.properties[key] = value;
    
    return true;
  }
  
  /**
   * 查找并更新节点的数据。
   * 
   * @param nodeId - 节点 ID
   * @param key - 数据键
   * @param value - 数据值
   * @returns 是否更新成功
   */
  setNodeData(nodeId: string, key: string, value: any): boolean {
    const node = this.findById(nodeId);
    if (!node) {
      return false;
    }
    
    if (!node.data) {
      node.data = {};
    }
    node.data[key] = value;
    
    return true;
  }
  
  /**
   * 查找并更新节点的标志。
   * 
   * @param nodeId - 节点 ID
   * @param key - 标志键
   * @param value - 标志值
   * @returns 是否更新成功
   */
  setNodeFlag(nodeId: string, key: string, value: boolean): boolean {
    const node = this.findById(nodeId);
    if (!node) {
      return false;
    }
    
    if (!node.flags) {
      node.flags = {} as any;
    }
    (node.flags as any)[key] = value;
    
    return true;
  }
  
  /**
   * 查找并更新节点的 Widget 值。
   * 
   * @param nodeId - 节点 ID
   * @param widgetIndex - Widget 索引
   * @param value - Widget 值
   * @returns 是否更新成功
   */
  setNodeWidgetValue(nodeId: string, widgetIndex: number, value: any): boolean {
    const node = this.findById(nodeId);
    if (!node || !node.widgets || !node.widgets[widgetIndex]) {
      return false;
    }
    
    node.widgets[widgetIndex].value = value;
    
    return true;
  }
  
  /**
   * 查找并替换节点的 Widget。
   * 
   * @param nodeId - 节点 ID
   * @param widgetIndex - Widget 索引
   * @param widget - 新的 Widget
   * @returns 是否更新成功
   */
  replaceNodeWidget(nodeId: string, widgetIndex: number, widget: any): boolean {
    const node = this.findById(nodeId);
    if (!node || !node.widgets || widgetIndex < 0 || widgetIndex >= node.widgets.length) {
      return false;
    }
    
    node.widgets[widgetIndex] = widget;
    
    return true;
  }
  
  /**
   * 查找并删除节点的 Widget。
   * 
   * @param nodeId - 节点 ID
   * @param widgetIndex - Widget 索引
   * @returns 是否删除成功
   */
  removeNodeWidget(nodeId: string, widgetIndex: number): boolean {
    const node = this.findById(nodeId);
    if (!node || !node.widgets || widgetIndex < 0 || widgetIndex >= node.widgets.length) {
      return false;
    }
    
    node.widgets.splice(widgetIndex, 1);
    if (node.widgets.length === 0) {
      delete node.widgets;
    }
    
    return true;
  }
}
