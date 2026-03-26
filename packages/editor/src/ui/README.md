# `src/ui`

## 作用
- 收纳 editor 各个可见区域的 UI 模块。
- 每个区域默认遵循 `Connected.tsx + View.tsx + types.ts + styles.css + README.md + index.ts` 约定。

## 边界
- `Connected` 组件负责接 `EditorProvider`。
- `View` 组件优先保持 props 驱动，不重复持有全局运行态。

## 核心入口
- `titlebar/`
- `workspace/`
- `viewport/`
- `node-library/`
- `inspector/`
- `statusbar/`
- `workspace-settings/`
- `run-console/`
- `node-library-preview/`

## 主要数据流 / 调用链
1. `shell/provider.tsx` 输出 context。
2. `Connected.tsx` 从 context 读取状态和动作。
3. `View.tsx` 完成区域展示和局部交互回调。

## 推荐阅读顺序
1. `viewport/README.md`
2. `workspace/README.md`
3. `titlebar/README.md`
4. `run-console/README.md`
5. `node-library-preview/README.md`

## 上下游关系
- 上游：`src/shell/provider.tsx`。
- 下游：`src/app/WorkspacePanels.tsx`、`leafergraph`。