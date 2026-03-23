import { expect, test } from "@playwright/test";

import { EditorPage } from "../helpers/editor_page";

test("预览 authority 模式应连通并展示运行控制台链路", async ({ page }) => {
  const editor = new EditorPage(page);

  await editor.goto("/?authority=preview-demo-service");
  await expect(editor.statusbar).toContainText("demo-worker-doc @ 1");
  await expect(editor.toolbarButton("Play")).toBeEnabled();
  await expect(editor.toolbarButton("Run Console")).toBeEnabled();

  await editor.toolbarButton("Play").click();
  await editor.openRunConsole("Chains");
  const primaryChainCard = page.locator(".run-chain-card").filter({
    hasText: "Node 1"
  });
  await expect(primaryChainCard).toContainText("Node 1");
  await expect(primaryChainCard).toContainText("2 步");
});

test("根级错误边界应在启动失败时渲染 fallback", async ({ page }) => {
  await page.addInitScript((storageKey: string) => {
    const originalGetItem = window.localStorage.getItem.bind(window.localStorage);
    window.localStorage.getItem = (key: string) => {
      if (key === storageKey) {
        throw new Error("forced theme failure");
      }

      return originalGetItem(key);
    };
  }, "leafergraph.editor.theme");

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Editor 发生未捕获错误" })
  ).toBeVisible();
  await expect(page.getByText("forced theme failure")).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载编辑器" })).toBeVisible();
});
