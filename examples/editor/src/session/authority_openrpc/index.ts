/**
 * 公共导出入口模块。
 *
 * @remarks
 * 负责收口当前目录下的公开实现与类型，形成稳定的对外导出边界。
 */
/** 导出 OpenRPC 生成物中的 descriptor、方法、模型与通知类型。 */
export * from "./_generated/descriptor";
export * from "./_generated/methods";
export * from "./_generated/models";
export * from "./_generated/notifications";
export * from "./_generated/schema_bundle";
export { default as authorityOpenRpcDocument } from "./_generated/openrpc_document";
/** 导出 editor 手写的 OpenRPC runtime 与协议类型。 */
export * from "./runtime";
export * from "./types";
