# `@leafergraph/extensions/authoring`

`@leafergraph/extensions/authoring` 是 LeaferGraph workspace 的作者层 SDK。

它提供面向节点作者和 Widget 作者的类式体验，并把作者代码收口成 `NodeModule`、`LeaferGraphWidgetEntry` 和 `LeaferGraphNodePlugin` 这类正式产物。

## 包定位

适合直接依赖它的场景：

- 你想用 `BaseNode` / `BaseWidget` 写作者代码
- 你想把一组节点类和 Widget 类收口成正式 plugin / module
- 你在写模板工程、bundle 工程或对外分发的作者层包

不适合直接把它当成：

- 图运行时主包
- 模型真源
- editor bridge 或 bundle loader

固定边界是：

- `authoring` 只能输出正式核心产物
- 宿主和模板可以适配 `authoring`
- `authoring` 不反向依赖 editor、authority 或页面壳层

## 公开入口

根入口主要分三组：

- 节点作者层
  - `BaseNode`
  - `defineAuthoringNode(...)`
  - `createAuthoringModule(...)`
  - `createAuthoringPlugin(...)`
- Widget 作者层
  - `BaseWidget`
  - `defineAuthoringWidget(...)`
- 共享泛型辅助
  - `NodeProps`
  - `NodeInputs`
  - `NodeOutputs`
  - `NodeState`
  - `WidgetState`

## 最小使用方式

```ts
import { BaseNode, createAuthoringPlugin } from "@leafergraph/extensions/authoring";

class EchoNode extends BaseNode<
  { message: string },
  { text: string },
  { text: string },
  { runCount: number }
> {
  static meta = {
    type: "example/echo",
    title: "Echo",
    outputs: [{ name: "text", type: "string" }],
    properties: [{ name: "message", type: "string", default: "Hello" }]
  };

  createState() {
    return { runCount: 0 };
  }

  onExecute(ctx) {
    ctx.state.runCount += 1;
    ctx.setOutput("text", ctx.props.message);
  }
}

const plugin = createAuthoringPlugin({
  name: "example/authoring",
  nodes: [EchoNode]
});
```

这份 plugin 之后可以：

- 交给 `leafergraph` 主包的 `plugins`
- 被模板工程打包成 ESM 或 browser bundle
- 被示例工程直接消费

## 与其它包的边界

| 包 | 关系 |
| --- | --- |
| `@leafergraph/core/node` | 模型真源 |
| `@leafergraph/core/contracts` | 正式插件和 Widget 契约 |
| `@leafergraph/extensions/authoring` | 类式作者层体验 |
| `leafergraph` | 图运行时宿主 |
| `templates/` | 把作者层产物组织成可分发样例 |

如果你在判断某个能力该放哪里：

- 只要它属于“怎么更舒服地写作者代码”，优先看 `authoring`
- 只要它开始感知 editor、authority、bundle catalog 或页面壳层，通常就放错地方了

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:authoring
bun run test:authoring
```

## 继续阅读

- [根 README](../../README.md)
- [架构演进与提案总览](../../docs/架构演进与提案总览.md)
- [authoring-basic-nodes 示例](../../example/authoring-basic-nodes/README.md)
- [Templates 总览](../../templates/README.md)



