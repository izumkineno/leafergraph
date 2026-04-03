// 核心功能
export * from './core';

// 传输协议
export * from './transport';

// 运行时投影
export * from './projection';

// 工具函数
export * from './utils';

// 类型定义
export * from './types';

/**
 * 计算两个文档之间的差异。
 * 
 * @param oldDocument - 旧文档
 * @param newDocument - 新文档
 * @param options - 差异计算选项
 * @returns 文档差异
 */
export { DiffEngine } from './core/diff-engine';

/**
 * Find 更新器。
 * 支持按 ID、路径、条件等方式查找和更新节点。
 */
export { FindUpdater } from './core/find-updater';

/**
 * 运行时投影器。
 * 将 diff 增量投影到运行时视图。
 */
export { DiffProjector } from './projection/projector';

/**
 * 传输适配器抽象基类。
 */
export { TransportAdapter } from './transport/adapter';

/**
 * HTTP 传输适配器。
 */
export { HttpTransportAdapter } from './transport/http';

/**
 * WebSocket 传输适配器。
 */
export { WebSocketTransportAdapter } from './transport/websocket';

/**
 * MQ 传输适配器。
 */
export { MQTransportAdapter } from './transport/mq';
