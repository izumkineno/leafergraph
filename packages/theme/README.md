# `@leafergraph/theme`

`@leafergraph/theme` 是 LeaferGraph workspace 的视觉主题真源。

它负责 `themePreset`、`themeMode` 以及 graph / widget / context-menu 三类视觉 token；它不负责 `fitView`、菜单延迟、历史栈容量等非视觉行为设置。

## 包定位

适合直接依赖它的场景：

- 切换亮暗模式或命名 preset
- 注册一套自定义主题
- 获取 graph、widget 或 context-menu 的默认视觉 token

不适合直接把它当成：

- 行为配置包
- 图运行时主包
- DOM 菜单 runtime

固定边界：

- `theme` 管“看起来怎样”
- `config` 管“默认行为怎样”

## 公开入口

### 根入口

- `LeaferGraphThemeMode`
- `LeaferGraphThemePresetId`
- `LeaferGraphLinkPropagationAnimationPreset`
- `LeaferGraphThemePreset`
- `LeaferGraphThemeBundle`
- `registerThemePreset(...)`
- `resolveThemePreset(...)`

### 子路径

- `@leafergraph/theme/widget`
  - Widget token 与默认 resolver
- `@leafergraph/theme/graph`
  - 节点壳、连线、数据流动画相关 token 与 resolver
- `@leafergraph/theme/context-menu`
  - 菜单 token 与默认 resolver
- `@leafergraph/theme/registry`
  - preset 注册表

## 最小使用方式

```ts
import { createLeaferGraph } from "leafergraph";

const graph = createLeaferGraph(container, {
  themePreset: "default",
  themeMode: "dark"
});

await graph.ready;
graph.setThemeMode("light");
```

如果你要注册一套自定义 preset：

```ts
import {
  registerThemePreset,
  type LeaferGraphThemePreset
} from "@leafergraph/theme";
import { resolveDefaultGraphTheme } from "@leafergraph/theme/graph";
import { resolveDefaultWidgetTheme } from "@leafergraph/theme/widget";
import { resolveDefaultContextMenuTheme } from "@leafergraph/theme/context-menu";

const oceanPreset: LeaferGraphThemePreset = {
  id: "ocean",
  label: "Ocean",
  modes: {
    light: {
      graph: resolveDefaultGraphTheme("light"),
      widget: resolveDefaultWidgetTheme("light"),
      contextMenu: resolveDefaultContextMenuTheme("light")
    },
    dark: {
      graph: resolveDefaultGraphTheme("dark"),
      widget: resolveDefaultWidgetTheme("dark"),
      contextMenu: resolveDefaultContextMenuTheme("dark")
    }
  }
};

registerThemePreset(oceanPreset, { overwrite: true });
```

## 与其它包的边界

| 包 | 关系 |
| --- | --- |
| `@leafergraph/theme` | 视觉主题真源 |
| `@leafergraph/config` | 非视觉配置真源 |
| `@leafergraph/context-menu` | 消费菜单主题 token |
| `@leafergraph/widget-runtime` | 消费 Widget 主题 token |
| `leafergraph` | 消费 graph 主题并驱动场景刷新 |

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:theme
bun run test:theme
```

## 继续阅读

- [根 README](../../README.md)
- [@leafergraph/config README](../config/README.md)
- [@leafergraph/context-menu README](../../extensions/context-menu/README.md)
- [leafergraph README](../leafergraph/README.md)
