# `src/backend/authority`

## 作用
- 收口 remote authority 的来源解析、host adapter 注册和 app runtime 装配。
- 让 MessagePort、Worker、Window、WebSocket 等不同来源共享同一 editor 接线入口。

## 边界
- 负责把宿主差异变成统一 source/runtime。
- 不直接维护 document pending 队列，也不直接操作画布。

## 核心入口
- `remote_authority_app_runtime.ts`
- `remote_authority_host_adapter.ts`

## 主要数据流 / 调用链
1. 页面或 demo 提供 authority source / adapter。
2. `remote_authority_host_adapter.ts` 解析 descriptor。
3. `remote_authority_app_runtime.ts` 创建 client、session binding 和反馈入口。

## 推荐阅读顺序
1. `remote_authority_host_adapter.ts`
2. `remote_authority_app_runtime.ts`

## 上下游关系
- 上游：`src/app`、`src/demo`。
- 下游：`src/session`、`src/shell/provider.tsx`。