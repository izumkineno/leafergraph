import { basename } from "node:path";

import { expect, test } from "@playwright/test";

import { TEST_BUNDLE_PATHS } from "../helpers/bundle_paths";
import { EditorPage } from "../helpers/editor_page";

test("本地模式应支持 bundle 导入恢复、节点预览创建和基础画布冒烟", async ({
  page
}) => {
  const editor = new EditorPage(page);
  const workspaceDialog = editor.workspaceDialog("Workspace Settings");

  await editor.goto("/");
  await editor.openWorkspaceSettings();

  await editor.uploadBundle("Node Bundles", {
    name: "broken-node.iife.js",
    mimeType: "text/javascript",
    buffer: Buffer.from("window.__brokenBundle = ;")
  });
  await expect(workspaceDialog).toContainText("broken-node.iife.js");
  await expect(workspaceDialog).toContainText("加载失败");

  await editor.uploadBundle("Widget Bundles", TEST_BUNDLE_PATHS.widget);
  await editor.uploadBundle("Node Bundles", TEST_BUNDLE_PATHS.node);
  await editor.uploadBundle("Demo Bundles", TEST_BUNDLE_PATHS.demo);

  await expect(workspaceDialog).toContainText(basename(TEST_BUNDLE_PATHS.widget));
  await expect(workspaceDialog).toContainText(basename(TEST_BUNDLE_PATHS.node));
  await expect(workspaceDialog).toContainText(basename(TEST_BUNDLE_PATHS.demo));
  await expect(workspaceDialog).toContainText("已写入浏览器，刷新后自动恢复");

  await workspaceDialog
    .getByRole("button", { name: "切换为当前 Demo" })
    .click();
  await expect(workspaceDialog).toContainText("当前 Demo");
  await editor.closeActiveDialog();

  await expect(page.getByText("当前打开的是干净编辑器入口")).toHaveCount(0);

  await editor.searchNodes("Counter Source");
  const counterSourceItem = editor.nodeLibraryItem("Counter Source");
  await counterSourceItem.hover();
  await expect(page.getByText("Node Preview")).toBeVisible();
  await counterSourceItem.click();
  await expect(page.locator(".workspace-sidebar--right")).toContainText(
    "Counter Source"
  );
  await expect(editor.statusbar).toContainText("已选 1 个节点");

  await editor.titlebar.getByRole("button", { name: /撤销/ }).click();
  await expect(editor.statusbar).toContainText("未选择节点");
  await editor.titlebar.getByRole("button", { name: /重做/ }).click();
  await expect(page.locator(".workspace-sidebar--right")).toContainText(
    "Counter Source"
  );
  await expect(editor.statusbar).toContainText("已选 1 个节点");

  await editor.graphRoot.click({
    button: "right",
    position: { x: 120, y: 120 }
  });
  await expect(page.getByText("在这里创建节点")).toBeVisible();

  await page.reload();
  await editor.openWorkspaceSettings();
  await expect(editor.workspaceDialog("Workspace Settings")).toContainText(
    "已从浏览器恢复"
  );
  await expect(editor.workspaceDialog("Workspace Settings")).toContainText(
    "当前 Demo"
  );
});
