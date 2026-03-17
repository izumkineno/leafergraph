# LeaferGraph Workspace

这个目录是新的 LeaferGraph 实验工程，分成两个 Vite 子项目：

- `packages/leafergraph`
  - 核心库工程
  - 负责提供最小的 LeaferGraph API
- `packages/editor`
  - 编辑器工程
  - 使用 Preact 作为主要控制层，并通过包名 `leafergraph` 引用核心库
  - 当前通过本地 `dist/*.iife.js` bundle 动态加载 demo、node、widget
- `templates/`
  - 可直接复制出去的外部节点 / Widget 模板工程
  - 当前已提供 `templates/node-widget-plugin-template`

## 当前边界

- `packages/leafergraph`
  - 只保留核心图能力、节点运行时、渲染宿主与交互基础设施
  - 不再内建默认 demo 节点、默认 demo 图数据或 editor 专属快速创建模板
  - 主包初始化只接受正式 `graph` 输入，不再提供 `nodes` 这类 demo 级入口
- `packages/editor`
  - 承担 Sandbox、本地 bundle 装载面板和 editor 壳层行为
  - editor 不再源码直连模板工程，而是通过文件选择器读取本地 IIFE 产物

## 常用命令

```bash
bun install
bun run dev:editor
bun run dev:editor:lan
bun run build:testbundles
bun run build
```

## 当前定位

这一版先把工程骨架搭起来：

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
- `docs/节点API方案.md`
  - 节点 API 与节点外壳整合方案
  - 生命周期、注册机制、节点结构与外壳设计说明
- `docs/右键菜单管理方案.md`
  - 基于 Leafer `pointer.menu` 的右键菜单基础设施方案
  - 菜单管理器职责、坐标体系与宿主接入方式

## Editor 本地 Bundle 加载

editor 现在内建一个“本地 Bundle 加载面板”，固定有三个槽位：

- `Widget Bundle`
- `Node Bundle`
- `Demo Bundle`

加载方式不再依赖源码 alias，而是：

1. 在模板工程里构建出 browser IIFE 文件
2. 在 editor 页面用文件选择器选择本地 `dist/browser/*.iife.js`
3. editor 通过 `<script>` 注入这些文件
4. bundle 顶层调用 `LeaferGraphEditorBundleBridge.registerBundle(...)`
5. editor 再把已激活 bundle 组装成 `document + plugins`

推荐加载顺序：

1. `widget.iife.js`
2. `node.iife.js`
3. `demo.iife.js`

这样可以避免 demo 图先落地时缺少依赖节点或 widget。

模板里的 `demo document` 现在也直接使用正式 `GraphDocument` 结构：

- 节点使用可恢复快照语义
- 位置和尺寸走 `layout`
- 展示型字段走 `properties`

如果你修改了模板工程里的 browser bundle，或想刷新 editor 内置联调用的测试 bundle，可执行：

```bash
bun run build:testbundles
```

这条命令会先重建 `templates/node-widget-plugin-template/dist/browser/*`，再同步到 `packages/editor/public/__testbundles/`。

## 模板工程产物

`templates/node-widget-plugin-template` 当前会同时输出两条产物线：

- ESM 包产物
  - `dist/index.js`
  - 适合被其它工程正常 `import`
- browser IIFE 产物
  - `dist/browser/demo.iife.js`
  - `dist/browser/node.iife.js`
  - `dist/browser/widget.iife.js`
  - 适合被 editor 本地文件加载面板直接读取
