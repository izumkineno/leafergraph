/**
 * `developer/` 是开发者真正会看的目录。
 *
 * 这里按类型拆成：
 * - `shared.ts`：项目级常量
 * - `widgets/`：Widget 实现
 * - `nodes/`：节点实现
 * - `preset.ts`：demo 预设
 * - `module.ts`：模块与插件组装
 *
 * 这样开发者既能按类型定位，也不会再被 browser/presets 的消费层代码干扰。
 */
export * from "./shared";
export * from "./widgets";
export * from "./nodes";
export * from "./preset";
export * from "./module";
