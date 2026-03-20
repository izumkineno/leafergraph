import { describe, expect, test } from "bun:test";

import {
  readBrowserClipboardText,
  writeBrowserClipboardText
} from "../src/commands/browser_clipboard_bridge";

describe("browser clipboard bridge", () => {
  test("readBrowserClipboardText 在缺少 clipboard API 时返回 null", async () => {
    const ownerWindow = {
      navigator: {}
    } as Window;

    await expect(readBrowserClipboardText(ownerWindow)).resolves.toBeNull();
  });

  test("readBrowserClipboardText 会读取系统文本", async () => {
    const ownerWindow = {
      navigator: {
        clipboard: {
          readText: async () => "leafergraph"
        }
      }
    } as unknown as Window;

    await expect(readBrowserClipboardText(ownerWindow)).resolves.toBe(
      "leafergraph"
    );
  });

  test("writeBrowserClipboardText 会调用系统写入", async () => {
    const writes: string[] = [];
    const ownerWindow = {
      navigator: {
        clipboard: {
          writeText: async (text: string) => {
            writes.push(text);
          }
        }
      }
    } as unknown as Window;

    await writeBrowserClipboardText(ownerWindow, "payload");

    expect(writes).toEqual(["payload"]);
  });
});
