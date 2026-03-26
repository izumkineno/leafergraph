import { expect, test } from "@playwright/test";

import { EditorPage } from "../helpers/editor_page";

test("干净入口应显示 onboarding，并在刷新后恢复主题与 pane 偏好", async ({
  page
}) => {
  const editor = new EditorPage(page);

  await editor.goto("/");
  await expect(page.getByText("当前打开的是干净编辑器入口")).toBeVisible();
  await expect(
    editor.stageOnboardingCard.getByRole("button", {
      name: "打开 Python Authority Demo"
    })
  ).toBeVisible();
  await expect(
    editor.stageOnboardingCard.getByRole("button", { name: "打开 Extensions" })
  ).toBeVisible();

  await editor.openWorkspaceSettings();
  await editor.switchWorkspaceSettingsTab("Preferences");
  await page.getByRole("button", { name: "亮色" }).click();
  await page.getByRole("button", { name: "收起节点库" }).click();
  await editor.closeActiveDialog();

  await expect(editor.shell).toHaveAttribute("data-theme", "light");
  await expect(editor.shell).toHaveAttribute("data-left-open", "false");

  await page.reload();

  await expect(page.getByText("当前打开的是干净编辑器入口")).toBeVisible();
  await expect(editor.shell).toHaveAttribute("data-theme", "light");
  await expect(editor.shell).toHaveAttribute("data-left-open", "false");
});
