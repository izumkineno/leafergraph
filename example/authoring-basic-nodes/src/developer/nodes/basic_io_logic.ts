import { BaseNode } from "@leafergraph/authoring";

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

  createState() {
    return {
      value: undefined as unknown
    };
  }

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

  createState() {
    return {
      value: undefined as unknown
    };
  }

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

export class CastNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.cast,
    title: "Cast",
    category: "Basic/IO",
    inputs: [{ name: "in", type: 0 as const }],
    outputs: [{ name: "out", type: 0 as const }]
  };

  onExecute(ctx) {
    ctx.setOutput("out", ctx.getInput("in"));
  }
}

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

  onAction(_action, _param, _options, ctx) {
    const message = readWidgetString(ctx, "msg", "Hello from Alert");
    ctx.setProp("msg", message);
    setTimeout(() => {
      alert(message);
    }, 10);
  }
}

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
