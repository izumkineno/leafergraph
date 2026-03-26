# `src/ui/statusbar`

## 作用
- 承接底部状态栏区域的 UI 入口。

## 边界
- 负责展示精简状态摘要。
- 不负责构造运行时或 authority 摘要本身。

## 核心入口
- `Connected.tsx`
- `View.tsx`
- `types.ts`

## 推荐阅读顺序
1. `Connected.tsx`
2. `View.tsx`
3. `../viewport/runtime_status.ts`

## 上下游关系
- 上游：`shell/provider.tsx`、`viewport` 运行态摘要。
- 下游：shell 底栏区域。