# `src/backend`

## 作用
- 负责把不同 authority 宿主来源装配成 editor 可消费的 backend runtime。
- 对外统一暴露 remote authority source、adapter 与 app runtime 能力。

## 边界
- 负责 authority 来源解析与 runtime 装配。
- 不负责文档会话细节、命令总线和 UI 展示。

## 核心入口
- `authority/remote_authority_app_runtime.ts`
- `authority/remote_authority_host_adapter.ts`
- `../backend.ts`

## 主要数据流 / 调用链
1. bootstrap 提供 source 或 adapter descriptor。
2. backend 装配统一 runtime。
3. `shell/provider.tsx` 消费 runtime，接入 session 与 viewport。

## 推荐阅读顺序
1. `authority/README.md`
2. `authority/remote_authority_host_adapter.ts`
3. `authority/remote_authority_app_runtime.ts`

## 上下游关系
- 上游：`app/editor_app_bootstrap.ts`。
- 下游：`session/*`、`shell/provider.tsx`。