# Authoring Node Template

这是一份面向节点作者的 `TypeScript` 模板工程。

它的重点不是直接手写 `iife.js`，而是让你在 `src/developer/` 里按类型维护节点模板代码，最后再构建出给 editor 或外部宿主加载的 `dist/browser/node.iife.js`。

## 这份模板提供什么

- 一个最小计算节点 `BasicSumNode`
- 一个观察节点 `WatchNode`
- `WatchNode` 内部自带只读文字 Widget
- 可直接给宿主消费的 `module`、`plugin` 和 `node.iife.js`

`WatchNode` 的演示重点是：

- 输入使用通用槽位类型 `0`
- 执行时把最近输入值格式化成文本
- 通过 `ctx.setWidget("watch-text", ...)` 写回节点内部文字 Widget
- 不再只靠标题和 `status` 旁路显示内容

## 目录结构

```text
templates/node/authoring-node-template/
  package.json
  tsconfig.json
  tsconfig.build.json
  vite.config.ts
  vite.browser.config.ts
  scripts/
    prepare_dist.mjs
  src/
    index.ts
    developer/
      index.ts
      shared.ts
      module.ts
      nodes/
        basic_sum_node.ts
        watch_node.ts
    browser/
      register_bundle.ts
      node_bundle.ts
```

## 开发者改哪里

常见修改入口：

- `src/developer/shared.ts`
  - 包名、版本、scope、类型常量、bundle 展示名
- `src/developer/nodes/basic_sum_node.ts`
  - 计算节点逻辑
- `src/developer/nodes/watch_node.ts`
  - 观察节点逻辑
- `src/developer/module.ts`
  - `module`、`plugin` 与节点收口方式

`src/developer/index.ts` 现在只负责聚合导出，方便宿主和 browser 层统一引用。

## 开发流程

在模板目录执行：

```bash
bun install
bun run check
bun run build
```

流程固定是：

1. 在 `src/developer/nodes/*.ts` 里写 `BaseNode` 子类
2. 先通过 `check` 和 ESM 构建验证源码
3. 最后再输出 `dist/browser/node.iife.js`

## 对外导出

- `BasicSumNode`
- `WatchNode`
- `basicSumNodeDefinition`
- `watchNodeDefinition`
- `authoringNodeTemplateModule`
- `authoringNodeTemplatePlugin`
- `AUTHORING_NODE_TEMPLATE_BASIC_SUM_TYPE`
- `AUTHORING_NODE_TEMPLATE_WATCH_TYPE`

## 宿主接入

如果你想把模板直接当 ESM 包使用：

```ts
import { createLeaferGraph } from "leafergraph";
import authoringNodeTemplatePlugin, {
  AUTHORING_NODE_TEMPLATE_WATCH_TYPE
} from "@template/authoring-node-template";

const graph = createLeaferGraph(container, {
  plugins: [authoringNodeTemplatePlugin],
  document: {
    documentId: "authoring-node-template-demo",
    revision: 1,
    appKind: "leafergraph-local",
    nodes: [
      {
        id: "watch-1",
        type: AUTHORING_NODE_TEMPLATE_WATCH_TYPE,
        layout: { x: 120, y: 120 }
      }
    ],
    links: []
  }
});

await graph.ready;
```

如果你想给 editor 的本地 bundle 面板加载，使用最终产物：

```text
dist/browser/node.iife.js
```

## 边界说明

- 模板源码优先，`iife.js` 只是最终发布物
- `browser/` 目录只负责 bundle 注册，不承接业务节点信息
- 这里不兼容 litegraph.js 旧节点实现，只借用 `watch` 这种作者心智
- 仓库内为了方便验证，`devDependencies` 默认指向本地 `packages/*`

## 进一步阅读

- [Templates 总览](../../README.md)
- [@leafergraph/authoring README](../../../packages/authoring/README.md)
- [节点 / 组件 / 蓝图加载说明](../../../docs/节点组件蓝图加载说明.md)
