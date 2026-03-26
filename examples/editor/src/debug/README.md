# `src/debug`

## 作用
- 管理 Leafer Debug 设置的默认值、持久化、归一化和运行时投影。

## 边界
- 负责 editor 对 Leafer Debug 的本地偏好和运行时同步。
- 不负责实际画布挂载或 UI 渲染。

## 核心入口
- `leafer_debug.ts`

## 主要数据流 / 调用链
1. `shell/provider.tsx` 读取初始偏好。
2. `GraphViewport` 和预览浮层在挂载时应用设置。
3. 设置变化后回写到 localStorage 和 Leafer Debug 全局对象。

## 推荐阅读顺序
1. `leafer_debug.ts`

## 上下游关系
- 上游：`shell/provider.tsx`。
- 下游：`ui/viewport/View.tsx`、`ui/node-library-preview/View.tsx`。