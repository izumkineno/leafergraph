# UI 模块地图

## 目录
- `foundation/`：跨区域基础组件（当前含 dialog）。
- `titlebar/`：顶栏与运行控制入口。
- `workspace/`：主工作区布局。
- `node-library/`：节点库区域。
- `viewport/`：画布与交互挂载。
- `inspector/`：右侧检查器区域。
- `statusbar/`：底部状态摘要。
- `workspace-settings/`：工作区设置面板。
- `run-console/`：运行控制台面板。
- `node-library-preview/`：节点库预览浮层。

## 推荐复用顺序
1. 先引入 `styles.css` 与 `shell`，直接使用 `EditorShell`。
2. 需要局部组合时，优先使用各区域 `Connected` 版本。
3. 需要脱离 provider 时，按区域 README 引入对应 `View` 与最小依赖。

## 依赖规则
- `Connected` 组件默认依赖 `EditorProvider`。
- `View` 组件优先按 props 驱动；过渡期若仍依赖 provider，会在区域 README 明确标注。
