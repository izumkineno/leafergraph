# LeaferGraph

> 基于 Leafer 引擎构建的高性能、可扩展的节点图编辑器 runtime

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Leafer](https://img.shields.io/badge/powered%20by-leafer-green)](https://leaferjs.com/)
[![Bun](https://img.shields.io/badge/bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh/)

## ✨ 核心特性

### 🚀 高性能渲染

- 基于 Leafer 2D 渲染引擎，原生支持 Canvas/WebGL 双模式
- 支持 1000+ 节点同时渲染，保持高流畅体验
- 智能局部刷新机制，避免不必要的重绘

### 🧩 模块化架构

- 严格的分层设计，核心与扩展完全解耦
- 插件化扩展机制，功能按需接入
- 支持自定义节点、Widget、菜单、快捷键等

### 🎨 强大的定制能力

- 完整的主题系统，支持亮暗模式切换和自定义样式
- 可定制节点外壳、连线样式、交互行为
- 支持声明式节点定义和类式节点开发两种模式

### ⚡ 内置丰富功能

- 节点拖拽、框选、复制粘贴、删除等基础编辑能力
- 连线自动路由，支持自定义路径算法
- 撤销/重做历史栈
- 快捷键系统，支持自定义绑定
- 右键菜单扩展机制
- 节点执行与数据流动画

### 📦 开箱即用的生态

- 内置基础节点库和常用 Widget
- 提供官方模板，快速开始节点开发
- 完善的 TypeScript 类型支持
- 兼容浏览器和 Electron 等环境

### 🔧 开发者友好

- 完善的开发文档和示例
- 类 React 的 Widget 开发体验
- 内置的节点和 Widget 开发脚手架
- 提供调试工具和性能分析能力

## 🚀 快速开始

### 安装

```bash
# 安装核心库
npm install leafergraph
# 或使用 bun
bun add leafergraph
```

### 最简示例

```typescript
import { createLeaferGraph } from 'leafergraph';
import { leaferGraphBasicKitPlugin } from '@leafergraph/core/basic-kit';

// 创建图实例
const graph = createLeaferGraph(document.getElementById('app')!, {
  plugins: [leaferGraphBasicKitPlugin()], // 安装基础组件库
  config: {
    graph: {
      fill: '#0b1220' // 画布背景色
    }
  }
});

// 等待初始化完成
await graph.ready;

// 创建一个节点
graph.node.create({
  type: 'system/constant-number',
  position: { x: 100, y: 100 },
  properties: { value: 42 }
});
```

## 📖 文档导航

| 类型          | 链接                                                                               | 适用人群                          |
| ------------- | ---------------------------------------------------------------------------------- | --------------------------------- |
| 🚀 快速上手   | [主包 README](./packages/leafergraph/README.md)                                       | 首次使用者，想快速集成图编辑器    |
| 📚 使用指南   | [使用与扩展指南](./packages/leafergraph/使用与扩展指南.md)                            | 需要深入了解API和扩展能力的开发者 |
| 🔧 节点开发   | [@leafergraph/extensions/authoring README](./packages/extensions/authoring/README.md) | 想要自定义开发节点和Widget的作者  |
| 🏗️ 架构设计 | [内部架构地图](./packages/leafergraph/内部架构地图.md)                                | 核心开发者和贡献者                |
| 🎨 主题定制   | [@leafergraph/core/theme README](./packages/core/theme/README.md)                     | 需要定制界面风格的开发者          |

## 🎯 项目定位

`leafergraph` 是一个 Leafer-first 的多包 workspace，专注于提供高性能的节点图运行时核心，不绑定特定的业务场景。你可以用它来构建：

- 工作流编辑器
- 可视化编程平台
- 数据流处理工具
- 神经网络设计器
- 低代码搭建平台
- 任何需要节点式交互的应用

---

## 项目分层与开发指南

这份根 README 只做三件事：

- 告诉你现在仓库里有哪些正式包、示例、模板和维护文档
- 说明这些包之间的职责边界和依赖方向
- 帮你快速判断“我现在应该先看哪个包 / 哪份文档”

如果你只想开始用，优先看各包 README。
如果你在维护主包内部装配链，再继续看 `packages/leafergraph` 里的深层文档。
如果你在整理未来演进路线，再看 `docs/架构演进与提案总览.md`。

## 项目分层

当前仓库里实际存在的正式包可以按六层理解：

| 层级            | 当前包                                                                                                                                                                    | 作用                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| core foundation | `@leafergraph/core/node`、`@leafergraph/core/execution`、`@leafergraph/core/contracts`                                                                              | 定义节点模型、执行链、跨包共享协议                     |
| core runtime    | `@leafergraph/core/config`、`@leafergraph/core/theme`、`@leafergraph/core/widget-runtime`、`@leafergraph/core/basic-kit`                                          | 提供配置、主题、Widget runtime 和默认内容包            |
| 主包兼容层      | `leafergraph`                                                                                                                                                           | 作为 runtime-only 主包，对外提供 Leafer 图宿主 façade |
| 宿主扩展层      | `@leafergraph/extensions/context-menu`、`@leafergraph/extensions/context-menu-builtins`、`@leafergraph/extensions/shortcuts`、`@leafergraph/extensions/undo-redo` | 提供菜单、内建动作、快捷键和历史栈扩展                 |
| 作者层          | `@leafergraph/extensions/authoring`                                                                                                                                     | 提供节点 / Widget 作者层 SDK                           |
| 消费样例层      | `example/`、`templates/`                                                                                                                                              | 提供 dogfood 示例和可复制模板                          |

额外记住三个固定约束：

- `leafergraph` 已经收口成 runtime-only 主包，不再聚合 re-export 其它真源包。
- `@leafergraph/extensions/shortcuts`、`@leafergraph/extensions/undo-redo` 已进入默认 build/test 聚合，但文档定位仍然是“非核心维护包 / 宿主扩展层”。
- 当前仓库里没有活动中的 `runtime-bridge` 包；凡是还提到它的文档，都应视为历史草案或待清理内容。

## 当前正式布局与兼容映射

当前正式包已经落到 `packages/core/*` 和 `packages/extensions/*` 两条目录下。阅读旧文档或迁移笔记时，可以先按这张兼容映射表理解：

| 旧名 / 草案名                          | 当前正式包                                        | 备注                                                                                                           |
| -------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@leafergraph/node`                  | `@leafergraph/core/node`                        | core foundation                                                                                                |
| `@leafergraph/execution`             | `@leafergraph/core/execution`                   | core foundation                                                                                                |
| `@leafergraph/contracts`             | `@leafergraph/core/contracts`                   | core foundation                                                                                                |
| `@leafergraph/config`                | `@leafergraph/core/config`                      | core runtime                                                                                                   |
| `@leafergraph/theme`                 | `@leafergraph/core/theme`                       | core runtime                                                                                                   |
| `@leafergraph/widget-runtime`        | `@leafergraph/core/widget-runtime`              | core runtime                                                                                                   |
| `@leafergraph/basic-kit`             | `@leafergraph/core/basic-kit`                   | core runtime                                                                                                   |
| `@leafergraph/context-menu`          | `@leafergraph/extensions/context-menu`          | extensions                                                                                                     |
| `@leafergraph/context-menu-builtins` | `@leafergraph/extensions/context-menu-builtins` | extensions                                                                                                     |
| `@leafergraph/shortcuts`             | `@leafergraph/extensions/shortcuts`             | extensions                                                                                                     |
| `@leafergraph/undo-redo`             | `@leafergraph/extensions/undo-redo`             | extensions                                                                                                     |
| `@leafergraph/authoring`             | `@leafergraph/extensions/authoring`             | extensions / authoring SDK                                                                                     |
| `leafergraph`                        | `leafergraph`                                   | runtime-only 兼容主包；根入口只保留 `LeaferGraph` / `createLeaferGraph(...)`，高级兼容子路径按最小集合维护 |

这轮拆分里，README / docs / example / templates 统一遵守下面的写法约定：

| 场景                     | 文档应该怎么写                                           |
| ------------------------ | -------------------------------------------------------- |
| 描述“当前已落地事实”   | 继续使用当前源码里的真实包名和目录                       |
| 描述“拆分后的目标结构” | 明确写成 target package，例如 `@leafergraph/core/node` |
| 同时覆盖当前与目标       | 写出“当前包 → 目标包”的映射，避免把未来方案误写成现状 |

## 迁移边界与验证矩阵

这轮 package split 的文档/样例边界固定如下：

| 区域                              | 本轮应该证明什么                                                 | 推荐验证                                                                       |
| --------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `README.md` / `docs/`         | 当前包边界真实、目标拆分映射清晰、无已删除包导航                 | `bun run check:boundaries`                                                   |
| `example/mini-graph`            | 主包兼容层仍能显式装配 core + extensions                         | `bun run build:minimal-graph`                                                |
| `example/authoring-basic-nodes` | 纯作者层示例仍可说明 `authoring` 与 core foundation 的关系     | `bun run check:authoring-basic-nodes && bun run build:authoring-basic-nodes` |
| `templates/`                    | 模板仍然围绕 authoring + core 真源组织，不误导使用者依赖历史壳层 | `bun run test:smoke:templates`                                               |

## 我现在该先看哪里

### 我想直接跑一个图

1. [leafergraph README](./packages/leafergraph/README.md)
2. [使用与扩展指南](./packages/leafergraph/使用与扩展指南.md)
3. [mini-graph README](./example/mini-graph/README.md)

### 我想理解节点模型、文档和插件入口

1. [@leafergraph/core/node README](./packages/core/node/README.md)
2. [@leafergraph/core/contracts README](./packages/core/contracts/README.md)
3. [节点 API 与节点壳专题](./docs/节点API方案.md)
4. [外部节点包接入专题](./docs/节点插件接入方案.md)

### 我想写节点类、Widget 类或对外模板

1. [@leafergraph/extensions/authoring README](./packages/extensions/authoring/README.md)
2. [authoring-basic-nodes README](./example/authoring-basic-nodes/README.md)
3. [Templates 总览](./templates/README.md)
4. [架构演进与提案总览](./docs/架构演进与提案总览.md)

### 我想接主题、配置、菜单、快捷键或历史栈

1. [@leafergraph/core/theme README](./packages/core/theme/README.md)
2. [@leafergraph/core/config README](./packages/core/config/README.md)
3. [@leafergraph/extensions/context-menu README](./packages/extensions/context-menu/README.md)
4. [@leafergraph/extensions/context-menu-builtins README](./packages/extensions/context-menu-builtins/README.md)
5. [@leafergraph/extensions/shortcuts README](./packages/extensions/shortcuts/README.md)
6. [@leafergraph/extensions/undo-redo README](./packages/extensions/undo-redo/README.md)

### 我在维护主包内部装配链

1. [leafergraph README](./packages/leafergraph/README.md)
2. [内部架构地图](./packages/leafergraph/内部架构地图.md)
3. [渲染刷新策略](./packages/leafergraph/渲染刷新策略.md)
4. [注意事项](./注意事项.md)

## 包入口导航

| 路径                                                                                                | 什么时候看                    | 你会在这里找到什么                                                          |
| --------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------- |
| [`packages/core/node`](./packages/core/node/README.md)                                               | 需要模型真源时                | `NodeDefinition`、`NodeModule`、`GraphDocument`、`NodeRegistry`     |
| [`packages/core/theme`](./packages/core/theme/README.md)                                             | 需要视觉主题时                | `themePreset`、`themeMode`、graph/widget/context-menu token             |
| [`packages/core/config`](./packages/core/config/README.md)                                           | 需要行为配置时                | `graph`、`widget`、`context-menu`、`leafer` 配置和 normalize helper |
| [`packages/core/execution`](./packages/core/execution/README.md)                                     | 需要执行内核时                | 执行上下文、传播语义、图级状态机和本地反馈适配器                            |
| [`packages/core/contracts`](./packages/core/contracts/README.md)                                     | 需要跨包共享协议时            | 插件协议、图 API 输入输出、Widget 契约、history/diff helper                 |
| [`packages/core/widget-runtime`](./packages/core/widget-runtime/README.md)                           | 需要 Widget runtime 真源时    | registry、renderer lifecycle、editing、interaction helper                   |
| [`packages/core/basic-kit`](./packages/core/basic-kit/README.md)                                     | 需要默认内容时                | 基础 widgets、系统节点和一键安装 plugin                                     |
| [`packages/leafergraph`](./packages/leafergraph/README.md)                                           | 需要图运行时主包时            | `LeaferGraph`、`createLeaferGraph(...)` 和 runtime façade              |
| [`packages/extensions/context-menu`](./packages/extensions/context-menu/README.md)                   | 需要纯 Leafer 菜单 runtime 时 | DOM 菜单 overlay、target 绑定、resolver 链                                  |
| [`packages/extensions/context-menu-builtins`](./packages/extensions/context-menu-builtins/README.md) | 需要节点图内建菜单动作时      | 复制、粘贴、删除、运行、历史和快捷键文案接线                                |
| [`packages/extensions/shortcuts`](./packages/extensions/shortcuts/README.md)                         | 需要宿主快捷键时              | 功能注册表、按键注册表、graph 快捷键预设                                    |
| [`packages/extensions/undo-redo`](./packages/extensions/undo-redo/README.md)                         | 需要历史栈时                  | undo/redo controller、graph history 绑定                                    |
| [`packages/extensions/authoring`](./packages/extensions/authoring/README.md)                         | 需要作者层 SDK 时             | `BaseNode`、`BaseWidget`、plugin / module 组装                          |

## 深层文档

### 当前事实型专题

- [节点 API 与节点壳设计](./docs/节点API方案.md)
- [外部节点包接入方案](./docs/节点插件接入方案.md)
- [连线路径实现说明](./docs/连线路由.md)
- [AI / 工程导航索引](./docs/leafergraph-ai-index.md)

### 主包维护文档

- [使用与扩展指南](./packages/leafergraph/使用与扩展指南.md)
- [内部架构地图](./packages/leafergraph/内部架构地图.md)
- [渲染刷新策略](./packages/leafergraph/渲染刷新策略.md)

### 前瞻性提案

- [架构演进与提案总览](./docs/架构演进与提案总览.md)

这里的分工固定为：

- README
  - 优先服务使用者，讲“什么时候依赖它、怎么接入、和谁配合”
- 深层维护文档
  - 优先服务维护者，讲“内部怎么装配、刷新链怎么走、边界怎么划”
- 提案总览
  - 只收口尚未完全定型或仍在演进中的规划，不和当前事实型专题混写

## 示例与模板

### 示例

- [mini-graph](./example/mini-graph/README.md)
  - 当前最完整的公开 API 集成示例
  - 同时覆盖 `basic-kit`、菜单、shortcuts、undo-redo、bundle loader 和运行时动画
- [authoring-basic-nodes](./example/authoring-basic-nodes/README.md)
  - 纯作者层示例包
  - 适合看 `@leafergraph/extensions/authoring` 产物如何收口成 plugin / module
- `example/web-crawler-nodes`
  - 作为源码级作者层示例存在
  - 当前暂无独立 README，不作为一线对外导航入口

### 模板

| 模板                                                                                                              | 用途                          | 产物形态                                                            |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| [`templates/node/authoring-node-template`](./templates/node/authoring-node-template/README.md)                     | 纯节点作者模板                | `module`、`plugin`、`dist/browser/node.iife.js`               |
| [`templates/widget/authoring-text-widget-template`](./templates/widget/authoring-text-widget-template/README.md)   | 纯 Widget 作者模板            | `widget entry`、`plugin`、`dist/browser/widget.iife.js`       |
| [`templates/misc/authoring-browser-plugin-template`](./templates/misc/authoring-browser-plugin-template/README.md) | node / widget / demo 组合模板 | `dist/browser/widget.iife.js`、`node.iife.js`、`demo.iife.js` |

当前 `templates/` 下没有活动中的 backend 模板，这份根 README 也不再保留旧 backend 模板链接。

## 常用命令

在仓库根目录执行：

```bash
bun install
bun run check:boundaries
bun run build
bun run test:core
bun run test:smoke
bun run test
```

也可以按包或样例拆开执行：

```bash
# 构建命令
bun run build:node
bun run build:execution
bun run build:theme
bun run build:config
bun run build:contracts
bun run build:widget-runtime
bun run build:basic-kit
bun run build:authoring
bun run build:context-menu
bun run build:context-menu-builtins
bun run build:shortcuts
bun run build:undo-redo
bun run build:leafergraph
bun run build:minimal-graph
bun run build:authoring-basic-nodes

# 开发与预览
bun run dev:minimal-graph
bun run preview:minimal-graph

# 检查与测试
bun run check:jsdoc
bun run check:workspace-boundaries
bun run test:smoke:examples
bun run test:smoke:templates

# 工具命令
bun run inspect:package-split
```

命令约定：

- `build`
  - 只构建正式包，不自动构建 examples/templates
- `test:core`
  - 运行正式包测试
- `test:smoke`
  - 运行 example/template 的 `check/build` 级 smoke
- `test`
  - 先跑边界检查，再跑正式包测试和 smoke

## 文档维护约定

- 根 README 只保留现状入口，不再为已删除目录或历史兼容结构保留导航。
- 包 README 只讲该包自己的使用入口、职责边界和真实导出。
- `docs/` 下的事实型专题以当前源码和包 README 为准；如果二者冲突，优先相信当前源码。
- package split 仍在执行中的内容，统一写到 `docs/架构演进与提案总览.md`，不要混写成“当前已经落地”的事实。
- `注意事项.md` 用于维护跨任务复用的踩坑记录，不写成方案草案。
