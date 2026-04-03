// 导入 @leafergraph/diff 包
export * from '@leafergraph/diff';

// 重新导出核心功能，保持与原有接口兼容
export { DiffEngine } from '@leafergraph/diff';
export { deepClone, generateId, deepEqual } from '@leafergraph/diff';