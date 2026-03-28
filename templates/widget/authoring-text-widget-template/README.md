# Authoring Text Widget Template

这是一份面向 Widget 作者的 `TypeScript` 模板工程。

它的目标很明确：让开发者在 `src/developer/` 里按类型维护 Widget 模板代码，用 `@leafergraph/authoring` 写一个专门负责显示文字的自定义 Widget，然后在需要时再构建为 `dist/browser/widget.iife.js`，交给支持 browser bundle 的宿主或外部应用加载。

## 这份模板提供什么

- 一个自定义 `TextReadoutWidget`
- 正式导出的 `textReadoutWidgetEntry`
- 只注册 Widget 的 `authoringTextWidgetTemplatePlugin`
- 最终 browser 产物 `dist/browser/widget.iife.js`

这个 Widget 适合这类节点：

- `Watch`
- `Readout`
- `Status Display`
- 简单日志或运行反馈展示节点

## 目录结构

```text
templates/widget/authoring-text-widget-template/
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
      plugin.ts
      widgets/
        text_readout_widget.ts
    browser/
      register_bundle.ts
      widget_bundle.ts
```

## 开发者改哪里

常见修改入口：

- `src/developer/shared.ts`
  - 包名、版本、Widget 类型、bundle 展示名
- `src/developer/widgets/text_readout_widget.ts`
  - Widget 渲染逻辑与展示文案
- `src/developer/plugin.ts`
  - Widget plugin 的收口方式

`src/developer/index.ts` 现在只负责聚合导出，方便宿主和 browser 层统一引用。

## 开发流程

在模板目录执行：

```bash
bun install
bun run check
bun run build
```

流程固定是：

1. 在 `src/developer/widgets/*.ts` 里写 `BaseWidget` 子类
2. 先通过 `check` 和 ESM 构建验证源码
3. 最后再输出 `dist/browser/widget.iife.js`

## 对外导出

- `TextReadoutWidget`
- `textReadoutWidgetEntry`
- `authoringTextWidgetTemplatePlugin`
- `AUTHORING_TEXT_WIDGET_TEMPLATE_WIDGET_TYPE`

## 在节点里使用

```ts
import { BaseNode } from "@leafergraph/authoring";
import { AUTHORING_TEXT_WIDGET_TEMPLATE_WIDGET_TYPE } from "@template/authoring-text-widget-template";

class WatchNode extends BaseNode {
  static meta = {
    type: "demo/watch",
    title: "Watch",
    inputs: [{ name: "Value", type: 0 }],
    widgets: [
      {
        type: AUTHORING_TEXT_WIDGET_TEMPLATE_WIDGET_TYPE,
        name: "readout",
        value: "EMPTY",
        options: {
          label: "Watch Text",
          description: "显示最近一次输入值"
        }
      }
    ]
  };

  onExecute(ctx) {
    ctx.setWidget("readout", String(ctx.getInputAt(0) ?? "EMPTY"));
  }
}
```

## 宿主接入

如果你想给支持 IIFE bundle 的宿主加载，使用最终产物：

```text
dist/browser/widget.iife.js
```

如果你想把模板直接当 ESM 包使用，把 `authoringTextWidgetTemplatePlugin` 放进宿主 `plugins` 即可。

## 边界说明

- 模板源码优先，`iife.js` 只是最终发布物
- `browser/` 目录只负责 bundle 注册，不承接 Widget 业务定义
- 这里不提供节点模块、demo 文档或 editor 反向适配逻辑
- 这里不兼容 litegraph.js 旧 Widget 体系，只提供 authoring-first 的展示型 Widget 示例
- 仓库内为了方便验证，`devDependencies` 默认指向本地 `packages/*`

## 进一步阅读

- [Templates 总览](../../README.md)
- [@leafergraph/authoring README](../../../packages/authoring/README.md)
- [外部节点包接入方案](../../../docs/节点插件接入方案.md)
