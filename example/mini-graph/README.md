# `example/mini-graph`

`mini-graph` 是当前 workspace 里最完整的公开 API 集成示例。

它不是一个可发布库包，而是一个“把主包和扩展包真正接到一起”的 dogfood 工程：你可以用它验证文档、插件、菜单、快捷键、历史栈、bundle loader 和运行时动画有没有一起工作。

## 这个示例覆盖什么

- `leafergraph`
  - 图运行时主包
- `@leafergraph/core/basic-kit`
  - 默认系统节点和基础 widgets
- `@leafergraph/extensions/context-menu`
  - 纯菜单 runtime
- `@leafergraph/extensions/context-menu-builtins`
  - 节点图内建菜单动作
- `@leafergraph/extensions/shortcuts`
  - 默认 graph 快捷键预设
- `@leafergraph/extensions/undo-redo`
  - 历史栈和按钮 / 快捷键接线
- `@leafergraph/extensions/authoring`
  - authoring bundle 注册和动态装载

## package split 视角下该怎么理解它

`mini-graph` 是这轮拆分里最重要的兼容 smoke 之一：它要继续证明 `leafergraph` 主包可以显式装配 core runtime 和宿主扩展，而不是退回成“把所有真源重新塞回主包”的旧路线。

按当前正式布局理解，这个示例的依赖应该落在下面这些包上：

| 依赖 | 角色 |
| --- | --- |
| `@leafergraph/core/basic-kit` | 默认系统节点和基础 widgets |
| `@leafergraph/core/contracts` | 图级共享协议 |
| `@leafergraph/core/execution` | 执行链真源 |
| `@leafergraph/core/node` | 图模型真源 |
| `@leafergraph/core/theme` | 主题真源 |
| `@leafergraph/core/widget-runtime` | Widget runtime 真源 |
| `@leafergraph/extensions/context-menu` | 菜单 runtime |
| `@leafergraph/extensions/context-menu-builtins` | 菜单 builtins |
| `@leafergraph/extensions/shortcuts` | 快捷键扩展 |
| `@leafergraph/extensions/undo-redo` | 历史栈扩展 |
| `@leafergraph/extensions/authoring` | authoring bundle 装载 |
| `leafergraph` | runtime-only 主包，仅提供图宿主 façade |

## 适合什么时候看

适合：

- 想确认主包公开 API 现在该怎么组合使用
- 想找一个“不是模板、但是真能跑”的页面级集成例子
- 想看右键菜单、快捷键和历史栈怎样一起接进图宿主
- 想验证运行时数据流动画和 bundle loader

不适合：

- 想看最小 npm 包结构
- 想复制一个对外分发模板

## 重点入口

最常看的文件：

- `src/graph/use_example_graph.ts`
  - 图生命周期、状态、历史栈、快捷键和日志接线
- `src/graph/example_context_menu.ts`
  - 菜单 runtime 和 builtins 桥接
- `src/graph/example_authoring_bundle_loader.ts`
  - 本地 authoring bundle 动态装载

## 启动与构建

在仓库根目录执行：

```bash
bun install
bun run dev:minimal-graph
```

如果只想做 smoke 或确认打包没漂移：

```bash
bun run build:minimal-graph
```

也可以直接在示例目录执行：

```bash
bun run dev
bun run build
```

## 这个示例演示的接线方式

### 默认内容

示例会显式安装：

- `@leafergraph/core/basic-kit`

### 菜单

示例页面自己创建：

- `@leafergraph/extensions/context-menu`

然后再把 builtins 接上：

- `@leafergraph/extensions/context-menu-builtins`

### 快捷键和历史栈

示例会显式绑定：

- `bindLeaferGraphShortcuts(...)`
- `bindLeaferGraphUndoRedo(...)`

这也说明两件事：

- 写了 `graph.history` 配置不会自动启用历史栈
- 主包本身不会自动安装快捷键或 undo/redo

### authoring bundle

示例支持选择编译后的单文件 ESM JS bundle，并把其中导出的 plugin / module 注册进当前 graph。

这条链主要用于验证：

- 真源导入路径没有漂移
- bundle loader 还能和当前宿主协作
- 注册后的节点能进入右键菜单和运行链

## 继续阅读

- [根 README](../../README.md)
- [leafergraph README](../../packages/leafergraph/README.md)
- [package split 执行验证矩阵](../../docs/package-split-verification.md)
- 如果你在兼容层或扩展装配方式上做调整，先看验证矩阵里的 smoke 结果，再决定是不是 README 需要同步改写。
- [@leafergraph/extensions/context-menu-builtins README](../../packages/extensions/context-menu-builtins/README.md)
- [@leafergraph/extensions/shortcuts README](../../packages/extensions/shortcuts/README.md)
- [@leafergraph/extensions/undo-redo README](../../packages/extensions/undo-redo/README.md)


