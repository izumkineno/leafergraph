# leafergraph

`leafergraph` 是 LeaferGraph workspace 的 runtime-only 主包。

它负责把正式图模型恢复成 Leafer 场景，并提供稳定的实例 façade：

- 创建和销毁图实例
- 恢复 `GraphDocument`
- 注册节点、模块、Widget 和插件
- 处理节点拖拽、缩放、连线、选区和视口
- 执行 `play / step / stop / playFromNode(...)`
- 订阅宿主级运行反馈、交互提交事件与正式 history feed

它不再负责：

- 聚合 re-export `@leafergraph/node`、`@leafergraph/contracts`、`@leafergraph/theme`、`@leafergraph/config`
- 提供旧的 diff compatibility 子路径
- 作为 workspace 的 umbrella convenience package

## 适用场景

适合：

- 在浏览器里创建一个节点图画布
- 从正式 `GraphDocument` 恢复一张图
- 在运行时注册节点、模块、Widget 或插件
- 对接外部页面、调试面板或 runtime feedback 消费链

不适合：

- 作为图模型真源
- 承载主题 preset 或 config 默认值
- 取代菜单、authoring、bundle loader 等外层宿主逻辑

## 包边界

| 包 | 真源职责 |
| --- | --- |
| `@leafergraph/node` | `GraphDocument`、`GraphLink`、`NodeDefinition`、`NodeModule` |
| `@leafergraph/contracts` | `LeaferGraphOptions`、`LeaferGraphNodePlugin`、`RuntimeFeedbackEvent`、Widget 契约、图操作与 diff helper |
| `@leafergraph/theme` | 主题 mode、preset、graph/widget/context-menu 视觉 token |
| `@leafergraph/config` | 非视觉配置、默认值 resolver、normalize helper |
| `@leafergraph/widget-runtime` | Widget registry、renderer lifecycle、editing 与 interaction helper |
| `@leafergraph/basic-kit` | 基础 widgets、系统节点、默认内容 plugin |
| `@leafergraph/shortcuts` | 宿主输入扩展层，负责快捷键 runtime 与 graph 预设 |
| `@leafergraph/undo-redo` | 宿主状态扩展层，负责 undo/redo controller 与 history 回放 |
| `leafergraph` | 图运行时、Leafer 场景装配、交互基础设施、实例 façade |

一个实用判断是：

- “图长什么样”去 `@leafergraph/node`
- “图怎么跑、怎么扩、怎么描述公共输入输出”去 `@leafergraph/contracts`
- “图怎么显示、怎么交互、怎么执行实例方法”用 `leafergraph`

## 五分钟上手

### 1. 创建图实例

```ts
import type { GraphDocument } from "@leafergraph/node";
import { createLeaferGraph } from "leafergraph";

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

### 2. 显式安装默认内容包

```ts
import { leaferGraphBasicKitPlugin } from "@leafergraph/basic-kit";

const graph = createLeaferGraph(container, {
  document: documentData,
  plugins: [leaferGraphBasicKitPlugin]
});
```

### 3. 注册一个节点定义

```ts
import type { NodeDefinition } from "@leafergraph/node";

const helloNode: NodeDefinition = {
  type: "example/hello",
  title: "Hello Node",
  category: "Examples",
  outputs: [{ name: "Text", type: "string" }]
};

graph.registerNode(helloNode, { overwrite: true });
graph.createNode({
  id: "hello-1",
  type: "example/hello",
  x: 120,
  y: 80
});
```

## 真源导入映射

- 图模型
  - `GraphDocument`、`GraphLink`、`NodeDefinition`、`NodeModule` -> `@leafergraph/node`
- 公共契约
  - `LeaferGraphOptions`、`LeaferGraphNodePlugin`、`RuntimeFeedbackEvent`、`LeaferGraphWidgetEntry` -> `@leafergraph/contracts`
- 文档 diff
  - `applyGraphDocumentDiffToDocument(...)`、`createUpdateNodeInputFromNodeSnapshot(...)` -> `@leafergraph/contracts/graph-document-diff`
- 主题
  - `LeaferGraphThemeMode`、`LeaferGraphLinkPropagationAnimationPreset`、Widget theme context -> `@leafergraph/theme`
- 配置
  - `normalizeLeaferGraphConfig(...)`、`resolveDefaultLeaferGraphConfig(...)` -> `@leafergraph/config`
- Widget runtime helper
  - registry、interaction、render helper -> `@leafergraph/widget-runtime`
- 默认内容
  - `leaferGraphBasicKitPlugin`、系统节点、基础 widgets -> `@leafergraph/basic-kit`

## 主包对外 API

主包根入口现在只保留 runtime façade：

- `LeaferGraph`
- `createLeaferGraph(...)`

创建实例后，你会主要使用这些实例方法：

- `replaceGraphDocument(...)`
- `applyGraphOperation(...)`
- `applyGraphDocumentDiff(...)`
- `play / step / stop / playFromNode(...)`
- `registerNode(...) / registerWidget(...) / installModule(...) / use(...)`
- `subscribeRuntimeFeedback(...) / subscribeInteractionCommit(...) / subscribeHistory(...)`

如果你要接 undo / redo，这里只提供 `subscribeHistory(...)` 这类可回放历史事件，不会自动安装历史栈。
显式绑定仍然应交给 `@leafergraph/undo-redo`，而 `graph.history` 配置真源在 `@leafergraph/config`。

如果你要写静态类型，优先从真源包导入，而不是期待主包继续转发。

## 推荐阅读

### 我想直接使用主包

1. 先读这份 README
2. 再看 [使用与扩展指南](./使用与扩展指南.md)

### 我想看内部装配链

1. [内部架构地图](./内部架构地图.md)
2. [渲染刷新策略](./渲染刷新策略.md)

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:leafergraph
```
