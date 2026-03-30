import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({
  url: "http://localhost/"
});

class FakeCanvasRenderingContext2D {
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

if (!("CanvasRenderingContext2D" in globalThis)) {
  Object.assign(globalThis, {
    CanvasRenderingContext2D: FakeCanvasRenderingContext2D
  });
}

if (!("Path2D" in globalThis)) {
  Object.assign(globalThis, {
    Path2D: FakePath2D
  });
}

if (
  "HTMLCanvasElement" in globalThis &&
  typeof HTMLCanvasElement.prototype.getContext !== "function"
) {
  HTMLCanvasElement.prototype.getContext = () =>
    new FakeCanvasRenderingContext2D() as CanvasRenderingContext2D;
}

if (
  "HTMLCanvasElement" in globalThis &&
  HTMLCanvasElement.prototype.getContext &&
  HTMLCanvasElement.prototype.getContext("2d") === null
) {
  HTMLCanvasElement.prototype.getContext = () =>
    new FakeCanvasRenderingContext2D() as CanvasRenderingContext2D;
}
