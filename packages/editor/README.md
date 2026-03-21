# leafergraph-editor 目录结构说明

## 包定位

`packages/editor` 负责 LeaferGraph 的编辑器壳层：UI 组合、状态编排、authority 接线、bundle 装载与 demo 装配。  
核心图模型与渲染底层能力不在这里实现，底层能力来自 `leafergraph` / `@leafergraph/node`。

## 开发命令

在仓库根目录执行：

```powershell
bun run dev:editor
bun run build:editor
bun run preview:editor
```

在包目录执行：

```powershell
bun run dev
bun run build
bun run preview
```

## 顶层结构

```text
packages/editor
├─ src                           # 编辑器源码主目录
│  ├─ app                        # 过渡层（bootstrap/projection/旧面板与主样式）
│  ├─ backend                    # editor 侧后端接线层（authority source/adapter）
│  ├─ commands                   # 命令系统（复制粘贴、历史、节点/连线命令）
│  ├─ demo                       # demo 页面 bootstrap 与示例 authority 装配
│  ├─ interaction                # 交互到命令/operation 的提交桥
│  ├─ loader                     # bundle 加载、依赖解析、持久化
│  ├─ menu                       # 右键菜单绑定与菜单解析
│  ├─ runtime                    # 运行反馈入口抽象
│  ├─ session                    # authority 协议、transport、session 绑定
│  ├─ shell                      # 编辑器壳层与 controller 编排
│  ├─ state                      # 轻量状态控制（如 selection）
│  ├─ theme                      # 主题与背景样式策略
│  ├─ ui                         # 按区域拆分的 UI 模块
│  ├─ index.ts                   # 根公共导出入口
│  ├─ ui.ts                      # UI 聚合导出入口
│  ├─ backend.ts                 # backend/session 聚合导出入口
│  ├─ main.tsx                   # 浏览器启动入口（挂载 EditorShell）
│  └─ styles.css                 # 官方样式聚合入口
├─ tests                         # editor 单元/集成测试
├─ authority-host-demo.html      # 浏览器内 authority host demo 页面
├─ authority-node-host-demo.html # Node WebSocket authority host demo 页面
├─ authority-python-host-demo.html # Python WebSocket authority host demo 页面
├─ index.html                    # 默认编辑器页面入口
├─ package.json                  # 包信息、scripts、exports
└─ vite.config.ts                # Vite 构建与 dev server 配置
```

## src 目录职责

### `src/shell`

编辑器壳层入口与编排层。  
核心文件：

- `provider.tsx`：`EditorProvider`、`EditorShell`、连接式区域组合。
- `editor_controller.ts`：`createEditorController(...)` 与官方状态/动作模型。
- `layout/`：自适应布局策略。
- `onboarding/`：clean entry 引导策略。

### `src/ui`

按 UI 区域拆分的模块目录。每个区域默认包含 `View`、`Connected`、`types`、`styles`、`README`。  
区域包括：

- `foundation`
- `titlebar`
- `workspace`
- `node-library`
- `viewport`
- `inspector`
- `statusbar`
- `workspace-settings`
- `run-console`
- `node-library-preview`

> 详细说明见 [src/ui/README.md](./src/ui/README.md)。

### `src/backend`

editor 侧 authority 接线层。  
当前主要落点：

- `backend/authority/remote_authority_app_runtime.ts`
- `backend/authority/remote_authority_host_adapter.ts`

### `src/session`

authority 协议、client/service、transport、session binding、MessagePort/WS/NodeProcess 桥接。

### `src/loader`

bundle manifest 解析、依赖检查、运行时 setup、持久化读写（IndexedDB）相关能力。

### `src/commands`

编辑器命令层（复制粘贴、删除、历史、运行控制等）与命令状态解析。

### `src/interaction`

图交互与操作提交桥接层（例如交互 commit 到会话/authority 的路径）。

### `src/state`

轻量状态模型与状态工具（例如 selection 等）。

### `src/demo`

内部 demo/bootstrap 装配层。  
这里的代码用于 `index.html` 与 host demo 页面，不是推荐公共 API 入口。

补充边界（容易混淆）：

- `src/demo` 负责“给 editor 前端注入 bootstrap 配置”，例如 `preloadedBundles`、authority adapter、host demo URL。
- `src/demo` 不负责启动或实现 Node/Python 后端；后端由 `templates/*-backend-template` 独立启动。
- `node/widget/demo bundle` 的装载发生在 editor 前端（`main.tsx -> shell/provider.tsx -> loader/runtime.ts`），不是后端服务在装载。

### `src/app`

过渡层目录，目前只保留少量仍在收口中的实现：

- `editor_app_bootstrap.ts`
- `remote_authority_bundle_projection.ts`
- `WorkspacePanels.tsx`
- `style.css`

其余 UI/authority/controller 逻辑已迁到 `shell` / `ui` / `backend`。

## 文件级地图（详细）

下面按目录列出当前主要文件和职责，便于定位修改落点。

### 顶层入口文件

- `src/main.tsx`：浏览器启动入口；读取 bootstrap，创建 controller，渲染 `EditorProvider + EditorShell`。
- `src/index.ts`：根导出入口；对外暴露 `EditorShell`、`EditorProvider`、`createEditorController(...)` 等。
- `src/ui.ts`：UI 聚合导出入口；用于按区域引用 UI 能力。
- `src/backend.ts`：backend/session/runtime 聚合导出入口。
- `src/styles.css`：官方样式聚合入口（当前导入 `src/app/style.css`）。

### `src/backend/authority`

- `remote_authority_app_runtime.ts`：authority source/client/transport 的统一装配层，产出 `ResolvedEditorRemoteAuthorityAppRuntime`。
- `remote_authority_host_adapter.ts`：host adapter 解析层；内置 `message-port/worker/window/demo-worker` 适配。

### `src/commands`

- `command_bus.ts`：命令总线，统一执行入口、命令状态、执行结果。
- `command_history.ts`：撤销/重做历史栈。
- `graph_operation_utils.ts`：`GraphOperation` 构建与 snapshot 转换工具。
- `node_commands.ts`：节点命令主实现（创建、删除、复制、剪切、粘贴、重复、尺寸重置等）。
- `link_commands.ts`：连线命令（创建、删除、重连）。
- `canvas_commands.ts`：画布级命令（如节点创建定位、适配当前视图交互）。
- `clipboard_payload.ts`：LeaferGraph JSON 剪贴板载荷序列化/反序列化与重建。
- `browser_clipboard_bridge.ts`：浏览器系统剪贴板读写桥接。

### `src/interaction`

- `graph_interaction_commit_bridge.ts`：交互层与命令/operation 提交链路之间的桥接。

### `src/loader`

- `types.ts`：bundle 类型定义（manifest、record、catalog、runtime setup）。
- `runtime.ts`：bundle 装载、依赖求解、激活策略、runtime setup 解析。
- `persistence.ts`：bundle 持久化（IndexedDB）读写。

### `src/menu`

- `context_menu_bindings.ts`：节点/连线上下文菜单绑定元数据。
- `context_menu_resolver.ts`：上下文菜单项解析与打开前处理。

### `src/runtime`

- `runtime_feedback_inlet.ts`：运行反馈入口抽象与手动实现。

### `src/session`

- `graph_document_authority_protocol.ts`：authority 协议 envelope 与适配器。
- `graph_document_authority_client.ts`：authority 客户端能力与连接状态模型。
- `graph_document_authority_transport.ts`：transport 请求/响应/事件模型与 client 包装。
- `graph_document_authority_service.ts`：authority service 接口定义。
- `graph_document_authority_service_bridge.ts`：service 与 client/transport 的桥接实现。
- `graph_document_session.ts`：文档会话核心（loopback/remote，pending，resync）。
- `graph_document_session_binding.ts`：graph 与 session 绑定工厂。
- `message_port_remote_authority_transport.ts`：MessagePort transport。
- `message_port_remote_authority_host.ts`：MessagePort host。
- `message_port_remote_authority_bridge_host.ts`：bridge 场景握手 host。
- `message_port_remote_authority_worker_host.ts`：worker 握手 host。
- `websocket_remote_authority_transport.ts`：WebSocket transport（含重连）。
- `node_process_remote_authority_client.ts`：Node 进程 authority client（测试/桥接场景）。

### `src/shell`

- `provider.tsx`：壳层主组合文件；负责 titlebar/workspace/statusbar/dialogs 的连接与装配。
- `editor_controller.ts`：官方状态编排模型与 actions 定义。
- `layout/workspace_adaptive.ts`：自适应断点、侧栏呈现与 stage 布局策略。
- `onboarding/default_entry_onboarding.ts`：clean entry 引导状态判定。
- `index.ts`：shell 聚合导出。

### `src/state`

- `selection.ts`：选择状态控制器。

### `src/theme`

- `index.ts`：主题类型、主题初始化、GraphViewport 背景样式解析。

### `src/ui`（区域模块）

每个区域目录通常包含：

- `Connected.tsx`：连接 `EditorProvider/controller` 的版本。
- `View.tsx`：纯 props 版本。
- `types.ts`：区域 props/type 定义。
- `styles.css`：区域样式入口。
- `README.md`：该区域的职责与使用说明。
- `index.ts`：该区域导出入口。

重点区域说明：

- `ui/viewport`：`GraphViewport` 与运行态聚合工具（`runtime_collections.ts`、`runtime_status.ts`、`runtime_control_notice.ts`）。
- `ui/node-library-preview`：节点 hover 预览 overlay 与预览辅助函数（`helpers.ts`）。
- `ui/foundation/dialog`：通用 `AppDialog` 组件与类型。
- `ui/node-library`、`ui/inspector`：当前通过 `app/WorkspacePanels.tsx` 承接主要实现，后续可继续细拆。

### `src/demo`

- `websocket_host_demo_bootstrap.ts`：WebSocket host demo 通用 bootstrap。
- `node_websocket_host_demo_bootstrap.ts`：Node host demo 专用 bootstrap 封装。
- `python_websocket_host_demo_bootstrap.ts`：Python host demo 专用 bootstrap 封装。
- `node_websocket_host_demo_entry.ts`：Node host demo 页面入口。
- `python_websocket_host_demo_entry.ts`：Python host demo 页面入口。
- `preview_remote_authority_bootstrap.ts`：预览环境 authority bootstrap 注入。
- `preview_remote_authority_host_demo_bootstrap.ts`：host demo authority 注入。
- `preview_remote_authority_host_demo_entry.ts`：host demo 页面入口。
- `remote_authority_demo_service.ts`：浏览器内 demo authority service。
- `remote_authority_demo_source.ts`：demo worker source 封装。
- `remote_authority_demo_worker.ts`：浏览器内 authority worker。

`websocket_host_demo_bootstrap.ts` 当前只负责 authority 连接 bootstrap；前端 bundle 默认改为以后端 `frontendBundles.sync` 推送为准。

### `src/app`（剩余过渡文件）

- `editor_app_bootstrap.ts`：解析全局 bootstrap（`window.LeaferGraphEditorAppBootstrap`）。
- `remote_authority_bundle_projection.ts`：authority-first 场景下 demo document 投影策略。
- `WorkspacePanels.tsx`：`NodeLibraryPane`、`InspectorPane` 的实现。
- `style.css`：当前主样式文件。

## 公共入口与导出

`package.json` 目前暴露了这些稳定源码入口：

- `.`：`EditorShell`、`EditorProvider`、`createEditorController(...)`
- `./shell`
- `./ui/*`（区域级入口）
- `./backend`
- `./styles.css`
- `./ui/<region>/styles.css`

对应源码入口：

- `src/index.ts`
- `src/ui.ts`
- `src/backend.ts`
- `src/styles.css`

## 页面入口关系

- `src/main.tsx`：默认编辑器装配入口。
- `index.html`：默认入口页面。
- `authority-node-host-demo.html`：Node authority host demo。
- `authority-python-host-demo.html`：Python authority host demo。
- `authority-host-demo.html`：浏览器内 demo authority host。

## 常见问题：后端是否负责加载 node/widget bundle？

不是。当前链路是“前端加载 bundle，后端提供 authority 文档与运行控制”：

1. `src/demo/websocket_host_demo_bootstrap.ts` 在 host demo 场景按参数生成 `preloadedBundles`（如 `widget.iife.js`、`node.iife.js`、`demo.iife.js`）。
2. `src/app/editor_app_bootstrap.ts` 解析 `window.LeaferGraphEditorAppBootstrap`，把 `preloadedBundles` 交给主入口。
3. `src/main.tsx` 创建 controller 时透传 `preloadedBundles`。
4. `src/shell/provider.tsx` 读取这些 bundle，`fetch` 源码后调用 `loadEditorBundleSource(...)` 完成装载与激活。

authority（Node/Python）侧仅通过 `WS /authority` 与 editor 同步文档/操作/运行态，不参与前端 bundle 文件加载。  
对 WebSocket host demo，`bundleProjectionMode` 默认是 `skip`，因此文档事实源以远端 authority 为准。

## 常见改动落点

- 新增/调整编辑器状态动作：`src/shell/editor_controller.ts`
- 调整整壳布局与区域组合：`src/shell/provider.tsx`
- 改某个 UI 区域：`src/ui/<region>/`
- 调整 authority 接线：`src/backend/authority/` + `src/session/`
- 调整 bundle 装载/依赖/恢复：`src/loader/`
- 调整命令行为：`src/commands/`
- 调整 demo 注入逻辑：`src/demo/`

## 维护约定

- 优先在 `shell` / `ui` / `backend` 新结构上开发，避免新增 `app` 兼容层文件。
- demo/bootstrap 代码不作为公共 API 依赖入口。
- 新增 UI 区域时，保持“一个区域一个文件夹 + README”结构。
