# @leafergraph/node

`@leafergraph/node` 是当前工作区里的正式模型 SDK。

它的职责不是承接 Leafer 渲染宿主，也不是提供作者层类式体验，而是作为节点系统的模型真源，负责下面这些正式能力：

- 定义 `NodeDefinition`、`NodeModule` 和 `WidgetDefinition`
- 维护 `NodeRegistry`
- 提供 `GraphDocument`、`GraphLink`、`CapabilityProfile` 等正式图模型
- 负责节点创建、配置、序列化和模块安装的模型侧工具

如果你只想知道“节点模型层有哪些正式入口”，从这份 README 开始即可。  
如果你要继续看运行时宿主或 editor 接入层，请顺着下面的深链继续读。

## 适用场景

`@leafergraph/node` 适合这些场景：

- 定义一个正式 `NodeDefinition`
- 把多个定义整理成 `NodeModule`
- 用 `NodeRegistry` 管理节点类型注册
- 维护正式 `GraphDocument` / `GraphLink` 数据
- 创建、配置、序列化节点运行时快照
- 为 `leafergraph` 主包、外部插件或未来 authority / adapter 提供统一模型真源

它不直接负责这些事情：

- Leafer 场景对象和渲染宿主
- 视图、交互、执行反馈和主题
- 作者层类式节点 / Widget 体验
- editor UI、authority transport、bundle loader

## 包边界

这四层关系是理解 `node` 包的前置认知：

| 包 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `@leafergraph/node` | 节点定义、图文档、模块、注册表、模型工具 | Leafer 运行时、作者层体验、editor UI |
| `@leafergraph/authoring` | 节点 / Widget 作者层、plugin / module 组装 | 模型真源、图宿主 |
| `leafergraph` | 图运行时、渲染、交互基础设施、插件消费 | 模型 SDK、editor 壳层 |
| `examples/editor` | 工作区、authority、bundle loader、UI 壳层 | 主包运行时和模型真源 |

一个实用判断是：

- 描述“节点和图的数据结构是什么”，去 `@leafergraph/node`
- 描述“怎么更舒服地写节点类和 Widget 类”，去 `@leafergraph/authoring`
- 描述“图如何运行、渲染和交互”，去 `leafergraph`
- 描述“工作区怎样装配 authority 和 bundle”，看 `examples/editor`

## 五分钟上手

### 1. 定义节点模型并安装到注册表

```ts
import type {
  GraphDocument,
  NodeDefinition,
  WidgetDefinitionReader
} from "@leafergraph/node";
import {
  NodeRegistry,
  createNodeState,
  installNodeModule,
  serializeNode
} from "@leafergraph/node";

const widgetDefinitions: WidgetDefinitionReader = {
  get() {
    return undefined;
  }
};

const registry = new NodeRegistry(widgetDefinitions);

const helloNode: NodeDefinition = {
  type: "example/hello",
  title: "Hello Node",
  outputs: [{ name: "text", type: "string" }],
  onExecute(node, _context, api) {
    node.title = "Hello Executed";
    api?.setOutputData(0, "hello");
  }
};

installNodeModule(registry, {
  nodes: [helloNode]
});
```

### 2. 从定义创建运行时节点，再序列化回正式快照

```ts
const runtimeNode = createNodeState(registry, {
  id: "hello-1",
  type: "example/hello",
  layout: {
    x: 120,
    y: 80
  }
});

const snapshot = serializeNode(registry, runtimeNode);
```

### 3. 把节点快照放进正式 `GraphDocument`

```ts
const documentData: GraphDocument = {
  documentId: "hello-graph",
  revision: 1,
  appKind: "leafergraph-local",
  nodes: [snapshot],
  links: []
};
```

## 核心概念

| 概念 | 作用 |
| --- | --- |
| `NodeDefinition` | 正式节点类型定义，描述输入、输出、属性、Widget 和生命周期 |
| `NodeModule` | 一组可批量安装的节点定义 |
| `NodeRegistry` | 节点定义注册表，主包和外部插件都会消费它 |
| `GraphDocument` | 正式图文档模型，包含节点、连线和图级元数据 |
| `NodeRuntimeState` | 宿主持有的节点运行时实例状态 |
| `WidgetDefinition` | 模型层 Widget 定义，负责值归一化和序列化 |

## 对外 API 导航

`src/index.ts` 当前对外暴露的内容，建议按下面四组理解：

### 1. 类型模型

- `NodeDefinition`
- `NodeModule`
- `NodeModuleScope`
- `NodeResizeConfig`
- `NodeRuntimeState`
- `NodeSerializeResult`
- `GraphDocument`
- `GraphLink`
- `GraphLinkEndpoint`
- `CapabilityProfile`
- `AdapterBinding`

这组类型描述的是正式模型，不包含任何 Leafer 渲染语义。

### 2. 注册与模块

- `NodeRegistry`
- `installNodeModule(...)`
- `resolveNodeModule(...)`
- `resolveNodeModuleScope(...)`
- `applyNodeModuleScope(...)`
- `resolveScopedNodeType(...)`
- `isScopedNodeType(...)`

这组入口负责节点类型注册、模块安装和作用域处理。

### 3. Widget 规格工具

- `BUILTIN_WIDGET_TYPES`
- `hasWidgetDefinition(...)`
- `requireWidgetDefinition(...)`
- `normalizeWidgetSpec(...)`
- `normalizeWidgetSpecs(...)`
- `serializeWidgetSpec(...)`
- `serializeWidgetSpecs(...)`
- `validateWidgetSpec(...)`
- `validateWidgetPropertySpec(...)`

这组入口只关心模型层 Widget 规格，不负责真正的 renderer。

### 4. 节点运行时辅助

- `createNodeApi(...)`
- `createNodeState(...)`
- `configureNode(...)`
- `serializeNode(...)`
- `NodeApi`
- `NodeLifecycle`

这组入口负责在模型层把静态定义和运行时快照串起来，供宿主消费。

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:node
bun run build
```

如果你只改了模型层文档或公开类型，至少跑一次：

```bash
bun run build:node
```

## 深链文档

- [节点 API 方案](../../docs/节点API方案.md)
  - 面向节点模型与节点壳边界
  - 讲模型层和宿主层当前怎样拆分
- [当前节点计划书](../../docs/当前节点计划书.md)
  - 面向现状地图和长期路线
  - 讲 authority、runtime feedback、bundle 与模型层的整体关系
- [主包 README](../leafergraph/README.md)
  - 面向运行时宿主使用者
  - 讲 `@leafergraph/node` 的模型最终怎样进入 `leafergraph`
