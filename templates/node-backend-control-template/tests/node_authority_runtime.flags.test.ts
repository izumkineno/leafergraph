import { describe, expect, test } from "bun:test";

import type { AuthorityGraphOperation } from "../src/index.js";
import { createNodeAuthorityRuntime } from "../src/index.js";

function createUpdateFlagsOperation(): AuthorityGraphOperation {
  return {
    type: "node.update",
    nodeId: "node-1",
    input: {
      flags: {
        collapsed: true
      }
    },
    operationId: "authority-update-flags-node-1",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

function createCreateCollapsedNodeOperation(): AuthorityGraphOperation {
  return {
    type: "node.create",
    input: {
      id: "collapsed-node",
      type: "demo.pending",
      x: 24,
      y: 36,
      flags: {
        collapsed: true
      }
    },
    operationId: "authority-create-collapsed-node",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

describe("node authority runtime flags", () => {
  test("应支持 node.update(flags) 与 node.create(flags)", () => {
    const runtime = createNodeAuthorityRuntime({
      authorityName: "flags-test"
    });

    const updateResult = runtime.submitOperation(createUpdateFlagsOperation());
    expect(updateResult.accepted).toBe(true);
    expect(
      updateResult.document?.nodes.find((node) => node.id === "node-1")?.flags
        .collapsed
    ).toBe(true);

    const createResult = runtime.submitOperation(createCreateCollapsedNodeOperation());
    expect(createResult.accepted).toBe(true);
    expect(
      createResult.document?.nodes.find((node) => node.id === "collapsed-node")
        ?.flags.collapsed
    ).toBe(true);
  });
});
