# `leafergraph-editor`

`packages/editor` 是 LeaferGraph 的编辑器壳层，负责 UI 组合、状态编排、authority 接线、bundle 装载与 demo 装配。  
底层图模型、渲染宿主与运行时能力不在这里重写，主要来自 `leafergraph` 与 `@leafergraph/node`。

## 深入文档

- [架构总览](./ARCHITECTURE.md)
- [全量文件索引](./FILE_INDEX.md)

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

- `packages/editor`
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
