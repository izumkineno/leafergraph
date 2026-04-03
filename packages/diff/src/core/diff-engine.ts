import type { GraphDocument, NodeSerializeResult } from "@leafergraph/node";
import type { GraphOperation } from "@leafergraph/contracts";
import type { GraphDocumentDiff, ApplyGraphDocumentDiffResult, GraphDocumentFieldChange } from "../types";

/**
 * 核心 diff 引擎。
 */
export class DiffEngine {
  /**
   * 计算两个文档之间的差异。
   * 
   * @param oldDocument - 旧文档
   * @param newDocument - 新文档
   * @param options - 差异计算选项
   * @returns 文档差异
   */
  computeDiff(
    oldDocument: GraphDocument,
    newDocument: GraphDocument
  ): GraphDocumentDiff {
    const operations: GraphOperation[] = [];
    const fieldChanges: GraphDocumentFieldChange[] = [];
    
    // 计算节点差异
    this.computeNodesDiff(oldDocument, newDocument, operations, fieldChanges);
    
    // 计算连线差异
    this.computeLinksDiff(oldDocument, newDocument, operations);
    
    return {
      documentId: newDocument.documentId || "",
      baseRevision: oldDocument.revision || 0,
      revision: newDocument.revision || 0,
      emittedAt: Date.now(),
      operations,
      fieldChanges
    };
  }
  
  /**
   * 应用差异到文档。
   * 
   * @param currentDocument - 当前文档
   * @param diff - 文档差异
   * @returns 应用结果
   */
  applyDiff(
    currentDocument: GraphDocument,
    diff: GraphDocumentDiff
  ): ApplyGraphDocumentDiffResult {
    try {
      // 验证文档 ID
      if (currentDocument.documentId !== diff.documentId) {
        return {
          success: false,
          requiresFullReplace: true,
          document: currentDocument,
          affectedNodeIds: [],
          affectedLinkIds: [],
          reason: "documentId 不匹配，必须回退到整图同步"
        };
      }
      
      // 验证基础版本
      if (currentDocument.revision !== diff.baseRevision) {
        return {
          success: false,
          requiresFullReplace: true,
          document: currentDocument,
          affectedNodeIds: [],
          affectedLinkIds: [],
          reason: "baseRevision 不匹配，必须回退到整图同步"
        };
      }
      
      // 克隆当前文档
      const nextDocument = this.cloneDocument(currentDocument);
      const affectedNodeIds = new Set<string>();
      const affectedLinkIds = new Set<string>();
      
      // 应用操作
      for (const operation of diff.operations) {
        const result = this.applyOperation(nextDocument, operation);
        if (!result.success) {
          return {
            success: false,
            requiresFullReplace: true,
            document: currentDocument,
            affectedNodeIds: [],
            affectedLinkIds: [],
            reason: result.reason
          };
        }
        
        result.affectedNodeIds.forEach(id => affectedNodeIds.add(id));
        result.affectedLinkIds.forEach(id => affectedLinkIds.add(id));
      }
      
      // 应用字段变更
      for (const fieldChange of diff.fieldChanges) {
        const result = this.applyFieldChange(nextDocument, fieldChange);
        if (!result.success) {
          return {
            success: false,
            requiresFullReplace: true,
            document: currentDocument,
            affectedNodeIds: [],
            affectedLinkIds: [],
            reason: result.reason
          };
        }
        
        result.affectedNodeIds.forEach(id => affectedNodeIds.add(id));
      }
      
      // 更新版本
      nextDocument.revision = diff.revision;
      
      return {
        success: true,
        requiresFullReplace: false,
        document: nextDocument,
        affectedNodeIds: Array.from(affectedNodeIds),
        affectedLinkIds: Array.from(affectedLinkIds)
      };
    } catch (error) {
      return {
        success: false,
        requiresFullReplace: true,
        document: currentDocument,
        affectedNodeIds: [],
        affectedLinkIds: [],
        reason: error instanceof Error ? error.message : "应用差异时发生未知错误"
      };
    }
  }
  
  /**
   * 计算节点差异。
   */
  private computeNodesDiff(
    oldDocument: GraphDocument,
    newDocument: GraphDocument,
    operations: GraphOperation[],
    fieldChanges: GraphDocumentFieldChange[]
  ): void {
    const oldNodesMap = new Map(oldDocument.nodes.map(node => [node.id, node]));
    const newNodesMap = new Map(newDocument.nodes.map(node => [node.id, node]));
    
    // 检测新增和更新的节点
    for (const [nodeId, newNode] of newNodesMap) {
      const oldNode = oldNodesMap.get(nodeId);
      if (!oldNode) {
        // 新增节点
        operations.push({
          operationId: `node.create:${nodeId}:${Date.now()}`,
          timestamp: Date.now(),
          source: "diff.engine",
          type: "node.create",
          input: {
            id: nodeId,
            type: newNode.type,
            title: newNode.title,
            x: newNode.layout.x,
            y: newNode.layout.y,
            width: newNode.layout.width,
            height: newNode.layout.height,
            properties: newNode.properties,
            propertySpecs: newNode.propertySpecs,
            inputs: newNode.inputs,
            outputs: newNode.outputs,
            widgets: newNode.widgets,
            data: newNode.data,
            flags: newNode.flags
          }
        });
      } else {
        // 更新节点
        this.computeNodeChanges(oldNode, newNode, operations, fieldChanges);
      }
    }
    
    // 检测删除的节点
    for (const [nodeId] of oldNodesMap) {
      if (!newNodesMap.has(nodeId)) {
        operations.push({
          operationId: `node.remove:${nodeId}:${Date.now()}`,
          timestamp: Date.now(),
          source: "diff.engine",
          type: "node.remove",
          nodeId
        });
      }
    }
  }
  
  /**
   * 计算连线差异。
   */
  private computeLinksDiff(
    oldDocument: GraphDocument,
    newDocument: GraphDocument,
    operations: GraphOperation[]
  ): void {
    const oldLinksMap = new Map(oldDocument.links.map(link => [link.id, link]));
    const newLinksMap = new Map(newDocument.links.map(link => [link.id, link]));
    
    // 检测新增和更新的连线
    for (const [linkId, newLink] of newLinksMap) {
      if (!oldLinksMap.get(linkId)) {
        // 新增连线
        operations.push({
          operationId: `link.create:${linkId}:${Date.now()}`,
          timestamp: Date.now(),
          source: "diff.engine",
          type: "link.create",
          input: {
            id: linkId,
            source: newLink.source,
            target: newLink.target,
            label: newLink.label,
            data: newLink.data
          }
        });
      } else {
        // 检查连线是否需要更新
        const oldLink = oldLinksMap.get(linkId);
        if (oldLink && (JSON.stringify(oldLink.source) !== JSON.stringify(newLink.source) ||
            JSON.stringify(oldLink.target) !== JSON.stringify(newLink.target))) {
          operations.push({
            operationId: `link.reconnect:${linkId}:${Date.now()}`,
            timestamp: Date.now(),
            source: "diff.engine",
            type: "link.reconnect",
            linkId,
            input: {
              source: newLink.source,
              target: newLink.target
            }
          });
        }
      }
    }
    
    // 检测删除的连线
    for (const [linkId] of oldLinksMap) {
      if (!newLinksMap.has(linkId)) {
        operations.push({
          operationId: `link.remove:${linkId}:${Date.now()}`,
          timestamp: Date.now(),
          source: "diff.engine",
          type: "link.remove",
          linkId
        });
      }
    }
  }
  
  /**
   * 计算单个节点的变更。
   */
  private computeNodeChanges(
    oldNode: NodeSerializeResult,
    newNode: NodeSerializeResult,
    operations: GraphOperation[],
    fieldChanges: GraphDocumentFieldChange[]
  ): void {
    // 检查标题变更
    if (oldNode.title !== newNode.title) {
      fieldChanges.push({
        type: "node.title.set",
        nodeId: oldNode.id,
        value: newNode.title || ""
      });
    }
    
    // 检查位置变更
    if (oldNode.layout.x !== newNode.layout.x || oldNode.layout.y !== newNode.layout.y) {
      operations.push({
        operationId: `node.move:${oldNode.id}:${Date.now()}`,
        timestamp: Date.now(),
        source: "diff.engine",
        type: "node.move",
        nodeId: oldNode.id,
        input: {
          x: newNode.layout.x,
          y: newNode.layout.y
        }
      });
    }
    
    // 检查尺寸变更
    if (oldNode.layout.width !== newNode.layout.width || oldNode.layout.height !== newNode.layout.height) {
      operations.push({
        operationId: `node.resize:${oldNode.id}:${Date.now()}`,
        timestamp: Date.now(),
        source: "diff.engine",
        type: "node.resize",
        nodeId: oldNode.id,
        input: {
          width: Number(newNode.layout.width) || 0,
          height: Number(newNode.layout.height) || 0
        }
      });
    }
    
    // 检查属性变更
    this.computePropertyChanges(oldNode, newNode, fieldChanges);
    
    // 检查数据变更
    this.computeDataChanges(oldNode, newNode, fieldChanges);
    
    // 检查标志变更
    this.computeFlagChanges(oldNode, newNode, fieldChanges);
    
    // 检查 Widget 变更
    this.computeWidgetChanges(oldNode, newNode, fieldChanges);
  }
  
  /**
   * 计算属性变更。
   */
  private computePropertyChanges(
    oldNode: NodeSerializeResult,
    newNode: NodeSerializeResult,
    fieldChanges: GraphDocumentFieldChange[]
  ): void {
    const oldProps = oldNode.properties || {};
    const newProps = newNode.properties || {};
    
    // 检查新增和更新的属性
    for (const [key, value] of Object.entries(newProps)) {
      if (oldProps[key] !== value) {
        fieldChanges.push({
          type: "node.property.set",
          nodeId: oldNode.id,
          key,
          value
        });
      }
    }
    
    // 检查删除的属性
    for (const key of Object.keys(oldProps)) {
      if (!(key in newProps)) {
        fieldChanges.push({
          type: "node.property.unset",
          nodeId: oldNode.id,
          key
        });
      }
    }
  }
  
  /**
   * 计算数据变更。
   */
  private computeDataChanges(
    oldNode: NodeSerializeResult,
    newNode: NodeSerializeResult,
    fieldChanges: GraphDocumentFieldChange[]
  ): void {
    const oldData = oldNode.data || {};
    const newData = newNode.data || {};
    
    // 检查新增和更新的数据
    for (const [key, value] of Object.entries(newData)) {
      if (oldData[key] !== value) {
        fieldChanges.push({
          type: "node.data.set",
          nodeId: oldNode.id,
          key,
          value
        });
      }
    }
    
    // 检查删除的数据
    for (const key of Object.keys(oldData)) {
      if (!(key in newData)) {
        fieldChanges.push({
          type: "node.data.unset",
          nodeId: oldNode.id,
          key
        });
      }
    }
  }
  
  /**
   * 计算标志变更。
   */
  private computeFlagChanges(
    oldNode: NodeSerializeResult,
    newNode: NodeSerializeResult,
    fieldChanges: GraphDocumentFieldChange[]
  ): void {
    const oldFlags = oldNode.flags || {};
    const newFlags = newNode.flags || {};
    
    // 检查新增和更新的标志
    for (const [key, value] of Object.entries(newFlags)) {
      if ((oldFlags as any)[key] !== value) {
        fieldChanges.push({
          type: "node.flag.set",
          nodeId: oldNode.id,
          key,
          value: Boolean(value)
        });
      }
    }
  }
  
  /**
   * 计算 Widget 变更。
   */
  private computeWidgetChanges(
    oldNode: NodeSerializeResult,
    newNode: NodeSerializeResult,
    fieldChanges: GraphDocumentFieldChange[]
  ): void {
    const oldWidgets = oldNode.widgets || [];
    const newWidgets = newNode.widgets || [];
    
    // 检查 Widget 变更
    for (let i = 0; i < Math.max(oldWidgets.length, newWidgets.length); i++) {
      const oldWidget = oldWidgets[i];
      const newWidget = newWidgets[i];
      
      if (!oldWidget && newWidget) {
        // 新增 Widget（需要通过 node.update 操作）
      } else if (oldWidget && !newWidget) {
        // 删除 Widget
        fieldChanges.push({
          type: "node.widget.remove",
          nodeId: oldNode.id,
          widgetIndex: i
        });
      } else if (oldWidget && newWidget) {
        // 更新 Widget 值
        if (oldWidget.value !== newWidget.value) {
          fieldChanges.push({
            type: "node.widget.value.set",
            nodeId: oldNode.id,
            widgetIndex: i,
            value: newWidget.value
          });
        }
        
        // 检查 Widget 其他属性变更
        if (JSON.stringify(oldWidget) !== JSON.stringify(newWidget)) {
          fieldChanges.push({
            type: "node.widget.replace",
            nodeId: oldNode.id,
            widgetIndex: i,
            widget: newWidget
          });
        }
      }
    }
  }
  
  /**
   * 应用操作到文档。
   */
  private applyOperation(
    document: GraphDocument,
    operation: GraphOperation
  ): { success: boolean; affectedNodeIds: string[]; affectedLinkIds: string[]; reason?: string } {
    try {
      switch (operation.type) {
        case "node.create":
          return this.applyNodeCreate(document, operation);
        case "node.update":
          return this.applyNodeUpdate(document, operation);
        case "node.move":
          return this.applyNodeMove(document, operation);
        case "node.resize":
          return this.applyNodeResize(document, operation);
        case "node.collapse":
          return this.applyNodeCollapse(document, operation);
        case "node.widget.value.set":
          return this.applyNodeWidgetValueSet(document, operation);
        case "node.remove":
          return this.applyNodeRemove(document, operation);
        case "link.create":
          return this.applyLinkCreate(document, operation);
        case "link.remove":
          return this.applyLinkRemove(document, operation);
        case "link.reconnect":
          return this.applyLinkReconnect(document, operation);
        case "document.update":
          return { success: true, affectedNodeIds: [], affectedLinkIds: [] };
        default:
          return { 
            success: false, 
            affectedNodeIds: [], 
            affectedLinkIds: [],
            reason: `未知操作类型: ${(operation as any).type}`
          };
      }
    } catch (error) {
      return {
        success: false,
        affectedNodeIds: [],
        affectedLinkIds: [],
        reason: error instanceof Error ? error.message : "应用操作时发生未知错误"
      };
    }
  }
  
  /**
   * 应用节点创建操作。
   */
  private applyNodeCreate(
    document: GraphDocument,
    operation: any
  ): { success: boolean; affectedNodeIds: string[]; affectedLinkIds: string[]; reason?: string }
  {
    const nodeId = operation.input.id;
    if (!nodeId) {
      return { 
        success: false, 
        affectedNodeIds: [], 
        affectedLinkIds: [],
        reason: "node.create 缺少稳定节点 ID"
      };
    }
    
    // 检查节点是否已存在
    if (document.nodes.some(node => node.id === nodeId)) {
      return { 
        success: false, 
        affectedNodeIds: [], 
        affectedLinkIds: [],
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
    
    document.nodes.push(newNode);
    
    return {
      success: true,
      affectedNodeIds: [nodeId],
      affectedLinkIds: []
    };
  }
  
  /**
   * 应用节点更新操作。
   */
  private applyNodeUpdate(
    document: GraphDocument,
    operation: any
  ): { success: boolean; affectedNodeIds: string[]; affectedLinkIds: string[]; reason?: string }
  {
    const nodeIndex = document.nodes.findIndex(node => node.id === operation.nodeId);
    if (nodeIndex === -1) {
      return { 
        success: false, 
        affectedNodeIds: [], 
        affectedLinkIds: [],
        reason: `node.update 目标节点不存在: ${operation.nodeId}`
      };
    }
    
    const node = document.nodes[nodeIndex];
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
    
    document.nodes[nodeIndex] = updatedNode;
    
    return {
      success: true,
      affectedNodeIds: [operation.nodeId],
      affectedLinkIds: []
    };
  }
  
  /**
   * 应用节点移动操作。
   */
  private applyNodeMove(
    document: GraphDocument,
    operation: any
  ): { success: boolean; affectedNodeIds: string[]; affectedLinkIds: string[]; reason?: string }
  {
    const nodeIndex = document.nodes.findIndex(node => node.id === operation.nodeId);
    if (nodeIndex === -1) {
      return { 
        success: false, 
        affectedNodeIds: [], 
        affectedLinkIds: [],
        reason: `node.move 目标节点不存在: ${operation.nodeId}`
      };
    }
    
    const node = document.nodes[nodeIndex];
    node.layout.x = operation.input.x;
    node.layout.y = operation.input.y;
    
    return {
      success: true,
      affectedNodeIds: [operation.nodeId],
      affectedLinkIds: []
    };
  }
  
  /**
   * 应用节点缩放操作。
   */
  private applyNodeResize(
    document: GraphDocument,
    operation: any
  ): { success: boolean; affectedNodeIds: string[]; affectedLinkIds: string[]; reason?: string }
  {
    const nodeIndex = document.nodes.findIndex(node => node.id === operation.nodeId);
    if (nodeIndex === -1) {
      return { 
        success: false, 
        affectedNodeIds: [], 
        affectedLinkIds: [],
        reason: `node.resize 目标节点不存在: ${operation.nodeId}`
      };
    }
    
    const node = document.nodes[nodeIndex];
    node.layout.width = operation.input.width;
    node.layout.height = operation.input.height;
    
    return {
      success: true,
      affectedNodeIds: [operation.nodeId],
      affectedLinkIds: []
    };
  }
  
  /**
   * 应用节点折叠操作。
   */
  private applyNodeCollapse(
    document: GraphDocument,
    operation: any
  ): { success: boolean; affectedNodeIds: string[]; affectedLinkIds: string[]; reason?: string }
  {
    const nodeIndex = document.nodes.findIndex(node => node.id === operation.nodeId);
    if (nodeIndex === -1) {
      return { 
        success: false, 
        affectedNodeIds: [], 
        affectedLinkIds: [],
        reason: `node.collapse 目标节点不存在: ${operation.nodeId}`
      };
    }
    
    const node = document.nodes[nodeIndex];
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
    
    return {
      success: true,
      affectedNodeIds: [operation.nodeId],
      affectedLinkIds: []
    };
  }
  
  /**
   * 应用节点 Widget 值设置操作。
   */
  private applyNodeWidgetValueSet(
    document: GraphDocument,
    operation: any
  ): { success: boolean; affectedNodeIds: string[]; affectedLinkIds: string[]; reason?: string }
  {
    const nodeIndex = document.nodes.findIndex(node => node.id === operation.nodeId);
    if (nodeIndex === -1) {
      return { 
        success: false, 
        affectedNodeIds: [], 
        affectedLinkIds: [],
        reason: `node.widget.value.set 目标节点不存在: ${operation.nodeId}`
      };
    }
    
    const node = document.nodes[nodeIndex];
    if (!node.widgets || !node.widgets[operation.widgetIndex]) {
      return { 
        success: false, 
        affectedNodeIds: [], 
        affectedLinkIds: [],
        reason: `node.widget.value.set 目标 widget 不存在: ${operation.nodeId}#${operation.widgetIndex}`
      };
    }
    
    node.widgets[operation.widgetIndex].value = operation.value;
    
    return {
      success: true,
      affectedNodeIds: [operation.nodeId],
      affectedLinkIds: []
    };
  }
  
  /**
   * 应用节点删除操作。
   */
  private applyNodeRemove(
    document: GraphDocument,
    operation: any
  ): { success: boolean; affectedNodeIds: string[]; affectedLinkIds: string[]; reason?: string }
  {
    const nodeIndex = document.nodes.findIndex(node => node.id === operation.nodeId);
    if (nodeIndex === -1) {
      return { 
        success: false, 
        affectedNodeIds: [], 
        affectedLinkIds: [],
        reason: `node.remove 目标节点不存在: ${operation.nodeId}`
      };
    }
    
    // 删除节点
    document.nodes.splice(nodeIndex, 1);
    
    // 删除关联的连线
    const affectedLinkIds = document.links
      .filter(link => link.source.nodeId === operation.nodeId || link.target.nodeId === operation.nodeId)
      .map(link => link.id);
    
    document.links = document.links.filter(
      link => link.source.nodeId !== operation.nodeId && link.target.nodeId !== operation.nodeId
    );
    
    return {
      success: true,
      affectedNodeIds: [operation.nodeId],
      affectedLinkIds
    };
  }
  
  /**
   * 应用连线创建操作。
   */
  private applyLinkCreate(
    document: GraphDocument,
    operation: any
  ): { success: boolean; affectedNodeIds: string[]; affectedLinkIds: string[]; reason?: string }
  {
    const linkId = operation.input.id;
    if (!linkId) {
      return { 
        success: false, 
        affectedNodeIds: [], 
        affectedLinkIds: [],
        reason: "link.create 缺少稳定连线 ID"
      };
    }
    
    // 检查连线是否已存在
    if (document.links.some(link => link.id === linkId)) {
      return { 
        success: false, 
        affectedNodeIds: [], 
        affectedLinkIds: [],
        reason: `连线已存在: ${linkId}`
      };
    }
    
    // 检查源节点和目标节点是否存在
    if (!document.nodes.some(node => node.id === operation.input.source.nodeId)) {
      return { 
        success: false, 
        affectedNodeIds: [], 
        affectedLinkIds: [],
        reason: `源节点不存在: ${operation.input.source.nodeId}`
      };
    }
    
    if (!document.nodes.some(node => node.id === operation.input.target.nodeId)) {
      return { 
        success: false, 
        affectedNodeIds: [], 
        affectedLinkIds: [],
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
    
    document.links.push(newLink);
    
    return {
      success: true,
      affectedNodeIds: [operation.input.source.nodeId, operation.input.target.nodeId],
      affectedLinkIds: [linkId]
    };
  }
  
  /**
   * 应用连线删除操作。
   */
  private applyLinkRemove(
    document: GraphDocument,
    operation: any
  ): { success: boolean; affectedNodeIds: string[]; affectedLinkIds: string[]; reason?: string }
  {
    const linkIndex = document.links.findIndex(link => link.id === operation.linkId);
    if (linkIndex === -1) {
      return { 
        success: false, 
        affectedNodeIds: [], 
        affectedLinkIds: [],
        reason: `link.remove 目标连线不存在: ${operation.linkId}`
      };
    }
    
    // 删除连线
    document.links.splice(linkIndex, 1);
    
    return {
      success: true,
      affectedNodeIds: [],
      affectedLinkIds: [operation.linkId]
    };
  }
  
  /**
   * 应用连线重连操作。
   */
  private applyLinkReconnect(
    document: GraphDocument,
    operation: any
  ): { success: boolean; affectedNodeIds: string[]; affectedLinkIds: string[]; reason?: string }
  {
    const linkIndex = document.links.findIndex(link => link.id === operation.linkId);
    if (linkIndex === -1) {
      return { 
        success: false, 
        affectedNodeIds: [], 
        affectedLinkIds: [],
        reason: `link.reconnect 目标连线不存在: ${operation.linkId}`
      };
    }
    
    const link = document.links[linkIndex];
    const oldSourceNodeId = link.source.nodeId;
    const oldTargetNodeId = link.target.nodeId;
    
    // 更新连线
    if (operation.input.source) {
      // 检查源节点是否存在
      if (!document.nodes.some(node => node.id === operation.input.source.nodeId)) {
        return { 
          success: false, 
          affectedNodeIds: [], 
          affectedLinkIds: [],
          reason: `源节点不存在: ${operation.input.source.nodeId}`
        };
      }
      link.source = operation.input.source;
    }
    
    if (operation.input.target) {
      // 检查目标节点是否存在
      if (!document.nodes.some(node => node.id === operation.input.target.nodeId)) {
        return { 
          success: false, 
          affectedNodeIds: [], 
          affectedLinkIds: [],
          reason: `目标节点不存在: ${operation.input.target.nodeId}`
        };
      }
      link.target = operation.input.target;
    }
    
    const newSourceNodeId = link.source.nodeId;
    const newTargetNodeId = link.target.nodeId;
    
    // 收集受影响的节点
    const affectedNodeIds = new Set<string>();
    affectedNodeIds.add(oldSourceNodeId);
    affectedNodeIds.add(oldTargetNodeId);
    affectedNodeIds.add(newSourceNodeId);
    affectedNodeIds.add(newTargetNodeId);
    
    return {
      success: true,
      affectedNodeIds: Array.from(affectedNodeIds),
      affectedLinkIds: [operation.linkId]
    };
  }
  
  /**
   * 应用字段变更到文档。
   */
  private applyFieldChange(
    document: GraphDocument,
    fieldChange: GraphDocumentFieldChange
  ): { success: boolean; affectedNodeIds: string[]; reason?: string } {
    try {
      const nodeIndex = document.nodes.findIndex(node => node.id === fieldChange.nodeId);
      if (nodeIndex === -1) {
        return { 
          success: false, 
          affectedNodeIds: [],
          reason: `fieldChange 目标节点不存在: ${fieldChange.nodeId}`
        };
      }
      
      const node = document.nodes[nodeIndex];
      
      switch (fieldChange.type) {
        case "node.title.set":
          node.title = fieldChange.value;
          break;
        case "node.property.set":
          if (!node.properties) {
            node.properties = {};
          }
          node.properties[fieldChange.key] = fieldChange.value;
          break;
        case "node.property.unset":
          if (node.properties && fieldChange.key in node.properties) {
            delete node.properties[fieldChange.key];
            if (Object.keys(node.properties).length === 0) {
              delete node.properties;
            }
          }
          break;
        case "node.data.set":
          if (!node.data) {
            node.data = {};
          }
          node.data[fieldChange.key] = fieldChange.value;
          break;
        case "node.data.unset":
          if (node.data && fieldChange.key in node.data) {
            delete node.data[fieldChange.key];
            if (Object.keys(node.data).length === 0) {
              delete node.data;
            }
          }
          break;
        case "node.flag.set":
          if (!node.flags) {
            node.flags = {} as any;
          }
          (node.flags as any)[fieldChange.key] = fieldChange.value;
          break;
        case "node.widget.value.set":
          if (!node.widgets || !node.widgets[fieldChange.widgetIndex]) {
            return { 
              success: false, 
              affectedNodeIds: [],
              reason: `node.widget.value.set 目标 widget 不存在: ${fieldChange.nodeId}#${fieldChange.widgetIndex}`
            };
          }
          node.widgets[fieldChange.widgetIndex].value = fieldChange.value;
          break;
        case "node.widget.replace":
          if (!node.widgets || fieldChange.widgetIndex < 0 || fieldChange.widgetIndex >= node.widgets.length) {
            return { 
              success: false, 
              affectedNodeIds: [],
              reason: `node.widget.replace 目标 widget 不存在: ${fieldChange.nodeId}#${fieldChange.widgetIndex}`
            };
          }
          node.widgets[fieldChange.widgetIndex] = fieldChange.widget;
          break;
        case "node.widget.remove":
          if (!node.widgets || fieldChange.widgetIndex < 0 || fieldChange.widgetIndex >= node.widgets.length) {
            return { 
              success: false, 
              affectedNodeIds: [],
              reason: `node.widget.remove 目标 widget 不存在: ${fieldChange.nodeId}#${fieldChange.widgetIndex}`
            };
          }
          node.widgets.splice(fieldChange.widgetIndex, 1);
          if (node.widgets.length === 0) {
            delete node.widgets;
          }
          break;
        default:
          return { 
            success: false, 
            affectedNodeIds: [],
            reason: `未知字段变更类型: ${(fieldChange as any).type}`
          };
      }
      
      return {
        success: true,
        affectedNodeIds: [fieldChange.nodeId]
      };
    } catch (error) {
      return {
        success: false,
        affectedNodeIds: [],
        reason: error instanceof Error ? error.message : "应用字段变更时发生未知错误"
      };
    }
  }
  
  /**
   * 克隆文档。
   */
  private cloneDocument(document: GraphDocument): GraphDocument {
    return JSON.parse(JSON.stringify(document));
  }
}
