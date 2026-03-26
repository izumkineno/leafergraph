# `src/interaction`

## 作用
- 把 LeaferGraph 画布上的交互提交转换成 editor 命令或正式 `GraphOperation`。

## 边界
- 负责交互提交桥和 widget commit 辅助逻辑。
- 不负责命令历史、authority transport 或 UI 布局。

## 核心入口
- `graph_interaction_commit_bridge.ts`
- `widget_commit_update.ts`

## 主要数据流 / 调用链
1. LeaferGraph 产生交互提交事件。
2. interaction 模块根据类型生成命令或节点更新输入。
3. 命令总线和 session 接着完成文档写入与 authority 确认。

## 推荐阅读顺序
1. `graph_interaction_commit_bridge.ts`
2. `widget_commit_update.ts`

## 上下游关系
- 上游：`leafergraph` 交互提交。
- 下游：`commands/*`、`session/graph_document_session.ts`。