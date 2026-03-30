# `@leafergraph/theme`

`@leafergraph/theme` 是 LeaferGraph workspace 的视觉主题真源。

它负责这些内容：

- 主题模式 `light / dark`
- 命名主题 preset 注册表
- 默认 widget 主题
- 默认 graph 主题
- 默认 context-menu 主题

它不负责这些内容：

- 运行时 host
- 场景刷新 orchestration
- 视口、交互、延迟和缩放边界这类非视觉设置

如果你要改颜色、圆角、阴影、字体、节点壳观感、slot 调色或右键菜单视觉，请看这个包。  
如果你要改默认行为参数，请去 `@leafergraph/config`。

## 适用场景

- 给 `leafergraph` 主包切换亮暗模式或命名主题
- 给 `@leafergraph/context-menu` 提供一致的菜单视觉 token
- 在 workspace 内统一解析 graph / widget / context-menu 的默认主题
- 外部宿主注册一套完整的自定义视觉 preset

不适合这些场景：

- 想修改 `fitView` 默认 padding、viewport 缩放范围或菜单延迟
- 想通过运行时 host 直接刷新场景
- 想只 patch 少量 token 而不定义完整 preset

## 主题模型

这个包当前固定采用：

- `preset`
  - 一个命名主题方案
- `mode`
  - 当前固定为 `light | dark`
- `bundle`
  - 每个 mode 下同时包含：
    - `widget`
    - `graph`
    - `contextMenu`

workspace 内建一套默认 preset，稳定 id 固定为 `default`。

## 快速开始

### 1. 在 `leafergraph` 主包里消费主题

```ts
import { createLeaferGraph } from "leafergraph";

const graph = createLeaferGraph(container, {
  themePreset: "default",
  themeMode: "dark"
});

await graph.ready;
```

如果后续只切换亮暗模式，继续使用主包现有入口：

```ts
graph.setThemeMode("light");
```

### 2. 在 `@leafergraph/context-menu` 里消费主题

```ts
import { createLeaferContextMenu } from "@leafergraph/context-menu";

const menu = createLeaferContextMenu({
  app: graph.app,
  container,
  themePreset: "default",
  resolveThemeMode() {
    return "dark";
  }
});
```

菜单会在每次打开时重新按 `themePreset + mode` 解析对应 token。

### 3. 注册一个自定义 preset

```ts
import {
  registerThemePreset,
  type LeaferGraphThemePreset
} from "@leafergraph/theme";
import { resolveDefaultWidgetTheme } from "@leafergraph/theme/widget";
import { resolveDefaultGraphTheme } from "@leafergraph/theme/graph";
import { resolveDefaultContextMenuTheme } from "@leafergraph/theme/context-menu";

const oceanPreset: LeaferGraphThemePreset = {
  id: "ocean",
  label: "Ocean",
  modes: {
    light: {
      widget: resolveDefaultWidgetTheme("light"),
      graph: resolveDefaultGraphTheme("light"),
      contextMenu: resolveDefaultContextMenuTheme("light")
    },
    dark: {
      widget: resolveDefaultWidgetTheme("dark"),
      graph: resolveDefaultGraphTheme("dark"),
      contextMenu: resolveDefaultContextMenuTheme("dark")
    }
  }
};

registerThemePreset(oceanPreset, { overwrite: true });
```

v1 约束固定为：外部新增主题按完整 preset 注册，不提供 partial merge / patch 语义。

## 公开入口

### 根入口

根入口主要负责主题模式、preset 注册表和公共类型：

- `LeaferGraphThemeMode`
- `LeaferGraphThemePresetId`
- `LeaferGraphLinkPropagationAnimationPreset`
- `LeaferGraphThemePreset`
- `LeaferGraphThemeBundle`
- `registerThemePreset(...)`
- `unregisterThemePreset(...)`
- `getThemePreset(...)`
- `listThemePresets()`
- `resolveThemePreset(...)`

### `./widget`

负责 widget 视觉 token 与默认 resolver：

- `LeaferGraphWidgetThemeTokens`
- `LeaferGraphWidgetThemeContext`
- `resolveDefaultWidgetTheme(...)`
- `resolveBasicWidgetTheme(...)`

### `./graph`

负责 graph 视觉 token 与默认 resolver：

- `LeaferGraphGraphThemeTokens`
- `LeaferGraphNodeShellStyleConfig`
- `NodeShellLayoutMetrics`
- `NodeShellRenderTheme`
- `resolveDefaultGraphTheme(...)`
- `resolveDefaultCanvasBackground(...)`
- `resolveDefaultLinkStroke(...)`
- `resolveDefaultNodeShellRenderTheme(...)`
- `resolveDefaultSelectedStroke(...)`

### `./context-menu`

负责右键菜单视觉 token 与默认 resolver：

- `LeaferGraphContextMenuThemeTokens`
- `resolveDefaultContextMenuTheme(...)`

### `./registry`

负责命名 preset 注册表：

- `LeaferGraphThemePreset`
- `LeaferGraphThemeBundle`
- `defaultThemePreset`
- `DEFAULT_THEME_PRESET_ID`
- `registerThemePreset(...)`
- `unregisterThemePreset(...)`
- `getThemePreset(...)`
- `listThemePresets()`
- `resolveThemePreset(...)`

## 与其它包的边界

- `@leafergraph/theme`
  - 视觉 token、默认主题真源、preset 注册表
- `@leafergraph/config`
  - 非视觉设置、默认值、normalize helper、Leafer 配置桥接
- `leafergraph`
  - 消费主题结果并驱动运行时场景刷新
- `@leafergraph/context-menu`
  - 消费菜单主题 token，不自己维护默认视觉真源

一个简单判断是：

- 改“看起来怎样”，来 `theme`
- 改“行为默认值怎样”，去 `config`

## 常用命令

```bash
bun run build:theme
bun run test:theme
```
