# LeaferGraph Workspace

这个目录是新的 LeaferGraph 实验工程，当前主要由三个包组成：

- `packages/leafergraph`
  - 核心库工程
  - 负责提供最小的 LeaferGraph API
- `packages/authoring`
  - 干净的作者层包
  - 负责把节点 / widget 作者代码收口为 `NodeDefinition`、`NodeModule`、`LeaferGraphWidgetEntry`、`LeaferGraphNodePlugin`
  - 不承担 editor 适配、bundle bridge、loader manifest 或历史兼容负担
- `packages/editor`
  - 编辑器工程
  - 使用 Preact 作为主要控制层，并通过包名 `leafergraph` 引用核心库
  - 当前同时支持本地 bundle 加载与远端 authority 接线
- `openrpc/`
  - authority 协议真源目录
  - 默认包含 `authority.openrpc.json`、`schemas/`、`conformance/`
  - 全仓统一通过 `LEAFERGRAPH_OPENRPC_ROOT` 或默认仓库根 `openrpc/` 读取
- `templates/`
  - 可直接复制出去的外部模板工程
  - 当前已提供：
    - `templates/backend/python-openrpc-authority-template`
      - 当前仓库默认的 OpenRPC-first authority 后端模板
    - `templates/misc/browser-node-widget-plugin-template`
    - `templates/misc/backend-node-package-template`
  - 模板职责矩阵见 `templates/README.md`

## 当前边界

- `packages/authoring`
  - 只保留节点 / widget 作者体验与正式产物组装
  - 不内置 editor 适配、不提供 browser bundle helper，也不承载 demo/public bridge
- `packages/leafergraph`
  - 只保留核心图能力、节点运行时、渲染宿主与交互基础设施
  - 不再内建默认 demo 节点、默认 demo 图数据或 editor 专属快速创建模板
  - 主包初始化只接受正式 `graph` 输入，不再提供 `nodes` 这类 demo 级入口
- `packages/editor`
  - 承担 Sandbox、本地 bundle 装载面板和 editor 壳层行为
  - editor 不再源码直连模板工程，而是通过文件选择器读取本地 bundle，或通过 authority 消费远端推送

## 常用命令

```bash
bun install
bun run dev:editor
bun run dev:editor:lan
bun run build:authoring
bun run build:testbundles
bun run start:python-backend
bun run start:python-openrpc-backend
bun run test:authority-conformance
bun run test:authoring
bun run build
```

后端模板命令统一走 `backend` 命名；你可以在根目录直接运行：

```bash
bun run start:python-backend
bun run test:python-backend
bun run start:python-openrpc-backend
bun run test:python-openrpc-backend
bun run test:authority-conformance
```

当前 authority 协议固定为：

- `GET /health`
- `WS /authority`
- JSON-RPC 2.0
- `rpc.discover` 返回共享 OpenRPC 文档

## 当前定位

这一版先把工程骨架搭起来：

- 作者层包：`@leafergraph/authoring`
- 库包：`leafergraph`
- 编辑器包：`leafergraph-editor`
- 编辑器通过包依赖和 Vite alias 直接引用库源码

当前已经具备这几类基础能力：

- graph / node / link 数据结构
- scene sync
- viewport / selection / connect
- 图级 `play / step / stop`
- 节点级 `playFromNode(...)`

## 设计文档

- `docs/范围与设计选项.md`
  - 范围划定
  - 三个设计方案
  - 推荐结构与后续优先级
- `docs/架构蓝图.md`
  - 参考 `litegraph.js` Leafer 运行层提炼出的新架构
  - 分层、主链路、层级模型与阶段路线
- `docs/节点插件接入方案.md`
  - 外部节点包接入方案
  - Vite external、宿主注入与主包节点池注册流程
- [`docs/节点组件蓝图加载说明.md`](./docs/节点组件蓝图加载说明.md)
  - 节点 / 组件 / 蓝图 bundle 的完整加载说明
  - 覆盖本地导入、authority 同步、持久化恢复与模板产物
- `docs/节点API方案.md`
  - 节点 API 与节点外壳整合方案
  - 生命周期、注册机制、节点结构与外壳设计说明
- `docs/右键菜单管理方案.md`
  - 基于 Leafer `pointer.menu` 的右键菜单基础设施方案
  - 菜单管理器职责、坐标体系与宿主接入方式

## Editor 本地 Bundle 加载

如果你想系统理解“节点 / 组件（代码中仍名为 widget）/ 蓝图（代码中仍名为 demo）”三类 bundle 怎样进入 editor、怎样做依赖求解、怎样被持久化与恢复，优先看：

- [`docs/节点组件蓝图加载说明.md`](./docs/节点组件蓝图加载说明.md)

editor 现在内建一个“本地 Bundle 加载面板”，按三类 bundle 分组管理：

- `Widget Bundles`
- `Node Bundles`
- `Demo Bundles`

本地加载方式不再依赖源码 alias，而是：

1. 在模板工程里构建出 browser bundle 文件
2. 在 editor 页面用文件选择器选择本地 `dist/browser/*.iife.js`
3. editor 通过 `<script>` 注入这些文件
4. bundle 顶层调用 `LeaferGraphEditorBundleBridge.registerBundle(...)`
5. editor 再把已激活 bundle 组装成 `document + plugins`

远端 authority 加载方式固定为：

1. authority 返回正式 `GraphDocument`
2. authority 通过 `authority.frontendBundlesSync` 推送结构化前端 bundle
3. editor 根据 bundle `format` 分流注册 `node-json` / `demo-json` / `script`

当前行为语义：

- `node/widget` bundle 可同时加载多个，并按启用状态累加能力
- `demo` bundle 可同时加载多个，但同一时刻只会有一个“当前 demo”
- 加载 demo bundle 不会自动切换当前画布，必须显式切换

推荐加载顺序：

1. `widget.iife.js`
2. `node.iife.js`
3. `demo.iife.js`
4. `demo-alt.iife.js`（可选，用于验证 demo 切换）

这样可以避免 demo 图先落地时缺少依赖节点或 widget。

模板里的 `demo document` 现在也直接使用正式 `GraphDocument` 结构：

- 节点使用可恢复快照语义
- 位置和尺寸走 `layout`
- 展示型字段走 `properties`

如果你修改了模板工程里的 browser bundle，或想刷新 editor 内置联调用的测试 bundle，可执行：

```bash
bun run build:testbundles
```

这条命令会先重建 `templates/misc/browser-node-widget-plugin-template/dist/browser/*`，再同步到 `packages/editor/public/__testbundles/`。

## 模板工程产物

`templates/misc/browser-node-widget-plugin-template` 当前会同时输出两条产物线：

- ESM 包产物
  - `dist/index.js`
  - 适合被其它工程正常 `import`
- browser IIFE 产物
  - `dist/browser/demo.iife.js`
  - `dist/browser/demo-alt.iife.js`
  - `dist/browser/node.iife.js`
  - `dist/browser/widget.iife.js`
  - 适合被 editor 本地文件加载面板直接读取

## Editor 多页面预览产物

`packages/editor` 的生产构建现在会同时产出这些页面：

- `dist/index.html`
- `dist/authority-python-host-demo.html`

这样用 `bun run preview:editor` 时，Python authority host demo 页面会保留自己的 bootstrap 入口，不会回退成通用 `index.html`。

## GitHub Pages 托管

当前仓库已经补上 editor 的 GitHub Pages 工作流，默认会把 `packages/editor/dist/` 发布到 Pages。

工作流文件：

- `.github/workflows/deploy-editor.yml`

当前行为：

1. workflow 只在“默认分支”上真正执行部署
2. 会自动根据仓库名推导 Vite `base`
3. 普通仓库会使用 `/<repo>/`
4. 如果仓库名本身是 `<user>.github.io`，则自动使用根路径 `/`

启用方式：

1. 把当前仓库推到 GitHub
2. 进入 `Settings -> Pages`
3. 在 `Build and deployment` 里选择 `GitHub Actions`
4. 再次推送默认分支，或手动触发 `Deploy Editor to GitHub Pages`

补充说明：

- editor 仍然是静态页面，适合 GitHub Pages
- 页面里的“本地 bundle 文件选择”和浏览器持久化在 Pages 上可以继续使用
- authority demo 若依赖本地或远程后端，需要你另外准备可访问的后端地址
