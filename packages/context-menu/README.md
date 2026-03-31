# `@leafergraph/context-menu`

`@leafergraph/context-menu` 是纯 Leafer-first 的右键菜单 runtime 包。

它负责菜单目标绑定、resolver 链和 DOM overlay；它不再承载 `leafergraph` 专属 builtins，也不依赖主包。

## 包定位

适合直接依赖它的场景：

- 需要一个基于 Leafer `pointer.menu` 的右键菜单 runtime
- 需要按 `canvas / node / link / custom` 分类动态生成菜单
- 需要子菜单、checkbox、radio、group 等结构化菜单项

不适合直接把它当成：

- 图运行时主包
- 内建菜单动作包
- 通用 DOM 菜单框架

## 公开入口

根入口当前只保留纯菜单 runtime API：

- `createLeaferContextMenu(...)`
- `LEAFER_POINTER_MENU_EVENT`
- `LeaferContextMenu`
- `LeaferContextMenuItem`
- `LeaferContextMenuContext`
- `LeaferContextMenuTarget`

配置真源来自 `@leafergraph/config`，主题 token 来自 `@leafergraph/theme`。

## 最小使用方式

```ts
import { createLeaferContextMenu } from "@leafergraph/context-menu";

const menu = createLeaferContextMenu({
  app: graph.app,
  container,
  resolveThemeMode() {
    return "dark";
  },
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

menu.bindCanvas(graph.app, { title: "画布" });
```

如果你要直接接节点图常见动作，请额外装：

- `@leafergraph/context-menu-builtins`

## 与其它包的边界

| 包 | 关系 |
| --- | --- |
| `@leafergraph/context-menu` | 纯菜单 runtime |
| `@leafergraph/context-menu-builtins` | 节点图内建菜单动作集成层 |
| `@leafergraph/config` | 菜单行为配置真源 |
| `@leafergraph/theme` | 菜单视觉 token 真源 |

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:context-menu
bun run test:context-menu
```

## 继续阅读

- [根 README](../../README.md)
- [@leafergraph/context-menu-builtins README](../context-menu-builtins/README.md)
- [mini-graph README](../../example/mini-graph/README.md)
