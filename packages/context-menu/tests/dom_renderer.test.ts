import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createContextMenuController, type ContextMenuContext } from "../src/core/index";
import { createDomContextMenuRenderer } from "../src/internal/dom_overlay_renderer";

const originalMatchMedia = window.matchMedia.bind(window);

beforeEach(() => {
  window.matchMedia = originalMatchMedia;
});

afterEach(() => {
  document.body.innerHTML = "";
  window.matchMedia = originalMatchMedia;
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
