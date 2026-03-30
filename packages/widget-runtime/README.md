# @leafergraph/widget-runtime

`@leafergraph/widget-runtime` 是当前 workspace 里 Widget runtime 基础设施的正式真源。

它负责这些能力：

- `LeaferGraphWidgetRegistry`
- `LeaferGraphWidgetHost`
- `LeaferGraphWidgetEditingManager`
- Widget lifecycle helper
- Widget interaction helper
- 缺失态 Widget renderer 与无副作用编辑上下文

它不负责这些能力：

- `LeaferGraph` 主包 facade
- 图主题装配与主包 runtime assembly
- 内建基础控件库 `widgets/basic/*`

当前兼容策略是：

- `leafergraph` 根入口仍继续 re-export 常用 Widget helper 和 `LeaferGraphWidgetRegistry`
- workspace 内部新增实现应优先直接依赖 `@leafergraph/widget-runtime`

常用命令：

```bash
bun run build:widget-runtime
bun run test:widget-runtime
```
