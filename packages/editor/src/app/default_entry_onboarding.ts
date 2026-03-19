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

export interface ResolveDefaultEntryOnboardingDocumentNodeCountOptions {
  initialDocumentNodeCount: number;
  workspaceDocumentNodeCount?: number | null;
}

export interface DefaultEntryOnboardingState {
  isCleanEntryMode: boolean;
  showStageOnboarding: boolean;
  showNodeLibraryHint: boolean;
  showExtensionsQuickActions: boolean;
}

/**
 * 解析默认入口引导应参考的“当前文档节点数”。
 *
 * @remarks
 * App 首次挂载时只能拿到 bootstrap / runtime 提供的初始 document；
 * 一旦 GraphViewport 已经把本地编辑后的实时文档摘要回传回来，应优先使用
 * workspace state 中的节点数，避免舞台 onboarding 在用户开始创建节点后仍滞留。
 */
export function resolveDefaultEntryOnboardingDocumentNodeCount(
  options: ResolveDefaultEntryOnboardingDocumentNodeCountOptions
): number {
  if (
    typeof options.workspaceDocumentNodeCount === "number" &&
    Number.isFinite(options.workspaceDocumentNodeCount) &&
    options.workspaceDocumentNodeCount >= 0
  ) {
    return options.workspaceDocumentNodeCount;
  }

  return options.initialDocumentNodeCount;
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
