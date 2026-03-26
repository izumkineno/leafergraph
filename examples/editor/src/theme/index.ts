/**
 * editor 当前阶段只提供亮色 / 暗色两套主题。
 * 后续如果要扩展高对比、品牌定制等模式，可以继续沿用这组基础类型。
 */
export type EditorTheme = "light" | "dark";

/** 主题持久化使用的本地存储 key。 */
export const EDITOR_THEME_STORAGE_KEY = "leafergraph.editor.theme";

/** 画布网格背景统一使用同一组 size，避免切换主题时出现跳变。 */
export const GRAPH_VIEWPORT_BACKGROUND_SIZE = "auto, auto, 20px 20px, auto";

/** 判断任意值是否为合法 editor 主题。 */
export function isEditorTheme(value: unknown): value is EditorTheme {
  return value === "light" || value === "dark";
}

/**
 * 解析 editor 初始主题。
 * 优先级如下：
 * 1. 用户上次手动选择
 * 2. 系统 `prefers-color-scheme`
 * 3. 默认暗色
 */
export function resolveInitialEditorTheme(): EditorTheme {
  if (typeof window === "undefined") {
    return "dark";
  }

  const savedTheme = window.localStorage.getItem(EDITOR_THEME_STORAGE_KEY);
  if (isEditorTheme(savedTheme)) {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * 返回画布容器应使用的背景。
 * 这里单独维护，是因为 LeaferGraph 当前会直接写宿主容器背景，
 * editor 侧需要一个稳定入口在不重建实例的情况下同步主题。
 */
export function resolveGraphViewportBackground(theme: EditorTheme): string {
  if (theme === "dark") {
    return [
      "radial-gradient(circle at top left, rgba(125, 211, 252, 0.16), transparent 24%)",
      "radial-gradient(circle at bottom right, rgba(255, 138, 91, 0.12), transparent 24%)",
      "radial-gradient(circle at center, rgba(255, 255, 255, 0.05) 1px, transparent 1px)",
      "linear-gradient(180deg, #09111d 0%, #0f1727 100%)"
    ].join(", ");
  }

  return [
    "radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 30%)",
    "radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.14), transparent 28%)",
    "radial-gradient(circle at center, rgba(15, 23, 42, 0.06) 1px, transparent 1px)",
    "linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%)"
  ].join(", ");
}
