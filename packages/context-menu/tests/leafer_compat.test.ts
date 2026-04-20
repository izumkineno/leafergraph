import { afterEach, describe, expect, it } from "bun:test";
import type { App } from "leafer-ui";
import {
  LEAFER_POINTER_MENU_EVENT,
  createLeaferContextMenu
} from "../src/index";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("@leafergraph/context-menu leafer runtime", () => {
  it("会优先命中最近的绑定目标", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const appTarget = new FakeLeaferTarget("app");
    const nodeTarget = new FakeLeaferTarget("node", appTarget);
    const menu = createLeaferContextMenu({
      app: appTarget as unknown as App,
      container,
      resolveItems(context) {
        return [
          {
            key: "open",
            label: "打开",
            onSelect() {
              context.data = {
                ...(context.data ?? {}),
                selected: true
              };
            }
          }
        ];
      }
    });

    menu.bindNode("node", nodeTarget, { id: "node-1" });
    nodeTarget.emitMenuBubble({
      x: 120,
      y: 80,
      target: nodeTarget,
      origin: {
        clientX: 120,
        clientY: 80,
        pageX: 120,
        pageY: 80,
        preventDefault() {}
      }
    });

    const openItem = document.querySelector<HTMLButtonElement>(
      '.leafergraph-context-menu__item[data-key="open"]'
    );
    expect(menu.isOpen()).toBe(true);
    expect(openItem).not.toBeNull();

    menu.destroy();
  });

  it("点击菜单项后会真实触发业务回调", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const appTarget = new FakeLeaferTarget("app");
    const nodeTarget = new FakeLeaferTarget("node", appTarget);
    let selectedNodeId = "";

    const menu = createLeaferContextMenu({
      app: appTarget as unknown as App,
      container,
      resolveItems(context) {
        return [
          {
            key: "rename",
            label: "重命名",
            onSelect(selectedContext) {
              selectedNodeId = String(
                selectedContext.target.id ?? context.target.id ?? ""
              );
            }
          }
        ];
      }
    });

    menu.bindNode("node", nodeTarget, {
      id: "node-1"
    });
    nodeTarget.emitMenuBubble({
      x: 96,
      y: 72,
      target: nodeTarget,
      origin: {
        clientX: 96,
        clientY: 72,
        pageX: 96,
        pageY: 72,
        preventDefault() {}
      }
    });

    const renameItem = document.querySelector<HTMLButtonElement>(
      '.leafergraph-context-menu__item[data-key="rename"]'
    );
    expect(renameItem).not.toBeNull();
    renameItem?.click();
    await waitForTimers();

    expect(selectedNodeId).toBe("node-1");
    expect(menu.isOpen()).toBe(false);

    menu.destroy();
  });
});

class FakeLeaferTarget {
  readonly name: string;
  parent: FakeLeaferTarget | null;
  private readonly listeners = new Map<
    number,
    (event: {
      x: number;
      y: number;
      target?: unknown;
      origin?: {
        clientX?: number;
        clientY?: number;
        pageX?: number;
        pageY?: number;
        preventDefault?(): void;
      };
    }) => void
  >();
  private listenerSeed = 0;

  constructor(name: string, parent: FakeLeaferTarget | null = null) {
    this.name = name;
    this.parent = parent;
  }

  on_: App["on_"] = ((eventName, listener) => {
    if (eventName !== LEAFER_POINTER_MENU_EVENT) {
      return null;
    }

    const listenerId = ++this.listenerSeed;
    this.listeners.set(
      listenerId,
      listener as (event: {
        x: number;
        y: number;
        target?: unknown;
        origin?: {
          clientX?: number;
          clientY?: number;
          pageX?: number;
          pageY?: number;
          preventDefault?(): void;
        };
      }) => void
    );
    return listenerId as ReturnType<NonNullable<App["on_"]>>;
  }) as App["on_"];

  off_: App["off_"] = ((listenerId) => {
    this.listeners.delete(listenerId as number);
  }) as App["off_"];

  emitMenuBubble(event: {
    x: number;
    y: number;
    target?: unknown;
    origin?: {
      clientX?: number;
      clientY?: number;
      pageX?: number;
      pageY?: number;
      preventDefault?(): void;
    };
  }): void {
    let current: FakeLeaferTarget | null = this;
    while (current) {
      for (const listener of current.listeners.values()) {
        listener(event);
      }
      current = current.parent;
    }
  }
}

function waitForTimers(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
