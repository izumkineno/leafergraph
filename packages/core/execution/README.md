# `@leafergraph/execution`

`@leafergraph/execution` 是 LeaferGraph workspace 的纯执行内核。

它只负责“节点如何执行、数据如何传播、图级运行如何推进、反馈事件如何汇总”这条链，不负责图渲染、交互宿主、主题或菜单。

## 包定位

适合直接依赖它的场景：

- 自己实现一个不依赖 `leafergraph` 主包的执行宿主
- 需要正式的执行上下文、传播元数据和执行反馈类型
- 需要复用 `system/on-play`、`system/timer` 这两个内建执行节点定义
- 需要把节点级执行、图级状态机和反馈事件拆成独立子系统

不适合直接把它当成：

- 图运行时主包
- 节点模型真源
- UI 层运行日志面板或动画层

一句话记忆：

- `@leafergraph/node` 定义“图是什么”
- `@leafergraph/execution` 定义“图怎么跑”
- `leafergraph` 负责“图怎么显示、怎么交互、怎么把执行投影到场景里”

## 公开入口

根入口当前主要分成四组：

- 执行状态与反馈类型
  - `LeaferGraphExecutionContext`
  - `LeaferGraphActionExecutionOptions`
  - `LeaferGraphNodeExecutionEvent`
  - `LeaferGraphGraphExecutionEvent`
  - `LeaferGraphLinkPropagationEvent`
  - `ExecutionFeedbackEvent`
- 内建执行节点
  - `LEAFER_GRAPH_ON_PLAY_NODE_TYPE`
  - `leaferGraphOnPlayNodeDefinition`
  - `LEAFER_GRAPH_TIMER_NODE_TYPE`
  - `leaferGraphTimerNodeDefinition`
  - `LEAFER_GRAPH_TIMER_DEFAULT_INTERVAL_MS`
- 节点与图级执行宿主
  - `LeaferGraphNodeExecutionHost`
  - `LeaferGraphGraphExecutionHost`
- 反馈适配层
  - `LeaferGraphLocalExecutionFeedbackAdapter`

## 最小使用方式

如果你只是写节点定义，最常见的用法是从这里导入执行相关类型：

```ts
import type {
  LeaferGraphActionExecutionOptions,
  LeaferGraphExecutionContext
} from "@leafergraph/execution";

export function handleExecute(
  context: LeaferGraphExecutionContext,
  options: LeaferGraphActionExecutionOptions
) {
  console.log(context.source, options.trigger);
}
```

如果你要搭一个自定义执行宿主，入口通常是：

```ts
import { NodeRegistry } from "@leafergraph/node";
import {
  LeaferGraphGraphExecutionHost,
  LeaferGraphNodeExecutionHost,
  leaferGraphOnPlayNodeDefinition,
  leaferGraphTimerNodeDefinition
} from "@leafergraph/execution";

const registry = new NodeRegistry({
  get() {
    return undefined;
  }
});

registry.registerNode(leaferGraphOnPlayNodeDefinition, { overwrite: true });
registry.registerNode(leaferGraphTimerNodeDefinition, { overwrite: true });

const nodeExecutionHost = new LeaferGraphNodeExecutionHost({
  nodeRegistry: registry,
  widgetRegistry: { get() { return undefined; } },
  graphNodes,
  graphLinks
});

const graphExecutionHost = new LeaferGraphGraphExecutionHost({
  nodeExecutionHost
});
```

在 workspace 内更常见的消费方式是：

- `@leafergraph/basic-kit/node`
  - 直接复用这里的 `on-play` / `timer` 定义来组装默认系统节点
- `@leafergraph/contracts`
  - 复用执行相关类型，统一向宿主层公开共享协议
- `leafergraph`
  - 消费 `LeaferGraphNodeExecutionHost`、`LeaferGraphGraphExecutionHost` 和本地反馈适配器，把执行结果投影成节点状态、连线动画和 UI 反馈

## 与其它包的边界

| 包 | 负责什么 |
| --- | --- |
| `@leafergraph/node` | 节点定义、图文档、注册表、序列化模型 |
| `@leafergraph/execution` | 执行状态机、传播语义、执行反馈、内建执行节点 |
| `@leafergraph/contracts` | 面向多个包共享的宿主协议和公开类型 |
| `leafergraph` | 图运行时、场景刷新、交互和执行反馈投影 |

这里有一个固定约束：

- `@leafergraph/execution` 只依赖 `@leafergraph/node`
- 它不依赖 `@leafergraph/contracts`、`@leafergraph/theme`、`@leafergraph/config`
- 这保证执行内核可以单独被其它宿主复用

## 何时直接依赖它

优先直接依赖 `@leafergraph/execution` 的情况：

- 你在写自定义执行宿主
- 你在实现运行反馈桥接
- 你在写执行相关测试，希望不把 UI 宿主一起拉进来

优先依赖别的包的情况：

- 只是要创建图实例：用 `leafergraph`
- 只是要安装默认系统节点：用 `@leafergraph/basic-kit`
- 只是要写公开的宿主类型：先看 `@leafergraph/contracts`

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:execution
bun run test:execution
```

## 继续阅读

- [根 README](../../README.md)
- [@leafergraph/contracts README](../contracts/README.md)
- [leafergraph README](../leafergraph/README.md)
- [使用与扩展指南](../leafergraph/使用与扩展指南.md)
