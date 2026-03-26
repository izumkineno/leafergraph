# `src/ui/run-console`

## 作用
- 承接运行控制台区域的 UI 入口。

## 边界
- 负责展示运行摘要、执行链、失败聚合和焦点节点运行态。
- 不直接维护运行反馈采集逻辑。

## 核心入口
- `Connected.tsx`
- `View.tsx`
- `types.ts`

## 推荐阅读顺序
1. `Connected.tsx`
2. `View.tsx`
3. `../viewport/runtime_collections.ts`

## 上下游关系
- 上游：`shell/provider.tsx`、`viewport` 回传的 `workspaceState`。
- 下游：运行对话框展示。