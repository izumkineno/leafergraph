# `src/shell`

## 作用
- 持有 editor 壳层的状态编排中心：controller、provider、自适应布局、onboarding 和偏好设置。

## 边界
- 负责“编辑器如何被组织起来”。
- 不直接重写 graph runtime，也不承担 authority transport 细节。

## 核心入口
- `provider.tsx`
- `editor_controller.ts`
- `layout/README.md`
- `onboarding/README.md`

## 主要数据流 / 调用链
1. `main.tsx` 创建 controller。
2. `EditorProvider` 编排 bundle、authority、workspace 与 viewport bridge。
3. `EditorShell` 组织顶栏、工作区、状态栏和对话框。

## 推荐阅读顺序
1. `editor_controller.ts`
2. `provider.tsx`
3. `layout/README.md`
4. `onboarding/README.md`

## 上下游关系
- 上游：`main.tsx`、`app/editor_app_bootstrap.ts`。
- 下游：`ui/*`、`loader/*`、`backend/*`。