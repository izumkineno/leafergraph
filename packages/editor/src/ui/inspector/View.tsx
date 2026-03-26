/**
 * 视图组件模块。
 *
 * @remarks
 * 负责承接当前区域的纯展示结构与交互回调，尽量把运行时编排留在 Connected 组件或 shell 层处理。
 */
import { InspectorPane } from "../../app/WorkspacePanels";
import type { EditorInspectorViewProps } from "./types";

/** 复用 app 层的检查器面板实现，作为 UI 区域的纯视图入口。 */
export function EditorInspectorView(props: EditorInspectorViewProps) {
  return <InspectorPane {...props} />;
}
