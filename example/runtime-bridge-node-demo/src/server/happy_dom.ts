import { GlobalRegistrator } from "@happy-dom/global-registrator";

let headlessDomBootstrapped = false;

class FakeCanvasRenderingContext2D {
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  arc() {}
  arcTo() {}
  ellipse() {}
  rect() {}
  fill() {}
  stroke() {}
  clip() {}
  save() {}
  restore() {}
  translate() {}
  scale() {}
  rotate() {}
  clearRect() {}
  fillRect() {}
  strokeRect() {}
  setTransform() {}
  resetTransform() {}
  setLineDash() {}
  getLineDash() {
    return [];
  }
  createLinearGradient() {
    return {
      addColorStop() {}
    };
  }
  createRadialGradient() {
    return {
      addColorStop() {}
    };
  }
  createPattern() {
    return null;
  }
  drawImage() {}
  measureText(text = "") {
    return {
      width: String(text).length * 8,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: String(text).length * 8,
      fontBoundingBoxAscent: 8,
      fontBoundingBoxDescent: 2
    };
  }
}

class FakePath2D {}

function defineCanvasGlobal(name: string, value: unknown): void {
  const targets: unknown[] = [globalThis];
  const globalObject = globalThis as typeof globalThis & {
    global?: typeof globalThis;
    self?: typeof globalThis;
    window?: typeof globalThis;
  };

  if (globalObject.global) {
    targets.push(globalObject.global);
  }
  if (globalObject.self) {
    targets.push(globalObject.self);
  }
  if (globalObject.window) {
    targets.push(globalObject.window);
  }

  for (const target of targets) {
    if (!target || typeof target !== "object") {
      continue;
    }

    Object.defineProperty(target, name, {
      configurable: true,
      writable: true,
      value
    });
  }
}

/**
 * 初始化 Node authority 需要的最小 DOM 环境。
 *
 * @returns 无返回值。
 */
export function ensureRuntimeBridgeDemoHeadlessDom(): void {
  if (headlessDomBootstrapped) {
    return;
  }

  GlobalRegistrator.register({
    url: "http://127.0.0.1/"
  });

  defineCanvasGlobal(
    "CanvasRenderingContext2D",
    FakeCanvasRenderingContext2D
  );

  defineCanvasGlobal("Path2D", FakePath2D);

  const fakeGetContext = (() =>
    new FakeCanvasRenderingContext2D() as unknown as CanvasRenderingContext2D) as
    unknown as HTMLCanvasElement["getContext"];

  if (
    "HTMLCanvasElement" in globalThis &&
    typeof HTMLCanvasElement.prototype.getContext !== "function"
  ) {
    (
      HTMLCanvasElement.prototype as unknown as {
        getContext: HTMLCanvasElement["getContext"];
      }
    ).getContext = fakeGetContext;
  }

  if (
    "HTMLCanvasElement" in globalThis &&
    HTMLCanvasElement.prototype.getContext &&
    HTMLCanvasElement.prototype.getContext("2d") === null
  ) {
    (
      HTMLCanvasElement.prototype as unknown as {
        getContext: HTMLCanvasElement["getContext"];
      }
    ).getContext = fakeGetContext;
  }

  headlessDomBootstrapped = true;
}

/**
 * 创建 headless authority 使用的固定尺寸容器。
 *
 * @returns 当前容器。
 */
export function createRuntimeBridgeDemoContainer(): HTMLDivElement {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", {
    configurable: true,
    value: 1440
  });
  Object.defineProperty(container, "clientHeight", {
    configurable: true,
    value: 900
  });
  container.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1440,
      bottom: 900,
      width: 1440,
      height: 900,
      toJSON() {
        return this;
      }
    }) as DOMRect;
  document.body.appendChild(container);
  return container;
}
