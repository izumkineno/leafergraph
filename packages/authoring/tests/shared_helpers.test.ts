import { describe, expect, it } from "bun:test";

import {
  clonePropertySpec as nodeClonePropertySpec,
  clonePropertySpecs as nodeClonePropertySpecs,
  cloneRecord as nodeCloneRecord,
  cloneSlotSpec as nodeCloneSlotSpec,
  cloneSlotSpecs as nodeCloneSlotSpecs,
  cloneValue as nodeCloneValue,
  cloneWidgetSpec as nodeCloneWidgetSpec,
  cloneWidgetSpecs as nodeCloneWidgetSpecs
} from "@leafergraph/node";

import {
  clonePropertySpec,
  clonePropertySpecs,
  cloneRecord,
  cloneSlotSpec,
  cloneSlotSpecs,
  cloneValue,
  cloneWidgetSpec,
  cloneWidgetSpecs
} from "../src/shared";

describe("@leafergraph/authoring shared helpers", () => {
  it("re-exports the node clone helpers directly", () => {
    expect(cloneValue).toBe(nodeCloneValue);
    expect(cloneRecord).toBe(nodeCloneRecord);
    expect(cloneSlotSpec).toBe(nodeCloneSlotSpec);
    expect(cloneSlotSpecs).toBe(nodeCloneSlotSpecs);
    expect(cloneWidgetSpec).toBe(nodeCloneWidgetSpec);
    expect(cloneWidgetSpecs).toBe(nodeCloneWidgetSpecs);
    expect(clonePropertySpec).toBe(nodeClonePropertySpec);
    expect(clonePropertySpecs).toBe(nodeClonePropertySpecs);
  });
});
