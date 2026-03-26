# `src/ui/workspace-settings`

## 作用
- 承接工作区设置对话框区域的 UI 入口。

## 边界
- 负责 Extensions、Authority、Preferences、Shortcuts 等标签页视图。
- 不直接维护 bundle catalog 或 authority runtime。

## 核心入口
- `Connected.tsx`
- `View.tsx`
- `types.ts`

## 推荐阅读顺序
1. `Connected.tsx`
2. `View.tsx`
3. `../../shell/provider.tsx`

## 上下游关系
- 上游：`shell/provider.tsx`。
- 下游：bundle 管理、authority 重连和偏好设置操作。