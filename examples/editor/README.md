# `leafergraph-editor`

`examples/editor` 是 LeaferGraph 的编辑器壳层，负责 UI 组合、状态编排、authority 接线、bundle 装载与 demo 装配。  
底层图模型、渲染宿主与运行时能力不在这里重写，主要来自 `leafergraph` 与 `@leafergraph/node`。

## 深入文档

- [架构总览](./ARCHITECTURE.md)
- [全量文件索引](./FILE_INDEX.md)

## 阅读顺序

如果你想快速建立 editor 的心智模型，推荐按下面顺序阅读：

1. `src/main.tsx`
2. `src/app/editor_app_bootstrap.ts`
3. `src/shell/README.md`
4. `src/shell/provider.tsx`
5. `src/ui/viewport/README.md`
6. `src/ui/viewport/View.tsx`
7. `src/session/README.md`
8. `src/commands/README.md`

## 目录文档地图

- `src/app/README.md`
  - 页面 bootstrap、过渡面板和 authority bundle projection
- `src/backend/README.md`
  - authority source/runtime 装配
- `src/debug/README.md`
  - Leafer debug 初始化、持久化与调试投影
- `src/commands/README.md`
  - 命令总线、历史、剪贴板和节点/连线命令
- `src/demo/README.md`
  - demo authority、Worker 与 WebSocket host demo
- `src/interaction/README.md`
  - 交互提交桥、widget commit 更新与 operation 回填
- `src/loader/README.md`
  - bundle 装载、依赖求解和持久化
- `src/menu/README.md`
  - 右键菜单绑定、上下文解析与创建节点子菜单
- `src/runtime/README.md`
  - 统一运行反馈入口和外部 runtime 回流
- `src/session/README.md`
  - authority 协议、transport、document session 和 binding
- `src/shell/README.md`
  - controller、Provider、自适应布局和 onboarding
- `src/state/README.md`
  - 轻量状态控制器，例如节点选区
- `src/theme/README.md`
  - 主题初始化、画布背景与界面外观入口
- `src/ui/README.md`
  - UI 区域地图与 Connected/View 约定

关键嵌套目录也有独立入口，建议在进入主链路前并行打开：

- `src/backend/authority/README.md`
- `src/session/authority_openrpc/README.md`
- `src/shell/layout/README.md`
- `src/shell/onboarding/README.md`

## 注释约定

- `src/` 下手写 `.ts/.tsx` 文件统一带文件级中文说明。
- 导出的类型、接口、工厂和关键组件优先补中文 JSDoc。
- 超大文件优先补“数据流/生命周期”块注释，而不是机械逐行翻译。
- `_generated/` 生成目录不做人肉注释，改动应回到真源和生成器。

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

## Authority OpenRPC 生成

- `bun run generate:authority-openrpc`
  手动重生成 editor 侧 authority OpenRPC 产物，适合在共享 `authority.openrpc.json` 或 schema 变更后立即同步。
- `bun run check:authority-openrpc`
  只做 stale 校验；若失败，表示共享真源已经变化，但 `src/session/authority_openrpc/_generated/` 还没重新生成。
- `bun run dev`
  现在会先执行一次 `generate:authority-openrpc`，避免 fresh clone 时因为缺少生成物导致 Vite/TS 直接报错。
- `bun run build`
  会先生成 authority OpenRPC 产物，再执行 `tsc + vite build`。

如果 `check:authority-openrpc` 失败，默认处理方式就是重新执行：

```powershell
bun run generate:authority-openrpc
```

### 生成目录说明

- `src/session/authority_openrpc/_generated/` 是 editor 侧 authority OpenRPC 自动生成产物。
- 真源来自仓库根的 `openrpc/`，生成入口是 `tools/generate_from_openrpc.ts`。
- 这类文件不做人肉补注释或手工修补；如果内容过期，重新生成而不是直接编辑。
- 目录级说明放在 `src/session/README.md` 与 `src/session/authority_openrpc/README.md`，便于读代码时先理解生成链和消费方式。

## 包结构

- `src/main.tsx`
  - 浏览器启动入口，负责 bootstrap 解析和挂载 `EditorProvider + EditorShell`
- `src/shell`
  - editor 壳层编排、controller、自适应布局和 onboarding
- `src/ui`
  - 按区域拆分的 Connected/View 组件
- `src/backend`
  - authority source/runtime 装配
- `src/session`
  - authority OpenRPC 协议目录、transport、session binding 与 document session
- `src/loader`
  - bundle manifest、runtime setup 与浏览器持久化
- `src/commands`
  - 命令总线、历史、节点/连线/剪贴板命令
- `src/demo`
  - preview/demo authority bootstrap、worker 和 service
- `tests`
  - authority、bundle、viewport、interaction、clipboard 等主题的测试
- `tools`
  - 构建期工具，当前 authority OpenRPC 生成器位于 `tools/generate_from_openrpc.ts`

## 边界

- `examples/editor`
  - 负责“如何组织一个编辑器”
- `packages/leafergraph`
  - 负责“图如何被渲染、交互、运行和序列化”

如果需要从入口开始阅读，推荐顺序是：

1. `src/main.tsx`
2. `src/app/editor_app_bootstrap.ts`
3. `src/shell/provider.tsx`
4. `src/ui/viewport/View.tsx`
5. `src/loader/runtime.ts`
6. `src/backend/authority/remote_authority_app_runtime.ts`
7. `src/session/graph_document_session.ts`
8. `src/commands/command_bus.ts`
