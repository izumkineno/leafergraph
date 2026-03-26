# `src/ui/foundation`

## 作用
- 存放跨区域复用的基础 UI 组件。

## 边界
- 负责通用基础组件，不绑定具体业务区域。
- 当前主要提供 dialog 体系。

## 核心入口
- `dialog/`

## 推荐阅读顺序
1. `dialog/README.md`

## 上下游关系
- 上游：`shell/provider.tsx`。
- 下游：各业务区域对话框。