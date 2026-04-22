# `@leafergraph/core/node`

`@leafergraph/core/node` 是 LeaferGraph workspace 的模型真源。

它负责定义节点、模块、图文档和注册表，也负责把节点定义与运行时快照连接起来；它不负责 Leafer 场景、交互宿主、主题、菜单或页面壳层。

## 包定位

适合直接依赖它的场景：

- 定义 `NodeDefinition`、`NodeModule`、`WidgetDefinition`
- 管理 `NodeRegistry`
- 读写正式 `GraphDocument`、`GraphLink`
- 创建、配置、序列化节点运行时快照
- 写面向多个宿主共享的模型工具

不适合直接把它当成：

- 图运行时主包
- 作者层 SDK
- UI 或交互层扩展包

一句话记忆：

- `@leafergraph/core/node` 只回答“图模型和节点定义是什么”
- `@leafergraph/extensions/authoring` 回答“怎样更舒服地写节点类和 Widget 类”
- `leafergraph` 回答“怎样把这些模型恢复成可运行的图”

## 公开入口

根入口当前主要分成四组：

- 类型模型
  - `NodeDefinition`
  - `NodeModule`
  - `GraphDocument`
  - `GraphLink`
  - `NodeRuntimeState`
- 注册与模块
  - `NodeRegistry`
  - `installNodeModule(...)`
  - `resolveNodeModuleScope(...)`
  - `applyNodeModuleScope(...)`
  - `resolveScopedNodeType(...)`
- Widget 规格工具
  - `BUILTIN_WIDGET_TYPES`
  - `normalizeWidgetSpec(...)`
  - `serializeWidgetSpec(...)`
  - `validateWidgetSpec(...)`
- 运行时快照辅助
  - `createNodeApi(...)`
  - `createNodeState(...)`
  - `configureNode(...)`
  - `serializeNode(...)`

## 最小使用方式

```ts
import type { GraphDocument, NodeDefinition } from "@leafergraph/core/node";
import {
  NodeRegistry,
  createNodeState,
  installNodeModule,
  serializeNode
} from "@leafergraph/core/node";

const registry = new NodeRegistry({
  get() {
    return undefined;
  }
});

const helloNode: NodeDefinition = {
  type: "example/hello",
  title: "Hello",
  outputs: [{ name: "text", type: "string" }]
};

installNodeModule(registry, {
  nodes: [helloNode]
});

const runtimeNode = createNodeState(registry, {
  id: "hello-1",
  type: "example/hello",
  layout: { x: 120, y: 80 }
});

const documentData: GraphDocument = {
  documentId: "hello-graph",
  revision: 1,
  appKind: "leafergraph-local",
  nodes: [serializeNode(registry, runtimeNode)],
  links: []
};
```

## 与其它包的边界

| 包 | 关系 |
| --- | --- |
| `@leafergraph/core/node` | 模型真源 |
| `@leafergraph/extensions/authoring` | 在这个真源之上提供作者层体验 |
| `@leafergraph/core/execution` | 在这个真源之上提供执行内核 |
| `@leafergraph/core/contracts` | 在这个真源之上定义跨包共享协议 |
| `leafergraph` | 消费这些模型并恢复成 Leafer 图运行时 |

优先直接依赖 `@leafergraph/core/node` 的情况：

- 你在写模型层工具或共享类型
- 你在写插件 / 模块 / 模板
- 你不想把 UI 宿主一起拉进依赖树

优先改用其它包的情况：

- 你要写类式节点 / Widget：看 `@leafergraph/extensions/authoring`
- 你要直接创建图实例：看 `leafergraph`
- 你要写执行链：看 `@leafergraph/core/execution`

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:node
bun run test:node
```

## 继续阅读

- [根 README](../../README.md)
- [节点 API 与节点壳设计](../../docs/节点API方案.md)
- [外部节点包接入方案](../../docs/节点插件接入方案.md)
- [@leafergraph/extensions/authoring README](../../extensions/authoring/README.md)
- [leafergraph README](../../leafergraph/README.md)



