# `src/session`

## 作用
- 承接 authority OpenRPC、transport、client、document session 和 viewport binding。
- 这是 editor 对“正式图文档会话”最核心的一层。

## 边界
- 负责文档快照、pending 队列、authority 确认和重同步语义。
- 不负责 UI 组织和 graph kernel 本身。

## 核心入口
- `graph_document_session.ts`
- `graph_document_session_binding.ts`
- `graph_document_authority_transport.ts`
- `authority_openrpc/README.md`

## 主要数据流 / 调用链
1. transport / client 从 authority 接收正式文档和通知。
2. session 维护当前文档、pending 操作和 authority confirmation。
3. viewport binding 把 session 与 `LeaferGraph` 实例接到一起。

## 生成目录说明
- `authority_openrpc/_generated/` 是基于共享 OpenRPC 真源自动生成的协议产物。
- 这里不做人肉注释修改；如需更新，执行 `bun run generate:authority-openrpc`。

## 推荐阅读顺序
1. `authority_openrpc/README.md`
2. `graph_document_authority_transport.ts`
3. `graph_document_session.ts`
4. `graph_document_session_binding.ts`

## 上下游关系
- 上游：`backend/authority`、`demo/*`。
- 下游：`ui/viewport/View.tsx`、`commands/command_bus.ts`。