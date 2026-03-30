# leafergraph

`leafergraph` 是当前工作区里的 Leafer-first 节点图主包。

它的职责不是承接 editor 页面壳层，也不是复制 `@leafergraph/node` 的模型 SDK，而是作为 Leafer 宿主与图 façade，负责下面这些正式能力：

- 把 `GraphDocument` 恢复成可交互、可执行、可局部刷新的 Leafer 场景
- 管理节点、连线、Widget、主题、视图和交互宿主
- 消费 `@leafergraph/execution` 并把执行态投影回 Leafer scene
- 对外暴露稳定的图 API、宿主级运行反馈 API 和扩展入口
- 为外部页面和未来宿主 / runtime 适配层提供统一运行时基础

当前仓库处于一轮兼容式拆分阶段：

- 公共契约真源已经迁到 `@leafergraph/contracts`
- Widget runtime 真源已经迁到 `@leafergraph/widget-runtime`
- `leafergraph` 根入口仍继续 re-export 这些契约
- `leafergraph` 根入口仍继续 re-export 常用 Widget runtime helper
- `leafergraph/graph-document-diff` 子路径仍继续可用

这意味着外部当前仍可继续从 `leafergraph` 导入原有公共类型和常用 Widget helper；但在 workspace 内部，新增实现应优先直接依赖 `@leafergraph/contracts` 和 `@leafergraph/widget-runtime`

如果你只想知道“怎么用”，从这份 README 开始即可。  
如果你要扩插件、接 Widget、读内部实现或排查刷新链路，请按下面的深链继续读。

## 适用场景

`leafergraph` 适合这些场景：

- 在浏览器里创建一个节点图画布，并用 Leafer 渲染节点、连线和 Widget
- 从正式 `GraphDocument` 恢复一张图
- 在运行时注册节点、模块、Widget 或插件
- 在本地执行图级 `play / step / stop` 或节点级 `playFromNode(...)`
- 订阅节点执行、图执行、节点状态和连线传播反馈
- 对接外部宿主、remote runtime feedback 或外部调试面板

它不直接负责这些事情：

- workspace 页面布局和 UI 壳层
- authority transport、session、OpenRPC、bundle loader
- `@leafergraph/node` 的节点模型定义和序列化真源

## 包边界

这四个包的关系是当前最重要的前置认知：

| 包 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `@leafergraph/node` | 节点定义、模块、注册表、图文档模型、序列化类型 | Leafer 场景、交互、渲染宿主 |
| `@leafergraph/execution` | 执行链、传播、图级 `play/step/stop`、执行反馈、系统执行节点 | Leafer scene、节点壳、Widget 渲染、宿主状态投影 |
| `@leafergraph/contracts` | 插件协议、Widget 契约、图操作类型、运行反馈类型、图文档 diff helper | 主包 facade、场景宿主、节点交互实现 |
| `@leafergraph/widget-runtime` | Widget 注册表、生命周期 helper、编辑宿主、交互 helper | 图主题装配、内建基础控件库、主包 facade |
| `leafergraph` | 图运行时、渲染、交互基础设施、宿主反馈、公共 API | 宿主 UI、authority transport、bundle 协议 |
| 外部宿主 / 页面壳层 | 页面组织、bundle 装配、外围命令和协议接线 | 主包运行时真源 |

一个实用判断是：

- 定义“节点是什么”，去 `@leafergraph/node`
- 定义“节点怎么执行、怎么传播”，去 `@leafergraph/execution`
- 定义“插件、图操作和运行反馈这些公共契约是什么”，去 `@leafergraph/contracts`
- 让“节点图跑起来、显示出来、可交互”，用 `leafergraph`
- 做“宿主页面、菜单、bundle 面板和外围协议接线”，放在主包外处理

## 五分钟上手

### 1. 创建图实例

```ts
import { createLeaferGraph, type GraphDocument } from "leafergraph";

const container = document.getElementById("app");
if (!container) {
  throw new Error("缺少挂载容器 #app");
}

const documentData: GraphDocument = {
  documentId: "hello-graph",
  revision: 1,
  appKind: "leafergraph-local",
  nodes: [],
  links: []
};

const graph = createLeaferGraph(container, {
  document: documentData
});

await graph.ready;
```

### 2. 注册一个节点，再创建实例

`NodeDefinition` 属于 `@leafergraph/node`，不是 `leafergraph` 直接导出的公共类型：

```ts
import type { NodeDefinition } from "@leafergraph/node";
import { createLeaferGraph } from "leafergraph";

const helloNode: NodeDefinition = {
  type: "example/hello",
  title: "Hello Node",
  category: "Examples",
  outputs: [{ name: "Text", type: "string" }],
  onExecute(node, _context, api) {
    node.title = "Hello Executed";
    api?.setOutputData(0, "hello");
  }
};

const graph = createLeaferGraph(container);
await graph.ready;

graph.registerNode(helloNode, { overwrite: true });
graph.createNode({
  id: "hello-1",
  type: "example/hello",
  x: 120,
  y: 80
});
```

### 3. 跑一次执行链

```ts
graph.play();
```

如果你要从某个节点直接起跑：

```ts
graph.playFromNode("hello-1");
```

### 4. 销毁

```ts
graph.destroy();
```

## 核心概念

| 概念 | 作用 |
| --- | --- |
| `GraphDocument` | 正式图快照，包含节点、连线和图级元数据 |
| `GraphOperation` | 正式图操作，表达节点/连线/文档的增删改移 |
| `GraphDocumentDiff` | 文档增量，适合 authority 或同步链做增量投影 |
| `NodeModule` | 一组可批量安装的节点定义 |
| `LeaferGraphNodePlugin` | 主包运行时插件，能注册节点、模块和 Widget |
| `LeaferGraphWidgetEntry` | 一个完整 Widget 条目，包含定义和 renderer |
| `ExecutionFeedbackEvent` | 纯执行反馈事件，只覆盖节点执行、图执行和连线传播 |
| `RuntimeFeedbackEvent` | 宿主级运行反馈事件，等于 `ExecutionFeedbackEvent + node.state` |

## 对外 API 导航

`src/index.ts` 当前对外暴露的内容，建议按下面几组理解：

### 1. 图宿主入口

- `LeaferGraph`
- `createLeaferGraph(...)`

这是最常用的一组入口。你通常会先创建实例，再调用：

- `replaceGraphDocument(...)`
- `applyGraphOperation(...)`
- `applyGraphDocumentDiff(...)`
- `play / step / stop / playFromNode(...)`
- `subscribe*` 系列

### 2. 正式图与运行反馈类型

- `GraphDocument`
- `GraphLink`
- `GraphOperation`
- `GraphOperationApplyResult`
- `GraphDocumentDiff`
- `RuntimeFeedbackEvent`
- `LeaferGraphNodeExecutionEvent`
- `LeaferGraphGraphExecutionEvent`
- `LeaferGraphNodeInspectorState`

这组类型适合外部页面、调试工具和 authority/runtime 适配层消费。

### 3. 插件与 Widget 扩展契约

- `LeaferGraphNodePlugin`
- `LeaferGraphNodePluginContext`
- `LeaferGraphOptions`
- `LeaferGraphWidgetEntry`
- `LeaferGraphWidgetRendererContext`
- `LeaferGraphWidgetLifecycle`
- `LeaferGraphWidgetRegistry`

这组类型和工具适合扩节点、扩 Widget 或自定义宿主行为。

### 4. 交互与 Widget 辅助

- `bindPressWidgetInteraction(...)`
- `bindLinearWidgetDrag(...)`
- `createWidgetHitArea(...)`
- `createWidgetLabel(...)`
- `createWidgetSurface(...)`
- `createWidgetValueText(...)`

这组入口是“在主包公共边界内能直接复用的交互/渲染 helper”。

补充说明：

- 右键菜单已经完全移到 `@leafergraph/context-menu`
- 主包当前不再导出菜单兼容入口
- 如果你要做画布、节点或连线右键菜单，请直接使用 `@leafergraph/context-menu`

### 5. 文档 diff 工具

- `applyGraphDocumentDiffToDocument(...)`
- `createUpdateNodeInputFromNodeSnapshot(...)`

它们是纯工具，不依赖图实例，适合 session 或同步链在实例外先处理文档。

## 内建执行入口

主包当前默认内建两个系统节点：

| 节点类型 | 作用 |
| --- | --- |
| `system/on-play` | 图级 `play / step` 的启动事件节点 |
| `system/timer` | 图级定时触发节点，接受 `Start` 输入，输出 `Tick` |

它们的语义是：

- `system/on-play`
  - 只在图级 `play / step` 中作为启动事件节点使用
  - 会把当前 `LeaferGraphExecutionContext` 写到输出槽位 `0`
- `system/timer`
  - 需要上游 `Start` 才会建立图级循环
  - `playFromNode(...)` 场景下只执行一次，不建立图级循环
  - `immediate=false` 时，首次执行只注册定时器，不立即输出 `Tick`

## Event 输入语义

主包当前对 `event` 输入使用下面这套稳定语义：

- 连线传播命中目标输入槽位 `type === "event"` 时
  - 如果节点定义实现了 `onAction(...)`
  - 主包会调用 `onAction(node, input.name, payload, options, api)`
- `options.executionContext` 会带当前正式执行上下文
- `options.propagation` 会带来源连线、来源输出槽位和目标输入槽位信息
- 非 `event` 输入继续沿用 `onExecute(...)` 数据流执行语义

如果你在作者层节点里要消费图级定时契约，可以直接使用主包导出的：

- `LEAFER_GRAPH_TIMER_NODE_TYPE`
- `LEAFER_GRAPH_TIMER_DEFAULT_INTERVAL_MS`
- `LeaferGraphTimerRegistration`
- `LeaferGraphTimerRuntimePayload`

`onTrigger(...)` 当前仍不建议作为 v1 稳定依赖。

如果你只关心“运行时刷新到底发生了什么”，直接看：

- [渲染刷新策略](./渲染刷新策略.md)

## 推荐阅读路径

按不同目标，建议这样读：

### 我想直接用这个包

1. 先读这份 README
2. 再看 [使用与扩展指南](./使用与扩展指南.md)

### 我想扩节点、扩 Widget、扩插件

1. 先读 [使用与扩展指南](./使用与扩展指南.md)
2. 再回看 `@leafergraph/node` 里的模型定义

### 我想读源码或排查问题

1. 先读这份 README 的边界和 API 导航
2. 再看 [内部架构地图](./内部架构地图.md)
3. 如果问题与刷新或执行时机相关，再看 [渲染刷新策略](./渲染刷新策略.md)

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:leafergraph
```

如果你改的是主包文档或公开类型，至少跑一次：

```bash
bun run build:leafergraph
```

## 深链文档

- [使用与扩展指南](./使用与扩展指南.md)
  - 面向使用者
  - 讲怎么创建图、同步文档、注册节点、装插件、扩 Widget、跑执行链
- [内部架构地图](./内部架构地图.md)
  - 面向维护者
  - 讲装配链、目录职责、关键宿主和源码阅读顺序
- [渲染刷新策略](./渲染刷新策略.md)
  - 面向性能、刷新和执行链排查
  - 讲整图替换、局部刷新、执行期刷新和外围消费链
