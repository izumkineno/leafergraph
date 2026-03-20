import type { EditorTitlebarViewProps } from "./types";
import { EditorTitlebar } from "../../shell/provider";

/**
 * 过渡期 View：当前复用官方连接态 Titlebar。
 * 后续会继续收敛成纯 props 视图层。
 */
export function EditorTitlebarView(_: EditorTitlebarViewProps) {
  return <EditorTitlebar />;
}
