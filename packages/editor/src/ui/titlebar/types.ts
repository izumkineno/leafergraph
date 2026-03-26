/**
 * 类型定义模块。
 *
 * @remarks
 * 负责集中声明当前区域或当前子系统对外复用的 props、状态和辅助类型。
 */
import type { JSX } from "preact";

/** 顶栏视图当前接收的最小 props。 */
export interface EditorTitlebarViewProps {
  children?: JSX.Element | JSX.Element[] | null;
}
