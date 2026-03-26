# `src/runtime`

## 作用
- 定义 editor 统一运行反馈入口，让本地和远端 runtime 事件共用同一消费链。

## 边界
- 负责运行反馈入口抽象。
- 不负责 authority transport、graph 挂载或 UI 展示。

## 核心入口
- `runtime_feedback_inlet.ts`

## 主要数据流 / 调用链
1. backend 或本地运行时产生反馈事件。
2. runtime inlet 统一转交给 `GraphViewport`。
3. `GraphViewport` 再投影到 run console、statusbar 和 inspector。

## 推荐阅读顺序
1. `runtime_feedback_inlet.ts`

## 上下游关系
- 上游：`backend/authority`、本地 graph runtime。
- 下游：`ui/viewport/View.tsx`。