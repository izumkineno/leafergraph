/**
 * 连线数据流动画环境适配模块。
 *
 * @remarks
 * 负责所属窗口探测和 `prefers-reduced-motion` 监听兼容。
 */

export function resolveLeaferGraphAnimationOwnerWindow(
  container: HTMLElement
): Window | null {
  return (
    container.ownerDocument.defaultView ??
    (typeof window === "undefined" ? null : window)
  );
}

export function attachLeaferGraphReducedMotionListener(
  mediaQuery: MediaQueryList | null,
  listener: (event: MediaQueryListEvent) => void
): void {
  if (!mediaQuery) {
    return;
  }

  if ("addEventListener" in mediaQuery) {
    mediaQuery.addEventListener("change", listener);
    return;
  }

  const legacyMediaQuery = mediaQuery as MediaQueryList & {
    addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  };
  legacyMediaQuery.addListener?.(listener);
}

export function detachLeaferGraphReducedMotionListener(
  mediaQuery: MediaQueryList | null,
  listener: (event: MediaQueryListEvent) => void
): void {
  if (!mediaQuery) {
    return;
  }

  if ("removeEventListener" in mediaQuery) {
    mediaQuery.removeEventListener("change", listener);
    return;
  }

  const legacyMediaQuery = mediaQuery as MediaQueryList & {
    removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  };
  legacyMediaQuery.removeListener?.(listener);
}
