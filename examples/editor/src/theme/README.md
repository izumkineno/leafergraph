# `src/theme`

## 作用
- 维护 editor 主题类型、初始主题解析和画布背景样式决策。

## 边界
- 负责主题偏好和背景文案/样式计算。
- 不负责具体 UI 组件渲染。

## 核心入口
- `index.ts`

## 主要数据流 / 调用链
1. provider 读取初始主题。
2. 主题变化后回写到本地偏好。
3. 画布、预览浮层和 UI 组件按主题选择样式。

## 推荐阅读顺序
1. `index.ts`

## 上下游关系
- 上游：`shell/provider.tsx`。
- 下游：`ui/viewport/View.tsx`、`ui/node-library-preview/View.tsx`、各区域样式。