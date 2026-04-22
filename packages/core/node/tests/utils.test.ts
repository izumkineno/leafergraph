import { describe, expect, it } from "bun:test";

import { createNodeId } from "../src/utils";

describe("@leafergraph/core/node utils", () => {
  it("createNodeId 会跳过调用方声明的保留 ID", () => {
    const firstId = createNodeId("demo/task");
    const match = /^demo-task-(\d+)$/.exec(firstId);

    if (!match) {
      throw new Error(`unexpected node id format: ${firstId}`);
    }

    const nextSeed = Number(match[1]) + 1;
    const reservedId = `demo-task-${nextSeed}`;

    const guardedId = createNodeId("demo/task", [reservedId]);

    expect(guardedId).not.toBe(reservedId);
    expect(guardedId).toBe(`demo-task-${nextSeed + 1}`);
  });
});
