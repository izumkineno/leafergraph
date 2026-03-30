# `@leafergraph/config`

`@leafergraph/config` 是 LeaferGraph workspace 的非视觉配置真源。

它本身不依赖其它 `@leafergraph/*` workspace 包，只负责提供稳定配置结构、默认值和桥接 helper。

它负责这些内容：

- 主包运行时设置
- widget 编辑设置
- 右键菜单行为设置
- Leafer 与官方插件配置桥接
- 默认值 resolver 与 normalize helper

它不负责这些内容：

- 颜色、圆角、阴影、字体等视觉 token
- 主题 preset 与亮暗模式
- 运行时 host 或场景 orchestration

边界可以记成一句话：

- `@leafergraph/theme` 管视觉
- `@leafergraph/config` 管非视觉设置

## 适用场景

- 想通过 `config` 统一配置 `leafergraph` 主包行为
- 想通过 `config` 调整 `@leafergraph/context-menu` 子菜单策略
- 想在 workspace 内拿到一份已补齐默认值的稳定配置
- 想把 Leafer 原生配置以“精选字段 + raw”方式暴露给宿主

不适合这些场景：

- 想切换主题 preset 或亮暗模式
- 想直接驱动运行时 host 做刷新
- 想把菜单、节点壳或 widget 的视觉 token 放进配置包

## 快速开始

### 1. 给 `leafergraph` 主包传入 nested config

```ts
import { createLeaferGraph } from "leafergraph";

const graph = createLeaferGraph(container, {
  config: {
    graph: {
      fill: "#0b1220",
      view: {
        defaultFitPadding: 96
      },
      runtime: {
        linkPropagationAnimation: "performance"
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

await graph.ready;
```

### 2. 给 `@leafergraph/context-menu` 传入行为配置

```ts
import { createLeaferContextMenu } from "@leafergraph/context-menu";

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

## 配置形状速记

### `graph`

主包图级配置，当前最常用的是：

- `graph.fill`
- `graph.view.defaultFitPadding`
- `graph.runtime.linkPropagationAnimation`

### `widget`

Widget 编辑相关配置，当前入口是：

- `widget.editing.enabled`
- `widget.editing.useOfficialTextEditor`
- `widget.editing.allowOptionsMenu`

### `context-menu`

右键菜单行为配置，当前入口是：

- `context-menu.submenu.triggerMode`
- `context-menu.submenu.openDelay`
- `context-menu.submenu.closeDelay`

### `leafer`

Leafer 原生与官方插件配置桥接，当前已公开这些分组：

- `leafer.app`
- `leafer.tree`
- `leafer.viewport`
- `leafer.view`
- `leafer.editor`
- `leafer.textEditor`
- `leafer.resize`
- `leafer.state`
- `leafer.find`
- `leafer.flow`

其中当前真实运行时接线覆盖的是：

- `app`
- `tree`
- `viewport`
- `view`
- `editor`
- `textEditor`

`resize / state / find / flow` 目前是公开配置位与 passthrough 预留，不在本轮强制消费为完整运行时行为。

## 公开入口

### 根入口

根入口负责主包与菜单的总配置类型，以及默认值 / normalize helper：

- `LeaferGraphConfig`
- `NormalizedLeaferGraphConfig`
- `LeaferContextMenuConfig`
- `resolveDefaultLeaferGraphConfig(...)`
- `resolveDefaultLeaferContextMenuConfig(...)`
- `normalizeLeaferGraphConfig(...)`
- `normalizeLeaferContextMenuConfig(...)`

### `./graph`

负责主包 graph 级配置：

- `LeaferGraphGraphConfig`
- `LeaferGraphGraphViewConfig`
- `LeaferGraphGraphRuntimeConfig`
- `resolveDefaultLeaferGraphGraphConfig(...)`
- `normalizeLeaferGraphGraphConfig(...)`
- `DEFAULT_FIT_VIEW_PADDING`
- `VIEWPORT_MIN_SCALE`
- `VIEWPORT_MAX_SCALE`
- `DEFAULT_LINK_PROPAGATION_ANIMATION_PRESET`

### `./widget`

负责 widget 编辑配置：

- `LeaferGraphWidgetConfig`
- `LeaferGraphWidgetEditingConfig`
- `LeaferGraphWidgetEditingOptions`
- `resolveDefaultLeaferGraphWidgetConfig(...)`
- `resolveDefaultLeaferGraphWidgetEditingConfig(...)`
- `normalizeLeaferGraphWidgetConfig(...)`
- `resolveWidgetEditingOptions(...)`

### `./context-menu`

负责右键菜单行为配置：

- `LeaferContextMenuConfig`
- `LeaferContextMenuSubmenuConfig`
- `LeaferContextMenuSubmenuTriggerMode`
- `resolveDefaultLeaferContextMenuConfig(...)`
- `normalizeLeaferContextMenuConfig(...)`

### `./leafer`

负责 Leafer 与官方插件配置桥接：

- `LeaferGraphLeaferConfig`
- `LeaferGraphLeaferAppConfig`
- `LeaferGraphLeaferViewportConfig`
- `LeaferGraphLeaferViewConfig`
- `LeaferGraphLeaferEditorConfig`
- `LeaferGraphLeaferTextEditorConfig`
- `LeaferGraphLeaferResizeConfig`
- `LeaferGraphLeaferStateConfig`
- `LeaferGraphLeaferFindConfig`
- `LeaferGraphLeaferFlowConfig`
- `resolveDefaultLeaferGraphLeaferConfig(...)`
- `normalizeLeaferGraphLeaferConfig(...)`

## Leafer 配置桥接规则

这个包对 Leafer 配置固定采用“精选稳定字段 + raw”模式：

- 常用稳定字段直接显式暴露
  - 例如 `pixelSnap`、`usePartRender`、`usePartLayout`
  - 例如 `viewport.zoom.min / max`
  - 例如 `viewport.move.holdSpaceKey / holdMiddleKey / scroll`
- 每个子配置都保留 `raw`
  - 用于透传当前还没有收口成正式字段的 Leafer 配置

这意味着：

- 外部宿主平时优先写精选字段
- workspace 内部运行时再统一把精选字段和 `raw` 合并
- 当 Leafer 新能力暂时还没正式收口时，仍可先通过 `raw` 接入

## 何时直接使用 normalize helper

推荐规则是：

- 外部调用方大多数只需要写 `config`
- workspace 内部包应优先消费 normalize 结果

也就是说：

- 页面或 demo
  - 直接写 `createLeaferGraph(..., { config: ... })`
- 包内部运行时
  - 先 `normalizeLeaferGraphConfig(...)`
  - 再消费稳定的 `Normalized...` 结构

这样可以避免默认值散落在多个包里重复维护。

## 与其它包的边界

- `@leafergraph/config`
  - 非视觉设置、默认值、normalize helper、Leafer 配置桥接
- `@leafergraph/theme`
  - 视觉 token、preset、mode
- `leafergraph`
  - 消费 graph / widget / leafer config 并装配正式运行时
- `@leafergraph/context-menu`
  - 消费菜单配置，不自己维护行为默认值真源

## 常用命令

```bash
bun run build:config
```
