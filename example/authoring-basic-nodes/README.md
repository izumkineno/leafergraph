# `@leafergraph/authoring-basic-nodes`

`authoring-basic-nodes` 是一个纯作者层示例包。

它不提供页面 demo，也不提供额外宿主壳层；它的作用是演示怎样把一组作者层节点和 Widget 收口成可以直接分发的 `module` / `plugin`。

## 适用场景

适合：

- 想看 `@leafergraph/authoring` 的真实落地样子
- 想参考一个纯 ESM 作者层包怎么组织导出
- 想知道如何把状态读数 Widget 跟节点一起分发

不适合：

- 想直接看浏览器页面交互
- 想看菜单、shortcuts、history 或 bundle loader

## 对外导出

- 默认导出
  - `authoringBasicNodesPlugin`
- 具名导出
  - `authoringBasicNodesPlugin`
  - `authoringBasicNodesModule`
  - `authoringBasicNodeClasses`
  - `AUTHORING_BASIC_NODE_TYPES`
  - `StatusReadoutWidget`

## 最小使用方式

### 作为 plugin

```ts
import { createLeaferGraph } from "leafergraph";
import authoringBasicNodesPlugin from "@leafergraph/authoring-basic-nodes";

const graph = createLeaferGraph(container, {
  plugins: [authoringBasicNodesPlugin]
});

await graph.ready;
```

### 作为 module

```ts
import { createLeaferGraph } from "leafergraph";
import { authoringBasicNodesModule } from "@leafergraph/authoring-basic-nodes";

const graph = createLeaferGraph(container);
await graph.ready;
graph.installModule(authoringBasicNodesModule);
```

## 依赖边界

这个示例包当前依赖这些真源：

- `@leafergraph/authoring`
- `@leafergraph/execution`
- `@leafergraph/node`
- `leafergraph`

如果按 package split 的目标结构来理解，这组依赖会对应为：

| 当前依赖 | 拆分后目标 |
| --- | --- |
| `@leafergraph/authoring` | `@leafergraph/extensions/authoring` |
| `@leafergraph/execution` | `@leafergraph/core/execution` |
| `@leafergraph/node` | `@leafergraph/core/node` |
| `leafergraph` | `leafergraph`（兼容主包） |

它不自动提供：

- `system/on-play`
- `system/timer`
- 基础 widgets

如果宿主还需要这些默认内容，请额外安装 `@leafergraph/basic-kit`。

## 构建与检查

在 workspace 根目录执行：

```bash
bun run check:authoring-basic-nodes
bun run build:authoring-basic-nodes
```

## 继续阅读

- [根 README](../../README.md)
- [@leafergraph/authoring README](../../packages/authoring/README.md)
- [Templates 总览](../../templates/README.md)
