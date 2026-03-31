# `leafergraph`

`leafergraph` 是 LeaferGraph workspace 的 runtime-only 主包。

它负责把正式图模型恢复成 Leafer 场景，并通过 `LeaferGraph` / `createLeaferGraph(...)` 暴露稳定的实例 façade。

## 包定位

适合直接依赖它的场景：

- 在浏览器里创建一个节点图实例
- 从 `GraphDocument` 恢复、更新和运行一张图
- 注册节点、模块、Widget 或插件
- 订阅运行反馈、交互提交和 history feed

不适合直接把它当成：

- 模型真源聚合包
- 主题、配置或默认内容真源
- 菜单、快捷键、历史栈或作者层的总入口

## 根入口

主包根入口现在只保留 runtime façade：

- `LeaferGraph`
- `createLeaferGraph(...)`

静态类型和 helper 的正式导入位置固定为：

- `GraphDocument`、`NodeDefinition`、`NodeModule`
  - `@leafergraph/node`
- `LeaferGraphOptions`、`LeaferGraphNodePlugin`、`RuntimeFeedbackEvent`
  - `@leafergraph/contracts`
- diff helper
  - `@leafergraph/contracts/graph-document-diff`
- `themePreset` / `themeMode`
  - `@leafergraph/theme`
- normalize / 默认 config
  - `@leafergraph/config`
- Widget runtime helper
  - `@leafergraph/widget-runtime`

## 五分钟上手

```ts
import type { GraphDocument } from "@leafergraph/node";
import { createLeaferGraph } from "leafergraph";
import { leaferGraphBasicKitPlugin } from "@leafergraph/basic-kit";

const documentData: GraphDocument = {
  documentId: "hello-graph",
  revision: 1,
  appKind: "leafergraph-local",
  nodes: [],
  links: []
};

const graph = createLeaferGraph(container, {
  document: documentData,
  plugins: [leaferGraphBasicKitPlugin],
  themePreset: "default",
  themeMode: "dark"
});

await graph.ready;
```

实例创建后，最常用的入口是：

- 文档与操作
  - `replaceGraphDocument(...)`
  - `applyGraphOperation(...)`
  - `applyGraphDocumentDiff(...)`
- 注册与扩展
  - `registerNode(...)`
  - `registerWidget(...)`
  - `installModule(...)`
  - `use(...)`
- 运行控制
  - `play()`
  - `step()`
  - `stop()`
  - `playFromNode(...)`
- 反馈订阅
  - `subscribeRuntimeFeedback(...)`
  - `subscribeInteractionCommit(...)`
  - `subscribeHistory(...)`

## 与其它包的边界

| 包 | 真源职责 |
| --- | --- |
| `@leafergraph/node` | 图模型、节点定义、模块和注册表 |
| `@leafergraph/contracts` | 公共宿主协议、图 API 输入输出、Widget 契约 |
| `@leafergraph/theme` | 视觉主题真源 |
| `@leafergraph/config` | 非视觉配置真源 |
| `@leafergraph/widget-runtime` | Widget runtime 真源 |
| `@leafergraph/basic-kit` | 默认内容包 |
| `@leafergraph/context-menu` | 纯菜单 runtime |
| `@leafergraph/shortcuts` | 快捷键扩展 |
| `@leafergraph/undo-redo` | 历史栈扩展 |

一个简单判断是：

- 需要图实例和场景宿主，用 `leafergraph`
- 需要真源类型或 helper，不要再从主包绕路导入

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:leafergraph
bun run test:leafergraph
```

## 继续阅读

- [使用与扩展指南](./使用与扩展指南.md)
- [内部架构地图](./内部架构地图.md)
- [渲染刷新策略](./渲染刷新策略.md)
- [mini-graph 示例](../../example/mini-graph/README.md)
