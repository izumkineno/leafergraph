/**
 * 右键菜单 DOM 主题 token 模块。
 *
 * @remarks
 * 这组 token 专门服务 DOM 菜单渲染层，
 * 不承担图节点或 Widget 的画布内视觉语义。
 */

/**
 * 右键菜单 DOM 主题 token。
 */
export interface LeaferGraphContextMenuThemeTokens {
  /** 菜单整体使用的字体族。 */
  fontFamily: string;
  /** 菜单面板背景色。 */
  background: string;
  /** 菜单面板边框色。 */
  panelBorder: string;
  /** 菜单面板阴影。 */
  shadow: string;
  /** 主文本颜色。 */
  color: string;
  /** 次级提示文本颜色。 */
  muted: string;
  /** 菜单项 hover 背景色。 */
  hoverBackground: string;
  /** 危险操作文本或强调色。 */
  danger: string;
  /** 分隔线颜色。 */
  separator: string;
  /** 勾选图标颜色。 */
  check: string;
  /** 面板圆角。 */
  panelRadius: number;
  /** 面板内边距。 */
  panelPadding: number;
  /** 面板最小宽度。 */
  panelMinWidth: number;
  /** 面板最大宽度。 */
  panelMaxWidth: number;
  /** 单个菜单项圆角。 */
  itemRadius: number;
  /** 菜单项横向内边距。 */
  itemPaddingX: number;
  /** 菜单项纵向内边距。 */
  itemPaddingY: number;
  /** 分组标题横向内边距。 */
  groupLabelPaddingX: number;
  /** 分组标题上内边距。 */
  groupLabelPaddingTop: number;
  /** 分组标题下内边距。 */
  groupLabelPaddingBottom: number;
}
