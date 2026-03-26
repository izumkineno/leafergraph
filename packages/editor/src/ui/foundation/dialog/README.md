# `src/ui/foundation/dialog`

## 作用
- 提供 editor 统一对话框视图和 Connected 命名入口。

## 边界
- 负责基础弹窗结构、尺寸和样式。
- 不负责业务态管理。

## 核心入口
- `View.tsx`
- `Connected.tsx`
- `types.ts`

## 推荐阅读顺序
1. `View.tsx`
2. `types.ts`
3. `Connected.tsx`

## 上下游关系
- 上游：`shell/provider.tsx`、各区域业务组件。
- 下游：工作区设置、运行控制台等对话框。