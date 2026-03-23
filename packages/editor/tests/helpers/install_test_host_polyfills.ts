const host = globalThis as Record<string, unknown>;
const localStorageState = new Map<string, string>();

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
host.localStorage ??= {
  getItem(key: string) {
    return localStorageState.has(key) ? localStorageState.get(key)! : null;
  },
  setItem(key: string, value: string) {
    localStorageState.set(key, String(value));
  },
  removeItem(key: string) {
    localStorageState.delete(key);
  },
  clear() {
    localStorageState.clear();
  },
  key(index: number) {
    return [...localStorageState.keys()][index] ?? null;
  },
  get length() {
    return localStorageState.size;
  }
};
host.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {
    return false;
  }
})) as unknown;
host.File ??= class File extends Blob {
  readonly name: string;
  readonly lastModified: number;

  constructor(
    bits: BlobPart[],
    name: string,
    options?: FilePropertyBag
  ) {
    super(bits, options);
    this.name = name;
    this.lastModified = options?.lastModified ?? Date.now();
  }
};
host.DataTransfer ??= class DataTransfer {
  readonly files: File[] = [];
  readonly items = {
    add: () => null
  };
};
