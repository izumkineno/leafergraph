# `src/ui/titlebar`

## 作用
- 承接 editor 顶栏区域的 UI 入口。

## 边界
- 负责展示品牌区、文档摘要、命令动作和运行控制入口。
- 不负责命令总线和 graph runtime 的真实执行。

## 核心入口
- `Connected.tsx`
- `View.tsx`
- `types.ts`

## 推荐阅读顺序
1. `Connected.tsx`
2. `View.tsx`
3. `../viewport/types.ts`

## 上下游关系
- 上游：`shell/provider.tsx`、`viewport` 回传的工具栏和运行控制状态。
- 下游：用户命令入口。