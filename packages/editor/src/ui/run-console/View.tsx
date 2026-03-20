import { EditorRunConsoleDialog } from "../../shell/provider";
import type { EditorRunConsoleViewProps } from "./types";

/**
 * 过渡期 View：当前复用官方连接态 Run Console。
 */
export function EditorRunConsoleView(_: EditorRunConsoleViewProps) {
  return <EditorRunConsoleDialog />;
}
