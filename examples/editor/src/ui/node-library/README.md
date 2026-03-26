# `src/ui/node-library`

## 作用
- 承接左侧节点库区域的 UI 入口。

## 边界
- 当前复用 `app/WorkspacePanels.tsx` 中的节点库实现。
- 负责区域接线、搜索和 hover 预览请求派发。

## 核心入口
- `Connected.tsx`
- `View.tsx`
- `types.ts`

## 推荐阅读顺序
1. `Connected.tsx`
2. `View.tsx`
3. `../../app/WorkspacePanels.tsx`
4. `../node-library-preview/README.md`

## 上下游关系
- 上游：`shell/provider.tsx`、`loader/runtime.ts`。
- 下游：工作区创建节点、节点库预览浮层。