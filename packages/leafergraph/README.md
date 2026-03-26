# leafergraph

`leafergraph` 是当前工作区里的 Leafer-first 节点图主包。

它的职责不是承接 editor 页面壳层，也不是复制 `@leafergraph/node` 的模型 SDK，而是作为唯一图运行时宿主，负责下面这些正式能力：

- 把 `GraphDocument` 恢复成可交互、可执行、可局部刷新的 Leafer 场景
- 管理节点、连线、Widget、主题、视图和交互宿主
- 对外暴露稳定的图 API、运行反馈 API 和扩展入口
- 为 editor、外部页面和未来 authority/runtime 适配层提供统一运行时基础

如果你只想知道“怎么用”，从这份 README 开始即可。  
如果你要扩插件、接 Widget、读内部实现或排查刷新链路，请按下面的深链继续读。

## 适用场景

`leafergraph` 适合这些场景：

- 在浏览器里创建一个节点图画布，并用 Leafer 渲染节点、连线和 Widget
- 从正式 `GraphDocument` 恢复一张图
- 在运行时注册节点、模块、Widget 或插件
- 在本地执行图级 `play / step / stop` 或节点级 `playFromNode(...)`
- 订阅节点执行、图执行、节点状态和连线传播反馈
- 对接 editor、remote runtime feedback 或外部调试面板

它不直接负责这些事情：

- workspace 页面布局和 UI 壳层
- authority transport、session、OpenRPC、bundle loader
- `@leafergraph/node` 的节点模型定义和序列化真源

## 包边界

这三个包的关系是当前最重要的前置认知：

| 包 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `@leafergraph/node` | 节点定义、模块、注册表、图文档模型、序列化类型 | Leafer 场景、交互、渲染宿主 |
| `leafergraph` | 图运行时、渲染、交互基础设施、执行反馈、公共 API | editor UI、authority transport、bundle 协议 |
| `examples/editor` | 工作区壳层、命令、session、authority、bundle 装配 | 主包运行时真源 |

一个实用判断是：

- 定义“节点是什么”，去 `@leafergraph/node`
- 让“节点图跑起来、显示出来、可交互”，用 `leafergraph`
- 做“工作区、菜单、authority、bundle 面板”，看 `examples/editor`

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
| `RuntimeFeedbackEvent` | 统一运行反馈事件，覆盖节点执行、图执行、节点状态和连线传播 |

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

### 4. 菜单与交互辅助

- `createLeaferGraphContextMenu(...)`
- `LeaferGraphContextMenuManager`
- `bindPressWidgetInteraction(...)`
- `bindLinearWidgetDrag(...)`
- `createWidgetHitArea(...)`
- `createWidgetLabel(...)`
- `createWidgetSurface(...)`
- `createWidgetValueText(...)`

这组入口是“在主包公共边界内能直接复用的交互/渲染 helper”。

### 5. 文档 diff 工具

- `applyGraphDocumentDiffToDocument(...)`
- `createUpdateNodeInputFromNodeSnapshot(...)`

它们是纯工具，不依赖图实例，适合 session 或同步链在实例外先处理文档。

## 内建执行入口

主包当前默认内建两个系统节点：

| 节点类型 | 作用 |
| --- | --- |
| `system/on-play` | 图级 `play / step` 的正式入口节点 |
| `system/timer` | 图级定时触发节点，接受 `Start` 输入，输出 `Tick` |

它们的语义是：

- `system/on-play`
  - 只在图级 `play / step` 中作为入口节点使用
  - 会把当前 `LeaferGraphExecutionContext` 写到输出槽位 `0`
- `system/timer`
  - 需要上游 `Start` 才会建立图级循环
  - `playFromNode(...)` 场景下只执行一次，不建立图级循环
  - `immediate=false` 时，首次执行只注册定时器，不立即输出 `Tick`

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
bun run build
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
  - 讲整图替换、局部刷新、执行期刷新和 editor 消费链
