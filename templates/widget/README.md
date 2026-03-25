# Widget Templates

这个目录用于放“纯 Widget 作者模型”的模板与说明。

## 当前边界

- 当前默认入口是 `authoring-text-widget-template`。
- Widget 模板的 `developer/` 会按 `shared / widgets / plugin` 分文件。
- 如果只是改包名、Widget 类型或 bundle 信息，优先改 `src/developer/shared.ts`。
- 如果是改 Widget 渲染逻辑，优先改 `src/developer/widgets/*.ts`。
- 这里不放同时承担 node/demo 的组合模板。

## 当前模板

- [`authoring-text-widget-template`](./authoring-text-widget-template/README.md)
  - 纯展示型 Widget 模板
  - 内置 `TextReadoutWidget`
  - 适合 `Watch`、`Readout`、`Status Display`
  - 浏览器发布物是 `dist/browser/widget.iife.js`

## 应放什么

- 单 Widget renderer 模板
- Widget 元数据与交互约定说明
- Widget 与节点属性镜像写回的作者指南

## 不应放什么

- authority 后端模板
- 同时承载 node/demo/widget 的混合型浏览器插件模板
- 后端驱动节点包模板
