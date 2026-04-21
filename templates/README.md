# Templates 总览

`templates/` 只放对外可复制的模板工程，不承载 workspace 核心源码。

这层文档重点回答两件事：

- 现在有哪些活动模板可以直接复制
- 不同模板分别适合哪类作者和哪种交付方式

## 当前模板矩阵

| 路径 | 适合谁 | 主要产物 |
| --- | --- | --- |
| `templates/node/authoring-node-template` | 只想交付节点模块的作者 | `module`、`plugin`、`dist/browser/node.iife.js` |
| `templates/widget/authoring-text-widget-template` | 只想交付 Widget 的作者 | `widget entry`、`plugin`、`dist/browser/widget.iife.js` |
| `templates/misc/authoring-browser-plugin-template` | 想同时交付 node / widget / demo 的作者 | `dist/browser/widget.iife.js`、`node.iife.js`、`demo.iife.js` |

当前 `templates/` 下没有活动中的 backend 模板，也没有额外的 category README 需要优先阅读。

## 我该选哪个模板

### 只需要节点

优先看：

- [authoring-node-template](./node/authoring-node-template/README.md)

适合：

- 纯计算节点
- 纯流程节点
- 只打算交付 `module` / `plugin` 和 `node.iife.js`

### 只需要 Widget

优先看：

- [authoring-text-widget-template](./widget/authoring-text-widget-template/README.md)

适合：

- 只读展示型 Widget
- 输入类或状态类 Widget
- 只打算交付 `widget entry` 和 `widget.iife.js`

### 需要一个组合式 browser bundle

优先看：

- [authoring-browser-plugin-template](./misc/authoring-browser-plugin-template/README.md)

适合：

- 需要一起交付 Widget、节点和 demo 文档
- 需要 `widget / node / demo` 三份 browser bundle
- 需要同时验证 ESM 包和 browser bundle 入口

## 模板和正式包的关系

模板当前默认建立在这些真源包之上：

- `@leafergraph/authoring`
- `@leafergraph/node`
- `@leafergraph/contracts`

部分模板或示例还会额外依赖：

- `leafergraph`
- `@leafergraph/basic-kit`

固定原则是：

- 模板负责演示“怎样组织一个对外可分发的作者层工程”
- 真正的模型、协议和运行时真源仍然在 `packages/`
- 模板不重新定义主包 API，也不承担 editor 壳层逻辑

## package split 期间如何理解模板依赖

当前模板源码仍然跟着现有 workspace 包名走；但在拆分完成后，这些依赖会收口到更明确的 target package。

| 当前依赖 | 拆分后目标 |
| --- | --- |
| `@leafergraph/node` | `@leafergraph/core/node` |
| `@leafergraph/contracts` | `@leafergraph/core/contracts` |
| `@leafergraph/widget-runtime` | `@leafergraph/core/widget-runtime` |
| `@leafergraph/basic-kit` | `@leafergraph/core/basic-kit` |
| `@leafergraph/authoring` | `@leafergraph/extensions/authoring` |

文档写法约定：

- 讲模板“现在怎么跑”，继续使用当前真实包名。
- 讲模板“拆分后会依赖什么”，明确写成 target package。
- 不要把 `leafergraph` 重新描述成聚合全部真源的单入口；模板仍然应该显式知道自己依赖的是 core 还是 extensions。

## 开发与验证

模板当前统一采用：

- `bun run check`
- `bun run build`

root workspace 里的 smoke 会覆盖这三份活动模板：

- `@template/authoring-node-template`
- `@template/authoring-text-widget-template`
- `@template/authoring-browser-plugin-template`

如果你在模板上做改动，推荐至少在仓库根目录执行：

```bash
bun run test:smoke:templates
```

## 继续阅读

- [Node Templates](./node/README.md)
- [Widget Templates](./widget/README.md)
- [@leafergraph/authoring README](../packages/authoring/README.md)
- [外部节点包接入方案](../docs/节点插件接入方案.md)
