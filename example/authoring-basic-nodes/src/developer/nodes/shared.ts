type VariableContainerName = "litegraph" | "graph" | "global";
export type FileOutputType = "text" | "json" | "arraybuffer" | "blob";

const sharedLitegraphVariables = new Map<string, unknown>();
const sharedGraphVariables = new Map<string, unknown>();

const SCRIPT_FORBIDDEN_TOKENS = [
  "script",
  "document",
  "window",
  "eval",
  "function",
  "fetch"
] as const;

/**
 * 设置节点标题。
 *
 * @param node - 节点。
 * @param title - 标题。
 * @returns 无返回值。
 */
export function setNodeTitle(node: { title: string }, title: string): void {
  node.title = title;
}

/**
 * 解析文件类型。
 *
 * @param value - 当前值。
 * @returns 处理后的结果。
 */
export function resolveFileType(value: string): FileOutputType {
  if (
    value === "text" ||
    value === "json" ||
    value === "arraybuffer" ||
    value === "blob"
  ) {
    return value;
  }

  return "text";
}

/**
 * 解析变量`Container`。
 *
 * @param name - `name`。
 * @returns 处理后的结果。
 */
export function resolveVariableContainer(name: VariableContainerName): {
  label: string;
  read(key: string): unknown;
  write(key: string, value: unknown): void;
} {
  if (name === "graph") {
    return {
      label: "GRAPH",
      read(key) {
        return sharedGraphVariables.get(key);
      },
      write(key, value) {
        sharedGraphVariables.set(key, value);
      }
    };
  }

  if (name === "global") {
    const host = globalThis as Record<string, unknown>;
    return {
      label: "GLOBAL",
      read(key) {
        return host[key];
      },
      write(key, value) {
        host[key] = value;
      }
    };
  }

  return {
    label: "LITEGRAPH",
    read(key) {
      return sharedLitegraphVariables.get(key);
    },
    write(key, value) {
      sharedLitegraphVariables.set(key, value);
    }
  };
}

/**
 * 下载`As` 浏览器文件。
 *
 * @param filename - `filename`。
 * @param value - 当前值。
 * @returns 无返回值。
 */
export function downloadAsBrowserFile(filename: string, value: unknown): void {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const element = document.createElement("a");
  element.href = url;
  element.download = filename;
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * 编译用户`Script`。
 *
 * @param code - `code`。
 * @returns 编译用户`Script`的结果。
 */
export function compileUserScript(code: string): {
  fn?: (A: unknown, B: unknown, C: unknown, DATA: Record<string, unknown>, node: unknown) => unknown;
  error?: string;
} {
  if (!code.trim()) {
    return {
      error: "脚本为空"
    };
  }

  if (code.length > 512) {
    return {
      error: "脚本过长，限制 512 个字符"
    };
  }

  const lowered = code.toLowerCase();
  for (const token of SCRIPT_FORBIDDEN_TOKENS) {
    if (lowered.includes(token)) {
      return {
        error: `脚本包含受限标记: ${token}`
      };
    }
  }

  try {
    return {
      fn: new Function(
        "A",
        "B",
        "C",
        "DATA",
        "node",
        code
      ) as (A: unknown, B: unknown, C: unknown, DATA: Record<string, unknown>, node: unknown) => unknown
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 比较值。
 *
 * @param a - `a`。
 * @param b - `b`。
 * @param operator - `operator`。
 * @returns 对应的判断结果。
 */
export function compareValues(a: unknown, b: unknown, operator: string): boolean {
  if (operator !== "==" && operator !== "!=") {
    return false;
  }

  let result = false;
  if (typeof a === typeof b) {
    if (typeof a === "object" && a && b) {
      try {
        result = JSON.stringify(a) === JSON.stringify(b);
      } catch {
        result = a === b;
      }
    } else {
      result = a == b;
    }
  }

  return operator === "!=" ? !result : result;
}
