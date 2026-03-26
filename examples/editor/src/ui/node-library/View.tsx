/**
 * 视图组件模块。
 *
 * @remarks
 * 负责承接当前区域的纯展示结构与交互回调，尽量把运行时编排留在 Connected 组件或 shell 层处理。
 */
import { NodeLibraryPane } from "../../app/WorkspacePanels";
import type { EditorNodeLibraryViewProps } from "./types";

/** 复用 app 层的节点库面板实现，作为 UI 区域的纯视图入口。 */
export function EditorNodeLibraryView(props: EditorNodeLibraryViewProps) {
  return <NodeLibraryPane {...props} />;
}
