import { describe, expect, it } from "bun:test";

import {
  clonePropertySpec,
  clonePropertySpecs,
  cloneRecord,
  cloneSlotSpec,
  cloneSlotSpecs,
  cloneValue,
  cloneWidgetSpec,
  cloneWidgetSpecs
} from "../src";

describe("@leafergraph/node shared clone helpers", () => {
  it("deep-clones nested values without sharing references", () => {
    const original = {
      meta: {
        flag: true,
        nested: {
          numbers: [1, 2, 3],
          deep: [{ label: "x" }]
        }
      }
    };

    const cloned = cloneValue(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.meta).not.toBe(original.meta);
    expect(cloned.meta.nested).not.toBe(original.meta.nested);
    expect(cloned.meta.nested.numbers).not.toBe(original.meta.nested.numbers);
    expect(cloned.meta.nested.deep).not.toBe(original.meta.nested.deep);

    cloned.meta.nested.deep[0].label = "y";
    expect(original.meta.nested.deep[0].label).toBe("x");
  });

  it("clones spec helpers recursively and preserves empty or undefined shapes", () => {
    const slotSpec = {
      name: "input",
      data: { meta: { tags: ["a"] } }
    };
    const widgetSpec = {
      type: "demo/widget",
      name: "value",
      value: { numbers: [1, 2] },
      options: { config: { enabled: true } }
    };
    const propertySpec = {
      name: "count",
      default: { deep: ["a"] },
      options: { extra: { note: "hello" } },
      widget: widgetSpec
    };

    const clonedSlot = cloneSlotSpec(slotSpec);
    const clonedWidget = cloneWidgetSpec(widgetSpec);
    const clonedProperty = clonePropertySpec(propertySpec);

    expect(clonedSlot).toEqual(slotSpec);
    expect(clonedSlot).not.toBe(slotSpec);
    expect(clonedSlot.data).not.toBe(slotSpec.data);
    expect(clonedSlot.data?.meta).not.toBe(slotSpec.data?.meta);

    expect(clonedWidget).toEqual(widgetSpec);
    expect(clonedWidget).not.toBe(widgetSpec);
    expect(clonedWidget.value).not.toBe(widgetSpec.value);
    expect(clonedWidget.options).not.toBe(widgetSpec.options);

    expect(clonedProperty).toEqual(propertySpec);
    expect(clonedProperty).not.toBe(propertySpec);
    expect(clonedProperty.default).not.toBe(propertySpec.default);
    expect(clonedProperty.options).not.toBe(propertySpec.options);
    expect(clonedProperty.widget).not.toBe(propertySpec.widget);

    expect(cloneRecord(undefined)).toBeUndefined();
    expect(cloneSlotSpecs(undefined)).toEqual([]);
    expect(cloneWidgetSpecs(undefined)).toEqual([]);
    expect(clonePropertySpecs(undefined)).toEqual([]);
  });
});
