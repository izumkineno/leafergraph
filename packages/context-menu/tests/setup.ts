import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({
  url: "http://localhost/"
});

class FakeCanvasRenderingContext2D {}
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
