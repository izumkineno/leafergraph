import type {
  LeaferGraphContextMenuClipboardFragment,
  LeaferGraphContextMenuClipboardState
} from "./types";

/**
 * 封装 LeaferGraphContextMenuClipboardStore 的状态存取逻辑。
 */
class LeaferGraphContextMenuClipboardStore
  implements LeaferGraphContextMenuClipboardState
{
  private fragment: LeaferGraphContextMenuClipboardFragment | null = null;

  /**
   * 获取片段。
   *
   * @returns 处理后的结果。
   */
  getFragment(): LeaferGraphContextMenuClipboardFragment | null {
    return this.fragment
      ? {
          nodes: structuredClone(this.fragment.nodes),
          links: structuredClone(this.fragment.links)
        }
      : null;
  }

  /**
   * 设置片段。
   *
   * @param fragment - 片段。
   * @returns 无返回值。
   */
  setFragment(fragment: LeaferGraphContextMenuClipboardFragment | null): void {
    this.fragment = fragment
      ? {
          nodes: structuredClone(fragment.nodes),
          links: structuredClone(fragment.links)
        }
      : null;
  }

  /**
   * 处理 `clear` 相关逻辑。
   *
   * @returns 无返回值。
   */
  clear(): void {
    this.fragment = null;
  }

  /**
   * 判断是否存在片段。
   *
   * @returns 对应的判断结果。
   */
  hasFragment(): boolean {
    return Boolean(this.fragment?.nodes.length);
  }
}

const sharedClipboardStore = new LeaferGraphContextMenuClipboardStore();

/**
 * 创建LeaferGraph 上下文菜单剪贴板`Store`。
 *
 * @returns 创建后的结果对象。
 */
export function createLeaferGraphContextMenuClipboardStore(): LeaferGraphContextMenuClipboardState {
  return new LeaferGraphContextMenuClipboardStore();
}

/**
 * 获取共享 LeaferGraph 上下文菜单剪贴板`Store`。
 *
 * @returns 处理后的结果。
 */
export function getSharedLeaferGraphContextMenuClipboardStore(): LeaferGraphContextMenuClipboardState {
  return sharedClipboardStore;
}
