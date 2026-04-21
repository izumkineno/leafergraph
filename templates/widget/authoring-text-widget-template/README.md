# Authoring Text Widget Template

这是一份面向“纯 Widget 作者”的模板工程。

它的目标是让你在 `src/developer/` 里维护 Widget 作者代码，然后同时得到：

- 可直接给 TypeScript / ESM 宿主消费的 Widget entry / plugin
- 给支持 browser bundle 的宿主加载的 `dist/browser/widget.iife.js`

## 适用场景

适合：

- 展示型 Widget
- 状态回显 Widget
- 想先从单个 Widget entry 开始打磨作者层体验

不适合：

- 需要同时交付 node / demo bundle
- 需要主包运行时之外的宿主壳层逻辑

## 模板里有什么

- `TextReadoutWidget`
  - 最小文字展示型 Widget
- `textReadoutWidgetEntry`
  - 正式 Widget entry
- `authoringTextWidgetTemplatePlugin`
  - 只注册 Widget 的 plugin 入口
- `dist/browser/widget.iife.js`
  - browser bundle 产物

## 真源依赖

这份模板默认建立在这些真源包之上：

- `@leafergraph/extensions/authoring`
- `@leafergraph/core/contracts`
- `@leafergraph/core/node`

如果你的宿主需要真正显示这类 Widget，一般还会消费：

- `leafergraph`
- `@leafergraph/core/widget-runtime`

## 目录速览

```text
templates/widget/authoring-text-widget-template/
  src/
    developer/
      shared.ts
      plugin.ts
      widgets/
    browser/
  scripts/
  vite.config.ts
  vite.browser.config.ts
```

最常改的地方：

- `src/developer/shared.ts`
  - 包名、Widget 类型、bundle 展示名
- `src/developer/widgets/*.ts`
  - Widget 渲染逻辑
- `src/developer/plugin.ts`
  - plugin 收口方式

## 开发流程

在模板目录执行：

```bash
bun install
bun run check
bun run build
```

## 宿主接入

### ESM 宿主

直接把 `authoringTextWidgetTemplatePlugin` 装进宿主即可。

### browser bundle 宿主

把下面这个产物交给支持 widget bundle 的宿主：

```text
dist/browser/widget.iife.js
```

## 继续阅读

- [Templates 总览](../../README.md)
- [@leafergraph/extensions/authoring README](../../../packages/extensions/authoring/README.md)
- [@leafergraph/core/widget-runtime README](../../../packages/core/widget-runtime/README.md)


