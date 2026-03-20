import { EditorStatusbar } from "../../shell/provider";
import type { EditorStatusbarViewProps } from "./types";

/**
 * 过渡期 View：当前复用官方连接态 Statusbar。
 */
export function EditorStatusbarView(_: EditorStatusbarViewProps) {
  return <EditorStatusbar />;
}
