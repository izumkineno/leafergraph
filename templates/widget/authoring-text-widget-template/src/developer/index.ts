/**
 * `developer/` 是开发者真正会看的目录。
 *
 * 这里按类型拆成：
 * - `shared.ts`：项目级常量
 * - `widgets/`：Widget 实现
 * - `plugin.ts`：插件组装
 *
 * 这样开发者既能按类型定位，也能保持模板结构稳定。
 */
export * from "./shared";
export * from "./widgets";
export * from "./plugin";
