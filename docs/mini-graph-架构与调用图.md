# mini-graph 架构与调用图

> 以 `example/mini-graph` 为切入点，追踪所有涉及文件的完整调用链路与职责注释。
>
> 本文档覆盖 mini-graph demo 自身文件 + 它直接或间接调用的 `packages/` 内所有相关文件。

---

## 1. 整体架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           example/mini-graph                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  index.html → src/main.tsx → src/app.tsx                             │  │
│  │                    ↓                                                  │  │
│  │            src/graph/use_example_graph.ts (核心 hook)                 │  │
│  │              ↓          ↓           ↓           ↓                    │  │
│  │         example_     example_    example_    example_                │  │
│  │         context_     authoring_  demo_      document                 │  │
│  │         menu.ts      bundle_     plugin.ts                           │  │
│  │                      loader.ts                                       │  │
│  │                        ↓                                             │  │
│  │              example_authoring_runtime_dependencies.ts               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    ↓                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                         packages/leafergraph                                │
│              LeaferGraph 类 + createLeaferGraph() 工厂                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  src/public/leafer_graph.ts  ← 公共 façade 入口                      │   │
│  │  src/graph/assembly/entry.ts ← 入口运行时装配                         │   │
│  │  src/graph/assembly/runtime.ts ← 核心运行时装配                       │   │
│  │  src/graph/host/*            ← 场景、恢复、mutation、视图宿主         │   │
│  │  src/node/*                  ← 节点宿主与 shell                      │   │
│  │  src/link/*                  ← 连线宿主与动画                        │   │
│  │  src/api/*                   ← 图 API 宿主层                         │   │
│  │  src/interaction/*           ← 交互与手势                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                ↓                    ↓                    ↓
┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│  packages/core/*   │  │ packages/extensions│  │   leafer-ui        │
│  模型·执行·契约    │  │  菜单·快捷键·历史  │  │   渲染引擎         │
└────────────────────┘  └────────────────────┘  └────────────────────┘
```

---

## 2. 完整文件调用图（自顶向下）

以下从 mini-graph 入口开始，逐层追踪每个文件的调用关系与职责。

### 2.1 页面入口层

```
index.html
│
└─→ src/main.tsx
│   作用：Preact 应用挂载入口，把 App 组件渲染到 DOM #app 容器
│   调用：render(<App />, ...)
│
└─→ src/app.tsx
    作用：demo 页面壳层组件，组织 UI 布局（顶部工具栏、画布容器、浮层）
    职责：
    - 顶部按钮（Play / Stop / Reset / Undo / Redo / Register Bundle）
    - 动画预设选择器
    - Leafer 调试开关
    - 画布容器（ref 挂载到 useExampleGraph）
    - 运行日志浮层
    - Canvas Notes 浮层
    不直接操作图实例，所有数据和动作来自 useExampleGraph() hook
    调用：
    └─→ src/graph/use_example_graph.ts  ← 核心 hook
```

### 2.2 核心 Hook 层

```
src/graph/use_example_graph.ts
│  作用：图生命周期 hook，收口所有图运行时交互
│  职责：
│  - 创建 LeaferGraph 实例（调用 leafergraph 主包）
│  - 安装 basic-kit 插件
│  - 绑定快捷键（bindLeaferGraphShortcuts）
│  - 绑定历史栈（bindLeaferGraphUndoRedo）
│  - 创建右键菜单（createExampleContextMenu）
│  - 管理剪贴板、节点增删、连线跟踪
│  - 管理 authoring bundle 动态注册
│  - 维护运行日志、执行链说明
│  - 投影状态给页面层
│
├─→ leafergraph  [packages/leafergraph/src/public/leafer_graph.ts]
│   createLeaferGraph() / LeaferGraph 类
│
├─→ @leafergraph/core/basic-kit  [packages/core/basic-kit/src/index.ts]
│   leaferGraphBasicKitPlugin  ← 一键安装默认 widgets + 系统节点
│
├─→ @leafergraph/extensions/context-menu-builtins
│   createLeaferGraphContextMenuClipboardStore() ← 剪贴板状态
│
├─→ @leafergraph/extensions/undo-redo/graph  [packages/extensions/undo-redo/src/graph/index.ts]
│   bindLeaferGraphUndoRedo() ← 历史栈绑定
│
├─→ @leafergraph/extensions/shortcuts/graph  [packages/extensions/shortcuts/src/graph/index.ts]
│   bindLeaferGraphShortcuts() ← 快捷键绑定
│
├─→ @leafergraph/core/node  [packages/core/node/src/index.ts]
│   类型：GraphLink, NodeRuntimeState, NodeSerializeResult
│
├─→ @leafergraph/core/contracts  [packages/core/contracts/src/index.ts]
│   类型：LeaferGraphCreateLinkInput, LeaferGraphCreateNodeInput, RuntimeFeedbackEvent
│   工具：createCreateNodeInputFromNodeSnapshot()
│
├─→ @leafergraph/core/theme  [packages/core/theme/src/index.ts]
│   类型：LeaferGraphLinkPropagationAnimationPreset, LeaferGraphThemeMode
│
├─→ leafer-ui  [外部包]
│   Debug ← Leafer 全局调试开关
│
├─→ src/graph/example_authoring_bundle_loader.ts
│   loadAuthoringBundleRegistration()
│
├─→ src/graph/example_demo_plugin.ts
│   miniGraphExampleDemoPlugin ← 示例节点插件
│
├─→ src/graph/example_document.ts
│   createEmptyExampleDocument() ← 空文档工厂
│
└─→ src/graph/example_context_menu.ts
    createExampleContextMenu() ← 右键菜单
```

### 2.3 示例辅助模块层

```
src/graph/example_context_menu.ts
│  作用：右键菜单桥接模块，接线 builtins + demo 专属动作
│  职责：
│  - 注册内建菜单动作（复制、粘贴、删除、运行等）
│  - 追加 demo 专属动作（插入动画链、长任务链、Reset、Clear Log）
│  - 管理节点/连线菜单 target 绑定与解绑
│
├─→ @leafergraph/extensions/context-menu  [packages/extensions/context-menu/src/index.ts]
│   createLeaferContextMenu() ← 菜单 runtime
│   类型：LeaferContextMenu, LeaferContextMenuContext, LeaferContextMenuItem
│
├─→ @leafergraph/extensions/context-menu-builtins  [packages/extensions/context-menu-builtins/src/index.ts]
│   registerLeaferGraphContextMenuBuiltins() ← 内建动作注册
│   类型：LeaferGraphContextMenuBuiltinsHost, LeaferGraphContextMenuClipboardState
│
├─→ @leafergraph/core/node
│   类型：GraphLink, NodeRuntimeState
│
├─→ @leafergraph/core/contracts
│   类型：LeaferGraphCreateLinkInput, LeaferGraphCreateNodeInput
│
├─→ @leafergraph/core/theme
│   类型：LeaferGraphThemeMode
│
├─→ leafergraph
│   类型：LeaferGraph
│
└─→ src/graph/example_demo_plugin.ts
    EXAMPLE_EVENT_RELAY_NODE_TYPE, EXAMPLE_LONG_TASK_PROBE_NODE_TYPE, ...
```

```
src/graph/example_demo_plugin.ts
│  作用：demo 专属示例节点插件，定义 Event Relay / Tick Monitor / Long Task Probe
│  职责：
│  - 定义 3 个示例节点的 inputs/outputs/properties/onExecute
│  - 导出 miniGraphExampleDemoPlugin 插件对象
│
├─→ @leafergraph/core/contracts
│   类型：LeaferGraphNodePlugin
│
└─→ @leafergraph/core/node
    类型：NodeDefinition
```

```
src/graph/example_document.ts
│  作用：空文档工厂，供初始化与 reset 共用
│  职责：
│  - 创建最小 GraphDocument 结构（documentId, revision, nodes=[], links=[]）
│
└─→ @leafergraph/core/node
    类型：GraphDocument
```

```
src/graph/example_authoring_bundle_loader.ts
│  作用：authoring bundle 文件加载器，读取用户选择的编译后 JS 文件
│  职责：
│  - 读取文件文本
│  - 剥离 sourcemap 注释
│  - 重写 bare import 为宿主可用的运行时依赖 shim URL
│  - 动态 import 解析后的 bundle
│  - 从导出中识别 plugin 或 module 并返回注册结果
│
├─→ @leafergraph/core/node
│   类型：NodeModule
│
├─→ @leafergraph/core/contracts
│   类型：LeaferGraphNodePlugin
│
├─→ leafergraph
│   类型：LeaferGraph
│
└─→ src/graph/example_authoring_runtime_dependencies.ts
    运行时依赖映射与 shim 构建
```

```
src/graph/example_authoring_runtime_dependencies.ts
│  作用：authoring bundle 运行时依赖桥接，把核心包暴露给动态加载的 bundle
│  职责：
│  - 静态映射：contracts, execution, node, widget-runtime, leafer-ui, leafergraph
│  - 懒加载映射：@leafergraph/extensions/authoring
│  - 按 specifier 返回对应包的 namespace
│
├─→ @leafergraph/core/contracts  [整包导入]
├─→ @leafergraph/core/execution  [整包导入]
├─→ @leafergraph/core/node       [整包导入]
├─→ @leafergraph/core/widget-runtime  [整包导入]
├─→ leafer-ui                     [整包导入]
├─→ leafergraph                   [createLeaferGraph, LeaferGraph]
└─→ @leafergraph/extensions/authoring  [懒加载]
```

---

## 3. packages/ 核心文件调用图

### 3.1 主包 `packages/leafergraph`

```
packages/leafergraph/src/index.ts
│  作用：主包根入口，只导出 LeaferGraph + createLeaferGraph
│
└─→ src/public/leafer_graph.ts
    作用：公共 façade 实现，承载 LeaferGraph 类与 createLeaferGraph() 工厂
    职责：
    - LeaferGraph 类：container, app, root, linkLayer, nodeLayer, ready
    - createLeaferGraph()：创建图宿主并异步完成模块与插件安装
    - 委托到内部运行时宿主（apiHost）
    │
    ├─→ src/graph/assembly/entry.ts
    │   作用：入口运行时创建，准备默认图状态容器、宿主装配参数、ready 链
    │   │
    │   ├─→ @leafergraph/core/config  ← normalizeLeaferGraphConfig()
    │   ├─→ @leafergraph/core/widget-runtime  ← createMissingWidgetRenderer()
    │   ├─→ @leafergraph/core/theme  ← resolveThemePreset()
    │   └─→ src/graph/assembly/runtime.ts  ← createLeaferGraphRuntimeAssembly()
    │
    ├─→ src/public/facade/install.ts  ← installLeaferGraphFacade()
    │   作用：安装各 facade 子模块（document, execution, query, mutations, ...）
    │
    ├─→ src/graph/host/bootstrap.ts   ← 图启动与初始化
    ├─→ src/graph/host/restore.ts     ← GraphDocument 恢复
    ├─→ src/graph/host/mutation.ts    ← 节点/连线增删改
    ├─→ src/graph/host/scene.ts       ← Leafer 场景同步
    ├─→ src/graph/host/view.ts        ← 视图适配（fitView 等）
    ├─→ src/graph/host/canvas.ts      ← 画布配置
    │
    ├─→ src/node/node_host.ts         ← 节点 view 生命周期宿主
    ├─→ src/node/runtime/*            ← 节点运行时、执行、快照、状态
    ├─→ src/node/shell/*              ← 节点壳、布局、端口、slot 样式
    │
    ├─→ src/link/link.ts              ← 连线模型
    ├─→ src/link/link_host.ts         ← 连线 view 生命周期宿主
    ├─→ src/link/curve.ts             ← 共享曲线解析
    ├─→ src/link/animation/*          ← 数据流动画
    │
    ├─→ src/interaction/host/*        ← DOM/gesture 宿主
    ├─→ src/interaction/runtime/*     ← 交互运行时
    │
    ├─→ src/api/graph_api_host.ts     ← 公共 API 宿主接口
    │
    ├─→ src/graph/feedback/*          ← 执行反馈投影
    │   │
    │   └─→ @leafergraph/core/execution  ← LeaferGraphLocalExecutionFeedbackAdapter
    │
    ├─→ src/graph/theme/*             ← 主题运行时应用
    ├─→ src/graph/history.ts          ← history feed 发出
    └─→ src/graph/style.ts            ← 节点壳/连线样式计算
```

### 3.2 模型真源 `packages/core/node`

```
packages/core/node/src/index.ts
│  作用：节点定义、模块、图文档、注册表、序列化的统一公共入口
│
├─→ src/types.ts          ← 基础类型模型（Slot, Property, Widget, Layout, RuntimeState）
├─→ src/definition.ts     ← NodeDefinition, NodeModule, WidgetDefinition, NodeShellConfig
├─→ src/registry.ts       ← NodeRegistry（节点定义注册表）
├─→ src/widget.ts         ← Widget 校验、归一化与序列化
├─→ src/factory.ts        ← createNodeState()（节点实例工厂）
├─→ src/configure.ts      ← configureNode()（节点重配置入口）
├─→ src/serialize.ts      ← serializeNode()（节点序列化入口）
├─→ src/module.ts         ← installNodeModule(), resolveNodeModuleScope()
├─→ src/lifecycle.ts      ← NodeApi, NodeLifecycle
├─→ src/graph.ts          ← GraphDocument, GraphLink, GraphLinkEndpoint
└─→ src/api.ts            ← createNodeApi()（节点运行时 API 工厂）
```

### 3.3 执行内核 `packages/core/execution`

```
packages/core/execution/src/index.ts
│  作用：纯执行内核——节点如何执行、数据如何传播、图级运行如何推进
│
├─→ src/types.ts          ← 执行状态、反馈事件、传播元数据类型
├─→ src/builtin/on_play_node.ts  ← system/on-play 节点定义
├─→ src/builtin/timer_node.ts    ← system/timer 节点定义
├─→ src/node/node_execution_host.ts  ← 节点级执行宿主
├─→ src/graph/graph_execution_host.ts  ← 图级执行状态机
└─→ src/feedback/local_execution_feedback_adapter.ts  ← 本地反馈适配器
```

### 3.4 共享契约 `packages/core/contracts`

```
packages/core/contracts/src/index.ts
│  作用：跨包共享协议——插件协议、图 API 输入输出、Widget 契约、运行反馈
│
├─→ src/plugin.ts         ← LeaferGraphNodePlugin, LeaferGraphOptions
├─→ src/graph_api_types.ts  ← LeaferGraphCreateNodeInput, LeaferGraphCreateLinkInput, ...
├─→ src/graph_document_diff.ts  ← GraphDocumentDiff, applyGraphDocumentDiffToDocument()
│                              createCreateNodeInputFromNodeSnapshot()
└─→ @leafergraph/core/config  ← 转出配置类型（re-export）
```

### 3.5 视觉主题 `packages/core/theme`

```
packages/core/theme/src/index.ts
│  作用：视觉主题真源——themePreset, themeMode, graph/widget/context-menu token
│
├─→ src/types.ts          ← LeaferGraphThemeMode, LeaferGraphThemePresetId, AnimationPreset
├─→ src/graph.ts          ← GraphThemeTokens, NodeShellStyle, DataFlowAnimationStyle
├─→ src/widget.ts         ← WidgetThemeTokens, WidgetThemeContext
├─→ src/context-menu.ts   ← ContextMenuThemeTokens
└─→ src/registry.ts       ← 主题 preset 注册表
```

### 3.6 行为配置 `packages/core/config`

```
packages/core/config/src/index.ts
│  作用：非视觉配置真源——稳定配置结构、默认值、normalize helper
│
├─→ src/types.ts          ← LeaferGraphConfig, NormalizedLeaferGraphConfig
├─→ src/graph.ts          ← graph.view, graph.runtime, graph.history 配置
├─→ src/widget.ts         ← widget.editing 配置
├─→ src/context-menu.ts   ← context-menu.submenu 配置
├─→ src/leafer.ts         ← Leafer 原生配置桥接
└─→ src/default_config.ts ← normalizeLeaferGraphConfig(), resolveDefaultLeaferGraphConfig()
```

### 3.7 Widget Runtime `packages/core/widget-runtime`

```
packages/core/widget-runtime/src/index.ts
│  作用：Widget runtime 真源——registry, renderer 生命周期, 编辑宿主, 交互 helper
│
├─→ src/widget_registry.ts     ← LeaferGraphWidgetRegistry
├─→ src/widget_host.ts         ← LeaferGraphWidgetHost, createMissingWidgetRenderer()
├─→ src/widget_lifecycle.ts    ← createWidgetLifecycleRenderer(), createWidgetLabel(), ...
├─→ src/widget_editing.ts      ← LeaferGraphWidgetEditingManager
└─→ src/widget_interaction.ts  ← bindLinearWidgetDrag(), bindPressWidgetInteraction()
```

### 3.8 默认内容包 `packages/core/basic-kit`

```
packages/core/basic-kit/src/index.ts
│  作用：默认内容包——把 widgets + 系统节点打包成一条 plugin
│
├─→ src/widget/index.ts  ← BasicWidgetLibrary
│   作用：基础 Widget 库（11 种内建 Widget）
│   ├─→ src/widget/button_widget.ts    ← ButtonFieldController
│   ├─→ src/widget/checkbox_widget.ts  ← CheckboxFieldController
│   ├─→ src/widget/radio_widget.ts     ← RadioFieldController
│   ├─→ src/widget/readonly_widget.ts  ← ReadonlyFieldController
│   ├─→ src/widget/select_widget.ts    ← SelectFieldController
│   ├─→ src/widget/slider_widget.ts    ← SliderFieldController
│   ├─→ src/widget/text_widget.ts      ← TextFieldController
│   ├─→ src/widget/toggle_widget.ts    ← ToggleFieldController
│   │
│   └─→ @leafergraph/core/widget-runtime  ← createWidgetLifecycleRenderer()
│
└─→ src/node/index.ts  ← createBasicSystemNodeModule()
    作用：系统节点模块工厂
    └─→ @leafergraph/core/execution  ← on-play, timer 节点定义
```

### 3.9 菜单 Runtime `packages/extensions/context-menu`

```
packages/extensions/context-menu/src/index.ts
│  作用：纯 Leafer-first 右键菜单 runtime
│
├─→ src/leafer_context_menu.ts  ← createLeaferContextMenu()
│   职责：
│   - 目标绑定（canvas / node / link / custom）
│   - resolver 链（动态生成菜单项）
│   - DOM overlay 渲染
│   - 子菜单、checkbox、radio、group 支持
│
├─→ @leafergraph/core/config  ← 菜单行为配置
└─→ @leafergraph/core/theme   ← 菜单视觉 token
```

### 3.10 菜单内建动作 `packages/extensions/context-menu-builtins`

```
packages/extensions/context-menu-builtins/src/index.ts
│  作用：节点图菜单内建动作集成层
│
├─→ src/registry.ts  ← registerLeaferGraphContextMenuBuiltins()
│   职责：注册 13 个内建特性（undo, redo, selectAll, addNode, paste, delete, ...）
│   │
│   ├─→ src/features/canvas_undo_feature.ts
│   ├─→ src/features/canvas_redo_feature.ts
│   ├─→ src/features/canvas_select_all_feature.ts
│   ├─→ src/features/canvas_controls_feature.ts
│   ├─→ src/features/canvas_add_node_feature.ts
│   ├─→ src/features/canvas_paste_feature.ts
│   ├─→ src/features/canvas_delete_selection_feature.ts
│   ├─→ src/features/node_run_from_here_feature.ts
│   ├─→ src/features/node_copy_feature.ts
│   ├─→ src/features/node_cut_feature.ts
│   ├─→ src/features/node_duplicate_feature.ts
│   ├─→ src/features/node_delete_feature.ts
│   └─→ src/features/link_delete_feature.ts
│
├─→ src/clipboard_store.ts  ← createLeaferGraphContextMenuClipboardStore()
│   作用：剪贴板状态管理（fragment 级别）
│
├─→ src/types.ts  ← 宿主接口类型
│   LeaferGraphContextMenuBuiltinsHost：graph API 适配接口
│   LeaferGraphContextMenuClipboardState：剪贴板接口
│   LeaferGraphContextMenuBuiltinHistoryHost：历史栈接口
│
└─→ @leafergraph/extensions/context-menu  ← 菜单 runtime 类型
```

### 3.11 快捷键扩展 `packages/extensions/shortcuts`

```
packages/extensions/shortcuts/src/index.ts
│  作用：宿主输入扩展——功能注册表 + 按键注册表 + 控制器
│
├─→ src/core/chord.ts           ← normalizeShortcutChord(), matchShortcutEvent()
├─→ src/core/function_registry.ts  ← createShortcutFunctionRegistry()
├─→ src/core/keymap_registry.ts    ← createShortcutKeymapRegistry()
├─→ src/core/controller.ts         ← createShortcutController()
├─→ src/core/types.ts              ← 类型定义
│
└─→ src/graph/index.ts  ← graph 预设入口
    │
    ├─→ src/graph/bind.ts      ← bindLeaferGraphShortcuts()
    │   作用：绑定默认 graph 快捷键（编辑、历史、视图、执行）
    │
    ├─→ src/graph/functions.ts ← registerLeaferGraphShortcutFunctions()
    │   作用：注册默认功能定义（copy, cut, paste, delete, fitView, play, ...）
    │
    ├─→ src/graph/keymap.ts    ← registerLeaferGraphShortcutKeymap()
    │   作用：注册默认按键映射（Mod+C → copy, Mod+Z → undo, ...）
    │
    └─→ src/graph/types.ts     ← LeaferGraphShortcutHost, LeaferGraphShortcutHistoryHost
```

### 3.12 历史栈扩展 `packages/extensions/undo-redo`

```
packages/extensions/undo-redo/src/index.ts
│  作用：宿主状态扩展——undo/redo controller 与历史栈裁剪
│
├─→ src/core/controller.ts  ← createUndoRedoController()
├─→ src/core/types.ts       ← UndoRedoController, UndoRedoControllerState, UndoRedoEntry
│
└─→ src/graph/index.ts  ← graph 绑定入口
    │
    ├─→ src/graph/bind.ts   ← bindLeaferGraphUndoRedo()
    │   作用：绑定 graph history feed，建立 undo/redo controller
    │
    └─→ src/graph/types.ts  ← LeaferGraphUndoRedoHost, BoundLeaferGraphUndoRedo
```

### 3.13 作者层 SDK `packages/extensions/authoring`

```
packages/extensions/authoring/src/index.ts
│  作用：作者层 SDK——类式节点/Widget 开发体验
│
├─→ src/node_authoring.ts  ← BaseNode, defineAuthoringNode(), createAuthoringModule/Plugin()
│   作用：节点基类与定义收口入口
│
├─→ src/widget_authoring.ts  ← BaseWidget, defineAuthoringWidget()
│   作用：Widget 基类与定义收口入口
│
└─→ src/shared.ts  ← NodeProps, NodeInputs, NodeOutputs, NodeState, WidgetState
```

---

## 4. 依赖关系总览图

```
                          ┌──────────────────────┐
                          │   example/mini-graph  │
                          └──────────┬───────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐
│    leafergraph    │    │ @core/basic-kit  │    │ @extensions/authoring│
│  (主包 façade)   │    │  (默认内容)      │    │   (作者层 SDK)       │
└────────┬─────────┘    └────────┬─────────┘    └──────────────────────┘
         │                       │
         ▼                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        packages/core/*                                 │
│  ┌──────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐ ┌──────────┐ │
│  │   node   │ │  contracts │ │  execution │ │ config │ │  theme   │ │
│  │ (模型)   │ │ (契约)     │ │ (执行)     │ │(配置)  │ │ (主题)   │ │
│  └──────────┘ └────────────┘ └────────────┘ └────────┘ └──────────┘ │
│  ┌──────────────────┐                                                │
│  │ widget-runtime   │                                                │
│  │ (Widget runtime) │                                                │
│  └──────────────────┘                                                │
└────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      packages/extensions/*                             │
│  ┌──────────────┐ ┌────────────────────┐ ┌──────────┐ ┌───────────┐ │
│  │ context-menu │ │context-menu-builtins│ │ shortcuts│ │ undo-redo │ │
│  │ (菜单runtime)│ │   (内建动作)       │ │ (快捷键) │ │ (历史栈)  │ │
│  └──────────────┘ └────────────────────┘ └──────────┘ └───────────┘ │
└────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│    leafer-ui     │
│  (渲染引擎)      │
└──────────────────┘
```

---

## 5. 关键调用链路

### 5.1 初始化链路

```
main.tsx → app.tsx → useExampleGraph()
  │
  ├─→ createLeaferGraph(stageHost, { document, plugins, themeMode, config })
  │   └─→ [leafergraph] src/graph/assembly/entry.ts
  │       ├─→ normalizeLeaferGraphConfig()    ← @core/config
  │       ├─→ resolveThemePreset()            ← @core/theme
  │       ├─→ createMissingWidgetRenderer()   ← @core/widget-runtime
  │       └─→ createLeaferGraphRuntimeAssembly()
  │           ├─→ Leafer App 创建
  │           ├─→ NodeRegistry 初始化
  │           ├─→ LeaferGraphNodeExecutionHost 创建   ← @core/execution
  │           ├─→ LeaferGraphGraphExecutionHost 创建   ← @core/execution
  │           ├─→ LeaferGraphWidgetRegistry 创建       ← @core/widget-runtime
  │           ├─→ 场景层次建立（root, nodeLayer, linkLayer）
  │           └─→ plugin 安装链
  │
  ├─→ leaferGraphBasicKitPlugin.install()
  │   ├─→ BasicWidgetLibrary().createEntries()  ← 11 种 Widget
  │   └─→ createBasicSystemNodeModule()         ← system/on-play, system/timer
  │
  ├─→ miniGraphExampleDemoPlugin.install()
  │   └─→ 注册 Event Relay, Tick Monitor, Long Task Probe
  │
  ├─→ bindLeaferGraphShortcuts()    ← @extensions/shortcuts/graph
  ├─→ bindLeaferGraphUndoRedo()     ← @extensions/undo-redo/graph
  └─→ createExampleContextMenu()    ← @extensions/context-menu + builtins
```

### 5.2 右键菜单插入节点链路

```
用户右键画布 → "插入动画示例链"
  │
  ├─→ createExampleMenuItems() [example_context_menu.ts]
  │   └─→ insertAnimationDemoChain()
  │       ├─→ createNode({ type: "system/on-play" })     ← contracts → node
  │       ├─→ createNode({ type: "system/timer" })       ← contracts → node
  │       ├─→ createNode({ type: "example/event-relay" }) ← demo_plugin
  │       ├─→ createNode({ type: "example/tick-monitor" })← demo_plugin
  │       ├─→ createLink(source → target) × 3            ← contracts → node
  │       └─→ fitView()                                  ← leafergraph
  │
  └─→ [leafergraph 内部]
      ├─→ GraphDocument mutation
      ├─→ 节点 view 创建（shell + ports + widgets）
      ├─→ 连线 view 创建（curve + animation）
      └─→ Leafer scene 同步刷新
```

### 5.3 Authoring Bundle 加载链路

```
用户选择 JS 文件 → registerAuthoringBundle(file)
  │
  ├─→ loadAuthoringBundleRegistration(file) [example_authoring_bundle_loader.ts]
  │   ├─→ file.text() → 剥离 sourcemap
  │   ├─→ rewriteRuntimeDependencies()
  │   │   └─→ ensureRuntimeDependencyShim(specifier)
  │   │       └─→ loadExampleAuthoringRuntimeDependency(specifier)
  │   │           [example_authoring_runtime_dependencies.ts]
  │   │           ├─→ @leafergraph/core/contracts
  │   │           ├─→ @leafergraph/core/execution
  │   │           ├─→ @leafergraph/core/node
  │   │           ├─→ @leafergraph/core/widget-runtime
  │   │           ├─→ leafer-ui
  │   │           ├─→ leafergraph
  │   │           └─→ @leafergraph/extensions/authoring (懒加载)
  │   │
  │   ├─→ URL.createObjectURL(Blob) → 动态 import
  │   └─→ resolveBundleRegistration()
  │       ├─→ isPluginLike() → graph.use(plugin)
  │       └─→ isNodeModuleLike() → graph.installModule(module)
  │
  └─→ [leafergraph 内部]
      ├─→ NodeRegistry 注册新节点定义
      └─→ 节点可进入右键菜单和运行链
```

### 5.4 执行链路

```
用户点击 Play → graph.play()
  │
  ├─→ [leafergraph] src/graph/assembly/runtime.ts
  │   └─→ LeaferGraphGraphExecutionHost.play()
  │       ├─→ 查找 on-play 入口节点
  │       ├─→ 按拓扑序执行节点
  │       │   └─→ LeaferGraphNodeExecutionHost.executeNode()
  │       │       ├─→ nodeDefinition.onExecute(context, api)
  │       │       └─→ 传播输出到下游连线
  │       ├─→ 连线数据流动画
  │       │   └─→ src/link/animation/controller.ts
  │       └─→ 运行反馈事件
  │           └─→ LeaferGraphLocalExecutionFeedbackAdapter
  │               └─→ RuntimeFeedbackEvent → subscribeRuntimeFeedback()
  │
  └─→ useExampleGraph() 收到反馈
      └─→ formatRuntimeFeedback() → appendLog() → 更新 logs state
```

---

## 6. 包职责速查表

| 包 | 职责 | mini-graph 中的用途 |
|---|---|---|
| `leafergraph` | 图运行时主包，提供 LeaferGraph 类和 createLeaferGraph() | 创建图实例、节点/连线增删、执行控制 |
| `@leafergraph/core/node` | 模型真源：节点定义、图文档、注册表、序列化 | GraphDocument、GraphLink、NodeRuntimeState 类型 |
| `@leafergraph/core/execution` | 执行内核：节点执行、数据传播、图级状态机 | system/on-play、system/timer 节点定义 |
| `@leafergraph/core/contracts` | 跨包共享协议：插件协议、图 API 输入输出、运行反馈 | CreateNodeInput、CreateLinkInput、RuntimeFeedbackEvent |
| `@leafergraph/core/theme` | 视觉主题真源：themePreset、themeMode、token | 动画预设、主题模式切换 |
| `@leafergraph/core/config` | 非视觉配置真源：配置结构、默认值、normalize | graph.history、graph.runtime 配置 |
| `@leafergraph/core/widget-runtime` | Widget runtime：registry、renderer、编辑、交互 | Widget 渲染与交互基础设施 |
| `@leafergraph/core/basic-kit` | 默认内容包：11 种 Widget + 2 个系统节点 | leaferGraphBasicKitPlugin 一键安装 |
| `@leafergraph/extensions/context-menu` | 菜单 runtime：目标绑定、resolver 链、DOM overlay | createLeaferContextMenu() |
| `@leafergraph/extensions/context-menu-builtins` | 菜单内建动作：复制、粘贴、删除、运行等 13 个特性 | registerLeaferGraphContextMenuBuiltins() |
| `@leafergraph/extensions/shortcuts` | 快捷键扩展：功能注册表 + 按键注册表 | bindLeaferGraphShortcuts() |
| `@leafergraph/extensions/undo-redo` | 历史栈扩展：undo/redo controller | bindLeaferGraphUndoRedo() |
| `@leafergraph/extensions/authoring` | 作者层 SDK：BaseNode、BaseWidget | 动态 bundle 加载时的依赖 |

---

## 7. 文件索引（按字母序）

### example/mini-graph/

| 文件 | 作用 |
|---|---|
| `index.html` | 页面入口 HTML |
| `src/main.tsx` | Preact 应用挂载 |
| `src/app.tsx` | 页面壳层组件（工具栏 + 画布 + 浮层） |
| `src/app.css` | 页面样式 |
| `src/index.css` | 全局重置样式 |
| `src/graph/use_example_graph.ts` | **核心 hook**：图生命周期、状态、历史栈、快捷键、日志 |
| `src/graph/example_context_menu.ts` | 右键菜单桥接（builtins + demo 动作） |
| `src/graph/example_demo_plugin.ts` | 示例节点插件（Event Relay / Tick Monitor / Long Task Probe） |
| `src/graph/example_document.ts` | 空文档工厂 |
| `src/graph/example_authoring_bundle_loader.ts` | Authoring bundle 文件加载器 |
| `src/graph/example_authoring_runtime_dependencies.ts` | Bundle 运行时依赖桥接 |
| `package.json` | 包配置与依赖声明 |
| `vite.config.ts` | Vite 构建配置 |
| `tsconfig.json` | TypeScript 配置 |

### packages/leafergraph/

| 文件 | 作用 |
|---|---|
| `src/index.ts` | 主包根入口（导出 LeaferGraph + createLeaferGraph） |
| `src/public/leafer_graph.ts` | LeaferGraph 类 + createLeaferGraph() 工厂 |
| `src/public/facade/install.ts` | 各 facade 子模块安装 |
| `src/graph/assembly/entry.ts` | 入口运行时创建（状态容器、主题、ready 链） |
| `src/graph/assembly/runtime.ts` | 核心运行时装配（App、Registry、ExecutionHost） |
| `src/graph/host/bootstrap.ts` | 图启动与初始化 |
| `src/graph/host/restore.ts` | GraphDocument 恢复 |
| `src/graph/host/mutation.ts` | 节点/连线增删改 |
| `src/graph/host/scene.ts` | Leafer 场景同步 |
| `src/graph/host/view.ts` | 视图适配（fitView） |
| `src/graph/feedback/projection.ts` | 执行反馈投影 |
| `src/graph/feedback/local_runtime_adapter.ts` | 本地运行反馈适配器 |
| `src/node/node_host.ts` | 节点 view 生命周期宿主 |
| `src/node/runtime/*` | 节点运行时、执行、快照、状态 |
| `src/node/shell/*` | 节点壳、布局、端口、slot 样式 |
| `src/link/link.ts` | 连线模型 |
| `src/link/link_host.ts` | 连线 view 生命周期宿主 |
| `src/link/curve.ts` | 共享曲线解析 |
| `src/link/animation/*` | 数据流动画（controller, effects, frame_loop） |
| `src/interaction/host/*` | DOM/gesture 宿主 |
| `src/interaction/runtime/*` | 交互运行时 |
| `src/api/graph_api_host.ts` | 公共 API 宿主接口 |

### packages/core/

| 包 | 关键文件 | 作用 |
|---|---|---|
| `node` | `src/index.ts` | 模型真源入口 |
| | `src/types.ts` | Slot, Property, Widget, Layout, RuntimeState 类型 |
| | `src/definition.ts` | NodeDefinition, NodeModule, WidgetDefinition |
| | `src/registry.ts` | NodeRegistry |
| | `src/graph.ts` | GraphDocument, GraphLink |
| | `src/factory.ts` | createNodeState() |
| | `src/serialize.ts` | serializeNode() |
| | `src/module.ts` | installNodeModule() |
| `execution` | `src/index.ts` | 执行内核入口 |
| | `src/types.ts` | 执行状态、反馈事件类型 |
| | `src/builtin/on_play_node.ts` | system/on-play 定义 |
| | `src/builtin/timer_node.ts` | system/timer 定义 |
| | `src/node/node_execution_host.ts` | 节点级执行宿主 |
| | `src/graph/graph_execution_host.ts` | 图级执行状态机 |
| `contracts` | `src/index.ts` | 契约层入口 |
| | `src/plugin.ts` | 插件协议、图选项 |
| | `src/graph_api_types.ts` | 图 API 输入输出类型 |
| | `src/graph_document_diff.ts` | 文档 diff 与 helper |
| `theme` | `src/index.ts` | 主题真源入口 |
| | `src/graph.ts` | graph token（节点壳、连线、动画） |
| | `src/widget.ts` | widget token |
| | `src/registry.ts` | 主题 preset 注册表 |
| `config` | `src/index.ts` | 配置真源入口 |
| | `src/graph.ts` | graph.view / runtime / history 配置 |
| | `src/widget.ts` | widget.editing 配置 |
| | `src/default_config.ts` | normalize + default helper |
| `widget-runtime` | `src/index.ts` | Widget runtime 入口 |
| | `src/widget_registry.ts` | Widget 注册表 |
| | `src/widget_host.ts` | Widget 宿主 |
| | `src/widget_lifecycle.ts` | 生命周期渲染器 |
| `basic-kit` | `src/index.ts` | 默认内容包入口 |
| | `src/widget/index.ts` | BasicWidgetLibrary（11 种 Widget） |
| | `src/node/index.ts` | createBasicSystemNodeModule() |

### packages/extensions/

| 包 | 关键文件 | 作用 |
|---|---|---|
| `context-menu` | `src/index.ts` | 菜单 runtime 入口 |
| | `src/leafer_context_menu.ts` | createLeaferContextMenu() 实现 |
| `context-menu-builtins` | `src/index.ts` | 内建动作入口 |
| | `src/registry.ts` | registerLeaferGraphContextMenuBuiltins() |
| | `src/clipboard_store.ts` | 剪贴板状态管理 |
| | `src/features/*.ts` | 13 个内建特性实现 |
| `shortcuts` | `src/index.ts` | 快捷键入口 |
| | `src/core/controller.ts` | 快捷键控制器 |
| | `src/graph/bind.ts` | bindLeaferGraphShortcuts() |
| | `src/graph/functions.ts` | 默认功能注册 |
| | `src/graph/keymap.ts` | 默认按键映射 |
| `undo-redo` | `src/index.ts` | 历史栈入口 |
| | `src/core/controller.ts` | undo/redo 控制器 |
| | `src/graph/bind.ts` | bindLeaferGraphUndoRedo() |
| `authoring` | `src/index.ts` | 作者层 SDK 入口 |
| | `src/node_authoring.ts` | BaseNode, defineAuthoringNode() |
| | `src/widget_authoring.ts` | BaseWidget, defineAuthoringWidget() |

---

## 8. 分层架构原则

```
┌─────────────────────────────────────────────────────────┐
│  消费样例层  │  example/mini-graph, templates/*          │
├─────────────────────────────────────────────────────────┤
│  宿主扩展层  │  context-menu, builtins, shortcuts,       │
│              │  undo-redo                                │
├─────────────────────────────────────────────────────────┤
│  作者层      │  authoring (BaseNode, BaseWidget)         │
├─────────────────────────────────────────────────────────┤
│  主包兼容层  │  leafergraph (LeaferGraph façade)         │
├─────────────────────────────────────────────────────────┤
│  core runtime│  config, theme, widget-runtime, basic-kit│
├─────────────────────────────────────────────────────────┤
│  core        │  node, execution, contracts               │
│  foundation  │                                           │
├─────────────────────────────────────────────────────────┤
│  渲染引擎    │  leafer-ui                                │
└─────────────────────────────────────────────────────────┘
```

**核心约束**：
- 依赖方向只能向下，不能反向
- `core/foundation` 不依赖任何上层包
- `core/runtime` 可以依赖 `core/foundation`
- `主包` 可以依赖所有 `core/*`
- `extensions` 可以依赖 `core/*`，但不能依赖主包
- `消费样例层` 可以依赖所有层
