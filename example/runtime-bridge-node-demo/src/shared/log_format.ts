/**
 * 创建 demo 日志使用的时间戳标签。
 *
 * @param value - 可选时间。
 * @returns 格式化后的时间标签。
 */
export function formatDemoTimestamp(value = Date.now()): string {
  return new Date(value).toLocaleTimeString("en-US", {
    hour12: false
  });
}

/**
 * 把任意对象整理成 demo 面板可读字符串。
 *
 * @param value - 原始值。
 * @returns 序列化后的字符串。
 */
export function formatDemoPayload(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(
      value,
      (_key, currentValue) => {
        if (typeof currentValue === "object" && currentValue !== null) {
          if (seen.has(currentValue)) {
            return "[Circular]";
          }
          seen.add(currentValue);
        }

        return currentValue;
      },
      2
    );
  } catch (error) {
    return String(error);
  }
}
