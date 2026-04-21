# `leafergraph`

`leafergraph` 是 LeaferGraph workspace 的 Leafer host / graph facade 主包。

它负责把 `GraphDocument` 恢复成 Leafer 场景，装配交互、刷新和宿主态投影，并通过 `LeaferGraph` / `createLeaferGraph(...)` 暴露稳定实例 API。

执行链真源已经迁到 `@leafergraph/core/execution`。主包仍然负责把执行状态投影回节点壳、连线和运行反馈，但根入口已经收口为 runtime-only façade：共享类型与运行反馈真源应继续从 core / extensions 包导入，而不是要求主包重新聚合。

## 包定位

适合直接依赖它的场景：

- 在浏览器里创建一个节点图实例
- 从 `GraphDocument` 恢复、更新和运行一张图
- 注册节点、模块、 Widget 或插件
- 订阅运行反馈、交互提交和 history feed
- 在前端直接读取当前正式图文档快照

不适合直接把它当成：

- 图模型真源聚合包
- 执行内核真源
- 本地后端桥接聚合入口
- 菜单、快捷键、历史栈或作者层总入口

## 根入口

主包根入口保持为：

- `LeaferGraph`
- `createLeaferGraph(...)`

执行相关类型和宿主边界建议这样导入：

- `GraphDocument`、`NodeDefinition`、`NodeModule`
  - `@leafergraph/core/node`
- `LeaferGraphExecutionContext`、`LeaferGraphActionExecutionOptions`、`ExecutionFeedbackEvent`
  - `@leafergraph/core/execution`
- `LeaferGraphOptions`、`LeaferGraphNodePlugin`、`RuntimeFeedbackEvent`
  - `@leafergraph/core/contracts`
- `LeaferGraphApiHost`
  - `leafergraph/api/graph_api_host`

也就是说，`leafergraph` 当前只保留两类公开面：

- 根入口：`LeaferGraph`、`createLeaferGraph(...)`
- 最小兼容子路径：`leafergraph/api/graph_api_host`

## 内部结构

当前源码目录已经按“薄入口 + 子能力目录”收口：

- `src/public/`
  - 根入口 facade 的实际实现
- `src/api/host/`
  - 公共 API 的内部能力层
- `src/interaction/host/` 与 `src/interaction/runtime/`
  - DOM / gesture 宿主与交互运行时
- `src/graph/`
  - 图装配、恢复、刷新、主题和本地运行反馈投影
- `src/link/curve.ts` 与 `src/link/animation/`
  - 连线共享曲线层与数据流动画内部实现层
- `src/node/runtime/` 与 `src/node/shell/`
  - 节点运行时投影层，以及节点壳/布局/端口/样式层

`src/graph/` 当前固定目录树如下：

```text
src/graph/
  assembly/
    entry.ts
    runtime.ts
    scene.ts
    widget_environment.ts
  feedback/
    local_runtime_adapter.ts
    projection.ts
  host/
    bootstrap.ts
    canvas.ts
    mutation.ts
    restore.ts
    scene.ts
    scene_runtime.ts
    view.ts
  theme/
    host.ts
    runtime.ts
  history.ts
  style.ts
  types.ts
```

其中：

- `assembly/widget_environment.ts` 是 Widget 基础环境的装配工厂，不再是旧的 `*host`
- 图级执行宿主直接来自 `@leafergraph/core/execution`
- 主包内部统一使用 `graphExecutionHost` 字段名，不再保留旧 execution 字段名

`link/` 与 `node/` 现在统一直接使用真实实现目录：

```text
src/link/
  animation/
    controller.ts
    effects.ts
    frame_loop.ts
    resolved_link.ts
  curve.ts
  link.ts
  link_host.ts

src/node/
  runtime/
    controller.ts
    execution.ts
    snapshot.ts
    state.ts
  shell/
    host.ts
    layout.ts
    ports.ts
    slot_style.ts
    view.ts
  node_host.ts
```

其中：

- `link/curve.ts` 负责正式连线视图和动画复用的共享曲线解析
- `link/animation/controller.ts` 是数据流动画宿主的真实实现入口
- `node/runtime/*` 负责节点运行时、执行、快照和连接变化
- `node/shell/*` 负责节点壳、布局、端口和 slot 样式
- `node_host.ts` 继续保留在顶层，作为节点 view 生命周期宿主

## 五分钟上手

```ts
import type { GraphDocument } from "@leafergraph/core/node";
import { createLeaferGraph } from "leafergraph";
import { leaferGraphBasicKitPlugin } from "@leafergraph/core/basic-kit";

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
  - `getGraphDocument()`
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
| `@leafergraph/core/node` | 图模型、节点定义、模块和注册表 |
| `@leafergraph/core/execution` | 纯执行内核、图级执行状态机、执行反馈、内建执行节点 |
| `@leafergraph/core/contracts` | 公共宿主协议、图 API 输入输出、Widget 契约 |
| `@leafergraph/core/theme` | 视觉主题真源 |
| `@leafergraph/core/config` | 非视觉配置真源 |
| `@leafergraph/core/widget-runtime` | Widget runtime 真源 |
| `@leafergraph/core/basic-kit` | 默认内容包 |
| `@leafergraph/extensions/context-menu` | 纯菜单 runtime |
| `@leafergraph/extensions/shortcuts` | 快捷键扩展 |
| `@leafergraph/extensions/undo-redo` | 历史栈扩展 |

一个简单判断是：

- 需要图实例和 Leafer 场景宿主，用 `leafergraph`
- 需要执行类型或执行反馈真源，用 `@leafergraph/core/execution` / `@leafergraph/core/contracts`
- 需要高级 API 宿主兼容面，用 `leafergraph/api/graph_api_host`
- 需要模型真源类型或 helper，不要再从主包绕路导入

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
- [节点状态与外壳规范](../../docs/节点状态与外壳规范.md)
- [mini-graph 示例](../../example/mini-graph/README.md)


