# `leafergraph`

`leafergraph` 是 LeaferGraph workspace 的 viewer-first root 主包。

它通过 `LeaferGraph` / `createLeaferGraph(...)` 暴露稳定实例 API，并通过 extracted runtime 包的薄适配层继续提供完整能力。

`@leafergraph/scene-runtime` 和 `@leafergraph/api-host` 已经分别承载 scene/runtime 实现与 full API host 实现；root 只保留最小公开面和兼容子路径。

## 包定位

适合直接依赖它的场景：

- 在浏览器里创建一个节点图实例
- 从 `GraphDocument` 恢复、更新和运行一张图
- 注册节点、模块、 Widget 或插件
- 订阅运行反馈、交互提交和 history feed
- 在前端直接读取当前正式图文档快照
- 跟踪 viewer-first root split 的当前边界和 replacement package paths

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

`leafergraph` 现在保留两类公开面：

- 根入口：`LeaferGraph`、`createLeaferGraph(...)`
- 最小兼容子路径：`leafergraph/api/graph_api_host`

compatibility 入口已经通过 extracted `@leafergraph/api-host` 重新安装，迁移状态见 [viewer-first root split manifest](../../docs/viewer-first-root-split-manifest.md)。

## 内部结构

当前源码目录已经按“薄入口 + 子能力目录”收口：

- `src/public/`
  - 根入口 façade 的实际实现
- `src/api/host/`
  - 公共 API 的兼容内部能力层，实际实现由 `@leafergraph/api-host` 承载
- `src/graph/assembly/`
  - root 侧 viewer composition 层，负责把 extracted runtime 组合成默认入口
- `src/graph/history.ts`
  - root 侧 history 兼容桥接
- `src/index.ts`
  - 主包公共入口
- `src/public/leafer_graph.ts`
  - 默认入口 façade 实现
- `src/public/viewer_model.ts`
  - viewer-first root 的最小视图契约

`src/graph/` 当前固定目录树如下：

```text
src/graph/
  assembly/
    entry.ts
    runtime.ts
    runtime_api.ts
    runtime_history.ts
    widget_environment.ts
  history.ts
```

其中：

- `assembly/entry.ts` 负责把 viewer-first root 的默认入口和 extracted runtime 组合起来
- `assembly/runtime.ts` 负责 root 侧的总装配
- `assembly/runtime_api.ts`、`assembly/runtime_history.ts` 是 root 侧对 extracted API host 的薄转发
- `assembly/widget_environment.ts` 是 root 侧的 Widget 基础环境装配工厂
- `history.ts` 保留 root 侧的历史兼容桥接
- 交互、节点、连线、主题、反馈和场景实现已经由 `@leafergraph/scene-runtime` 承载

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
| `@leafergraph/scene-runtime` | scene、interaction、node shell、link visuals、theme runtime |
| `@leafergraph/api-host` | full API host、facade groups、history、registry、document/mutation/execution integration |
| `@leafergraph/extensions/context-menu` | 纯菜单 runtime |
| `@leafergraph/extensions/shortcuts` | 快捷键扩展 |
| `@leafergraph/extensions/undo-redo` | 历史栈扩展 |

一个简单判断是：

- 需要图实例和 Leafer 场景宿主，用 `leafergraph`
- 需要执行类型或执行反馈真源，用 `@leafergraph/core/execution` / `@leafergraph/core/contracts`
- 需要完整 API 宿主，用 `@leafergraph/api-host` 或 `leafergraph/api/graph_api_host`
- 需要 scene/runtime、interaction、node shell 或 link visuals，用 `@leafergraph/scene-runtime`
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
- [viewer-first root migration](../../docs/viewer-first-root-migration.md)
- [viewer-first root split manifest](../../docs/viewer-first-root-split-manifest.md)
- [节点状态与外壳规范](../../docs/节点状态与外壳规范.md)
- [mini-graph 示例](../../example/mini-graph/README.md)


