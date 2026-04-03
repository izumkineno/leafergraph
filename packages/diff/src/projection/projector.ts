import type { GraphDocument, NodeSerializeResult } from "@leafergraph/node";
import type { GraphDocumentDiff, ApplyGraphDocumentDiffResult } from "../types";

/**
 * 运行时投影器配置。
 */
export interface DiffProjectorConfig {
  /** 是否启用快速路径优化。 */
  enableFastPath?: boolean;
  /** 是否收集受影响的节点和连线。 */
  collectAffected?: boolean;
}

/**
 * 运行时投影器上下文。
 */
export interface DiffProjectorContext {
  /** 当前文档。 */
  document: GraphDocument;
  /** 配置。 */
  config: DiffProjectorConfig;
  /** 受影响的节点 ID 集合。 */
  affectedNodeIds: Set<string>;
  /** 受影响的连线 ID 集合。 */
  affectedLinkIds: Set<string>;
}

/**
 * 运行时投影器。
 * 将 diff 增量投影到运行时视图。
 */
export class DiffProjector {
  private config: DiffProjectorConfig;
  
  constructor(config: DiffProjectorConfig = {}) {
    this.config = {
      enableFastPath: true,
      collectAffected: true,
      ...config
    };
  }
  
  /**
   * 投影 diff 到运行时。
   * 
   * @param document - 当前文档
   * @param diff - 文档差异
   * @returns 投影结果
   */
  project(
    document: GraphDocument,
    diff: GraphDocumentDiff
  ): ApplyGraphDocumentDiffResult {
    const context: DiffProjectorContext = {
      document: JSON.parse(JSON.stringify(document)), // 深拷贝
      config: this.config,
      affectedNodeIds: new Set(),
      affectedLinkIds: new Set()
    };
    
    try {
      // 验证文档 ID
      if (context.document.documentId !== diff.documentId) {
        return this.createFallback(
          document,
          "documentId 不匹配，必须回退到整图同步"
        );
      }
      
      // 验证基础版本
      if (context.document.revision !== diff.baseRevision) {
        return this.createFallback(
          document,
          "baseRevision 不匹配，必须回退到整图同步"
        );
      }
      
      // 应用操作
      for (const operation of diff.operations) {
        const result = this.applyOperation(context, operation);
        if (!result.success) {
          return this.createFallback(document, result.reason || "未知错误");
        }
      }
      
      // 应用字段变更
      for (const fieldChange of diff.fieldChanges) {
        const result = this.applyFieldChange(context, fieldChange);
        if (!result.success) {
          return this.createFallback(document, result.reason || "未知错误");
        }
      }
      
      // 更新版本
      context.document.revision = diff.revision;
      
      return {
        success: true,
        requiresFullReplace: false,
        document: context.document,
        affectedNodeIds: Array.from(context.affectedNodeIds),
        affectedLinkIds: Array.from(context.affectedLinkIds)
      };
    } catch (error) {
      return this.createFallback(
        document,
        error instanceof Error ? error.message : "投影 diff 时发生未知错误"
      );
    }
  }
  
  /**
   * 应用操作到上下文。
   */
  private applyOperation(
    context: DiffProjectorContext,
    operation: any
  ): { success: boolean; reason?: string } {
    try {
      switch (operation.type) {
        case "node.create":
          return this.applyNodeCreate(context, operation);
        case "node.update":
          return this.applyNodeUpdate(context, operation);
        case "node.move":
          return this.applyNodeMove(context, operation);
        case "node.resize":
          return this.applyNodeResize(context, operation);
        case "node.collapse":
          return this.applyNodeCollapse(context, operation);
        case "node.widget.value.set":
          return this.applyNodeWidgetValueSet(context, operation);
        case "node.remove":
          return this.applyNodeRemove(context, operation);
        case "link.create":
          return this.applyLinkCreate(context, operation);
        case "link.remove":
          return this.applyLinkRemove(context, operation);
        case "link.reconnect":
          return this.applyLinkReconnect(context, operation);
        case "document.update":
          return { success: true };
        default:
          return { 
            success: false, 
            reason: `未知操作类型: ${operation.type}`
          };
      }
    } catch (error) {
      return {
        success: false,
        reason: error instanceof Error ? error.message : "应用操作时发生未知错误"
      };
    }
  }
  
  /**
   * 应用字段变更到上下文。
   */
  private applyFieldChange(
    context: DiffProjectorContext,
    fieldChange: any
  ): { success: boolean; reason?: string } {
    try {
      const nodeIndex = context.document.nodes.findIndex(node => node.id === fieldChange.nodeId);
      if (nodeIndex === -1) {
        return { 
          success: false, 
          reason: `fieldChange 目标节点不存在: ${fieldChange.nodeId}`
        };
      }
      
      const node = context.document.nodes[nodeIndex];
      
      switch (fieldChange.type) {
        case "node.title.set":
          node.title = fieldChange.value;
          context.affectedNodeIds.add(fieldChange.nodeId);
          break;
        case "node.property.set":
          if (!node.properties) {
            node.properties = {};
          }
          node.properties[fieldChange.key] = fieldChange.value;
          context.affectedNodeIds.add(fieldChange.nodeId);
          break;
        case "node.property.unset":
          if (node.properties && fieldChange.key in node.properties) {
            delete node.properties[fieldChange.key];
            if (Object.keys(node.properties).length === 0) {
              delete node.properties;
            }
            context.affectedNodeIds.add(fieldChange.nodeId);
          }
          break;
        case "node.data.set":
          if (!node.data) {
            node.data = {};
          }
          node.data[fieldChange.key] = fieldChange.value;
          context.affectedNodeIds.add(fieldChange.nodeId);
          break;
        case "node.data.unset":
          if (node.data && fieldChange.key in node.data) {
            delete node.data[fieldChange.key];
            if (Object.keys(node.data).length === 0) {
              delete node.data;
            }
            context.affectedNodeIds.add(fieldChange.nodeId);
          }
          break;
        case "node.flag.set":
          if (!node.flags) {
            node.flags = {} as any;
          }
          (node.flags as any)[fieldChange.key] = fieldChange.value;
          context.affectedNodeIds.add(fieldChange.nodeId);
          break;
        case "node.widget.value.set":
          if (!node.widgets || !node.widgets[fieldChange.widgetIndex]) {
            return { 
              success: false, 
              reason: `node.widget.value.set 目标 widget 不存在: ${fieldChange.nodeId}#${fieldChange.widgetIndex}`
            };
          }
          node.widgets[fieldChange.widgetIndex].value = fieldChange.value;
          context.affectedNodeIds.add(fieldChange.nodeId);
          break;
        case "node.widget.replace":
          if (!node.widgets || fieldChange.widgetIndex < 0 || fieldChange.widgetIndex >= node.widgets.length) {
            return { 
              success: false, 
              reason: `node.widget.replace 目标 widget 不存在: ${fieldChange.nodeId}#${fieldChange.widgetIndex}`
            };
          }
          node.widgets[fieldChange.widgetIndex] = fieldChange.widget;
          context.affectedNodeIds.add(fieldChange.nodeId);
          break;
        case "node.widget.remove":
          if (!node.widgets || fieldChange.widgetIndex < 0 || fieldChange.widgetIndex >= node.widgets.length) {
            return { 
              success: false, 
              reason: `node.widget.remove 目标 widget 不存在: ${fieldChange.nodeId}#${fieldChange.widgetIndex}`
            };
          }
          node.widgets.splice(fieldChange.widgetIndex, 1);
          if (node.widgets.length === 0) {
            delete node.widgets;
          }
          context.affectedNodeIds.add(fieldChange.nodeId);
          break;
        default:
          return { 
            success: false, 
            reason: `未知字段变更类型: ${fieldChange.type}`
          };
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        reason: error instanceof Error ? error.message : "应用字段变更时发生未知错误"
      };
    }
  }
  
  /**
   * 应用节点创建操作。
   */
  private applyNodeCreate(
    context: DiffProjectorContext,
    operation: any
  ): { success: boolean; reason?: string } {
    const nodeId = operation.input.id;
    if (!nodeId) {
      return { 
        success: false, 
        reason: "node.create 缺少稳定节点 ID"
      };
    }
    
    // 检查节点是否已存在
    if (context.document.nodes.some(node => node.id === nodeId)) {
      return { 
        success: false, 
        reason: `节点已存在: ${nodeId}`
      };
    }
    
    // 创建节点
    const newNode: NodeSerializeResult = {
      id: nodeId,
      type: operation.input.type,
      layout: {
        x: operation.input.x,
        y: operation.input.y,
        width: operation.input.width,
        height: operation.input.height
      },
      ...(operation.input.title !== undefined ? { title: operation.input.title } : {}),
      ...(operation.input.properties !== undefined ? { properties: operation.input.properties } : {}),
      ...(operation.input.propertySpecs !== undefined ? { propertySpecs: operation.input.propertySpecs } : {}),
      ...(operation.input.inputs !== undefined ? { inputs: operation.input.inputs } : {}),
      ...(operation.input.outputs !== undefined ? { outputs: operation.input.outputs } : {}),
      ...(operation.input.widgets !== undefined ? { widgets: operation.input.widgets } : {}),
      ...(operation.input.data !== undefined ? { data: operation.input.data } : {}),
      ...(operation.input.flags !== undefined ? { flags: operation.input.flags } : {})
    };
    
    context.document.nodes.push(newNode);
    context.affectedNodeIds.add(nodeId);
    
    return { success: true };
  }
  
  /**
   * 应用节点更新操作。
   */
  private applyNodeUpdate(
    context: DiffProjectorContext,
    operation: any
  ): { success: boolean; reason?: string } {
    const nodeIndex = context.document.nodes.findIndex(node => node.id === operation.nodeId);
    if (nodeIndex === -1) {
      return { 
        success: false, 
        reason: `node.update 目标节点不存在: ${operation.nodeId}`
      };
    }
    
    const node = context.document.nodes[nodeIndex];
    const updatedNode = {
      ...node,
      ...(operation.input.title !== undefined ? { title: operation.input.title } : {}),
      layout: {
        ...node.layout,
        ...(operation.input.x !== undefined ? { x: operation.input.x } : {}),
        ...(operation.input.y !== undefined ? { y: operation.input.y } : {}),
        ...(operation.input.width !== undefined ? { width: operation.input.width } : {}),
        ...(operation.input.height !== undefined ? { height: operation.input.height } : {})
      },
      ...(operation.input.properties !== undefined ? { properties: operation.input.properties } : {}),
      ...(operation.input.propertySpecs !== undefined ? { propertySpecs: operation.input.propertySpecs } : {}),
      ...(operation.input.inputs !== undefined ? { inputs: operation.input.inputs } : {}),
      ...(operation.input.outputs !== undefined ? { outputs: operation.input.outputs } : {}),
      ...(operation.input.widgets !== undefined ? { widgets: operation.input.widgets } : {}),
      ...(operation.input.data !== undefined ? { data: operation.input.data } : {}),
      ...(operation.input.flags !== undefined ? { flags: operation.input.flags } : {})
    };
    
    context.document.nodes[nodeIndex] = updatedNode;
    context.affectedNodeIds.add(operation.nodeId);
    
    return { success: true };
  }
  
  /**
   * 应用节点移动操作。
   */
  private applyNodeMove(
    context: DiffProjectorContext,
    operation: any
  ): { success: boolean; reason?: string } {
    const nodeIndex = context.document.nodes.findIndex(node => node.id === operation.nodeId);
    if (nodeIndex === -1) {
      return { 
        success: false, 
        reason: `node.move 目标节点不存在: ${operation.nodeId}`
      };
    }
    
    const node = context.document.nodes[nodeIndex];
    node.layout.x = operation.input.x;
    node.layout.y = operation.input.y;
    context.affectedNodeIds.add(operation.nodeId);
    
    return { success: true };
  }
  
  /**
   * 应用节点缩放操作。
   */
  private applyNodeResize(
    context: DiffProjectorContext,
    operation: any
  ): { success: boolean; reason?: string } {
    const nodeIndex = context.document.nodes.findIndex(node => node.id === operation.nodeId);
    if (nodeIndex === -1) {
      return { 
        success: false, 
        reason: `node.resize 目标节点不存在: ${operation.nodeId}`
      };
    }
    
    const node = context.document.nodes[nodeIndex];
    node.layout.width = operation.input.width;
    node.layout.height = operation.input.height;
    context.affectedNodeIds.add(operation.nodeId);
    
    return { success: true };
  }
  
  /**
   * 应用节点折叠操作。
   */
  private applyNodeCollapse(
    context: DiffProjectorContext,
    operation: any
  ): { success: boolean; reason?: string } {
    const nodeIndex = context.document.nodes.findIndex(node => node.id === operation.nodeId);
    if (nodeIndex === -1) {
      return { 
        success: false, 
        reason: `node.collapse 目标节点不存在: ${operation.nodeId}`
      };
    }
    
    const node = context.document.nodes[nodeIndex];
    if (!node.flags) {
      node.flags = {};
    }
    
    if (operation.collapsed) {
      node.flags.collapsed = true;
    } else {
      delete node.flags.collapsed;
      if (Object.keys(node.flags).length === 0) {
        delete node.flags;
      }
    }
    
    context.affectedNodeIds.add(operation.nodeId);
    
    return { success: true };
  }
  
  /**
   * 应用节点 Widget 值设置操作。
   */
  private applyNodeWidgetValueSet(
    context: DiffProjectorContext,
    operation: any
  ): { success: boolean; reason?: string } {
    const nodeIndex = context.document.nodes.findIndex(node => node.id === operation.nodeId);
    if (nodeIndex === -1) {
      return { 
        success: false, 
        reason: `node.widget.value.set 目标节点不存在: ${operation.nodeId}`
      };
    }
    
    const node = context.document.nodes[nodeIndex];
    if (!node.widgets || !node.widgets[operation.widgetIndex]) {
      return { 
        success: false, 
        reason: `node.widget.value.set 目标 widget 不存在: ${operation.nodeId}#${operation.widgetIndex}`
      };
    }
    
    node.widgets[operation.widgetIndex].value = operation.value;
    context.affectedNodeIds.add(operation.nodeId);
    
    return { success: true };
  }
  
  /**
   * 应用节点删除操作。
   */
  private applyNodeRemove(
    context: DiffProjectorContext,
    operation: any
  ): { success: boolean; reason?: string } {
    const nodeIndex = context.document.nodes.findIndex(node => node.id === operation.nodeId);
    if (nodeIndex === -1) {
      return { 
        success: false, 
        reason: `node.remove 目标节点不存在: ${operation.nodeId}`
      };
    }
    
    // 删除节点
    context.document.nodes.splice(nodeIndex, 1);
    context.affectedNodeIds.add(operation.nodeId);
    
    // 删除关联的连线
    const affectedLinkIds = context.document.links
      .filter(link => link.source.nodeId === operation.nodeId || link.target.nodeId === operation.nodeId)
      .map(link => link.id);
    
    context.document.links = context.document.links.filter(
      link => link.source.nodeId !== operation.nodeId && link.target.nodeId !== operation.nodeId
    );
    
    affectedLinkIds.forEach(id => context.affectedLinkIds.add(id));
    
    return { success: true };
  }
  
  /**
   * 应用连线创建操作。
   */
  private applyLinkCreate(
    context: DiffProjectorContext,
    operation: any
  ): { success: boolean; reason?: string } {
    const linkId = operation.input.id;
    if (!linkId) {
      return { 
        success: false, 
        reason: "link.create 缺少稳定连线 ID"
      };
    }
    
    // 检查连线是否已存在
    if (context.document.links.some(link => link.id === linkId)) {
      return { 
        success: false, 
        reason: `连线已存在: ${linkId}`
      };
    }
    
    // 检查源节点和目标节点是否存在
    if (!context.document.nodes.some(node => node.id === operation.input.source.nodeId)) {
      return { 
        success: false, 
        reason: `源节点不存在: ${operation.input.source.nodeId}`
      };
    }
    
    if (!context.document.nodes.some(node => node.id === operation.input.target.nodeId)) {
      return { 
        success: false, 
        reason: `目标节点不存在: ${operation.input.target.nodeId}`
      };
    }
    
    // 创建连线
    const newLink = {
      id: linkId,
      source: operation.input.source,
      target: operation.input.target,
      ...(operation.input.label !== undefined ? { label: operation.input.label } : {}),
      ...(operation.input.data !== undefined ? { data: operation.input.data } : {})
    };
    
    context.document.links.push(newLink);
    context.affectedLinkIds.add(linkId);
    context.affectedNodeIds.add(operation.input.source.nodeId);
    context.affectedNodeIds.add(operation.input.target.nodeId);
    
    return { success: true };
  }
  
  /**
   * 应用连线删除操作。
   */
  private applyLinkRemove(
    context: DiffProjectorContext,
    operation: any
  ): { success: boolean; reason?: string } {
    const linkIndex = context.document.links.findIndex(link => link.id === operation.linkId);
    if (linkIndex === -1) {
      return { 
        success: false, 
        reason: `link.remove 目标连线不存在: ${operation.linkId}`
      };
    }
    
    // 删除连线
    context.document.links.splice(linkIndex, 1);
    context.affectedLinkIds.add(operation.linkId);
    
    return { success: true };
  }
  
  /**
   * 应用连线重连操作。
   */
  private applyLinkReconnect(
    context: DiffProjectorContext,
    operation: any
  ): { success: boolean; reason?: string } {
    const linkIndex = context.document.links.findIndex(link => link.id === operation.linkId);
    if (linkIndex === -1) {
      return { 
        success: false, 
        reason: `link.reconnect 目标连线不存在: ${operation.linkId}`
      };
    }
    
    const link = context.document.links[linkIndex];
    const oldSourceNodeId = link.source.nodeId;
    const oldTargetNodeId = link.target.nodeId;
    
    // 更新连线
    if (operation.input.source) {
      // 检查源节点是否存在
      if (!context.document.nodes.some(node => node.id === operation.input.source.nodeId)) {
        return { 
          success: false, 
          reason: `源节点不存在: ${operation.input.source.nodeId}`
        };
      }
      link.source = operation.input.source;
    }
    
    if (operation.input.target) {
      // 检查目标节点是否存在
      if (!context.document.nodes.some(node => node.id === operation.input.target.nodeId)) {
        return { 
          success: false, 
          reason: `目标节点不存在: ${operation.input.target.nodeId}`
        };
      }
      link.target = operation.input.target;
    }
    
    const newSourceNodeId = link.source.nodeId;
    const newTargetNodeId = link.target.nodeId;
    
    // 收集受影响的节点
    context.affectedLinkIds.add(operation.linkId);
    context.affectedNodeIds.add(oldSourceNodeId);
    context.affectedNodeIds.add(oldTargetNodeId);
    context.affectedNodeIds.add(newSourceNodeId);
    context.affectedNodeIds.add(newTargetNodeId);
    
    return { success: true };
  }
  
  /**
   * 创建回退结果。
   */
  private createFallback(
    document: GraphDocument,
    reason: string
  ): ApplyGraphDocumentDiffResult {
    return {
      success: false,
      requiresFullReplace: true,
      document,
      affectedNodeIds: [],
      affectedLinkIds: [],
      reason
    };
  }
}
