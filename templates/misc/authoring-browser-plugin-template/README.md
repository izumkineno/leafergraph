# Authoring Browser Plugin Template

这是一份完整的 authoring-first `TypeScript` 模板工程。

它面向“开发者真正要交付一个可加载 bundle”的场景：开发者平时主要维护 `src/developer/` 里的类型化文件，而 `src/presets/` 和 `src/browser/` 只负责消费这些信息，最终再构建成给 editor 或外部宿主加载的 `dist/browser/*.iife.js`。

## 这份模板提供什么

- 一个自定义文字展示 Widget `TextReadoutWidget`
- 一个计算节点 `SumNode`
- 一个流程节点 `PulseCounterNode`
- 一个观察节点 `WatchNode`
- 最小 demo 文档 `authoringBrowserTemplateDemoDocument`
- 最终 browser 产物：
  - `dist/browser/widget.iife.js`
  - `dist/browser/node.iife.js`
  - `dist/browser/demo.iife.js`

其中最重要的演示链路是：

```text
system/on-play -> PulseCounterNode -> WatchNode
```

`WatchNode` 不再只改标题或 `status`，而是把最新输入值同步到节点内部的自定义文字 Widget。

## 目录结构

```text
templates/misc/authoring-browser-plugin-template/
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
      preset.ts
      nodes/
        sum_node.ts
        pulse_counter_node.ts
        watch_node.ts
      widgets/
        text_readout_widget.ts
    presets/
      demo_document.ts
    browser/
      register_bundle.ts
      widget_bundle.ts
      node_bundle.ts
      demo_bundle.ts
```

## 开发者改哪里

常见修改入口：

- `src/developer/shared.ts`
  - 包名、版本、scope、类型常量、bundle 展示名
- `src/developer/widgets/text_readout_widget.ts`
  - 文字 Widget 渲染逻辑
- `src/developer/nodes/*.ts`
  - `SumNode`、`PulseCounterNode`、`WatchNode`
- `src/developer/preset.ts`
  - demo 预设里的节点、连线和默认文案
- `src/developer/module.ts`
  - `module`、`plugin` 与节点/Widget 收口方式

而这两个目录默认尽量不改：

- `src/presets/`
  - 只负责把开发者入口提供的数据装配成正式 `GraphDocument`
- `src/browser/`
  - 只负责向 editor 的 bundle bridge 注册 `widget/node/demo`

## 开发流程

在模板目录执行：

```bash
bun install
bun run check
bun run build
```

流程固定是：

1. 在 `src/developer/widgets/*.ts` 和 `src/developer/nodes/*.ts` 里写 `BaseWidget` / `BaseNode`
2. 先通过 `check` 和 ESM 构建验证源码
3. 最后构建 `widget.iife.js`、`node.iife.js`、`demo.iife.js`

## 对外导出

- `TextReadoutWidget`
- `textReadoutWidgetEntry`
- `SumNode`
- `PulseCounterNode`
- `WatchNode`
- `authoringBrowserTemplateModule`
- `authoringBrowserTemplateWidgetPlugin`
- `authoringBrowserTemplateNodePlugin`
- `authoringBrowserTemplatePlugin`
- `authoringBrowserTemplateDemoDocument`

## ESM 宿主接入

```ts
import { createLeaferGraph } from "leafergraph";
import authoringBrowserTemplatePlugin, {
  authoringBrowserTemplateDemoDocument
} from "@template/authoring-browser-plugin-template";

const graph = createLeaferGraph(container, {
  plugins: [authoringBrowserTemplatePlugin],
  document: authoringBrowserTemplateDemoDocument
});

await graph.ready;
```

## editor 本地加载顺序

如果你想直接用 editor 的本地 bundle 面板联调，推荐顺序是：

1. `dist/browser/widget.iife.js`
2. `dist/browser/node.iife.js`
3. `dist/browser/demo.iife.js`

这样 `WatchNode` 依赖的 `TextReadoutWidget` 会先完成注册，再恢复引用它的节点和 demo 文档。

## 边界说明

- 模板源码优先，`iife.js` 只是最终发布物
- browser bundle 继续沿用 editor 现有 script-bundle 握手
- editor / 宿主适配 authoring 产物，不是 authoring 反向兼容 editor
- 预设层与开发者层已分离；需要改 demo 内容时，优先先改 `src/developer/preset.ts`
- 这里不兼容 litegraph.js 旧节点实现，只借用 `watch` 和最小流程链的开发者心智
- 这里就是当前更推荐的 authoring 浏览器模板入口

## 进一步阅读

- [Templates 总览](../../README.md)
- [@leafergraph/authoring README](../../../packages/authoring/README.md)
- [节点 / 组件 / 蓝图加载说明](../../../docs/节点组件蓝图加载说明.md)
