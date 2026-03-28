# @leafergraph/authoring

`@leafergraph/authoring` 是当前工作区里的干净作者层 SDK。

它不是 editor 兼容层，也不是新的图运行时宿主，而是专门服务节点 / Widget 作者体验的一层薄 SDK，负责把作者代码收口为下面这些正式产物：

- `NodeDefinition`
- `NodeModule`
- `LeaferGraphWidgetEntry`
- `LeaferGraphNodePlugin`

如果你只想知道“怎么写节点类和 Widget 类”，从这份 README 开始即可。  
如果你要理解它为什么不能反向兼容 editor 或历史装载链，请继续读方案文档。

## 适用场景

`@leafergraph/authoring` 适合这些场景：

- 用类式写法定义节点作者层代码
- 用类式写法定义 Widget 作者层代码
- 把一组节点类批量组装成 `NodeModule`
- 把节点类和 Widget 类收口成正式 `LeaferGraphNodePlugin`
- 在内部示例或模板工程里复用同一套作者层体验
- 交给 `leafergraph` 宿主通过 `plugins` 正式消费

它不直接负责这些事情：

- editor bridge、bundle helper、loader manifest
- authority session、transport、OpenRPC
- 浏览器全局注册协议或 IIFE bridge
- Leafer 图运行时、场景装配和交互宿主
- 历史装载链兼容或反向适配 editor

## 包边界

这四层关系是理解 `authoring` 的前置认知：

| 包 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `@leafergraph/node` | 节点定义、图文档模型、模块、注册表、序列化 | 作者类体验、Leafer 宿主 |
| `@leafergraph/authoring` | 节点 / Widget 作者层、plugin / module 组装 | 宿主适配、运行时宿主、历史兼容 |
| `leafergraph` | 图运行时、渲染、交互基础设施、插件消费 | 宿主壳层、bundle 装载协议 |
| 外部宿主 / bundle 消费方 | 页面壳层、bundle 装配和外围接线 | 反向定义作者层公共 API |

一个实用判断是：

- 定义正式模型和图文档，去 `@leafergraph/node`
- 写节点类、Widget 类和正式 plugin，去 `@leafergraph/authoring`
- 让图跑起来、显示出来、可交互，去 `leafergraph`
- 做宿主页面、菜单、bundle 装配和外围协议接线，看具体宿主工程

这里必须保持一个固定方向：

- `editor`、模板工程或其他宿主只能来适配 `authoring`
- `authoring` 不能为了它们反向背上历史 loader / bundle 负担

## 五分钟上手

### 1. 定义一个节点类和一个 Widget 类

```ts
import type { GraphDocument } from "@leafergraph/node";
import {
  BaseNode,
  BaseWidget,
  createAuthoringPlugin
} from "@leafergraph/authoring";
import { createLeaferGraph } from "leafergraph";

class EchoNode extends BaseNode<
  { message: string },
  { text: string },
  { text: string },
  { runCount: number }
> {
  static meta = {
    type: "example/echo",
    title: "Echo",
    inputs: [{ name: "text", type: "string" }],
    outputs: [{ name: "text", type: "string" }],
    properties: [
      { name: "message", type: "string", default: "Hello Authoring" }
    ]
  };

  createState() {
    return { runCount: 0 };
  }

  onExecute(ctx) {
    const text = ctx.getInput("text") ?? ctx.props.message;
    ctx.state.runCount += 1;
    ctx.setOutput("text", text);
    ctx.setData("lastRunCount", ctx.state.runCount);
  }
}

class StatusWidget extends BaseWidget<string> {
  static meta = {
    type: "example/status",
    title: "Status Widget"
  };

  mount(ctx) {
    ctx.group.add(
      new ctx.ui.Text({
        x: ctx.bounds.x,
        y: ctx.bounds.y,
        text: String(ctx.value ?? "idle")
      })
    );
  }
}
```

### 2. 组装成正式 plugin

```ts
const plugin = createAuthoringPlugin({
  name: "example/basic",
  widgets: [StatusWidget],
  nodes: [EchoNode]
});
```

### 3. 交给 `leafergraph` 宿主消费

```ts
const documentData: GraphDocument = {
  documentId: "authoring-demo",
  revision: 1,
  appKind: "leafergraph-local",
  nodes: [],
  links: []
};

const graph = createLeaferGraph(container, {
  plugins: [plugin],
  document: documentData
});

await graph.ready;
```

如果初始 `document` 已经依赖这些作者层节点类型，插件必须在启动期就进入 `plugins` 链，或至少先安装 plugin 再恢复文档；不能等文档恢复完成后再补装。

## 当前合同

作者层 v1 当前默认遵守这些合同：

- 节点类和 Widget 类都使用零参数构造
- 节点生命周期按当前同步合同理解，不承诺 async hook
- 节点侧当前没有正式 destroy lifecycle
- Widget 侧继续建立在正式 `mount / update / destroy` lifecycle 之上
- 节点 `state` 和 Widget 实例都只属于当前运行时，不参与序列化
- `createAuthoringPlugin(...)` 内部固定先注册 Widget，再安装节点 module

## 对外 API 导航

`src/index.ts` 当前对外暴露的内容，建议按下面三组理解：

### 1. 节点作者层

- `DevNodeMeta`
- `DevNodeContext`
- `DevNodeClass`
- `BaseNode`
- `defineAuthoringNode(...)`
- `createAuthoringModule(...)`
- `createAuthoringPlugin(...)`

这是最常用的一组入口。通常你只需要写 `BaseNode` 子类，然后把它交给 `createAuthoringPlugin(...)`。

### 2. Widget 作者层

- `DevWidgetMeta`
- `DevWidgetContext`
- `DevWidgetClass`
- `BaseWidget`
- `defineAuthoringWidget(...)`

这组入口负责把类式 Widget 作者代码映射成正式 `LeaferGraphWidgetEntry`。

### 3. 共享类型

- `NodeProps`
- `NodeInputs`
- `NodeOutputs`
- `NodeState`
- `WidgetState`

这组类型只是作者层泛型辅助，不替代 `@leafergraph/node` 的正式模型类型。

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:authoring
bun run test:authoring
```

如果你只改了作者层文档或公开类型，至少跑一次：

```bash
bun run build:authoring
```

## 深链文档

- [开发者友好节点作者层与接入包方案](../../docs/开发者友好节点作者层与接入包方案.md)
  - 面向作者层设计和边界判断
  - 讲为什么 `authoring` 必须保持干净、只输出正式核心产物
- [主包 README](../leafergraph/README.md)
  - 面向运行时宿主使用者
  - 讲 plugin 最终怎样进入 `leafergraph` 图宿主
