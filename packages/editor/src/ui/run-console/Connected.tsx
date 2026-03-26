/**
 * Connected 接线组件模块。
 *
 * @remarks
 * 负责从 EditorProvider 或上层 props 读取当前区域所需状态，再转交给对应的 View 组件。
 */
import { EditorRunConsoleView } from "./View";
import type { EditorRunConsoleViewProps } from "./types";

/** 运行控制台 Connected 组件当前透传纯视图 props。 */
export interface EditorRunConsoleConnectedProps extends EditorRunConsoleViewProps {}

/** 作为运行控制台区域的 Connected 包装，保留统一接线命名。 */
export function EditorRunConsoleConnected(props: EditorRunConsoleConnectedProps) {
  return <EditorRunConsoleView {...props} />;
}
