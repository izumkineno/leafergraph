/**
 * 连线数据流动画颜色工具模块。
 *
 * @remarks
 * 负责动画层颜色混合、透明度曲线和 CSS 颜色解析。
 */

/**
 * 把数值限制到 `0..1`。
 *
 * @param value - 原始数值。
 * @returns 归一后的比例值。
 */
export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * 提供动画层统一使用的 `easeOutCubic` 缓动。
 *
 * @param progress - 原始进度。
 * @returns 缓动后的进度值。
 */
export function easeOutCubic(progress: number): number {
  const safeProgress = clamp01(progress);
  return 1 - Math.pow(1 - safeProgress, 3);
}

/**
 * 把一个颜色朝另一个颜色按比例逼近。
 *
 * @param baseColor - 基础颜色。
 * @param targetColor - 目标颜色。
 * @param ratio - 混合比例。
 * @returns 成功时返回混合后的 CSS `rgba(...)`。
 */
export function mixColorToward(
  baseColor: string,
  targetColor: string,
  ratio: number
): string | null {
  const baseRgba = parseCssColor(baseColor);
  const targetRgba = parseCssColor(targetColor);
  if (!baseRgba || !targetRgba) {
    return null;
  }

  const safeRatio = clamp01(ratio);
  const mixedAlpha = baseRgba.a + (targetRgba.a - baseRgba.a) * safeRatio;

  return formatCssColor({
    r: mixChannel(baseRgba.r, targetRgba.r, safeRatio),
    g: mixChannel(baseRgba.g, targetRgba.g, safeRatio),
    b: mixChannel(baseRgba.b, targetRgba.b, safeRatio),
    a: mixedAlpha
  });
}

/**
 * 根据粒子动画进度解析粒子的整体透明度。
 *
 * @param progress - 当前进度。
 * @param fadeInRatio - 淡入占比。
 * @param fadeOutRatio - 淡出占比。
 * @returns 当前粒子透明度。
 */
export function resolveParticleOpacity(
  progress: number,
  fadeInRatio: number,
  fadeOutRatio: number
): number {
  const safeProgress = clamp01(progress);
  const safeFadeIn = Math.min(Math.max(fadeInRatio, 0.01), 0.5);
  const safeFadeOut = Math.min(Math.max(fadeOutRatio, 0.01), 0.5);

  if (safeProgress <= safeFadeIn) {
    return safeProgress / safeFadeIn;
  }

  if (safeProgress >= 1 - safeFadeOut) {
    return (1 - safeProgress) / safeFadeOut;
  }

  return 1;
}

/**
 * 混合单个色道的数值。
 *
 * @param base - 基础色道值。
 * @param target - 目标色道值。
 * @param ratio - 混合比例。
 * @returns 混合后的色道值。
 */
function mixChannel(base: number, target: number, ratio: number): number {
  return Math.round(base + (target - base) * clamp01(ratio));
}

/**
 * 解析 CSS `#hex/rgb/rgba` 颜色。
 *
 * @param color - 原始 CSS 颜色字符串。
 * @returns 成功时返回 RGBA 结构。
 */
function parseCssColor(
  color: string
): { r: number; g: number; b: number; a: number } | null {
  const normalized = color.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("#")) {
    return parseHexColor(normalized);
  }

  const rgbaMatch = normalized.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i
  );
  if (!rgbaMatch) {
    return null;
  }

  return {
    r: clampColorChannel(Number(rgbaMatch[1])),
    g: clampColorChannel(Number(rgbaMatch[2])),
    b: clampColorChannel(Number(rgbaMatch[3])),
    a: clampAlpha(Number(rgbaMatch[4] ?? 1))
  };
}

/**
 * 解析十六进制颜色。
 *
 * @param color - 十六进制颜色字符串。
 * @returns 成功时返回 RGBA 结构。
 */
function parseHexColor(
  color: string
): { r: number; g: number; b: number; a: number } | null {
  const hex = color.slice(1);
  if (hex.length === 3 || hex.length === 4) {
    const [r, g, b, a = "f"] = hex.split("");
    return {
      r: clampColorChannel(Number.parseInt(r + r, 16)),
      g: clampColorChannel(Number.parseInt(g + g, 16)),
      b: clampColorChannel(Number.parseInt(b + b, 16)),
      a: clampAlpha(Number.parseInt(a + a, 16) / 255)
    };
  }

  if (hex.length === 6 || hex.length === 8) {
    return {
      r: clampColorChannel(Number.parseInt(hex.slice(0, 2), 16)),
      g: clampColorChannel(Number.parseInt(hex.slice(2, 4), 16)),
      b: clampColorChannel(Number.parseInt(hex.slice(4, 6), 16)),
      a: clampAlpha(
        hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1
      )
    };
  }

  return null;
}

/**
 * 把 RGBA 结构重新格式化成 CSS `rgba(...)`。
 *
 * @param color - RGBA 结构。
 * @returns 序列化后的 CSS 颜色。
 */
function formatCssColor(color: {
  r: number;
  g: number;
  b: number;
  a: number;
}): string {
  const alpha = Math.round(clampAlpha(color.a) * 1000) / 1000;
  return `rgba(${clampColorChannel(color.r)}, ${clampColorChannel(color.g)}, ${clampColorChannel(color.b)}, ${alpha})`;
}

/**
 * 限制单个 RGB 色道到 `0..255`。
 *
 * @param value - 原始色道值。
 * @returns 归一后的整数色道值。
 */
function clampColorChannel(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(255, Math.max(0, Math.round(value)));
}

/**
 * 限制透明度到 `0..1`。
 *
 * @param value - 原始透明度。
 * @returns 归一后的透明度。
 */
function clampAlpha(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
}

