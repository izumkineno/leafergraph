/**
 * 浏览器系统剪贴板桥接模块。
 *
 * @remarks
 * 负责把 editor 内部的复制粘贴链路接到浏览器原生 Clipboard API，隔离权限、异常和兼容性差异。
 */
export async function readBrowserClipboardText(
  ownerWindow: Window
): Promise<string | null> {
  try {
    const clipboardApi = ownerWindow.navigator?.clipboard;
    if (!clipboardApi?.readText) {
      return null;
    }

    const text = await clipboardApi.readText();
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}

export async function writeBrowserClipboardText(
  ownerWindow: Window,
  text: string
): Promise<void> {
  try {
    const clipboardApi = ownerWindow.navigator?.clipboard;
    if (!clipboardApi?.writeText) {
      return;
    }

    await clipboardApi.writeText(text);
  } catch {
    // 系统剪贴板写入失败时回退到内存剪贴板即可，这里不打断 editor 流程。
  }
}
