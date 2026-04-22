# `@leafergraph/core/config`

`@leafergraph/core/config` 是 LeaferGraph workspace 的非视觉配置真源。

它只负责稳定配置结构、默认值和 normalize helper，本身不依赖其它 `@leafergraph/*` workspace 包。

## 包定位

适合直接依赖它的场景：

- 统一主包的 graph / widget / leafer 配置
- 调整菜单行为配置
- 消费已补齐默认值的 `Normalized...Config`
- 把 Leafer 原生配置通过“精选字段 + raw”方式暴露给宿主

不适合直接把它当成：

- 主题包
- 图运行时主包
- 历史栈实现包

## 公开入口

### 根入口

- `LeaferGraphConfig`
- `NormalizedLeaferGraphConfig`
- `LeaferContextMenuConfig`
- `normalizeLeaferGraphConfig(...)`
- `resolveDefaultLeaferGraphConfig(...)`
- `normalizeLeaferContextMenuConfig(...)`
- `resolveDefaultLeaferContextMenuConfig(...)`

### 子路径

- `@leafergraph/core/config/graph`
  - `graph.view`、`graph.runtime`、`graph.history`
- `@leafergraph/core/config/widget`
  - Widget editing 配置与 `resolveWidgetEditingOptions(...)`
- `@leafergraph/core/config/context-menu`
  - 菜单行为配置
- `@leafergraph/core/config/leafer`
  - Leafer 与官方插件配置桥接

## 最小使用方式

```ts
import { createLeaferGraph } from "leafergraph";

const graph = createLeaferGraph(container, {
  config: {
    graph: {
      view: {
        defaultFitPadding: 96
      },
      runtime: {
        linkPropagationAnimation: "performance"
      },
      history: {
        maxEntries: 100,
        resetOnDocumentSync: true
      }
    },
    widget: {
      editing: {
        enabled: true
      }
    },
    leafer: {
      viewport: {
        zoom: {
          min: 0.2,
          max: 4
        }
      }
    }
  }
});
```

菜单配置也从这个真源来：

```ts
import { createLeaferContextMenu } from "@leafergraph/extensions/context-menu";

const menu = createLeaferContextMenu({
  app: graph.app,
  container,
  config: {
    submenu: {
      triggerMode: "hover",
      openDelay: 0,
      closeDelay: 100
    }
  }
});
```

## 与其它包的边界

| 包 | 关系 |
| --- | --- |
| `@leafergraph/core/config` | 非视觉配置真源 |
| `@leafergraph/core/theme` | 视觉主题真源 |
| `@leafergraph/extensions/undo-redo` | 消费 `graph.history`，但不会因为写了 config 自动启用 |
| `@leafergraph/extensions/context-menu` | 消费菜单配置 |
| `leafergraph` | 消费 graph / widget / leafer config 并装配运行时 |

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:config
```

## 继续阅读

- [根 README](../../README.md)
- [@leafergraph/core/theme README](../theme/README.md)
- [@leafergraph/extensions/undo-redo README](../../extensions/undo-redo/README.md)
- [leafergraph README](../../leafergraph/README.md)



