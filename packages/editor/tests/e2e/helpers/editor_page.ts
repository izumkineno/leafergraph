import { expect, type Locator, type Page } from "@playwright/test";

export class EditorPage {
  constructor(private readonly page: Page) {}

  get shell(): Locator {
    return this.page.locator(".app-shell");
  }

  get statusbar(): Locator {
    return this.page.locator(".statusbar");
  }

  get graphRoot(): Locator {
    return this.page.locator("#editor-main-canvas .graph-root").first();
  }

  get stageOnboardingCard(): Locator {
    return this.page.locator(".workspace-stage__onboarding-card").first();
  }

  get titlebar(): Locator {
    return this.page.getByRole("banner");
  }

  workspaceDialog(title: string): Locator {
    return this.page
      .locator("dialog.app-dialog[open]")
      .filter({ has: this.page.getByRole("heading", { name: title }) })
      .first();
  }

  bundleGroup(title: string): Locator {
    const dialog = this.workspaceDialog("Workspace Settings");
    return dialog
      .locator(".bundle-group")
      .filter({ hasText: title })
      .first();
  }

  bundleCard(title: string): Locator {
    const dialog = this.workspaceDialog("Workspace Settings");
    return dialog
      .locator(".bundle-card")
      .filter({ hasText: title })
      .first();
  }

  nodeLibraryItem(title: string): Locator {
    return this.page
      .locator(".node-library__item")
      .filter({ hasText: title })
      .first();
  }

  async goto(pathname: string): Promise<void> {
    await this.page.goto(pathname);
    await expect(this.page.locator("#app")).toBeVisible();
  }

  async openWorkspaceSettings(): Promise<void> {
    await this.titlebar
      .getByRole("button", { name: "Workspace Settings", exact: true })
      .click();
    await expect(
      this.page.getByRole("heading", { name: "Workspace Settings" })
    ).toBeVisible();
  }

  async openRunConsole(tab?: string): Promise<void> {
    await this.titlebar.getByRole("button", { name: "Run Console", exact: true }).click();
    await expect(
      this.page.getByRole("heading", { name: "Run Console" })
    ).toBeVisible();
    if (tab) {
      await this.page.getByRole("tab", { name: tab }).click();
    }
  }

  async closeActiveDialog(): Promise<void> {
    const activeDialog = this.page.locator("dialog.app-dialog[open]").last();
    await activeDialog.getByLabel("关闭对话框").click();
    await expect(this.page.locator("dialog.app-dialog[open]")).toHaveCount(0);
  }

  async switchWorkspaceSettingsTab(tabName: string): Promise<void> {
    await this.page.getByRole("tab", { name: tabName }).click();
  }

  async uploadBundle(
    title: string,
    files:
      | string
      | ReadonlyArray<string>
      | Parameters<Locator["setInputFiles"]>[0]
  ): Promise<void> {
    const input = this.bundleGroup(title).locator('input[type="file"]');
    await expect(input).toHaveCount(1);
    await input.setInputFiles(files);
  }

  toolbarButton(name: string): Locator {
    return this.titlebar.getByRole("button", { name, exact: true });
  }

  async searchNodes(query: string): Promise<void> {
    await this.page.getByRole("searchbox", { name: "搜索节点" }).fill(query);
  }
}
