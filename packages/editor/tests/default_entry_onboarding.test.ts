import { describe, expect, test } from "bun:test";

import {
  DEFAULT_NODE_AUTHORITY_DEMO_URL,
  resolveDefaultEntryOnboardingState
} from "../src/app/default_entry_onboarding";

describe("default entry onboarding helper", () => {
  test("本地 loopback + 无 node/widget bundle + 空文档时应显示完整引导", () => {
    expect(
      resolveDefaultEntryOnboardingState({
        isRemoteAuthorityEnabled: false,
        hasLoadedNodeBundle: false,
        hasLoadedWidgetBundle: false,
        documentNodeCount: 0
      })
    ).toEqual({
      isCleanEntryMode: true,
      showStageOnboarding: true,
      showNodeLibraryHint: true,
      showExtensionsQuickActions: true
    });
  });

  test("本地已开始编辑时应收起舞台 onboarding，但保留轻量说明", () => {
    expect(
      resolveDefaultEntryOnboardingState({
        isRemoteAuthorityEnabled: false,
        hasLoadedNodeBundle: false,
        hasLoadedWidgetBundle: false,
        documentNodeCount: 2
      })
    ).toEqual({
      isCleanEntryMode: true,
      showStageOnboarding: false,
      showNodeLibraryHint: true,
      showExtensionsQuickActions: true
    });
  });

  test("只要已加载 node 或 widget bundle，就不再视为干净入口", () => {
    expect(
      resolveDefaultEntryOnboardingState({
        isRemoteAuthorityEnabled: false,
        hasLoadedNodeBundle: true,
        hasLoadedWidgetBundle: false,
        documentNodeCount: 0
      })
    ).toEqual({
      isCleanEntryMode: false,
      showStageOnboarding: false,
      showNodeLibraryHint: false,
      showExtensionsQuickActions: false
    });

    expect(
      resolveDefaultEntryOnboardingState({
        isRemoteAuthorityEnabled: false,
        hasLoadedNodeBundle: false,
        hasLoadedWidgetBundle: true,
        documentNodeCount: 0
      })
    ).toEqual({
      isCleanEntryMode: false,
      showStageOnboarding: false,
      showNodeLibraryHint: false,
      showExtensionsQuickActions: false
    });
  });

  test("remote authority 模式下不应显示默认入口引导", () => {
    expect(
      resolveDefaultEntryOnboardingState({
        isRemoteAuthorityEnabled: true,
        hasLoadedNodeBundle: false,
        hasLoadedWidgetBundle: false,
        documentNodeCount: 0
      })
    ).toEqual({
      isCleanEntryMode: false,
      showStageOnboarding: false,
      showNodeLibraryHint: false,
      showExtensionsQuickActions: false
    });
  });

  test("demo 快捷入口应固定指向 Node Authority 预载页面", () => {
    expect(DEFAULT_NODE_AUTHORITY_DEMO_URL).toBe(
      "/authority-node-host-demo.html?preloadTestBundles=1"
    );
  });
});
