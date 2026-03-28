import { BaseNode } from "@leafergraph/authoring";

import {
  cloneStructuredValue,
  parseJsonValue,
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
import {
  resolveFileType,
  resolveVariableContainer,
  setNodeTitle,
  type FileOutputType
} from "./shared";

interface FileNodeState {
  lastKey: string;
  lastType: FileOutputType;
  data: unknown;
  error: string;
  loading: boolean;
}

function readResponsePayload(
  response: Response,
  type: FileOutputType
): Promise<unknown> {
  if (type === "arraybuffer") {
    return response.arrayBuffer();
  }
  if (type === "blob") {
    return response.blob();
  }
  if (type === "json") {
    return response.json();
  }

  return response.text();
}

function formatFileStatus(state: FileNodeState, url: string): string {
  if (!url) {
    return "WAITING\nProvide a URL";
  }
  if (state.loading) {
    return `LOADING\n${url}`;
  }
  if (state.error) {
    return `ERROR\n${state.error}`;
  }
  if (state.data === undefined) {
    return `READY\n${url}\nNo payload yet`;
  }

  return `READY\n${url}\n${toDisplayText(state.data)}`;
}

export class FileNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.file,
    title: "Const File",
    category: "Basic/Data",
    inputs: [{ name: "url", type: "string", optional: true }],
    outputs: [{ name: "file", type: 0 as const }],
    properties: [
      { name: "url", type: "string", default: "" },
      { name: "type", type: "string", default: "json" }
    ],
    widgets: [
      {
        type: "input",
        name: "url",
        value: "",
        options: {
          label: "URL",
          placeholder: "https://example.com/data.json"
        }
      },
      {
        type: "select",
        name: "type",
        value: "json",
        options: {
          label: "Type",
          items: ["text", "json", "arraybuffer", "blob"]
        }
      },
      {
        type: "button",
        name: "reload",
        value: null,
        options: {
          label: "Action",
          text: "Reload"
        }
      },
      createStatusWidgetSpec({
        label: "File",
        description: "Fetches a file from a URL and caches the latest payload"
      })
    ]
  };

  createState() {
    return {
      lastKey: "",
      lastType: "json" as FileOutputType,
      data: undefined as unknown,
      error: "",
      loading: false
    } satisfies FileNodeState;
  }

  onExecute(ctx) {
    const inputUrl = ctx.getInput("url");
    const nextKey =
      typeof inputUrl === "string" && inputUrl.trim()
        ? inputUrl.trim()
        : readWidgetString(ctx, "url", "");
    const nextType = resolveFileType(readWidgetString(ctx, "type", "json"));

    ctx.setProp("url", nextKey);
    ctx.setProp("type", nextType);
    ctx.setWidget("url", nextKey);
    ctx.setWidget("type", nextType);

    if (ctx.state.lastKey !== nextKey || ctx.state.lastType !== nextType) {
      ctx.state.lastKey = nextKey;
      ctx.state.lastType = nextType;
      this.fetchFile(ctx, nextKey, nextType);
    }

    ctx.setOutput("file", ctx.state.data);
    updateStatus(ctx, formatFileStatus(ctx.state, nextKey));
    setNodeTitle(ctx.node, nextKey ? `Const File ${nextType}` : "Const File");
  }

  onAction(action, _param, _options, ctx) {
    if (action !== "reload") {
      return;
    }

    this.fetchFile(
      ctx,
      readWidgetString(ctx, "url", ""),
      resolveFileType(readWidgetString(ctx, "type", "json"))
    );
  }

  private fetchFile(
    ctx: Parameters<FileNode["onExecute"]>[0],
    url: string,
    type: FileOutputType
  ): void {
    if (!url) {
      ctx.state.data = undefined;
      ctx.state.error = "";
      ctx.state.loading = false;
      return;
    }

    ctx.state.loading = true;
    ctx.state.error = "";
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return readResponsePayload(response, type);
      })
      .then((payload) => {
        if (ctx.state.lastKey !== url || ctx.state.lastType !== type) {
          return;
        }

        ctx.state.data = payload;
        ctx.state.loading = false;
        ctx.state.error = "";
      })
      .catch((error) => {
        if (ctx.state.lastKey !== url || ctx.state.lastType !== type) {
          return;
        }

        ctx.state.data = undefined;
        ctx.state.loading = false;
        ctx.state.error =
          error instanceof Error ? error.message : "Fetch failed";
      });
  }
}

export class JsonParseNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.jsonparse,
    title: "JSON Parse",
    category: "Basic/Data",
    inputs: [
      { name: "parse", type: "event", optional: true },
      { name: "json", type: "string" }
    ],
    outputs: [
      { name: "done", type: "event" },
      { name: "object", type: "object" }
    ],
    widgets: [
      {
        type: "button",
        name: "parse",
        value: null,
        options: {
          label: "Parse",
          text: "Parse Now"
        }
      },
      createStatusWidgetSpec({
        label: "JSON Parser",
        description: "Use button or parse event input"
      })
    ]
  };

  createState() {
    return {
      parsed: undefined as unknown,
      error: ""
    };
  }

  onExecute(ctx) {
    ctx.setOutput("object", ctx.state.parsed);
    updateStatus(
      ctx,
      ctx.state.error
        ? `ERROR\n${ctx.state.error}`
        : `READY\n${toDisplayText(ctx.state.parsed)}`
    );
  }

  onAction(action, _param, _options, ctx) {
    if (action !== "parse") {
      return;
    }

    const jsonText = String(ctx.getInput("json") ?? "");
    const result = parseJsonValue(jsonText, undefined);
    if (!result.ok) {
      ctx.state.parsed = undefined;
      ctx.state.error = result.error ?? "JSON parse failed";
      updateStatus(ctx, `ERROR\n${ctx.state.error}`);
      return;
    }

    ctx.state.parsed = result.value;
    ctx.state.error = "";
    ctx.setOutput("object", result.value);
    ctx.setOutput("done", result.value);
    updateStatus(ctx, `READY\n${toDisplayText(result.value)}`);
  }
}

export class ConstantDataNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.data,
    title: "Const Data",
    category: "Basic/Data",
    outputs: [{ name: "data", type: "object" }],
    properties: [{ name: "value", type: "string", default: "{\n  \n}" }],
    widgets: [
      {
        type: "textarea",
        name: "value",
        value: "{\n  \n}",
        options: {
          label: "JSON",
          rows: 5
        }
      },
      createStatusWidgetSpec({
        label: "Data",
        description: "JSON object source"
      })
    ]
  };

  createState() {
    return {
      data: {} as Record<string, unknown>,
      error: ""
    };
  }

  onExecute(ctx) {
    const jsonText = readWidgetString(ctx, "value", "{\n  \n}");
    ctx.setProp("value", jsonText);
    const parsed = parseJsonValue(jsonText, {});
    ctx.state.data = parsed.value;
    ctx.state.error = parsed.ok ? "" : parsed.error ?? "Invalid JSON";
    ctx.setOutput("data", ctx.state.data);
    updateStatus(
      ctx,
      parsed.ok
        ? `READY\n${toDisplayText(ctx.state.data)}`
        : `ERROR\n${ctx.state.error}`
    );
  }
}

export class ConstantArrayNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.array,
    title: "Const Array",
    category: "Basic/Data",
    inputs: [{ name: "json", type: 0 as const, optional: true }],
    outputs: [
      { name: "arrayOut", type: "array" },
      { name: "length", type: "number" }
    ],
    properties: [{ name: "value", type: "string", default: "[1, 2, 3]" }],
    widgets: [
      {
        type: "textarea",
        name: "value",
        value: "[1, 2, 3]",
        options: {
          label: "Array",
          rows: 4
        }
      },
      createStatusWidgetSpec({
        label: "Array",
        description: "Array literal or upstream array"
      })
    ]
  };

  createState() {
    return {
      value: [1, 2, 3] as unknown[],
      error: ""
    };
  }

  onExecute(ctx) {
    const inputValue = ctx.getInput("json");
    if (Array.isArray(inputValue)) {
      ctx.state.value = [...inputValue];
      ctx.state.error = "";
    } else if (typeof inputValue === "string" && inputValue.trim()) {
      const parsedInput = parseJsonValue<unknown[]>(inputValue, []);
      ctx.state.value = parsedInput.value;
      ctx.state.error = parsedInput.ok ? "" : parsedInput.error ?? "Invalid JSON";
    } else {
      const widgetValue = readWidgetString(ctx, "value", "[1, 2, 3]");
      ctx.setProp("value", widgetValue);
      const normalized = widgetValue.trim().startsWith("[")
        ? widgetValue
        : `[${widgetValue}]`;
      const parsedValue = parseJsonValue<unknown[]>(normalized, []);
      ctx.state.value = parsedValue.value;
      ctx.state.error = parsedValue.ok ? "" : parsedValue.error ?? "Invalid JSON";
    }

    ctx.setOutput("arrayOut", ctx.state.value);
    ctx.setOutput("length", ctx.state.value.length);
    updateStatus(
      ctx,
      ctx.state.error
        ? `ERROR\n${ctx.state.error}`
        : `READY\nlength: ${ctx.state.value.length}`
    );
  }
}

export class SetArrayNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.setArray,
    title: "Set Array",
    category: "Basic/Data",
    inputs: [
      { name: "arr", type: "array" },
      { name: "value", type: 0 as const }
    ],
    outputs: [{ name: "arr", type: "array" }],
    properties: [{ name: "index", type: "number", default: 0 }],
    widgets: [
      {
        type: "input",
        name: "index",
        value: "0",
        options: {
          label: "Index",
          placeholder: "0"
        }
      }
    ]
  };

  onExecute(ctx) {
    const arrayValue = ctx.getInput("arr");
    const nextValue = ctx.getInput("value");
    const index = Math.max(0, Math.floor(readWidgetNumber(ctx, "index", 0)));

    ctx.setProp("index", index);
    if (!Array.isArray(arrayValue) || nextValue === undefined) {
      return;
    }

    arrayValue[index] = nextValue;
    ctx.setOutput("arr", arrayValue);
    setNodeTitle(ctx.node, `Set Array [${index}]`);
  }
}

export class ArrayElementNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.arrayElement,
    title: "Array[i]",
    category: "Basic/Data",
    inputs: [
      { name: "array", type: 0 as const },
      { name: "index", type: "number", optional: true }
    ],
    outputs: [{ name: "value", type: 0 as const }],
    properties: [{ name: "index", type: "number", default: 0 }],
    widgets: [
      {
        type: "input",
        name: "index",
        value: "0",
        options: {
          label: "Index"
        }
      }
    ]
  };

  onExecute(ctx) {
    const arrayValue = ctx.getInput("array");
    const inputIndex = ctx.getInput("index");
    const index =
      typeof inputIndex === "number"
        ? Math.floor(inputIndex)
        : Math.floor(readWidgetNumber(ctx, "index", 0));
    ctx.setProp("index", index);
    if (arrayValue == null) {
      return;
    }

    ctx.setOutput("value", (arrayValue as Record<number, unknown>)[index]);
  }
}

export class TableElementNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.tableElement,
    title: "Table[row][col]",
    category: "Basic/Data",
    inputs: [
      { name: "table", type: 0 as const },
      { name: "row", type: "number", optional: true },
      { name: "col", type: "number", optional: true }
    ],
    outputs: [{ name: "value", type: 0 as const }],
    properties: [
      { name: "row", type: "number", default: 0 },
      { name: "column", type: "number", default: 0 }
    ],
    widgets: [
      {
        type: "input",
        name: "row",
        value: "0",
        options: {
          label: "Row"
        }
      },
      {
        type: "input",
        name: "column",
        value: "0",
        options: {
          label: "Column"
        }
      }
    ]
  };

  onExecute(ctx) {
    const table = ctx.getInput("table");
    const rowInput = ctx.getInput("row");
    const colInput = ctx.getInput("col");
    const row =
      typeof rowInput === "number"
        ? Math.floor(rowInput)
        : Math.floor(readWidgetNumber(ctx, "row", 0));
    const column =
      typeof colInput === "number"
        ? Math.floor(colInput)
        : Math.floor(readWidgetNumber(ctx, "column", 0));

    ctx.setProp("row", row);
    ctx.setProp("column", column);
    if (!Array.isArray(table) || !Array.isArray(table[row])) {
      return;
    }

    ctx.setOutput("value", table[row][column]);
  }
}

export class ObjectPropertyNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.objectProperty,
    title: "Object Property",
    category: "Basic/Data",
    inputs: [{ name: "in", type: 0 as const }],
    outputs: [{ name: "value", type: 0 as const }],
    properties: [{ name: "value", type: "string", default: "name" }],
    widgets: [
      {
        type: "input",
        name: "value",
        value: "name",
        options: {
          label: "Property"
        }
      }
    ]
  };

  onExecute(ctx) {
    const property = readWidgetString(ctx, "value", "name");
    const objectValue = ctx.getInput("in");
    ctx.setProp("value", property);
    if (!objectValue || typeof objectValue !== "object") {
      return;
    }

    ctx.setOutput("value", (objectValue as Record<string, unknown>)[property]);
    setNodeTitle(ctx.node, `in.${property}`);
  }
}

export class ObjectKeysNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.objectKeys,
    title: "Object Keys",
    category: "Basic/Data",
    inputs: [{ name: "obj", type: 0 as const }],
    outputs: [{ name: "keys", type: "array" }]
  };

  onExecute(ctx) {
    const objectValue = ctx.getInput("obj");
    if (!objectValue || typeof objectValue !== "object") {
      return;
    }

    ctx.setOutput("keys", Object.keys(objectValue as Record<string, unknown>));
  }
}

export class SetObjectNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.setObject,
    title: "Set Object",
    category: "Basic/Data",
    inputs: [
      { name: "obj", type: 0 as const },
      { name: "value", type: 0 as const }
    ],
    outputs: [{ name: "obj", type: 0 as const }],
    properties: [{ name: "property", type: "string", default: "name" }],
    widgets: [
      {
        type: "input",
        name: "property",
        value: "name",
        options: {
          label: "Property"
        }
      }
    ]
  };

  onExecute(ctx) {
    const objectValue = ctx.getInput("obj");
    const nextValue = ctx.getInput("value");
    const property = readWidgetString(ctx, "property", "name");
    ctx.setProp("property", property);
    if (!objectValue || typeof objectValue !== "object" || nextValue === undefined) {
      return;
    }

    (objectValue as Record<string, unknown>)[property] = nextValue;
    ctx.setOutput("obj", objectValue);
  }
}

export class MergeObjectsNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.mergeObjects,
    title: "Merge Objects",
    category: "Basic/Data",
    inputs: [
      { name: "A", type: "object" },
      { name: "B", type: "object" }
    ],
    outputs: [{ name: "out", type: "object" }],
    widgets: [
      {
        type: "button",
        name: "clear",
        value: null,
        options: {
          label: "Result",
          text: "Clear"
        }
      },
      createStatusWidgetSpec({
        label: "Merge",
        description: "A wins first, B overwrites on conflict"
      })
    ]
  };

  createState() {
    return {
      result: {} as Record<string, unknown>
    };
  }

  onExecute(ctx) {
    const objectA = ctx.getInput("A");
    const objectB = ctx.getInput("B");
    if (objectA && typeof objectA === "object") {
      Object.assign(ctx.state.result, objectA);
    }
    if (objectB && typeof objectB === "object") {
      Object.assign(ctx.state.result, objectB);
    }

    ctx.setOutput("out", ctx.state.result);
    updateStatus(ctx, `READY\n${Object.keys(ctx.state.result).length} keys`);
  }

  onAction(action, _param, _options, ctx) {
    if (action !== "clear") {
      return;
    }

    ctx.state.result = {};
    updateStatus(ctx, "CLEARED\n0 keys");
  }
}

export class VariableNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.variable,
    title: "Variable",
    category: "Basic/Data",
    inputs: [{ name: "in", type: 0 as const, optional: true }],
    outputs: [{ name: "out", type: 0 as const }],
    properties: [
      { name: "varname", type: "string", default: "myname" },
      { name: "container", type: "string", default: "litegraph" }
    ],
    widgets: [
      {
        type: "input",
        name: "varname",
        value: "myname",
        options: {
          label: "Name"
        }
      },
      {
        type: "select",
        name: "container",
        value: "litegraph",
        options: {
          label: "Container",
          items: ["litegraph", "graph", "global"]
        }
      },
      createStatusWidgetSpec({
        label: "Variable",
        description: "graph container is local to the current graph host"
      })
    ]
  };

  onExecute(ctx) {
    const variableName = readWidgetString(ctx, "varname", "myname");
    const containerName = readWidgetString(
      ctx,
      "container",
      "litegraph"
    ) as "litegraph" | "graph" | "global";
    const container = resolveVariableContainer(containerName);
    ctx.setProp("varname", variableName);
    ctx.setProp("container", containerName);

    const inputValue = ctx.getInput("in");
    if (inputValue !== undefined) {
      container.write(variableName, inputValue);
      ctx.setOutput("out", inputValue);
      updateStatus(
        ctx,
        `${container.label}\nset ${variableName} = ${toDisplayText(inputValue)}`
      );
      setNodeTitle(ctx.node, variableName);
      return;
    }

    const storedValue = container.read(variableName);
    ctx.setOutput("out", storedValue);
    updateStatus(
      ctx,
      `${container.label}\n${variableName} = ${toDisplayText(storedValue)}`
    );
    setNodeTitle(ctx.node, variableName);
  }
}

export class DataStoreNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.dataStore,
    title: "Data Store",
    category: "Basic/Data",
    inputs: [
      { name: "data", type: 0 as const, optional: true },
      { name: "assign", type: "event", optional: true }
    ],
    outputs: [{ name: "data", type: 0 as const }],
    properties: [
      { name: "data", type: "object", default: null },
      { name: "serialize", type: "boolean", default: true }
    ],
    widgets: [
      {
        type: "button",
        name: "store",
        value: null,
        options: {
          label: "Store",
          text: "Capture"
        }
      },
      {
        type: "toggle",
        name: "serialize",
        value: true,
        options: {
          label: "Serialize",
          onText: "SAVE",
          offText: "TEMP"
        }
      },
      createStatusWidgetSpec({
        label: "Data Store",
        description: "Captures the most recent input only on assign/store"
      })
    ]
  };

  createState() {
    return {
      lastValue: null as unknown
    };
  }

  onExecute(ctx) {
    ctx.state.lastValue = ctx.getInput("data");
    ctx.setProp("serialize", readWidgetBoolean(ctx, "serialize", true));
    ctx.setOutput("data", ctx.props.data);
    updateStatus(ctx, `STORED\n${toDisplayText(ctx.props.data)}`);
  }

  onAction(action, _param, _options, ctx) {
    if (action !== "assign" && action !== "store") {
      return;
    }

    ctx.setProp(
      "data",
      readWidgetBoolean(ctx, "serialize", true)
        ? cloneStructuredValue(ctx.state.lastValue)
        : ctx.state.lastValue
    );
    ctx.setOutput("data", ctx.props.data);
    updateStatus(ctx, `CAPTURED\n${toDisplayText(ctx.props.data)}`);
  }
}

export const authoringBasicDataNodeClasses = [
  FileNode,
  JsonParseNode,
  ConstantDataNode,
  ConstantArrayNode,
  SetArrayNode,
  ArrayElementNode,
  TableElementNode,
  ObjectPropertyNode,
  ObjectKeysNode,
  SetObjectNode,
  MergeObjectsNode,
  VariableNode,
  DataStoreNode
] as const;
