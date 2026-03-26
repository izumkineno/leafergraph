# `src/ui/inspector`

## 作用
- 承接右侧检查器区域的 UI 入口。

## 边界
- 当前复用 `app/WorkspacePanels.tsx` 中的检查器实现。
- 负责区域接线，不负责运行时真相本身。

## 核心入口
- `Connected.tsx`
- `View.tsx`
- `types.ts`

## 推荐阅读顺序
1. `Connected.tsx`
2. `View.tsx`
3. `../../app/WorkspacePanels.tsx`

## 上下游关系
- 上游：`shell/provider.tsx`、`viewport` 回传的 `workspaceState`。
- 下游：运行控制台入口、authority 摘要展示。