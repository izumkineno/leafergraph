/**
 * 连线数据流动画环境适配模块。
 *
 * @remarks
 * 负责所属窗口探测和 `prefers-reduced-motion` 监听兼容。
 */

/**
 * 解析当前容器所属的窗口对象。
 *
 * @param container - 当前图容器。
 * @returns 容器所属窗口；在非浏览器环境下尽量回退到全局窗口。
 */
export function resolveLeaferGraphAnimationOwnerWindow(
  container: HTMLElement
): Window | null {
  return (
    container.ownerDocument.defaultView ??
    (typeof window === "undefined" ? null : window)
  );
}

/**
 * 在支持时监听 `prefers-reduced-motion` 变化。
 *
 * @param mediaQuery - 目标媒体查询。
 * @param listener - 变化监听器。
 * @returns 无返回值。
 */
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

/**
 * 清理 `prefers-reduced-motion` 监听。
 *
 * @param mediaQuery - 目标媒体查询。
 * @param listener - 已注册的监听器。
 * @returns 无返回值。
 */
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

