# Widget Templates

这个目录只放“纯 Widget 作者模板”。

它们的共同特点是：

- 作者代码集中在 `src/developer/`
- 重点演示 `BaseWidget` 和正式 `LeaferGraphWidgetEntry` 的写法
- 能导出 ESM 包，也能构建 `widget.iife.js`

## 当前模板

- [authoring-text-widget-template](./authoring-text-widget-template/README.md)
  - 纯展示型 Widget 模板
  - 自带 `TextReadoutWidget`
  - 适合做 `Watch`、`Readout`、`Status Display` 一类控件

## 适用边界

适合放在这里的模板：

- 只交付 Widget entry 和 plugin
- 不需要同时打包 node / demo bundle
- 主要演示渲染、编辑或展示型 Widget 作者代码

不适合放在这里的模板：

- 组合式 browser bundle 模板
- 只关注节点逻辑的模板
- authority、宿主壳层或后端模板

## 推荐阅读顺序

1. [authoring-text-widget-template README](./authoring-text-widget-template/README.md)
2. [@leafergraph/extensions/authoring README](../../packages/extensions/authoring/README.md)
3. [@leafergraph/core/widget-runtime README](../../packages/core/widget-runtime/README.md)


