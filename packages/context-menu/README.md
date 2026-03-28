# @leafergraph/context-menu

`@leafergraph/context-menu` 是一个 Leafer-first 的右键菜单包。

它的产品定位已经明确收口：

- 唯一正式触发源是 Leafer `pointer.menu`
- 菜单展示仍然通过内部 DOM overlay 完成
- 外部只使用单一公开入口，不再拼装 controller、renderer 或 adapter

## 适用场景

- LeaferGraph 节点图右键菜单
- 需要按 `canvas / node / link / custom` 分类出菜单的 Leafer 应用
- 需要级联子菜单、checkbox/radio、目标重绑和 hover+click 子菜单交互的场景

它不再面向这些场景：

- 纯 DOM 页面右键菜单
- 脱离 Leafer 事件系统的独立 Web 菜单框架
- 通过 `core` / `dom` / `adapters/*` 子路径做自定义拼装

## 快速开始

```ts
import { createLeaferContextMenu } from "@leafergraph/context-menu";

const menu = createLeaferContextMenu({
  app: graph.app,
  container,
  resolveItems(context) {
    if (context.target.kind === "node") {
      return [
        {
          key: "run-from-node",
          label: "从该节点开始执行",
          onSelect() {
            graph.playFromNode(String(context.target.id));
          }
        }
      ];
    }

    return [
      {
        key: "fit-view",
        label: "Fit View",
        onSelect() {
          graph.fitView();
        }
      }
    ];
  }
});

await graph.ready;

menu.bindCanvas(graph.app, {
  title: "画布"
});

const nodeView = graph.getNodeView("node-1");
if (nodeView) {
  menu.bindNode("node:node-1", nodeView, {
    id: "node-1",
    title: "示例节点"
  });
}
```

销毁时：

```ts
menu.destroy();
```

如果节点或连线在 `replaceGraphDocument(...)` 之后被重建，需要重新绑定新的 view 引用。

## 默认交互语义

- 根菜单默认由 Leafer `pointer.menu` 打开
- 子菜单默认触发策略是 `hover+click`
- 粗指针环境会自动把 hover 退化为 click
- 默认 `openDelay = 0`
- 默认 `closeDelay = 100`
- 默认支持：
  - `action`
  - `separator`
  - `group`
  - `submenu`
  - `checkbox`
  - `radio`

## 公开 API

根导出只保留下面这组 Leafer-only API：

- `createLeaferContextMenu(options)`
- `LEAFER_POINTER_MENU_EVENT`
- `LeaferContextMenu`
- `LeaferContextMenuOptions`
- `LeaferContextMenuContext`
- `LeaferContextMenuTarget`
- `LeaferContextMenuBinding`
- `LeaferContextMenuItem`
- `LeaferContextMenuActionItem`
- `LeaferContextMenuSubmenuItem`
- `LeaferContextMenuCheckboxItem`
- `LeaferContextMenuRadioItem`
- `LeaferContextMenuGroupItem`
- `LeaferContextMenuSeparatorItem`
- `LeaferPointerMenuEvent`

`createLeaferContextMenu(...)` 返回的句柄固定包含这些方法：

- `bindCanvas(target?, meta?)`
- `bindNode(key, target, meta?)`
- `bindLink(key, target, meta?)`
- `bindTarget(binding)`
- `unbindTarget(key)`
- `setResolver(resolver?)`
- `open(context, items?)`
- `close()`
- `isOpen()`
- `destroy()`

## 目标分类与菜单过滤

每次打开菜单时，当前命中目标都会被归一成 `LeaferContextMenuTarget`：

```ts
interface LeaferContextMenuTarget {
  kind: "canvas" | "node" | "link" | "custom" | string;
  id?: string;
  meta?: Record<string, unknown>;
  data?: unknown;
}
```

菜单项可以直接根据目标分类控制显隐和可用状态：

- `targetKinds`
- `excludeTargetKinds`
- `when(context)`
- `enableWhen(context)`

因此“右键到节点和右键到画布不一样”通常不需要外层硬编码分支，直接交给 resolver 和菜单项过滤即可。

## 与 leafergraph 的关系

- `leafergraph` 主包不再导出旧菜单兼容入口
- 右键菜单现在请直接使用 `@leafergraph/context-menu`
- `example/mini-graph` 是当前最小的 Leafer 菜单接入示例之一
