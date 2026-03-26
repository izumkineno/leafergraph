/**
 * 公共导出入口模块。
 *
 * @remarks
 * 负责收口当前目录下的公开实现与类型，形成稳定的对外导出边界。
 */
/** 导出 editor 壳层、布局和 onboarding 相关的公共边界。 */
export * from "./provider";
export * from "./editor_controller";
export * from "./error_boundary";
export * from "./layout/workspace_adaptive";
export * from "./onboarding/default_entry_onboarding";
export * from "./workspace_preferences";
