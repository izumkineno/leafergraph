import { BaseNode } from "@leafergraph/authoring";

import {
  readWidgetBoolean,
  readWidgetNumber,
  readWidgetString,
  toDisplayText,
  updateStatus
} from "../helpers";
import {
  AUTHORING_BASIC_NODE_TYPES,
  createStatusWidgetSpec
} from "../shared";
import { setNodeTitle } from "./shared";

export class TimeNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.time,
    title: "Time",
    category: "Basic/Primitives",
    outputs: [
      { name: "in ms", type: "number" },
      { name: "in sec", type: "number" }
    ],
    widgets: [
      createStatusWidgetSpec({
        label: "Clock",
        description: "Browser uptime snapshot"
      })
    ]
  };

  onExecute(ctx) {
    const seconds = performance.now() / 1000;
    ctx.setOutput("in ms", seconds * 1000);
    ctx.setOutput("in sec", seconds);
    setNodeTitle(ctx.node, "Time");
    updateStatus(ctx, `CLOCK\n${toDisplayText(seconds)} s`);
  }
}

export class ConstantNumberNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.constNumber,
    title: "Const Number",
    category: "Basic/Primitives",
    outputs: [{ name: "value", type: "number" }],
    properties: [{ name: "value", type: "number", default: 1 }],
    widgets: [
      {
        type: "input",
        name: "value",
        value: "1",
        options: {
          label: "Value",
          placeholder: "1"
        }
      }
    ]
  };

  onExecute(ctx) {
    const value = readWidgetNumber(ctx, "value", 1);
    ctx.setProp("value", value);
    ctx.setOutput("value", value);
    setNodeTitle(ctx.node, `Const ${toDisplayText(value)}`);
  }
}

export class ConstantBooleanNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.constBoolean,
    title: "Const Boolean",
    category: "Basic/Primitives",
    inputs: [{ name: "toggle", type: "event", optional: true }],
    outputs: [{ name: "bool", type: "boolean" }],
    properties: [{ name: "value", type: "boolean", default: true }],
    widgets: [
      {
        type: "toggle",
        name: "value",
        value: true,
        options: {
          label: "Value",
          onText: "TRUE",
          offText: "FALSE"
        }
      }
    ]
  };

  onExecute(ctx) {
    const value = readWidgetBoolean(ctx, "value", true);
    ctx.setProp("value", value);
    ctx.setOutput("bool", value);
    setNodeTitle(ctx.node, `Boolean ${value ? "TRUE" : "FALSE"}`);
  }

  onAction(action, _param, _options, ctx) {
    if (action !== "toggle") {
      return;
    }

    const nextValue = !readWidgetBoolean(ctx, "value", true);
    ctx.setWidget("value", nextValue);
    ctx.setProp("value", nextValue);
    setNodeTitle(ctx.node, `Boolean ${nextValue ? "TRUE" : "FALSE"}`);
  }
}

export class ConstantStringNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.constString,
    title: "Const String",
    category: "Basic/Primitives",
    outputs: [{ name: "string", type: "string" }],
    properties: [{ name: "value", type: "string", default: "" }],
    widgets: [
      {
        type: "textarea",
        name: "value",
        value: "",
        options: {
          label: "Value",
          rows: 3,
          placeholder: "Type any string"
        }
      }
    ]
  };

  onExecute(ctx) {
    const value = readWidgetString(ctx, "value", "");
    ctx.setProp("value", value);
    ctx.setOutput("string", value);
    setNodeTitle(
      ctx.node,
      value ? `String ${toDisplayText(value, 22)}` : "Const String"
    );
  }
}

export class ConstantObjectNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.constObject,
    title: "Const Object",
    category: "Basic/Primitives",
    outputs: [{ name: "obj", type: "object" }],
    widgets: [
      createStatusWidgetSpec({
        label: "Object",
        description: "Shared mutable object reference"
      })
    ]
  };

  createState() {
    return {
      value: {} as Record<string, unknown>
    };
  }

  onExecute(ctx) {
    ctx.setOutput("obj", ctx.state.value);
    updateStatus(ctx, `OBJECT\n${toDisplayText(ctx.state.value)}`);
  }
}

export const authoringBasicPrimitiveNodeClasses = [
  TimeNode,
  ConstantNumberNode,
  ConstantBooleanNode,
  ConstantStringNode,
  ConstantObjectNode
] as const;
