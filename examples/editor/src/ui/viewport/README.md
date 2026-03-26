# `src/ui/viewport`

## 作用
- 承接 editor 真正的画布执行面：挂载 `LeaferGraph`，接入命令总线、文档会话和运行反馈。

## 边界
- 负责 graph 挂载、session binding、interaction bridge 和对外 host bridge。
- 不负责 authority source 装配和全局 shell 状态编排。

## 核心入口
- `View.tsx`
- `Connected.tsx`
- `types.ts`
- `runtime_collections.ts`
- `runtime_status.ts`
- `runtime_control_notice.ts`

## 主要数据流 / 调用链
1. `Connected.tsx` 注入 `effectiveDocument`、plugins 和 runtime binding。
2. `View.tsx` 创建 `LeaferGraph`、command bus、history、selection 和 session。
3. 运行反馈、authority 投影和交互提交再回流到 provider。

## 推荐阅读顺序
1. `Connected.tsx`
2. `View.tsx`
3. `types.ts`
4. `runtime_collections.ts`
5. `authority_document_projection_gate.ts`

## 上下游关系
- 上游：`shell/provider.tsx`、`backend/authority`、`session/*`。
- 下游：`leafergraph`、`commands/*`、`interaction/*`。