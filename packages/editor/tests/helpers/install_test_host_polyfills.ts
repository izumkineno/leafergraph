const host = globalThis as Record<string, unknown>;

host.window ??= globalThis;
host.CanvasRenderingContext2D ??= class {};
host.Path2D ??= class {};
host.Image ??= class {};
host.ImageData ??= class {};
host.DOMMatrix ??= class {};
host.Event ??= class {};
host.CustomEvent ??= class {};
host.PointerEvent ??= class {};
host.MouseEvent ??= class {};
host.KeyboardEvent ??= class {};
host.FocusEvent ??= class {};
host.WheelEvent ??= class {};
host.DragEvent ??= class {};
host.TouchEvent ??= class {};
host.ClipboardEvent ??= class {};
host.HTMLElement ??= class {};
host.HTMLCanvasElement ??= class {};
host.navigator ??= {
  userAgent: "bun-test"
};
host.requestAnimationFrame ??= ((callback: FrameRequestCallback) =>
  setTimeout(() => callback(Date.now()), 0)) as unknown;
host.cancelAnimationFrame ??= ((handle: number) =>
  clearTimeout(handle)) as unknown;
host.document ??= {
  createElement() {
    return {
      style: {},
      getContext() {
        return {};
      },
      append() {},
      appendChild() {},
      remove() {}
    };
  },
  documentElement: {
    style: {}
  },
  head: {
    append() {},
    appendChild() {}
  },
  body: {
    append() {},
    appendChild() {}
  },
  defaultView: globalThis,
  addEventListener() {},
  removeEventListener() {}
};
