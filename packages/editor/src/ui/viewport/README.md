# Viewport

## 作用
- 承接 LeaferGraph 画布挂载、命令总线、运行控制反馈与会话同步。

## 导出
- `GraphViewport`（View）
- `EditorViewportConnected`
- `GraphViewportProps`
- `GraphViewportHostBridge`
- 运行态集合与状态工具：`runtime_collections` / `runtime_status` / `runtime_control_notice`

## 使用方式
```tsx
import { EditorViewportConnected } from "leafergraph-editor/ui/viewport";
import "leafergraph-editor/ui/viewport/styles.css";
```
