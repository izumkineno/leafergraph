# `src/shell/layout`

## 作用
- 负责根据窗口宽度和面板开闭状态计算工作区的响应式布局结果。

## 边界
- 负责纯布局决策函数。
- 不负责真实 DOM 布局渲染，也不直接读取 provider 状态以外的数据。

## 核心入口
- `workspace_adaptive.ts`

## 主要数据流 / 调用链
1. `EditorProvider` 监听窗口尺寸。
2. layout 模块计算 adaptive mode、pane presentation 和 stage layout。
3. UI 组件按这些结果决定停靠、抽屉或全屏表现。

## 推荐阅读顺序
1. `workspace_adaptive.ts`

## 上下游关系
- 上游：`shell/provider.tsx`。
- 下游：`ui/workspace`、`ui/node-library`、`ui/inspector`。