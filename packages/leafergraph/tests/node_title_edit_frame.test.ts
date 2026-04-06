import { describe, expect, test } from "bun:test";

import { resolveNodeTitleEditFrame } from "../src/graph/assembly/scene";

describe("resolveNodeTitleEditFrame", () => {
  test("标题编辑框起点会避开左上角信号球", () => {
    const frame = resolveNodeTitleEditFrame({
      titleTarget: {
        x: 38,
        y: 15,
        width: 140
      },
      titleHitArea: {
        height: 46
      },
      signalButton: {
        x: 13,
        width: 22
      }
    });

    expect(frame.offsetX).toBe(5);
    expect(frame.width).toBe(155);
    expect(frame.offsetY).toBe(-9);
    expect(frame.height).toBe(34);
  });
});
