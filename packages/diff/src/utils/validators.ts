import type { GraphDocumentDiff, GraphDocumentFieldChange } from "../types";

/**
 * 验证 diff 结构。
 * 
 * @param diff - 文档差异
 * @returns 是否有效
 */
export function validateDiff(diff: GraphDocumentDiff): boolean {
  if (!diff || typeof diff !== "object") return false;
  if (!diff.documentId || typeof diff.documentId !== "string") return false;
  if (typeof diff.baseRevision !== "number") return false;
  if (typeof diff.revision !== "number") return false;
  if (typeof diff.emittedAt !== "number") return false;
  if (!Array.isArray(diff.operations)) return false;
  if (!Array.isArray(diff.fieldChanges)) return false;
  
  // 验证操作
  for (const operation of diff.operations) {
    if (!validateOperation(operation)) return false;
  }
  
  // 验证字段变更
  for (const fieldChange of diff.fieldChanges) {
    if (!validateFieldChange(fieldChange)) return false;
  }
  
  return true;
}

/**
 * 验证操作。
 * 
 * @param operation - 操作
 * @returns 是否有效
 */
export function validateOperation(operation: any): boolean {
  if (!operation || typeof operation !== "object") return false;
  if (!operation.operationId || typeof operation.operationId !== "string") return false;
  if (typeof operation.timestamp !== "number") return false;
  if (!operation.source || typeof operation.source !== "string") return false;
  if (!operation.type || typeof operation.type !== "string") return false;
  
  switch (operation.type) {
    case "node.create":
      return validateNodeCreateOperation(operation);
    case "node.update":
      return validateNodeUpdateOperation(operation);
    case "node.move":
      return validateNodeMoveOperation(operation);
    case "node.resize":
      return validateNodeResizeOperation(operation);
    case "node.collapse":
      return validateNodeCollapseOperation(operation);
    case "node.widget.value.set":
      return validateNodeWidgetValueSetOperation(operation);
    case "node.remove":
      return validateNodeRemoveOperation(operation);
    case "link.create":
      return validateLinkCreateOperation(operation);
    case "link.remove":
      return validateLinkRemoveOperation(operation);
    case "link.reconnect":
      return validateLinkReconnectOperation(operation);
    case "document.update":
      return true;
    default:
      return false;
  }
}

/**
 * 验证节点创建操作。
 * 
 * @param operation - 操作
 * @returns 是否有效
 */
export function validateNodeCreateOperation(operation: any): boolean {
  if (!operation.input || typeof operation.input !== "object") return false;
  if (!operation.input.id || typeof operation.input.id !== "string") return false;
  if (!operation.input.type || typeof operation.input.type !== "string") return false;
  if (!operation.input.x || typeof operation.input.x !== "number") return false;
  if (!operation.input.y || typeof operation.input.y !== "number") return false;
  if (!operation.input.width || typeof operation.input.width !== "number") return false;
  if (!operation.input.height || typeof operation.input.height !== "number") return false;
  return true;
}

/**
 * 验证节点更新操作。
 * 
 * @param operation - 操作
 * @returns 是否有效
 */
export function validateNodeUpdateOperation(operation: any): boolean {
  if (!operation.nodeId || typeof operation.nodeId !== "string") return false;
  if (!operation.input || typeof operation.input !== "object") return false;
  return true;
}

/**
 * 验证节点移动操作。
 * 
 * @param operation - 操作
 * @returns 是否有效
 */
export function validateNodeMoveOperation(operation: any): boolean {
  if (!operation.nodeId || typeof operation.nodeId !== "string") return false;
  if (!operation.input || typeof operation.input !== "object") return false;
  if (typeof operation.input.x !== "number") return false;
  if (typeof operation.input.y !== "number") return false;
  return true;
}

/**
 * 验证节点缩放操作。
 * 
 * @param operation - 操作
 * @returns 是否有效
 */
export function validateNodeResizeOperation(operation: any): boolean {
  if (!operation.nodeId || typeof operation.nodeId !== "string") return false;
  if (!operation.input || typeof operation.input !== "object") return false;
  if (typeof operation.input.width !== "number") return false;
  if (typeof operation.input.height !== "number") return false;
  return true;
}

/**
 * 验证节点折叠操作。
 * 
 * @param operation - 操作
 * @returns 是否有效
 */
export function validateNodeCollapseOperation(operation: any): boolean {
  if (!operation.nodeId || typeof operation.nodeId !== "string") return false;
  if (typeof operation.collapsed !== "boolean") return false;
  return true;
}

/**
 * 验证节点 Widget 值设置操作。
 * 
 * @param operation - 操作
 * @returns 是否有效
 */
export function validateNodeWidgetValueSetOperation(operation: any): boolean {
  if (!operation.nodeId || typeof operation.nodeId !== "string") return false;
  if (typeof operation.widgetIndex !== "number") return false;
  return true;
}

/**
 * 验证节点删除操作。
 * 
 * @param operation - 操作
 * @returns 是否有效
 */
export function validateNodeRemoveOperation(operation: any): boolean {
  if (!operation.nodeId || typeof operation.nodeId !== "string") return false;
  return true;
}

/**
 * 验证连线创建操作。
 * 
 * @param operation - 操作
 * @returns 是否有效
 */
export function validateLinkCreateOperation(operation: any): boolean {
  if (!operation.input || typeof operation.input !== "object") return false;
  if (!operation.input.id || typeof operation.input.id !== "string") return false;
  if (!operation.input.source || typeof operation.input.source !== "object") return false;
  if (!operation.input.source.nodeId || typeof operation.input.source.nodeId !== "string") return false;
  if (!operation.input.target || typeof operation.input.target !== "object") return false;
  if (!operation.input.target.nodeId || typeof operation.input.target.nodeId !== "string") return false;
  return true;
}

/**
 * 验证连线删除操作。
 * 
 * @param operation - 操作
 * @returns 是否有效
 */
export function validateLinkRemoveOperation(operation: any): boolean {
  if (!operation.linkId || typeof operation.linkId !== "string") return false;
  return true;
}

/**
 * 验证连线重连操作。
 * 
 * @param operation - 操作
 * @returns 是否有效
 */
export function validateLinkReconnectOperation(operation: any): boolean {
  if (!operation.linkId || typeof operation.linkId !== "string") return false;
  if (!operation.input || typeof operation.input !== "object") return false;
  if (operation.input.source && (!operation.input.source.nodeId || typeof operation.input.source.nodeId !== "string")) return false;
  if (operation.input.target && (!operation.input.target.nodeId || typeof operation.input.target.nodeId !== "string")) return false;
  return true;
}

/**
 * 验证字段变更。
 * 
 * @param fieldChange - 字段变更
 * @returns 是否有效
 */
export function validateFieldChange(fieldChange: GraphDocumentFieldChange): boolean {
  if (!fieldChange || typeof fieldChange !== "object") return false;
  if (!fieldChange.nodeId || typeof fieldChange.nodeId !== "string") return false;
  if (!fieldChange.type || typeof fieldChange.type !== "string") return false;
  
  switch (fieldChange.type) {
    case "node.title.set":
      return typeof (fieldChange as any).value === "string";
    case "node.property.set":
      return typeof (fieldChange as any).key === "string";
    case "node.property.unset":
      return typeof (fieldChange as any).key === "string";
    case "node.data.set":
      return typeof (fieldChange as any).key === "string";
    case "node.data.unset":
      return typeof (fieldChange as any).key === "string";
    case "node.flag.set":
      return typeof (fieldChange as any).key === "string" && typeof (fieldChange as any).value === "boolean";
    case "node.widget.value.set":
      return typeof (fieldChange as any).widgetIndex === "number";
    case "node.widget.replace":
      return typeof (fieldChange as any).widgetIndex === "number" && typeof (fieldChange as any).widget === "object";
    case "node.widget.remove":
      return typeof (fieldChange as any).widgetIndex === "number";
    default:
      return false;
  }
}
