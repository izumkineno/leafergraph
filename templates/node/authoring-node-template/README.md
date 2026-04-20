# Authoring Node Template

这是一份面向“纯节点作者”的模板工程。

它的目标是让你在 `src/developer/` 里维护节点作者代码，然后同时得到两类产物：

- 可直接给 TypeScript / ESM 宿主消费的 `module` 和 `plugin`
- 给支持 browser bundle 的宿主加载的 `dist/browser/node.iife.js`

## 适用场景

适合：

- 只交付节点模块，不需要额外的 Widget bundle
- 想从最小节点作者层工程开始扩展自己的节点库
- 需要同时保留 ESM 和 browser bundle 两种分发方式

不适合：

- 需要同时交付 Widget、节点和 demo bundle
- 需要宿主壳层、authority 或页面 UI

## 模板里有什么

- `BasicSumNode`
  - 最小计算节点示例
- `WatchNode`
  - 最小观察节点示例
- `authoringNodeTemplateModule`
  - 纯模块入口
- `authoringNodeTemplatePlugin`
  - 适合直接挂到 `leafergraph` 的 plugin 入口
- `dist/browser/node.iife.js`
  - 面向 browser bundle 宿主的最终产物

## 真源依赖

这份模板默认建立在这些真源包之上：

- `@leafergraph/authoring`
- `@leafergraph/contracts`
- `@leafergraph/node`

如果你要直接拿它在宿主里跑图，通常还会再用：

- `leafergraph`

## 目录速览

```text
templates/node/authoring-node-template/
  src/
    developer/
      shared.ts
      module.ts
      nodes/
    browser/
  scripts/
  vite.config.ts
  vite.browser.config.ts
```

最常改的地方：

- `src/developer/shared.ts`
  - 包名、scope、类型常量、bundle 展示名
- `src/developer/nodes/*.ts`
  - 节点逻辑
- `src/developer/module.ts`
  - `module` 和 `plugin` 的收口方式

## 开发流程

在模板目录执行：

```bash
bun install
bun run check
bun run build
```

推荐顺序：

1. 先改 `src/developer/`
2. 先通过 `check`
3. 再看 `dist/` 里的 ESM 和 browser 产物

## 宿主接入

### ESM 宿主

```ts
import { createLeaferGraph } from "leafergraph";
import authoringNodeTemplatePlugin from "@template/authoring-node-template";

const graph = createLeaferGraph(container, {
  plugins: [authoringNodeTemplatePlugin]
});

await graph.ready;
```

### browser bundle 宿主

把下面这个产物交给支持 node bundle 的宿主：

```text
dist/browser/node.iife.js
```

## 继续阅读

- [Templates 总览](../../README.md)
- [@leafergraph/authoring README](../../../packages/authoring/README.md)
- [外部节点包接入方案](../../../docs/节点插件接入方案.md)
