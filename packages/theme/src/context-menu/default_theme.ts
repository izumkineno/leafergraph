import type { LeaferGraphThemeMode } from "../types";
import type { LeaferGraphContextMenuThemeTokens } from "./types";

/** 根据主题模式解析默认右键菜单主题。 */
export function resolveDefaultContextMenuTheme(
  mode: LeaferGraphThemeMode
): LeaferGraphContextMenuThemeTokens {
  if (mode === "dark") {
    return {
      fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      background: "rgba(15, 23, 42, 0.95)",
      panelBorder: "rgba(148, 163, 184, 0.22)",
      shadow: "0 22px 48px rgba(2, 6, 23, 0.42)",
      color: "#E2E8F0",
      muted: "#94A3B8",
      hoverBackground: "rgba(96, 165, 250, 0.18)",
      danger: "#FDA29B",
      separator: "rgba(148, 163, 184, 0.18)",
      check: "#93C5FD",
      panelRadius: 14,
      panelPadding: 8,
      panelMinWidth: 220,
      panelMaxWidth: 320,
      itemRadius: 10,
      itemPaddingX: 12,
      itemPaddingY: 10,
      groupLabelPaddingX: 12,
      groupLabelPaddingTop: 6,
      groupLabelPaddingBottom: 4
    };
  }

  return {
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    background: "rgba(255, 255, 255, 0.96)",
    panelBorder: "rgba(15, 23, 42, 0.08)",
    shadow: "0 18px 42px rgba(15, 23, 42, 0.18)",
    color: "#0F172A",
    muted: "#64748B",
    hoverBackground: "rgba(37, 99, 235, 0.12)",
    danger: "#B42318",
    separator: "rgba(148, 163, 184, 0.22)",
    check: "#2563EB",
    panelRadius: 14,
    panelPadding: 8,
    panelMinWidth: 220,
    panelMaxWidth: 320,
    itemRadius: 10,
    itemPaddingX: 12,
    itemPaddingY: 10,
    groupLabelPaddingX: 12,
    groupLabelPaddingTop: 6,
    groupLabelPaddingBottom: 4
  };
}
