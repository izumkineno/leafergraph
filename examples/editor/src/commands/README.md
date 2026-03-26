# `src/commands`

## 作用
- 收口 editor 的命令总线、命令历史、节点/连线/画布控制器和剪贴板协议。
- 统一承接 toolbar、context menu、快捷键和交互提交产生的用户意图。

## 边界
- 负责“用户想做什么”的命令表达与分发。
- 不重复实现 LeaferGraph runtime，也不维护 authority transport。

## 核心入口
- `command_bus.ts`
- `command_history.ts`
- `node_commands.ts`
- `link_commands.ts`
- `canvas_commands.ts`

## 主要数据流 / 调用链
1. UI 或画布交互生成命令请求。
2. `command_bus.ts` 分发到具体控制器。
3. 控制器调用 graph API 或生成 `GraphOperation`。
4. 结果回流到 history、selection 和 session。

## 推荐阅读顺序
1. `command_bus.ts`
2. `node_commands.ts`
3. `link_commands.ts`
4. `canvas_commands.ts`
5. `clipboard_payload.ts`

## 上下游关系
- 上游：`ui/viewport/View.tsx`、`menu/*`、`interaction/*`。
- 下游：`leafergraph`、`session/graph_document_session.ts`。