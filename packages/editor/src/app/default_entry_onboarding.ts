/** 默认完整 demo 入口，固定指向 Node Authority + 预载测试 bundles。 */
export const DEFAULT_NODE_AUTHORITY_DEMO_URL =
  "/authority-node-host-demo.html?preloadTestBundles=1";
/** 默认完整 demo 入口，固定指向 Python Authority + 预载测试 bundles。 */
export const DEFAULT_PYTHON_AUTHORITY_DEMO_URL =
  "/authority-python-host-demo.html?preloadTestBundles=1";

export interface ResolveDefaultEntryOnboardingStateOptions {
  isRemoteAuthorityEnabled: boolean;
  hasLoadedNodeBundle: boolean;
  hasLoadedWidgetBundle: boolean;
  documentNodeCount: number;
}

export interface DefaultEntryOnboardingState {
  isCleanEntryMode: boolean;
  showStageOnboarding: boolean;
  showNodeLibraryHint: boolean;
  showExtensionsQuickActions: boolean;
}

/**
 * 统一收敛默认入口语义。
 *
 * @remarks
 * “干净入口”只表示：
 * - 当前不是 remote authority 模式
 * - 当前没有装入 node/widget bundle
 *
 * 主画布 onboarding 额外要求当前文档为空，避免用户已经开始本地编辑后仍被
 * 大卡片持续覆盖；节点库和 Extensions 的轻量提示则在干净入口模式下继续保留。
 */
export function resolveDefaultEntryOnboardingState(
  options: ResolveDefaultEntryOnboardingStateOptions
): DefaultEntryOnboardingState {
  const isCleanEntryMode =
    !options.isRemoteAuthorityEnabled &&
    !options.hasLoadedNodeBundle &&
    !options.hasLoadedWidgetBundle;
  const hasEmptyDocument = options.documentNodeCount <= 0;

  return {
    isCleanEntryMode,
    showStageOnboarding: isCleanEntryMode && hasEmptyDocument,
    showNodeLibraryHint: isCleanEntryMode,
    showExtensionsQuickActions: isCleanEntryMode
  };
}
