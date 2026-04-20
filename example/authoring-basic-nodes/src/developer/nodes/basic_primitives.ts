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

/**
 * 封装 TimeNode 的节点行为。
 */
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

  /**
   * 处理 `onExecute` 相关逻辑。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onExecute(ctx) {
    const seconds = performance.now() / 1000;
    ctx.setOutput("in ms", seconds * 1000);
    ctx.setOutput("in sec", seconds);
    setNodeTitle(ctx.node, "Time");
    updateStatus(ctx, `CLOCK\n${toDisplayText(seconds)} s`);
  }
}

/**
 * 封装 ConstantNumberNode 的节点行为。
 */
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

  /**
   * 处理 `onExecute` 相关逻辑。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onExecute(ctx) {
    const value = readWidgetNumber(ctx, "value", 1);
    ctx.setProp("value", value);
    ctx.setOutput("value", value);
    setNodeTitle(ctx.node, `Const ${toDisplayText(value)}`);
  }
}

/**
 * 封装 ConstantBooleanNode 的节点行为。
 */
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

  /**
   * 处理 `onExecute` 相关逻辑。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onExecute(ctx) {
    const value = readWidgetBoolean(ctx, "value", true);
    ctx.setProp("value", value);
    ctx.setOutput("bool", value);
    setNodeTitle(ctx.node, `Boolean ${value ? "TRUE" : "FALSE"}`);
  }

  /**
   * 处理 `onAction` 相关逻辑。
   *
   * @param action - 动作。
   * @param _param - 参数。
   * @param _options - 可选配置项。
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
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

/**
 * 封装 ConstantStringNode 的节点行为。
 */
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

  /**
   * 处理 `onExecute` 相关逻辑。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
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

/**
 * 封装 ConstantObjectNode 的节点行为。
 */
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

  /**
   * 创建状态。
   *
   * @returns 创建后的结果对象。
   */
  createState() {
    return {
      value: {} as Record<string, unknown>
    };
  }

  /**
   * 处理 `onExecute` 相关逻辑。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
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
