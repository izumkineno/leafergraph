import type { LeaferGraphThemeMode } from "../../plugin";
import type { BasicWidgetTheme } from "./types";

/**
 * 亮暗两套基础控件主题。
 * 控件视觉刻意做成“专业编辑器面板”语义，而不是纯装饰玻璃块：
 * - 字段使用明确边框和焦点环
 * - 菜单和按钮拥有稳定的层次
 * - 暗色模式强调低眩光，亮色模式强调清晰轮廓
 */
export function resolveBasicWidgetTheme(mode: LeaferGraphThemeMode): BasicWidgetTheme {
  if (mode === "dark") {
    return {
      fontFamily: '"Inter", "IBM Plex Sans", "Segoe UI", sans-serif',
      labelFill: "#94A3B8",
      valueFill: "#F8FAFC",
      mutedFill: "#64748B",
      disabledFill: "#64748B",
      fieldFill: "rgba(15, 23, 42, 0.68)",
      fieldHoverFill: "rgba(15, 23, 42, 0.82)",
      fieldFocusFill: "rgba(15, 23, 42, 0.9)",
      fieldStroke: "rgba(148, 163, 184, 0.24)",
      fieldHoverStroke: "rgba(148, 163, 184, 0.44)",
      fieldFocusStroke: "#60A5FA",
      fieldDisabledFill: "rgba(15, 23, 42, 0.42)",
      fieldDisabledStroke: "rgba(100, 116, 139, 0.2)",
      fieldRadius: 10,
      fieldShadow: "0 10px 24px rgba(2, 6, 23, 0.24)",
      focusRing: "rgba(96, 165, 250, 0.22)",
      separatorFill: "rgba(148, 163, 184, 0.18)",
      trackFill: "rgba(51, 65, 85, 0.88)",
      trackActiveFill: "#38BDF8",
      thumbFill: "#E2E8F0",
      thumbStroke: "#0EA5E9",
      menuFill: "rgba(15, 23, 42, 0.96)",
      menuStroke: "rgba(148, 163, 184, 0.2)",
      menuShadow: "0 24px 40px rgba(2, 6, 23, 0.42)",
      menuTextFill: "#E2E8F0",
      menuMutedFill: "#94A3B8",
      menuActiveFill: "rgba(56, 189, 248, 0.18)",
      menuActiveTextFill: "#F8FAFC",
      menuDangerFill: "rgba(248, 113, 113, 0.16)",
      buttonPrimaryFill: "#0284C7",
      buttonPrimaryHoverFill: "#0EA5E9",
      buttonSecondaryFill: "rgba(51, 65, 85, 0.92)",
      buttonSecondaryHoverFill: "rgba(71, 85, 105, 0.96)",
      buttonGhostFill: "rgba(255, 255, 255, 0.001)",
      buttonGhostHoverFill: "rgba(148, 163, 184, 0.12)",
      buttonTextFill: "#F8FAFC",
      buttonGhostTextFill: "#CBD5E1",
      accentFallback: "#38BDF8"
    };
  }

  return {
    fontFamily: '"Inter", "IBM Plex Sans", "Segoe UI", sans-serif',
    labelFill: "#475569",
    valueFill: "#0F172A",
    mutedFill: "#94A3B8",
    disabledFill: "#94A3B8",
    fieldFill: "#FFFFFF",
    fieldHoverFill: "#FFFFFF",
    fieldFocusFill: "#FFFFFF",
    fieldStroke: "rgba(148, 163, 184, 0.22)",
    fieldHoverStroke: "rgba(96, 165, 250, 0.32)",
    fieldFocusStroke: "#3B82F6",
    fieldDisabledFill: "#F8FAFC",
    fieldDisabledStroke: "rgba(203, 213, 225, 0.7)",
    fieldRadius: 10,
    fieldShadow: "0 0 0 rgba(15, 23, 42, 0)",
    focusRing: "rgba(59, 130, 246, 0.16)",
    separatorFill: "rgba(203, 213, 225, 0.88)",
    trackFill: "rgba(203, 213, 225, 0.92)",
    trackActiveFill: "#2563EB",
    thumbFill: "#FFFFFF",
    thumbStroke: "#2563EB",
    menuFill: "rgba(255, 255, 255, 0.98)",
    menuStroke: "rgba(203, 213, 225, 0.82)",
    menuShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
    menuTextFill: "#0F172A",
    menuMutedFill: "#64748B",
    menuActiveFill: "rgba(37, 99, 235, 0.1)",
    menuActiveTextFill: "#0F172A",
    menuDangerFill: "rgba(239, 68, 68, 0.12)",
    buttonPrimaryFill: "#2563EB",
    buttonPrimaryHoverFill: "#1D4ED8",
    buttonSecondaryFill: "#FCFDFE",
    buttonSecondaryHoverFill: "#F8FAFC",
    buttonGhostFill: "rgba(255, 255, 255, 0.001)",
    buttonGhostHoverFill: "rgba(148, 163, 184, 0.08)",
    buttonTextFill: "#FFFFFF",
    buttonGhostTextFill: "#334155",
    accentFallback: "#2563EB"
  };
}
