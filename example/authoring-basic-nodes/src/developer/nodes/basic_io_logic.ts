import { BaseNode } from "@leafergraph/extensions/authoring";

import {
  readWidgetString,
  toDisplayText,
  updateStatus
} from "../helpers";
import {
  AUTHORING_BASIC_NODE_TYPES,
  createStatusWidgetSpec
} from "../shared";
import {
  compareValues,
  compileUserScript,
  downloadAsBrowserFile,
  setNodeTitle
} from "./shared";

/**
 * 封装 DownloadNode 的节点行为。
 */
export class DownloadNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.download,
    title: "Download",
    category: "Basic/IO",
    inputs: [
      { name: "data", type: 0 as const, optional: true },
      { name: "download", type: "event", optional: true }
    ],
    properties: [{ name: "filename", type: "string", default: "data.json" }],
    widgets: [
      {
        type: "input",
        name: "filename",
        value: "data.json",
        options: {
          label: "Filename"
        }
      },
      {
        type: "button",
        name: "download_now",
        value: null,
        options: {
          label: "Action",
          text: "Download"
        }
      },
      createStatusWidgetSpec({
        label: "Download",
        description: "Stores latest input until download is requested"
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
      value: undefined as unknown
    };
  }

  /**
   * 处理 `onExecute` 相关逻辑。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onExecute(ctx) {
    const inputValue = ctx.getInput("data");
    if (inputValue !== undefined) {
      ctx.state.value = inputValue;
    }
    ctx.setProp("filename", readWidgetString(ctx, "filename", "data.json"));
    updateStatus(
      ctx,
      ctx.state.value === undefined
        ? "WAITING\nNo captured input yet"
        : `READY\n${readWidgetString(ctx, "filename", "data.json")}`
    );
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
    if (action !== "download" && action !== "download_now") {
      return;
    }

    if (ctx.state.value === undefined) {
      updateStatus(ctx, "WAITING\nNo data to download");
      return;
    }

    const filename = readWidgetString(ctx, "filename", "data.json");
    ctx.setProp("filename", filename);
    downloadAsBrowserFile(filename, ctx.state.value);
    updateStatus(ctx, `DOWNLOADED\n${filename}`);
  }
}

/**
 * 封装 WatchNode 的节点行为。
 */
export class WatchNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.watch,
    title: "Watch",
    category: "Basic/IO",
    inputs: [{ name: "value", type: 0 as const, label: "" }],
    widgets: [
      createStatusWidgetSpec({
        label: "Watch",
        description: "Live input preview"
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
      value: undefined as unknown
    };
  }

  /**
   * 处理 `onExecute` 相关逻辑。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onExecute(ctx) {
    const inputValue = ctx.getInput("value");
    ctx.state.value = inputValue;
    // 节点标题保持紧凑，避免超长文本把头部挤坏；状态面板则尽量保留完整值。
    const titleDisplay = toDisplayText(inputValue);
    const panelDisplay = toDisplayText(inputValue, Number.POSITIVE_INFINITY);
    setNodeTitle(
      ctx.node,
      titleDisplay.length > 22
        ? `Watch ${titleDisplay.slice(0, 22)}…`
        : `Watch ${titleDisplay}`
    );
    updateStatus(ctx, `LIVE\n${panelDisplay}`);
  }
}

/**
 * 封装 CastNode 的节点行为。
 */
export class CastNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.cast,
    title: "Cast",
    category: "Basic/IO",
    inputs: [{ name: "in", type: 0 as const }],
    outputs: [{ name: "out", type: 0 as const }]
  };

  /**
   * 处理 `onExecute` 相关逻辑。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onExecute(ctx) {
    ctx.setOutput("out", ctx.getInput("in"));
  }
}

/**
 * 封装 ConsoleNode 的节点行为。
 */
export class ConsoleNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.console,
    title: "Console",
    category: "Basic/IO",
    inputs: [
      { name: "log", type: "event", optional: true },
      { name: "warn", type: "event", optional: true },
      { name: "error", type: "event", optional: true },
      { name: "msg", type: 0 as const, optional: true }
    ],
    properties: [{ name: "msg", type: "string", default: "" }],
    widgets: [
      {
        type: "input",
        name: "msg",
        value: "",
        options: {
          label: "Message"
        }
      },
      createStatusWidgetSpec({
        label: "Console",
        description: "Logs message on execute or event action"
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
    const msgInput = ctx.getInput("msg");
    const nextMessage =
      msgInput !== undefined
        ? toDisplayText(msgInput)
        : readWidgetString(ctx, "msg", "");
    if (!nextMessage) {
      return;
    }

    ctx.setProp("msg", nextMessage);
    console.log(nextMessage);
    updateStatus(ctx, `LOG\n${nextMessage}`);
  }

  /**
   * 处理 `onAction` 相关逻辑。
   *
   * @param action - 动作。
   * @param param - 解构后的输入参数。
   * @param _options - 可选配置项。
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onAction(action, param, _options, ctx) {
    let message =
      (ctx.getInput("msg") ?? readWidgetString(ctx, "msg", "")) || undefined;
    if (message === undefined || message === "") {
      message = `Event ${action}: ${toDisplayText(param)}`;
    }

    const display = toDisplayText(message);
    if (action === "warn") {
      console.warn(message);
    } else if (action === "error") {
      console.error(message);
    } else {
      console.log(message);
    }

    updateStatus(ctx, `${action.toUpperCase()}\n${display}`);
  }
}

/**
 * 封装 AlertNode 的节点行为。
 */
export class AlertNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.alert,
    title: "Alert",
    category: "Basic/IO",
    inputs: [{ name: "in", type: "event", optional: true }],
    properties: [{ name: "msg", type: "string", default: "Hello from Alert" }],
    widgets: [
      {
        type: "textarea",
        name: "msg",
        value: "Hello from Alert",
        options: {
          label: "Text",
          rows: 3
        }
      }
    ]
  };

  /**
   * 处理 `onAction` 相关逻辑。
   *
   * @param _action - 动作。
   * @param _param - 参数。
   * @param _options - 可选配置项。
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onAction(_action, _param, _options, ctx) {
    const message = readWidgetString(ctx, "msg", "Hello from Alert");
    ctx.setProp("msg", message);
    setTimeout(() => {
      alert(message);
    }, 10);
  }
}

/**
 * 封装 ScriptNode 的节点行为。
 */
export class ScriptNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.script,
    title: "Script",
    category: "Basic/Logic",
    inputs: [
      { name: "A", type: 0 as const, optional: true },
      { name: "B", type: 0 as const, optional: true },
      { name: "C", type: 0 as const, optional: true }
    ],
    outputs: [{ name: "out", type: 0 as const }],
    properties: [{ name: "onExecute", type: "string", default: "return A;" }],
    widgets: [
      {
        type: "textarea",
        name: "onExecute",
        value: "return A;",
        options: {
          label: "Code",
          rows: 5
        }
      },
      createStatusWidgetSpec({
        label: "Script",
        description: "Receives A, B, C and must return a value"
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
      compiledCode: "",
      fn: undefined as
        | ((A: unknown, B: unknown, C: unknown, DATA: Record<string, unknown>, node: unknown) => unknown)
        | undefined,
      error: "",
      data: {} as Record<string, unknown>
    };
  }

  /**
   * 处理 `onExecute` 相关逻辑。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onExecute(ctx) {
    const code = readWidgetString(ctx, "onExecute", "return A;");
    ctx.setProp("onExecute", code);

    if (ctx.state.compiledCode !== code) {
      ctx.state.compiledCode = code;
      const compilation = compileUserScript(code);
      ctx.state.fn = compilation.fn;
      ctx.state.error = compilation.error ?? "";
    }

    if (!ctx.state.fn) {
      updateStatus(ctx, `ERROR\n${ctx.state.error || "Script not compiled"}`);
      return;
    }

    try {
      const output = ctx.state.fn(
        ctx.getInput("A"),
        ctx.getInput("B"),
        ctx.getInput("C"),
        ctx.state.data,
        ctx.node
      );
      ctx.setOutput("out", output);
      updateStatus(ctx, `READY\n${toDisplayText(output)}`);
    } catch (error) {
      ctx.state.error = error instanceof Error ? error.message : String(error);
      updateStatus(ctx, `ERROR\n${ctx.state.error}`);
    }
  }
}

/**
 * 封装 CompareValuesNode 的节点行为。
 */
export class CompareValuesNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.compare,
    title: "Compare *",
    category: "Basic/Logic",
    inputs: [
      { name: "A", type: 0 as const, optional: true },
      { name: "B", type: 0 as const, optional: true }
    ],
    outputs: [
      { name: "true", type: "boolean" },
      { name: "false", type: "boolean" }
    ],
    properties: [
      { name: "A", type: "string", default: "1" },
      { name: "B", type: "string", default: "1" },
      { name: "OP", type: "string", default: "==" }
    ],
    widgets: [
      {
        type: "select",
        name: "OP",
        value: "==",
        options: {
          label: "Operator",
          items: ["==", "!="]
        }
      },
      createStatusWidgetSpec({
        label: "Compare",
        description: "Compares A and B using shallow equality"
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
    const operator = readWidgetString(ctx, "OP", "==");
    const valueA = ctx.getInput("A") ?? ctx.props.A;
    const valueB = ctx.getInput("B") ?? ctx.props.B;
    ctx.setProp("A", valueA);
    ctx.setProp("B", valueB);
    ctx.setProp("OP", operator);

    const result = compareValues(valueA, valueB, operator);
    ctx.setOutput("true", result);
    ctx.setOutput("false", !result);
    setNodeTitle(ctx.node, `A ${operator} B`);
    updateStatus(
      ctx,
      `${result ? "TRUE" : "FALSE"}\n${toDisplayText(valueA)} ${operator} ${toDisplayText(valueB)}`
    );
  }
}

export const authoringBasicIoLogicNodeClasses = [
  DownloadNode,
  WatchNode,
  CastNode,
  ConsoleNode,
  AlertNode,
  ScriptNode,
  CompareValuesNode
] as const;
