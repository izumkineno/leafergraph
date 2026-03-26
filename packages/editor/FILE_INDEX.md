# `packages/editor` 文件指纹索引

## 索引范围说明

- 统计基线：当前工作树下 `packages/editor` 的非琐碎文件，共 `211` 个。
- 纳入范围：
  - 源码、HTML 入口、配置、README、测试、fixtures、手工维护的 `public` 资产、`__testbundles/*.iife.js`
- 排除范围：
  - `dist/`
  - `node_modules/`
  - `*.map`
  - 纯生成物
- 说明约定：
  - “核心函数/类”只写真正承担职责的 symbol；barrel 文件只写导出边界。
  - `src/ui` 区域普遍遵循 `Connected / View / types / styles / README / index` 模板，下表会按区域分别标注它们的实际职责。

## 顶层入口与配置

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `ARCHITECTURE.md` | editor 架构总览、生命周期、数据流、运行模式与技术选型说明。 | `Mermaid 架构图`、`运行模式对照` | `README.md`、`FILE_INDEX.md` |
| `FILE_INDEX.md` | editor 全量非琐碎文件索引。 | `分层索引表` | `ARCHITECTURE.md`、`README.md` |
| `README.md` | 包级入口说明、阅读顺序、目录文档地图与生成目录说明。 | `开发命令、文档导航、注释约定` | `packages/editor` 全体 |
| `authority-python-host-demo.html` | Python WebSocket authority demo 的独立 HTML 入口。 | `HTML host 页面` | `src/demo/python_websocket_host_demo_entry.ts` |
| `index.html` | 默认 editor 页面入口。 | `HTML host 页面` | `src/main.tsx` |
| `package.json` | 包元数据、exports、scripts 与依赖声明。 | `scripts`、`exports` | `Vite + Preact + leafergraph` |
| `tsconfig.json` | TypeScript 配置，声明 Preact JSX 与 `leafergraph` 源码 alias。 | `compilerOptions.paths`、`jsxImportSource` | `src/**/*.ts(x)` |
| `vite.config.ts` | Vite 多页面构建、GitHub Pages `base`、dev server 和源码 alias 配置。 | `editorHtmlEntries`、`defineConfig` | `index.html`、`authority-python-host-demo.html` |

## `public`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `public/__testbundles/demo-alt.iife.js` | 备用 demo bundle 样例，供 bundle loader/manifest 测试使用。 | `IIFE registerBundle` | `tests/public_testbundles_manifest.test.ts` |
| `public/__testbundles/authoring-demo.iife.js` | authoring 外部 demo bundle 样例，验证蓝图仍沿用 editor demo manifest。 | `IIFE registerBundle` | `tests/public_testbundles_manifest.test.ts`、`tests/e2e/preview/bundles_and_canvas.e2e.ts` |
| `public/__testbundles/authoring-node.iife.js` | authoring 外部 node bundle 样例，验证节点作者类可通过 script bundle 接入 editor。 | `IIFE registerBundle` | `tests/public_testbundles_manifest.test.ts`、`tests/e2e/preview/bundles_and_canvas.e2e.ts` |
| `public/__testbundles/authoring-widget.iife.js` | authoring 外部 widget bundle 样例，验证组件作者类可通过 script bundle 接入 editor。 | `IIFE registerBundle` | `tests/public_testbundles_manifest.test.ts`、`tests/e2e/preview/bundles_and_canvas.e2e.ts` |
| `public/__testbundles/demo.iife.js` | 默认 demo bundle 样例，提供 graph document。 | `IIFE registerBundle` | `src/loader/runtime.ts` |
| `public/__testbundles/node.iife.js` | node bundle 样例，提供 node plugin。 | `IIFE registerBundle` | `src/loader/runtime.ts` |
| `public/__testbundles/widget.iife.js` | widget bundle 样例，提供 widget plugin。 | `IIFE registerBundle` | `src/loader/runtime.ts` |
| `public/favicon.svg` | editor 页面 favicon。 | `SVG 资源` | `index.html`、`authority-python-host-demo.html` |

## `src/app`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/app/README.md` | app 过渡层目录说明，串起 bootstrap、bundle projection 与过渡面板。 | `模块阅读地图` | `src/main.tsx`、`src/shell/provider.tsx` |
| `src/app/WorkspacePanels.tsx` | 当前承接节点库与检查器主面板实现的过渡文件。 | `NodeLibraryPane`、`InspectorPane` | `src/ui/node-library`、`src/ui/inspector` |
| `src/app/editor_app_bootstrap.ts` | 解析全局 bootstrap，归一化 authority source、preloaded bundles 与 host bridge 钩子。 | `resolveEditorAppBootstrap` | `src/main.tsx`、`src/backend/authority` |
| `src/app/remote_authority_bundle_projection.ts` | authority-first 场景下，将 demo bundle document 投影到远端 authority 的策略层。 | `resolveRemoteAuthorityBundleProjection`、`shouldApplyRemoteAuthorityBundleProjection` | `src/shell/provider.tsx`、`src/session` |
| `src/app/style.css` | 当前页面级主样式文件。 | `布局与面板样式` | `src/styles.css` |

## `src` 顶层入口

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/index.ts` | editor 根公共导出入口，暴露 `EditorProvider`、`EditorShell` 与 `createEditorController(...)`。 | `export { ... }` | `src/shell/provider.tsx`、`src/shell/editor_controller.ts` |
| `src/main.tsx` | 浏览器启动入口，安装 preview bootstrap、解析 bootstrap 并挂载 `EditorProvider + EditorShell`。 | `resolveEditorAppBootstrap`、`installPreviewRemoteAuthorityBootstrap` | `src/app/editor_app_bootstrap.ts`、`src/index.ts` |
| `src/styles.css` | editor 官方样式总入口，聚合 app 层主样式。 | `style aggregation` | `src/app/style.css` |

## `src/backend`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/backend/README.md` | backend 目录说明，聚焦 authority source/runtime 装配边界。 | `模块阅读地图` | `src/backend/authority`、`src/shell/provider.tsx` |
| `src/backend.ts` | backend/session/runtime 聚合导出入口。 | `export *` | `src/backend`、`src/session`、`src/runtime` |
| `src/backend/authority/README.md` | authority 子系统说明，串起 host adapter 与 app runtime 装配。 | `authority 阅读地图` | `src/app/editor_app_bootstrap.ts`、`src/session/*` |
| `src/backend/authority/remote_authority_app_runtime.ts` | 将 MessagePort/Worker/Window/service 等 authority source 装配成统一 app runtime。 | `createEditorRemoteAuthority*Source`、`createEditorRemoteAuthorityAppRuntime` | `src/session/*`、`src/shell/provider.tsx` |
| `src/backend/authority/remote_authority_host_adapter.ts` | authority host adapter 注册与 descriptor 解析层。 | `resolveEditorRemoteAuthorityHostAdapterSource` | `src/app/editor_app_bootstrap.ts` |
| `src/backend/index.ts` | backend 子目录 barrel。 | `export *` | `src/backend.ts` |

## `src/commands`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/commands/README.md` | commands 目录说明，聚焦命令入口、控制器和历史记录。 | `命令阅读地图` | `src/ui/viewport/View.tsx`、`src/session/graph_document_session.ts` |
| `src/commands/browser_clipboard_bridge.ts` | 浏览器系统剪贴板桥接。 | `readBrowserClipboardText`、`writeBrowserClipboardText` | `src/commands/clipboard_payload.ts` |
| `src/commands/canvas_commands.ts` | 画布级命令控制器，负责按落点和 nodeType 创建节点及 fit-view。 | `createEditorCanvasCommandController` | `src/commands/command_bus.ts`、`src/ui/viewport/View.tsx` |
| `src/commands/clipboard_payload.ts` | LeaferGraph 剪贴板 payload 的序列化与反序列化。 | `serializeLeaferGraphClipboardPayload`、`parseLeaferGraphClipboardPayload` | `src/commands/node_commands.ts` |
| `src/commands/command_bus.ts` | 统一命令总线，收口 toolbar、context menu、interaction commit 与 authority confirmation。 | `createEditorCommandBus` | `src/ui/viewport/View.tsx`、`src/commands/*` |
| `src/commands/command_history.ts` | 命令历史栈与 undo/redo 控制。 | `createEditorCommandHistory` | `src/commands/command_bus.ts` |
| `src/commands/graph_operation_utils.ts` | 将节点/连线快照转换为正式 `GraphOperation` 的工具层。 | `createNodeCreateOperationFromSnapshot`、`createLinkCreateOperation` | `src/commands/*`、`src/session/graph_document_session.ts` |
| `src/commands/link_commands.ts` | 连线创建、删除、重连命令控制器。 | `createEditorLinkCommandController` | `src/commands/command_bus.ts` |
| `src/commands/node_commands.ts` | 节点创建、删除、复制、剪切、粘贴、duplicate、reset-size 的主控制器。 | `createEditorNodeCommandController`、`copyNodesToClipboard` | `src/commands/command_bus.ts` |
| `src/commands/node_flag_utils.ts` | 节点 flag 与状态位工具层。 | `flag helper functions` | `src/commands/node_commands.ts`、`tests/node_flag_utils.test.ts` |

## `src/debug`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/debug/README.md` | debug 目录说明，聚焦 Leafer Debug 设置的持久化和投影。 | `debug 阅读地图` | `src/shell/provider.tsx`、`src/ui/viewport/View.tsx` |
| `src/debug/leafer_debug.ts` | Leafer 调试配置、localStorage 持久化与 debug 类型解析。 | `applyLeaferDebugSettings`、`resolveInitialEditorLeaferDebugSettings` | `src/shell/provider.tsx`、`src/ui/viewport/View.tsx` |

## `src/demo`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/demo/README.md` | demo 目录说明，覆盖 preview bootstrap、demo authority 与 WebSocket host demo。 | `demo 阅读地图` | `src/main.tsx`、`src/backend/authority` |
| `src/demo/preview_remote_authority_bootstrap.ts` | 默认页面预览模式下注入 authority/bootstrap 的入口。 | `installPreviewRemoteAuthorityBootstrap` | `src/main.tsx` |
| `src/demo/python_websocket_host_demo_bootstrap.ts` | Python WebSocket host demo 的 bootstrap 封装。 | `installPythonWebSocketHostDemoBootstrap` | `authority-python-host-demo.html` |
| `src/demo/python_websocket_host_demo_entry.ts` | Python host demo 页面脚本入口。 | `demo entry bootstrap` | `authority-python-host-demo.html` |
| `src/demo/remote_authority_demo_service.ts` | 浏览器内 demo authority service。 | `createRemoteAuthorityDemoService` | `src/demo/remote_authority_demo_worker.ts` |
| `src/demo/remote_authority_demo_source.ts` | demo worker authority source 封装。 | `createRemoteAuthorityDemoSource` | `src/backend/authority/remote_authority_host_adapter.ts` |
| `src/demo/remote_authority_demo_worker.ts` | 浏览器内 authority worker 主脚本。 | `worker message host` | `src/session/message_port_remote_authority_worker_host.ts` |
| `src/demo/websocket_host_demo_bootstrap.ts` | WebSocket host demo 的 authority bootstrap 与 URL 解析。 | `installWebSocketHostDemoBootstrap` | `src/demo/python_websocket_host_demo_bootstrap.ts` |

## `src/interaction`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/interaction/README.md` | interaction 目录说明，聚焦交互提交桥与 widget commit 更新。 | `interaction 阅读地图` | `src/ui/viewport/View.tsx`、`src/commands/command_bus.ts` |
| `src/interaction/graph_interaction_commit_bridge.ts` | 将画布交互提交为命令或正式 `GraphOperation` 的桥接层。 | `createGraphInteractionCommitBridge` | `src/ui/viewport/View.tsx`、`src/commands/command_bus.ts` |
| `src/interaction/widget_commit_update.ts` | widget 提交值时构造节点更新输入的辅助逻辑。 | `widget commit helpers` | `src/interaction/graph_interaction_commit_bridge.ts` |

## `src/loader`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/loader/README.md` | loader 目录说明，聚焦 bundle 装载、依赖求解和持久化。 | `loader 阅读地图` | `src/shell/provider.tsx`、`public/__testbundles` |
| `src/loader/persistence.ts` | bundle 目录的浏览器持久化读写层。 | `persistEditorBundleRecord`、`readPersistedEditorBundleRecords` | `src/shell/provider.tsx`、IndexedDB |
| `src/loader/runtime.ts` | bundle manifest 校验、IIFE/JSON 装载、依赖解析与 runtime setup 生成，并向 script bundle 暴露 `LeaferGraphRuntime`、`LeaferGraphAuthoring` 与 bridge 全局。 | `loadEditorBundleSource`、`resolveEditorBundleRuntimeSetup`、`ensureEditorBundleRuntimeGlobals` | `src/shell/provider.tsx`、`public/__testbundles` |
| `src/loader/types.ts` | bundle loader 的类型中心。 | `EditorBundleManifest`、`EditorBundleCatalogState`、`EditorBundleRuntimeSetup` | `src/loader/runtime.ts`、`src/shell/editor_controller.ts` |

## `src/menu`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/menu/README.md` | menu 目录说明，聚焦右键菜单绑定与解析。 | `menu 阅读地图` | `src/ui/viewport/View.tsx`、`src/commands/command_bus.ts` |
| `src/menu/context_menu_bindings.ts` | 节点/连线右键菜单绑定元数据与辅助键。 | `bindNodeContextMenu`、`bindLinkContextMenu` | `src/ui/viewport/View.tsx` |
| `src/menu/context_menu_resolver.ts` | 上下文菜单解析器，负责生成最终菜单项和打开前逻辑。 | `createEditorContextMenuResolver`、`createEditorContextMenuBeforeOpenHandler` | `src/ui/viewport/View.tsx` |

## `src/runtime`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/runtime/README.md` | runtime 目录说明，聚焦统一运行反馈入口。 | `runtime 阅读地图` | `src/backend/authority`、`src/ui/viewport/View.tsx` |
| `src/runtime/runtime_feedback_inlet.ts` | 统一运行反馈入口抽象，兼容本地与远端 runtime event。 | `createManualRuntimeFeedbackInlet` | `src/ui/viewport/View.tsx`、`src/backend/authority` |

## `src/session`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/session/README.md` | session 目录说明，串起 authority transport、document session 与 viewport binding。 | `session 阅读地图` | `src/backend/authority`、`src/ui/viewport/View.tsx` |
| `src/session/authority_openrpc/README.md` | authority OpenRPC 子系统说明，解释 `_generated/` 的生成边界和 runtime 用法。 | `OpenRPC 阅读地图` | `tools/generate_from_openrpc.ts`、`src/session/*transport*` |
| `src/session/authority_openrpc/index.ts` | authority OpenRPC 正式公共入口，聚合 generated descriptor、runtime 与 envelope 类型。 | `export *` | `src/backend.ts`、`transport/host/tests` |
| `src/session/authority_openrpc/runtime.ts` | 基于共享 OpenRPC 生成物的 authority JSON-RPC runtime，负责 params/result/notification 校验与默认协议 adapter。 | `validateMethodParams`、`validateMethodResult`、`validateNotificationParams`、`createDefaultEditorRemoteAuthorityProtocolAdapter` | `message_port`、`websocket`、`node_process` transports |
| `src/session/authority_openrpc/types.ts` | authority JSON-RPC envelope、协议 adapter 与 inbound/outbound 消息类型。 | `EditorRemoteAuthorityProtocolAdapter`、`EditorRemoteAuthority*Envelope` | `authority_openrpc/runtime.ts` |
| `src/session/authority_openrpc/_generated/` | authority OpenRPC 自动生成产物目录，收口 methods、notifications、schema bundle、OpenRPC 文档和 transport 类型。 | `descriptor / methods / notifications / models / transport_types` | `packages/editor/tools/generate_from_openrpc.ts` |
| `src/session/graph_document_authority_client.ts` | authority client 能力、连接状态与运行控制接口定义。 | `EditorRemoteAuthorityClient` 相关类型 | `src/backend/authority/remote_authority_app_runtime.ts` |
| `src/session/graph_document_authority_service.ts` | authority service 接口定义。 | `EditorRemoteAuthorityDocumentService` | `demo service`、`service bridge` |
| `src/session/graph_document_authority_service_bridge.ts` | 将 authority service 桥接到 transport/client 协议层。 | `createAuthorityServiceBridge` | `src/demo/remote_authority_demo_service.ts` |
| `src/session/graph_document_authority_transport.ts` | transport 抽象以及基于 transport 的标准 client 包装。 | `createTransportRemoteAuthorityClient` | `message_port`、`websocket` transports |
| `src/session/graph_document_session.ts` | document session 核心，实现 loopback、mock remote、remote client 三类会话。 | `createLoopbackGraphDocumentSession`、`createRemoteGraphDocumentSession` | `src/ui/viewport/View.tsx`、`src/shell/provider.tsx` |
| `src/session/graph_document_session_binding.ts` | `GraphViewport` 与 session 的绑定工厂。 | `createLoopbackGraphDocumentSessionBinding`、`createConfigurableSessionBindingFactory` | `src/ui/viewport/View.tsx` |
| `src/session/message_port_remote_authority_bridge_host.ts` | bridge 场景下的 MessagePort authority host。 | `DEFAULT_REMOTE_AUTHORITY_BRIDGE_HANDSHAKE_TYPE` | `iframe/window/worker bridge` |
| `src/session/message_port_remote_authority_host.ts` | 基于 MessagePort 的 authority host 主实现。 | `createMessagePortRemoteAuthorityHost` | `src/demo/remote_authority_demo_worker.ts`、`service bridge` |
| `src/session/message_port_remote_authority_transport.ts` | 基于 MessagePort 的 authority transport。 | `createMessagePortRemoteAuthorityTransport` | `src/backend/authority/remote_authority_app_runtime.ts` |
| `src/session/message_port_remote_authority_worker_host.ts` | worker 场景的 authority host 握手封装。 | `createMessagePortRemoteAuthorityWorkerHost` | `src/demo/remote_authority_demo_worker.ts` |
| `src/session/node_process_remote_authority_client.ts` | Node 进程 authority client，多用于测试/桥接环境。 | `createNodeProcessRemoteAuthorityClient` | `tests`、`child_process` host |
| `src/session/websocket_remote_authority_transport.ts` | 基于 WebSocket 的 authority transport，含重连和事件订阅。 | `createWebSocketRemoteAuthorityTransport` | `Python host demo`、`remote authority runtime` |

## `src/shell`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/shell/README.md` | shell 目录说明，聚焦 controller、Provider 和壳层编排。 | `shell 阅读地图` | `src/ui/*`、`src/backend/*` |
| `src/shell/editor_controller.ts` | editor 壳层状态模型与 actions 定义。 | `createEditorController`、`syncEditorController` | `src/shell/provider.tsx`、`src/ui/*` |
| `src/shell/index.ts` | shell barrel。 | `export *` | `src/index.ts` |
| `src/shell/layout/README.md` | layout 子系统说明，解释断点、自适应面板与 stage layout 计算。 | `layout 阅读地图` | `src/shell/provider.tsx`、`src/ui/workspace` |
| `src/shell/layout/workspace_adaptive.ts` | 工作区断点、自适应侧栏与 stage layout 决策。 | `resolveWorkspaceAdaptiveMode`、`resolveWorkspaceStageLayout` | `src/shell/provider.tsx`、`src/ui/workspace` |
| `src/shell/onboarding/README.md` | onboarding 子系统说明，解释 clean entry 引导和默认 demo 入口。 | `onboarding 阅读地图` | `src/shell/provider.tsx`、`src/ui/node-library` |
| `src/shell/onboarding/default_entry_onboarding.ts` | clean entry 模式下的 onboarding 判定与默认 Python demo URL。 | `resolveDefaultEntryOnboardingState`、`DEFAULT_PYTHON_AUTHORITY_DEMO_URL` | `src/shell/provider.tsx` |
| `src/shell/provider.tsx` | `EditorProvider` 与 `EditorShell` 主编排文件，连接 bundle、authority、theme、workspace 与 viewport。 | `EditorProvider`、`EditorShell`、`useEditorContext` | `src/shell/editor_controller.ts`、`src/ui/*` |

## `src/state`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/state/README.md` | state 目录说明，聚焦轻量状态控制器。 | `state 阅读地图` | `src/ui/viewport/View.tsx`、`src/commands/*` |
| `src/state/selection.ts` | 编辑器选择状态控制器。 | `createEditorNodeSelection` | `src/ui/viewport/View.tsx`、`commands` |

## `src/theme`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/theme/README.md` | theme 目录说明，聚焦主题初始化和画布背景样式。 | `theme 阅读地图` | `src/shell/provider.tsx`、`src/ui/viewport/View.tsx` |
| `src/theme/index.ts` | 主题类型、初始主题解析与画布背景样式。 | `resolveInitialEditorTheme`、`resolveGraphViewportBackground` | `src/shell/provider.tsx`、`src/ui/viewport/View.tsx` |

## `src/ui` 顶层

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/ui.ts` | UI 区域聚合导出入口。 | `export *` | `src/ui/*` |
| `src/ui/README.md` | UI 区域模块地图与 Connected/View 复用规则。 | `UI module guide` | `src/ui/*` |

## `src/ui/foundation`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/ui/foundation/README.md` | foundation 区域说明。 | `README` | `src/ui/foundation/*` |
| `src/ui/foundation/dialog/Connected.tsx` | 连接 `EditorProvider` 的通用对话框组件入口。 | `AppDialog` connected wrapper | `src/ui/foundation/dialog/View.tsx` |
| `src/ui/foundation/dialog/README.md` | 通用对话框组件说明。 | `README` | `src/ui/foundation/dialog/*` |
| `src/ui/foundation/dialog/View.tsx` | 纯 props 的通用对话框视图。 | `AppDialog` | `src/shell/provider.tsx` |
| `src/ui/foundation/dialog/index.ts` | dialog barrel。 | `export *` | `foundation/dialog View + types` |
| `src/ui/foundation/dialog/styles.css` | 对话框样式。 | `dialog styles` | `AppDialog` |
| `src/ui/foundation/dialog/types.ts` | 对话框 props 与动作类型。 | `AppDialogProps` | `View`、`Connected` |
| `src/ui/foundation/index.ts` | foundation barrel。 | `export *` | `src/ui/foundation/dialog` |
| `src/ui/foundation/styles.css` | foundation 公共样式汇总。 | `CSS aggregation` | `src/ui/foundation/dialog/styles.css` |

## `src/ui/inspector`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/ui/inspector/Connected.tsx` | 连接 `EditorProvider` 的检查器组件。 | `EditorInspectorConnected` | `src/app/WorkspacePanels.tsx` |
| `src/ui/inspector/README.md` | 检查器区域说明与使用方式。 | `README` | `inspector + WorkspacePanels` |
| `src/ui/inspector/View.tsx` | 纯 props 的检查器视图。 | `EditorInspectorView` | `src/app/WorkspacePanels.tsx` |
| `src/ui/inspector/index.ts` | inspector barrel。 | `export *` | `src/ui/inspector/*` |
| `src/ui/inspector/styles.css` | 检查器区域样式。 | `CSS styles` | `inspector + WorkspacePanels` |
| `src/ui/inspector/types.ts` | 检查器 props 与展示类型。 | `EditorInspectorViewProps` | `View`、`Connected` |

## `src/ui/node-library-preview`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/ui/node-library-preview/Connected.tsx` | 连接 `EditorProvider` 的节点库预览浮层组件。 | `EditorNodeLibraryPreviewConnected` | `node-library-preview + provider` |
| `src/ui/node-library-preview/README.md` | 节点库预览浮层说明与使用方式。 | `README` | `src/ui/node-library-preview/*` |
| `src/ui/node-library-preview/View.tsx` | 纯 props 的节点库预览浮层视图。 | `NodeLibraryHoverPreviewOverlay` | `src/ui/viewport/View.tsx` |
| `src/ui/node-library-preview/helpers.ts` | 节点库 hover/focus 预览的 request、preview document、浮层落点和能力判定工具。 | `createNodeLibraryPreviewRequest`、`createNodeLibraryPreviewDocument`、`resolveNodeLibraryPreviewPlacement`、`shouldEnableNodeLibraryHoverPreview` | `src/shell/provider.tsx`、`src/ui/node-library/View.tsx` |
| `src/ui/node-library-preview/index.ts` | node-library-preview barrel。 | `export *` | `src/ui/node-library-preview/*` |
| `src/ui/node-library-preview/styles.css` | 节点库预览浮层样式。 | `CSS styles` | `node-library-preview` |
| `src/ui/node-library-preview/types.ts` | 节点库预览浮层 props 与展示类型。 | `preview types/interfaces` | `View`、`Connected` |

## `src/ui/node-library`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/ui/node-library/Connected.tsx` | 连接 `EditorProvider` 的节点库组件。 | `EditorNodeLibraryConnected` | `src/app/WorkspacePanels.tsx` |
| `src/ui/node-library/README.md` | 节点库区域说明与使用方式。 | `README` | `node-library + WorkspacePanels` |
| `src/ui/node-library/View.tsx` | 纯 props 的节点库视图。 | `EditorNodeLibraryView` | `src/app/WorkspacePanels.tsx` |
| `src/ui/node-library/index.ts` | node-library barrel。 | `export *` | `src/ui/node-library/*` |
| `src/ui/node-library/styles.css` | 节点库区域样式。 | `CSS styles` | `node-library` |
| `src/ui/node-library/types.ts` | 节点库 props 与展示类型。 | `EditorNodeLibraryViewProps` | `View`、`Connected` |

## `src/ui/run-console`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/ui/run-console/Connected.tsx` | 连接 `EditorProvider` 的运行控制台组件。 | `EditorRunConsoleConnected` | `src/ui/viewport/runtime_*` |
| `src/ui/run-console/README.md` | 运行控制台说明与使用方式。 | `README` | `run-console + viewport runtime` |
| `src/ui/run-console/View.tsx` | 纯 props 的运行控制台视图。 | `EditorRunConsoleView` | `src/ui/viewport/runtime_*` |
| `src/ui/run-console/index.ts` | run-console barrel。 | `export *` | `src/ui/run-console/*` |
| `src/ui/run-console/styles.css` | 运行控制台样式。 | `CSS styles` | `run-console` |
| `src/ui/run-console/types.ts` | 运行控制台 props 与展示类型。 | `EditorRunConsoleViewProps` | `View`、`Connected` |

## `src/ui/statusbar`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/ui/statusbar/Connected.tsx` | 连接 `EditorProvider` 的状态栏组件。 | `EditorStatusbarConnected` | `src/shell/provider.tsx` |
| `src/ui/statusbar/README.md` | 状态栏说明与使用方式。 | `README` | `statusbar + provider` |
| `src/ui/statusbar/View.tsx` | 纯 props 的状态栏视图。 | `EditorStatusbarView` | `src/shell/provider.tsx` |
| `src/ui/statusbar/index.ts` | statusbar barrel。 | `export *` | `src/ui/statusbar/*` |
| `src/ui/statusbar/styles.css` | 状态栏样式。 | `CSS styles` | `statusbar` |
| `src/ui/statusbar/types.ts` | 状态栏 props 与展示类型。 | `EditorStatusbarViewProps` | `View`、`Connected` |

## `src/ui/titlebar`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/ui/titlebar/Connected.tsx` | 连接 `EditorProvider` 的顶栏组件。 | `EditorTitlebarConnected` | `src/shell/provider.tsx`、`src/ui/viewport/View.tsx` |
| `src/ui/titlebar/README.md` | 顶栏说明与使用方式。 | `README` | `titlebar + provider + viewport toolbar` |
| `src/ui/titlebar/View.tsx` | 纯 props 的顶栏视图，承接品牌区、文档摘要、命令按钮与运行控制按钮。 | `EditorTitlebarView` | `src/ui/viewport/View.tsx` |
| `src/ui/titlebar/index.ts` | titlebar barrel。 | `export *` | `src/ui/titlebar/*` |
| `src/ui/titlebar/styles.css` | 顶栏样式。 | `CSS styles` | `titlebar` |
| `src/ui/titlebar/types.ts` | 顶栏 props 与动作展示类型。 | `EditorTitlebarViewProps` | `View`、`Connected` |

## `src/ui/viewport`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/ui/viewport/Connected.tsx` | 连接 `EditorProvider` 的 viewport 组件，负责把 effective document/runtime/bundle setup 送入画布。 | `EditorViewportConnected` | `src/shell/provider.tsx` |
| `src/ui/viewport/README.md` | viewport 区域说明与使用方式。 | `README` | `src/ui/viewport/*` |
| `src/ui/viewport/View.tsx` | editor 真正挂载 `createLeaferGraph(...)` 的执行面，同时装配 command bus、history、selection、session binding、runtime feedback。 | `GraphViewport` | `leafergraph`、`src/commands/*`、`src/session/*`、`src/interaction/*` |
| `src/ui/viewport/authority_document_projection_gate.ts` | authority 文档整图投影的交互阻断 gate，避免在 marquee/reconnect/活跃交互期间 flush。 | `isAuthorityDocumentProjectionInteractionActive`、`canFlushDeferredAuthorityDocumentProjection` | `src/ui/viewport/View.tsx` |
| `src/ui/viewport/graph_execution_feedback_guard.ts` | remote mode 下过滤 authority document projection 带来的本地图执行态重置噪声。 | `shouldIgnoreProjectedGraphExecutionFeedback` | `src/ui/viewport/View.tsx`、`src/runtime/runtime_feedback_inlet.ts` |
| `src/ui/viewport/index.ts` | viewport barrel。 | `export *` | `src/ui/viewport/*` |
| `src/ui/viewport/node_pointer_selection.ts` | 统一解析节点左/右键命中的选区动作。 | `resolveNodePointerSelectionAction` | `src/ui/viewport/View.tsx` |
| `src/ui/viewport/runtime_collections.ts` | 运行历史条目、链路聚合、失败聚合与最近一次执行摘要的投影工具。 | `createRuntimeHistoryEntryFromEvent`、`appendRuntimeHistoryEntry`、`groupRuntimeHistoryEntries`、`groupRuntimeFailureEntries` | `src/ui/viewport/View.tsx`、`src/ui/run-console/View.tsx` |
| `src/ui/viewport/runtime_control_notice.ts` | remote runtime control 请求结果到 UI notice 的映射层。 | `resolveRemoteRuntimeControlNotice` | `src/ui/viewport/View.tsx`、`src/ui/titlebar/View.tsx` |
| `src/ui/viewport/runtime_status.ts` | 运行状态补充文案解析器，生成 statusbar/run console 可直接展示的摘要。 | `resolveGraphViewportRuntimeDetailLabel` | `src/ui/statusbar/View.tsx`、`src/ui/run-console/View.tsx` |
| `src/ui/viewport/styles.css` | viewport 区域样式。 | `CSS styles` | `viewport` |
| `src/ui/viewport/types.ts` | viewport props、toolbar controls、runtime controls、workspace state 等类型。 | `GraphViewport* types` | `View`、`Connected`、`src/shell/provider.tsx` |

## `src/ui/workspace-settings`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/ui/workspace-settings/Connected.tsx` | 连接 `EditorProvider` 的工作区设置面板组件。 | `EditorWorkspaceSettingsConnected` | `src/shell/provider.tsx` |
| `src/ui/workspace-settings/README.md` | 工作区设置说明与使用方式。 | `README` | `workspace-settings + provider` |
| `src/ui/workspace-settings/View.tsx` | 纯 props 的工作区设置视图，承接 extensions、authority、preferences、shortcuts 等面板。 | `EditorWorkspaceSettingsView` | `src/shell/provider.tsx`、`src/loader/*` |
| `src/ui/workspace-settings/index.ts` | workspace-settings barrel。 | `export *` | `src/ui/workspace-settings/*` |
| `src/ui/workspace-settings/styles.css` | 工作区设置样式。 | `CSS styles` | `workspace-settings` |
| `src/ui/workspace-settings/types.ts` | 工作区设置 props 与标签页类型。 | `EditorWorkspaceSettingsViewProps` | `View`、`Connected` |

## `src/ui/workspace`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `src/ui/workspace/Connected.tsx` | 连接 `EditorProvider` 的主工作区布局组件。 | `EditorWorkspaceConnected` | `src/shell/provider.tsx` |
| `src/ui/workspace/README.md` | 主工作区布局说明与使用方式。 | `README` | `workspace + shell/provider` |
| `src/ui/workspace/View.tsx` | 纯 props 的主工作区视图，组织左侧节点库、中心画布和右侧检查器。 | `EditorWorkspaceView` | `src/ui/node-library/*`、`src/ui/viewport/*`、`src/ui/inspector/*` |
| `src/ui/workspace/index.ts` | workspace barrel。 | `export *` | `src/ui/workspace/*` |
| `src/ui/workspace/styles.css` | 主工作区布局样式。 | `CSS styles` | `workspace` |
| `src/ui/workspace/types.ts` | 主工作区 props 与布局类型。 | `EditorWorkspaceViewProps` | `View`、`Connected` |

## `tools`

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `tools/generate_from_openrpc.ts` | editor authority OpenRPC 生成器，负责读取共享 OpenRPC 真源、重写 schema 引用、输出 `_generated/` 产物并支持 stale check。 | `generateAuthorityOpenRpcArtifacts`、`computeFingerprint`、`--check` | `src/session/authority_openrpc/_generated/`、`package.json scripts` |

## `tests`

> 测试不只是“是否能跑”，而是按 authority、bundle runtime、viewport runtime、interaction、clipboard、selection、debug、exports 等主题给 editor 建立回归面。

| 文件/目录路径 | 作用描述 | 核心函数/类 | 关联模块 |
| :--- | :--- | :--- | :--- |
| `tests/app.remote_authority_bundle_projection.test.ts` | 验证 app 层 authority bundle projection 的决策与投影结果。 | `bundle projection tests` | `src/app/remote_authority_bundle_projection.ts` |
| `tests/authority_document_projection_gate.test.ts` | 验证 authority 文档投影 gate 对交互态的阻断与放行。 | `projection gate tests` | `src/ui/viewport/authority_document_projection_gate.ts` |
| `tests/browser_clipboard_bridge.test.ts` | 验证浏览器剪贴板桥接读写。 | `clipboard bridge tests` | `src/commands/browser_clipboard_bridge.ts` |
| `tests/bundle_runtime_setup.test.ts` | 验证 bundle loader 的 manifest 校验与 runtime setup 组装。 | `bundle runtime tests` | `src/loader/runtime.ts` |
| `tests/clipboard_payload.test.ts` | 验证剪贴板 payload 的序列化与反序列化。 | `clipboard payload tests` | `src/commands/clipboard_payload.ts` |
| `tests/command_bus.authority_first.test.ts` | 验证 authority-first 模式下命令总线与确认链路。 | `command bus tests` | `src/commands/command_bus.ts` |
| `tests/command_bus.clipboard_state.test.ts` | 验证命令总线与剪贴板状态集成。 | `command bus clipboard tests` | `src/commands/command_bus.ts` |
| `tests/command_history.authority.test.ts` | 验证命令历史与 authority 确认的协同。 | `command history tests` | `src/commands/command_history.ts` |
| `tests/context_menu_resolver.create_node_submenu.test.ts` | 验证右键菜单“创建节点”子菜单解析。 | `context menu resolver tests` | `src/menu/context_menu_resolver.ts` |
| `tests/default_entry_onboarding.test.ts` | 验证 clean entry onboarding 判定。 | `onboarding tests` | `src/shell/onboarding/default_entry_onboarding.ts` |
| `tests/fixtures/remote_authority_demo_backend.mjs` | 供 remote authority demo/backend 集成测试复用的 fixture。 | `demo backend fixture` | `tests/*remote_authority*` |
| `tests/authority_openrpc_runtime.test.ts` | 验证 authority OpenRPC runtime 的常量、schema 校验与 discover 文档一致性。 | `protocol tests` | `src/session/authority_openrpc/` |
| `tests/graph_document_authority_service_bridge.test.ts` | 验证 service bridge 的请求/事件桥接。 | `service bridge tests` | `src/session/graph_document_authority_service_bridge.ts` |
| `tests/graph_document_session.remote_client.demo_backend.test.ts` | 验证 remote client session 对 demo backend 的联通。 | `remote session integration tests` | `src/session/graph_document_session.ts` |
| `tests/graph_document_session.remote_client.test.ts` | 验证 remote client session 的提交、确认与重同步。 | `remote session tests` | `src/session/graph_document_session.ts` |
| `tests/graph_document_session.remote_mock.test.ts` | 验证 mock remote session 行为。 | `mock remote session tests` | `src/session/graph_document_session.ts` |
| `tests/graph_document_session.remote_revision_guard.test.ts` | 验证 remote session revision guard。 | `revision guard tests` | `src/session/graph_document_session.ts` |
| `tests/graph_execution_feedback_guard.test.ts` | 验证执行反馈 guard 对投影噪声的过滤。 | `runtime feedback guard tests` | `src/ui/viewport/graph_execution_feedback_guard.ts` |
| `tests/graph_external_runtime_feedback_projection.test.ts` | 验证外部 runtime feedback 投影到 viewport 运行态。 | `runtime feedback projection tests` | `src/runtime/runtime_feedback_inlet.ts`、`src/ui/viewport/View.tsx` |
| `tests/graph_interaction_commit_bridge.test.ts` | 验证交互提交桥把交互动作转换成命令或 operation。 | `interaction bridge tests` | `src/interaction/graph_interaction_commit_bridge.ts` |
| `tests/graph_timer_runtime.test.ts` | 验证图运行定时器相关 runtime 行为。 | `graph timer runtime tests` | `leafergraph runtime + viewport` |
| `tests/graph_viewport.remote_runtime_control_notice.test.ts` | 验证 remote runtime control notice 的文案与状态。 | `runtime control notice tests` | `src/ui/viewport/runtime_control_notice.ts` |
| `tests/graph_viewport_runtime_collections.test.ts` | 验证 viewport 运行历史、链路聚合和失败聚合。 | `runtime collections tests` | `src/ui/viewport/runtime_collections.ts` |
| `tests/graph_viewport_runtime_status.test.ts` | 验证 viewport 运行状态补充文案。 | `runtime status tests` | `src/ui/viewport/runtime_status.ts` |
| `tests/helpers/install_test_host_polyfills.ts` | 安装测试环境宿主 polyfill。 | `test polyfill installer` | `tests/*` |
| `tests/interaction_host.activity_state.test.ts` | 验证交互宿主 activity state 与 editor 协同。 | `interaction activity tests` | `leafergraph interaction host + viewport` |
| `tests/interaction_host.link_create_commit.test.ts` | 验证连线创建交互的提交链路。 | `link create commit tests` | `src/interaction/graph_interaction_commit_bridge.ts` |
| `tests/leafer_debug.test.ts` | 验证 Leafer debug 配置读写与合并。 | `debug tests` | `src/debug/leafer_debug.ts` |
| `tests/message_port_remote_authority_bridge_host.test.ts` | 验证 MessagePort bridge host 握手。 | `bridge host tests` | `src/session/message_port_remote_authority_bridge_host.ts` |
| `tests/message_port_remote_authority_host.test.ts` | 验证 MessagePort authority host。 | `authority host tests` | `src/session/message_port_remote_authority_host.ts` |
| `tests/message_port_remote_authority_transport.test.ts` | 验证 MessagePort transport。 | `transport tests` | `src/session/message_port_remote_authority_transport.ts` |
| `tests/message_port_remote_authority_worker_host.test.ts` | 验证 worker authority host 握手。 | `worker host tests` | `src/session/message_port_remote_authority_worker_host.ts` |
| `tests/node_commands.clipboard_links.test.ts` | 验证节点复制粘贴时连线快照重建。 | `node command clipboard tests` | `src/commands/node_commands.ts` |
| `tests/node_flag_utils.test.ts` | 验证节点 flag 工具。 | `flag util tests` | `src/commands/node_flag_utils.ts` |
| `tests/node_library_hover_preview.test.ts` | 验证节点库 hover 预览逻辑。 | `hover preview tests` | `src/ui/node-library-preview/helpers.ts` |
| `tests/node_pointer_selection.test.ts` | 验证节点指针选择动作解析。 | `pointer selection tests` | `src/ui/viewport/node_pointer_selection.ts` |
| `tests/node_port_hit_area.test.ts` | 验证节点端口 hit area 相关交互。 | `node port hit area tests` | `viewport + leafergraph interaction` |
| `tests/preview_remote_authority_bootstrap.test.ts` | 验证 preview authority bootstrap 安装逻辑。 | `bootstrap tests` | `src/demo/preview_remote_authority_bootstrap.ts` |
| `tests/public_exports.test.ts` | 验证 editor 公共导出面稳定性。 | `public export tests` | `src/index.ts`、`src/backend.ts`、`src/ui.ts` |
| `tests/public_testbundles_manifest.test.ts` | 验证 public testbundles 的 manifest 形态。 | `bundle manifest tests` | `public/__testbundles/*.iife.js` |
| `tests/python_websocket_host_demo_bootstrap.test.ts` | 验证 Python WebSocket demo bootstrap。 | `python demo bootstrap tests` | `src/demo/python_websocket_host_demo_bootstrap.ts` |
| `tests/remote_authority_app_runtime.test.ts` | 验证 remote authority app runtime 装配。 | `app runtime tests` | `src/backend/authority/remote_authority_app_runtime.ts` |
| `tests/remote_authority_bundle_projection.test.ts` | 验证 authority bundle projection 策略。 | `bundle projection tests` | `src/app/remote_authority_bundle_projection.ts` |
| `tests/remote_authority_demo_backend.test.ts` | 验证 demo authority backend/service 行为。 | `demo backend tests` | `src/demo/remote_authority_demo_service.ts` |
| `tests/remote_authority_demo_service.test.ts` | 验证 demo authority service。 | `demo service tests` | `src/demo/remote_authority_demo_service.ts` |
| `tests/remote_authority_external_bridge_adapter.test.ts` | 验证外部 bridge adapter 装配。 | `external bridge adapter tests` | `src/backend/authority/remote_authority_host_adapter.ts` |
| `tests/remote_authority_host_adapter.test.ts` | 验证 host adapter descriptor 解析。 | `host adapter tests` | `src/backend/authority/remote_authority_host_adapter.ts` |
| `tests/runtime_feedback_inlet.test.ts` | 验证 runtime feedback inlet 行为。 | `runtime feedback tests` | `src/runtime/runtime_feedback_inlet.ts` |
| `tests/websocket_remote_authority_transport.test.ts` | 验证 WebSocket transport。 | `websocket transport tests` | `src/session/websocket_remote_authority_transport.ts` |
| `tests/workspace_adaptive.test.ts` | 验证 workspace adaptive layout 计算。 | `workspace adaptive tests` | `src/shell/layout/workspace_adaptive.ts` |
