# Authoring Browser Plugin Template

这是一份完整的 authoring-first 组合模板。

它面向“我要同时交付节点、Widget 和 demo bundle”的场景，适合拿来做最小可分发的 browser plugin 样例。

## 适用场景

适合：

- 同时交付 node / widget / demo 三段链路
- 既要保留 ESM 包，又要保留 browser bundle 入口
- 需要最小的 demo 文档来验证 bundle 安装结果

不适合：

- 只想交付单个节点包
- 只想交付单个 Widget 包
- 需要 editor 壳层、authority 或复杂页面工作台

## 模板里有什么

- `TextReadoutWidget`
- `SumNode`
- `PulseCounterNode`
- `WatchNode`
- `authoringBrowserTemplateModule`
- `authoringBrowserTemplatePlugin`
- `authoringBrowserTemplateDemoDocument`
- `dist/browser/widget.iife.js`
- `dist/browser/node.iife.js`
- `dist/browser/demo.iife.js`

## 真源依赖

这份模板默认建立在这些真源包之上：

- `@leafergraph/authoring`
- `@leafergraph/contracts`
- `@leafergraph/node`

如果你直接在宿主里跑它的 demo，通常还会额外用到：

- `leafergraph`
- `@leafergraph/basic-kit`

## 目录速览

```text
templates/misc/authoring-browser-plugin-template/
  src/
    developer/
      nodes/
      widgets/
      module.ts
      preset.ts
    presets/
    browser/
```

最常改的地方：

- `src/developer/shared.ts`
  - 包名、scope、类型常量、bundle 展示名
- `src/developer/nodes/*.ts`
  - 节点逻辑
- `src/developer/widgets/*.ts`
  - Widget 逻辑
- `src/developer/preset.ts`
  - demo 文档与默认链路
- `src/developer/module.ts`
  - plugin / module 收口方式

## 开发流程

在模板目录执行：

```bash
bun install
bun run check
bun run build
```

构建完成后，你会同时得到：

- `dist/browser/widget.iife.js`
- `dist/browser/node.iife.js`
- `dist/browser/demo.iife.js`

## 宿主接入

### ESM 宿主

```ts
import { createLeaferGraph } from "leafergraph";
import { leaferGraphBasicKitPlugin } from "@leafergraph/basic-kit";
import authoringBrowserTemplatePlugin, {
  authoringBrowserTemplateDemoDocument
} from "@template/authoring-browser-plugin-template";

const graph = createLeaferGraph(container, {
  plugins: [leaferGraphBasicKitPlugin, authoringBrowserTemplatePlugin],
  document: authoringBrowserTemplateDemoDocument
});

await graph.ready;
```

### browser bundle 宿主

推荐加载顺序：

1. `dist/browser/widget.iife.js`
2. `dist/browser/node.iife.js`
3. `dist/browser/demo.iife.js`

## 继续阅读

- [Templates 总览](../../README.md)
- [@leafergraph/authoring README](../../../packages/authoring/README.md)
- [外部节点包接入方案](../../../docs/节点插件接入方案.md)
