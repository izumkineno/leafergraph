import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createContextMenuController, type ContextMenuContext } from "../src/core/index";
import { createDomContextMenuRenderer } from "../src/internal/dom_overlay_renderer";

const originalMatchMedia = window.matchMedia.bind(window);
const originalMaxTouchPoints = Object.getOwnPropertyDescriptor(
  window.navigator,
  "maxTouchPoints"
);

beforeEach(() => {
  window.matchMedia = originalMatchMedia;
  if (originalMaxTouchPoints) {
    Object.defineProperty(
      window.navigator,
      "maxTouchPoints",
      originalMaxTouchPoints
    );
  } else {
    Reflect.deleteProperty(window.navigator, "maxTouchPoints");
  }
});

afterEach(() => {
  document.body.innerHTML = "";
  window.matchMedia = originalMatchMedia;
  if (originalMaxTouchPoints) {
    Object.defineProperty(
      window.navigator,
      "maxTouchPoints",
      originalMaxTouchPoints
    );
  } else {
    Reflect.deleteProperty(window.navigator, "maxTouchPoints");
  }
});

describe("@leafergraph/context-menu dom renderer", () => {
  it("会渲染根菜单并支持 hover+click 打开子菜单", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const controller = createContextMenuController({
      renderer: createDomContextMenuRenderer()
    });

    controller.open(createContext(container), [
      {
        kind: "submenu",
        key: "advanced",
        label: "高级",
        children: [{ key: "inspect", label: "查看详情" }]
      },
      {
        key: "rename",
        label: "重命名"
      }
    ]);

    const submenuButton = document.querySelector<HTMLButtonElement>(
      '.leafergraph-context-menu__item[data-key="advanced"]'
    );
    expect(submenuButton).not.toBeNull();
    expect(submenuButton?.getAttribute("aria-haspopup")).toBe("menu");

    submenuButton?.dispatchEvent(
      new PointerEvent("pointerenter", { bubbles: true })
    );
    await waitForTimers();

    expect(
      document.querySelector(
        '.leafergraph-context-menu__panel[data-level="1"]'
      )
    ).not.toBeNull();

    controller.destroy();
  });

  it("粗指针环境下会把 hover 子菜单退化为 click", async () => {
    window.matchMedia = ((query: string) =>
      ({
        matches: query === "(pointer: coarse)",
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent() {
          return false;
        }
      }) as MediaQueryList) as typeof window.matchMedia;

    const container = document.createElement("div");
    document.body.appendChild(container);

    const controller = createContextMenuController({
      renderer: createDomContextMenuRenderer()
    });

    controller.open(createContext(container), [
      {
        kind: "submenu",
        key: "advanced",
        label: "高级",
        children: [{ key: "inspect", label: "查看详情" }]
      }
    ]);

    const submenuButton = document.querySelector<HTMLButtonElement>(
      '.leafergraph-context-menu__item[data-key="advanced"]'
    );
    expect(submenuButton).not.toBeNull();

    submenuButton?.dispatchEvent(
      new PointerEvent("pointerenter", { bubbles: true })
    );
    await waitForTimers();
    expect(
      document.querySelector(
        '.leafergraph-context-menu__panel[data-level="1"]'
      )
    ).toBeNull();

    submenuButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitForTimers();
    expect(
      document.querySelector(
        '.leafergraph-context-menu__panel[data-level="1"]'
      )
    ).not.toBeNull();

    controller.destroy();
  });

  it("没有图标时不会渲染图标占位元素", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const controller = createContextMenuController({
      renderer: createDomContextMenuRenderer()
    });

    controller.open(createContext(container), [
      {
        key: "rename",
        label: "重命名"
      }
    ]);

    const renameItem = document.querySelector<HTMLElement>(
      '.leafergraph-context-menu__item[data-key="rename"]'
    );
    expect(renameItem).not.toBeNull();
    expect(
      renameItem?.querySelector(".leafergraph-context-menu__icon")
    ).toBeNull();
    expect(
      renameItem?.querySelector(".leafergraph-context-menu__leading")
    ).toBeNull();

    controller.destroy();
  });

  it("带触控能力但仍有 hover 指针时不会错误退化为 click", async () => {
    window.matchMedia = ((query: string) =>
      ({
        matches: query === "(any-hover: hover)",
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent() {
          return false;
        }
      }) as MediaQueryList) as typeof window.matchMedia;

    Object.defineProperty(window.navigator, "maxTouchPoints", {
      configurable: true,
      value: 5
    });

    const container = document.createElement("div");
    document.body.appendChild(container);

    const controller = createContextMenuController({
      renderer: createDomContextMenuRenderer()
    });

    controller.open(createContext(container), [
      {
        kind: "submenu",
        key: "advanced",
        label: "高级",
        children: [{ key: "inspect", label: "查看详情" }]
      }
    ]);

    const submenuButton = document.querySelector<HTMLButtonElement>(
      '.leafergraph-context-menu__item[data-key="advanced"]'
    );
    expect(submenuButton).not.toBeNull();

    submenuButton?.dispatchEvent(
      new PointerEvent("pointerenter", { bubbles: true })
    );
    await waitForTimers();

    expect(
      document.querySelector(
        '.leafergraph-context-menu__panel[data-level="1"]'
      )
    ).not.toBeNull();

    controller.destroy();
  });

  it("三级及以上子菜单在 hover 进入更深层 panel 时不会被祖先关闭定时器误杀", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const controller = createContextMenuController({
      closeDelay: 20,
      renderer: createDomContextMenuRenderer()
    });

    controller.open(createContext(container), [
      {
        kind: "submenu",
        key: "advanced",
        label: "高级",
        children: [
          {
            kind: "submenu",
            key: "inspect",
            label: "查看",
            children: [{ key: "runtime", label: "运行时详情" }]
          }
        ]
      }
    ]);

    const advancedButton = document.querySelector<HTMLButtonElement>(
      '.leafergraph-context-menu__item[data-key="advanced"]'
    );
    expect(advancedButton).not.toBeNull();

    advancedButton?.dispatchEvent(
      new PointerEvent("pointerenter", { bubbles: true })
    );
    await waitForTimers();

    const levelOnePanel = document.querySelector<HTMLDivElement>(
      '.leafergraph-context-menu__panel[data-level="1"]'
    );
    expect(levelOnePanel).not.toBeNull();

    advancedButton?.dispatchEvent(
      new PointerEvent("pointerleave", { bubbles: true })
    );
    levelOnePanel?.dispatchEvent(
      new PointerEvent("pointerenter", { bubbles: true })
    );

    const inspectButton = document.querySelector<HTMLButtonElement>(
      '.leafergraph-context-menu__item[data-level="1"][data-key="inspect"]'
    );
    expect(inspectButton).not.toBeNull();

    inspectButton?.dispatchEvent(
      new PointerEvent("pointerenter", { bubbles: true })
    );
    await waitForTimers();

    const levelTwoPanel = document.querySelector<HTMLDivElement>(
      '.leafergraph-context-menu__panel[data-level="2"]'
    );
    expect(levelTwoPanel).not.toBeNull();

    inspectButton?.dispatchEvent(
      new PointerEvent("pointerleave", { bubbles: true })
    );
    levelOnePanel?.dispatchEvent(
      new PointerEvent("pointerleave", { bubbles: true })
    );
    levelTwoPanel?.dispatchEvent(
      new PointerEvent("pointerenter", { bubbles: true })
    );

    await wait(40);

    expect(controller.getState().openPath).toEqual(["advanced", "inspect"]);
    expect(
      document.querySelector('.leafergraph-context-menu__panel[data-level="2"]')
    ).not.toBeNull();

    controller.destroy();
  });

  it("会在每次打开时重新解析并应用主题 token", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    let currentTheme = {
      fontFamily: '"IBM Plex Sans", sans-serif',
      background: "rgb(12, 34, 56)",
      panelBorder: "rgb(65, 77, 88)",
      shadow: "0 10px 20px rgba(0, 0, 0, 0.2)",
      color: "rgb(240, 244, 248)",
      muted: "rgb(120, 132, 144)",
      hoverBackground: "rgb(30, 60, 90)",
      danger: "rgb(210, 60, 60)",
      separator: "rgb(80, 92, 104)",
      check: "rgb(90, 160, 240)",
      panelRadius: 18,
      panelPadding: 10,
      panelMinWidth: 260,
      panelMaxWidth: 360,
      itemRadius: 12,
      itemPaddingX: 16,
      itemPaddingY: 12,
      groupLabelPaddingX: 14,
      groupLabelPaddingTop: 7,
      groupLabelPaddingBottom: 5
    };

    const controller = createContextMenuController({
      renderer: createDomContextMenuRenderer({
        resolveThemeTokens: () => currentTheme
      })
    });

    controller.open(createContext(container), [{ key: "rename", label: "重命名" }]);

    const root = document.querySelector<HTMLDivElement>(".leafergraph-context-menu");
    expect(root?.style.getPropertyValue("--lgcm-bg")).toBe("rgb(12, 34, 56)");
    expect(root?.style.getPropertyValue("--lgcm-panel-min-width")).toBe("260px");
    expect(root?.style.getPropertyValue("--lgcm-font-family")).toContain(
      "IBM Plex Sans"
    );

    controller.close();

    currentTheme = {
      ...currentTheme,
      background: "rgb(240, 248, 255)",
      panelMinWidth: 280
    };

    controller.open(createContext(container), [{ key: "rename", label: "重命名" }]);

    expect(root?.style.getPropertyValue("--lgcm-bg")).toBe("rgb(240, 248, 255)");
    expect(root?.style.getPropertyValue("--lgcm-panel-min-width")).toBe("280px");

    controller.destroy();
  });
});

function createContext(container: HTMLElement): ContextMenuContext {
  return {
    container,
    host: document.body,
    target: { kind: "canvas" },
    triggerReason: "manual",
    pagePoint: { x: 48, y: 36 },
    clientPoint: { x: 48, y: 36 },
    containerPoint: { x: 48, y: 36 }
  };
}

function waitForTimers(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
