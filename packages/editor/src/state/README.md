# `src/state`

## 作用
- 存放 editor 仍以轻量 controller 形式维护的局部状态模型。

## 边界
- 负责局部状态控制器，例如节点选区。
- 不负责全局 UI 编排或 authority 会话。

## 核心入口
- `selection.ts`

## 主要数据流 / 调用链
1. `GraphViewport` 创建选择控制器。
2. 命令总线和交互桥读写当前选区。
3. inspector、statusbar 和 toolbar 订阅选区快照。

## 推荐阅读顺序
1. `selection.ts`

## 上下游关系
- 上游：`ui/viewport/View.tsx`。
- 下游：`commands/*`、`app/WorkspacePanels.tsx`。