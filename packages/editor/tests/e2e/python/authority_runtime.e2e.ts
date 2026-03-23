import { expect, test } from "@playwright/test";

import { TEST_BUNDLE_PATHS } from "../helpers/bundle_paths";
import { EditorPage } from "../helpers/editor_page";
import {
  resolveFreePort,
  startPythonAuthorityServer
} from "../helpers/python_authority";

test("Python authority 离线时应展示连接失败和恢复入口", async ({
  page
}) => {
  const port = await resolveFreePort();
  const editor = new EditorPage(page);

  await editor.goto(
    `/authority-python-host-demo.html?authorityUrl=${encodeURIComponent(
      `http://localhost:${port}`
    )}`
  );

  await expect(
    page.getByRole("heading", { name: "Authority 连接失败" })
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "重试连接" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "打开 Authority 设置" })
  ).toBeVisible();
});

test("Python authority 在线时应支持浏览器侧建图并回显运行结果", async ({
  page
}) => {
  const server = await startPythonAuthorityServer();
  const editor = new EditorPage(page);

  try {
    await editor.goto(
      `/authority-python-host-demo.html?authorityUrl=${encodeURIComponent(
        server.authorityOrigin
      )}`
    );
    await expect(editor.statusbar).toContainText("Authority 已连接");

    await editor.openWorkspaceSettings();
    await editor.uploadBundle("Node Bundles", TEST_BUNDLE_PATHS.node);
    await editor.closeActiveDialog();

    await editor.searchNodes("Counter Source");
    await editor.nodeLibraryItem("Counter Source").click();
    await expect(editor.titlebar).toContainText("1 Nodes · 0 Links");

    await editor.toolbarButton("Play").click();
    await editor.openRunConsole("Chains");
    await expect(page.locator(".run-chain-card")).toContainText("Counter 1");
    await editor.closeActiveDialog();

    await editor.openWorkspaceSettings();
    await editor.switchWorkspaceSettingsTab("Authority");
    await expect(
      page.getByRole("button", { name: "重新同步文档" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "重新连接 Authority" })
    ).toBeVisible();
  } finally {
    await server.stop();
  }
});
