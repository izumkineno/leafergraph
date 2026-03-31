# `@leafergraph/basic-kit`

`@leafergraph/basic-kit` 是 LeaferGraph workspace 的默认内容包。

它负责把“基础 widgets + 系统节点”打包成一套显式安装的默认内容，而不再让主包隐式内装这些条目。

## 包定位

适合直接依赖它的场景：

- 需要 `system/on-play`、`system/timer`
- 需要基础 widgets，例如 `input`、`textarea`、`select`、`toggle`、`slider`
- 需要一条 plugin 直接装好默认内容

不适合直接把它当成：

- 图运行时主包
- Widget runtime 真源
- 主题或配置真源

## 公开入口

### 根入口

- `leaferGraphBasicKitPlugin`

根入口只做一件事：按固定顺序安装默认内容。

### `./widget`

这个子路径负责基础 Widget 条目：

- `BasicWidgetLibrary`
- `BasicWidgetRendererLibrary`

### `./node`

这个子路径负责系统节点模块：

- `createBasicSystemNodeModule()`
- `LEAFER_GRAPH_ON_PLAY_NODE_TYPE`
- `leaferGraphOnPlayNodeDefinition`
- `LEAFER_GRAPH_TIMER_NODE_TYPE`
- `leaferGraphTimerNodeDefinition`

## 最小使用方式

推荐方式是把它作为 plugin 显式装进主包：

```ts
import { leaferGraphBasicKitPlugin } from "@leafergraph/basic-kit";
import { createLeaferGraph } from "leafergraph";

const graph = createLeaferGraph(container, {
  plugins: [leaferGraphBasicKitPlugin]
});

await graph.ready;
```

如果你只想要其中一部分内容，也可以拆开用：

```ts
import { createBasicSystemNodeModule } from "@leafergraph/basic-kit/node";
import { BasicWidgetLibrary } from "@leafergraph/basic-kit/widget";

graph.installModule(createBasicSystemNodeModule(), { overwrite: true });

for (const entry of new BasicWidgetLibrary().createEntries()) {
  graph.registerWidget(entry, { overwrite: true });
}
```

## 与其它包的边界

| 包 | 关系 |
| --- | --- |
| `@leafergraph/basic-kit` | 默认内容包 |
| `@leafergraph/widget-runtime` | Widget runtime 真源 |
| `@leafergraph/execution` | 系统执行节点的逻辑真源 |
| `@leafergraph/theme` | 默认视觉主题真源 |
| `leafergraph` | 消费这套默认内容的图宿主 |

一个简单判断是：

- 想快速得到“能用的默认节点和控件”，来 `basic-kit`
- 想改 Widget runtime、主题或主包行为，不要改这里

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:basic-kit
bun run test:basic-kit
```

## 继续阅读

- [根 README](../../README.md)
- [@leafergraph/execution README](../execution/README.md)
- [@leafergraph/widget-runtime README](../widget-runtime/README.md)
- [leafergraph README](../leafergraph/README.md)
