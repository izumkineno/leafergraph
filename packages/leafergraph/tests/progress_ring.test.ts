import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  buildNodeShellProgressSegmentPath,
  buildNodeShellProgressTrackPath,
  createNodeShellProgressGeometry
} from "../src/node/shell/progress_ring";

describe("node shell progress ring", () => {
  test("builds rounded-rect paths with arc commands", () => {
    const geometry = createNodeShellProgressGeometry({
      x: -4,
      y: -4,
      width: 320,
      height: 180,
      radius: 28
    });

    const trackPath = buildNodeShellProgressTrackPath(geometry);
    const segmentPath = buildNodeShellProgressSegmentPath(geometry, 0.1, 0.35);

    expect(trackPath.startsWith("M ")).toBe(true);
    expect(trackPath).toContain("A ");
    expect(segmentPath).toContain("A ");
  });

  test("does not keep the removed signal cluster fields in shell sources", () => {
    const viewSource = readFileSync(
      new URL("../src/node/shell/view.ts", import.meta.url),
      "utf8"
    );
    const hostSource = readFileSync(
      new URL("../src/node/shell/host.ts", import.meta.url),
      "utf8"
    );

    expect(viewSource.includes("signalBadge")).toBe(false);
    expect(viewSource.includes("signalActivityDot")).toBe(false);
    expect(hostSource.includes("signalBadge")).toBe(false);
    expect(hostSource.includes("signalActivityDot")).toBe(false);
  });
});
