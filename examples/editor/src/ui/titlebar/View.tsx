/**
 * 视图组件模块。
 *
 * @remarks
 * 负责承接当前区域的纯展示结构与交互回调，尽量把运行时编排留在 Connected 组件或 shell 层处理。
 */
import type { EditorTitlebarViewProps } from "./types";
import { EditorTitlebar } from "../../shell/provider";

/**
 * 过渡期 View：当前复用官方连接态 Titlebar。
 * 后续会继续收敛成纯 props 视图层。
 */
export function EditorTitlebarView(_: EditorTitlebarViewProps) {
  return <EditorTitlebar />;
}
