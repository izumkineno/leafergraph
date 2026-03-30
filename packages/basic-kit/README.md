# `@leafergraph/basic-kit`

`@leafergraph/basic-kit` 是 LeaferGraph workspace 里的默认内容包。

它负责这些内容：

- 基础 widget 条目库
- 默认系统节点模块
- 一键安装默认内容的 plugin
- `./widget` 与 `./node` 子路径导出

它不负责这些内容：

- `leafergraph` 主包 facade
- widget runtime 真源
- graph 执行宿主或场景装配
- 默认主题真源

## 适用场景

- 需要 `system/on-play` 与 `system/timer`
- 需要基础 widgets，例如 `input / textarea / select / toggle / slider`
- 希望在宿主初始化时用一条 plugin 快速装好默认内容
- 希望显式安装默认内容，而不是依赖主包隐式内建

不适合这些场景：

- 想改 widget runtime 行为
- 想改默认主题 token
- 想把页面层 demo 内容硬塞进内容包

## 快速开始

### 1. 推荐方式：通过 plugin 一键安装

```ts
import { leaferGraphBasicKitPlugin } from "@leafergraph/basic-kit";
import { createLeaferGraph } from "leafergraph";

const graph = createLeaferGraph(container, {
  plugins: [leaferGraphBasicKitPlugin]
});

await graph.ready;
```

这也是当前最推荐的接法，因为它会按固定顺序统一安装：

1. 基础 widget 条目
2. 默认系统节点模块

### 2. 运行时等价接法：手动 `graph.use(...)`

```ts
import { leaferGraphBasicKitPlugin } from "@leafergraph/basic-kit";

await graph.use(leaferGraphBasicKitPlugin);
```

对于已经创建好的图实例，这条路径和 `plugins: [leaferGraphBasicKitPlugin]` 语义等价。

## 子路径使用

### `./widget`

如果你不想整包安装，而是只想拿基础 widget 条目：

```ts
import { BasicWidgetLibrary } from "@leafergraph/basic-kit/widget";

for (const entry of new BasicWidgetLibrary().createEntries()) {
  graph.registerWidget(entry, { overwrite: true });
}
```

### `./node`

如果你只想安装系统节点模块：

```ts
import { createBasicSystemNodeModule } from "@leafergraph/basic-kit/node";

graph.installModule(createBasicSystemNodeModule(), { overwrite: true });
```

## 公开入口

### 根入口

根入口固定只负责一键安装默认内容：

- `leaferGraphBasicKitPlugin`

### `./widget`

负责基础 widget 条目与相关类型：

- `BasicWidgetLibrary`
- `BasicWidgetRendererLibrary`
- 基础 widget 相关类型

当前 `BasicWidgetLibrary().createEntries()` 会生成这些基础 widget：

- `number`
- `string`
- `custom`
- `input`
- `textarea`
- `select`
- `checkbox`
- `toggle`
- `slider`
- `button`
- `radio`

### `./node`

负责系统节点模块与节点定义：

- `createBasicSystemNodeModule()`
- `LEAFER_GRAPH_ON_PLAY_NODE_TYPE`
- `leaferGraphOnPlayNodeDefinition`
- `LEAFER_GRAPH_TIMER_NODE_TYPE`
- `LEAFER_GRAPH_TIMER_DEFAULT_INTERVAL_MS`
- `leaferGraphTimerNodeDefinition`
- `LeaferGraphTimerRegistration`
- `LeaferGraphTimerRuntimePayload`

当前 `createBasicSystemNodeModule()` 固定包含：

- `system/on-play`
- `system/timer`

## 与其它包的边界

- `@leafergraph/basic-kit`
  - 默认内容包，只负责“装什么”
- `@leafergraph/widget-runtime`
  - widget runtime 真源，负责“怎么渲染和编辑 widget”
- `@leafergraph/theme`
  - 视觉主题真源
- `leafergraph`
  - graph 运行时宿主，负责消费这些默认内容

一个简单判断是：

- 想快速拥有默认节点和基础 widgets，来 `basic-kit`
- 想改 runtime 能力，去 `widget-runtime` 或 `leafergraph`
- 想改视觉 token，去 `theme`

## 常用命令

```bash
bun run build:basic-kit
bun run test:basic-kit
```
