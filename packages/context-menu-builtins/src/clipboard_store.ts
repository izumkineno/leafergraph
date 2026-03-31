import type {
  LeaferGraphContextMenuClipboardFragment,
  LeaferGraphContextMenuClipboardState
} from "./types";

class LeaferGraphContextMenuClipboardStore
  implements LeaferGraphContextMenuClipboardState
{
  private fragment: LeaferGraphContextMenuClipboardFragment | null = null;

  getFragment(): LeaferGraphContextMenuClipboardFragment | null {
    return this.fragment
      ? {
          nodes: structuredClone(this.fragment.nodes),
          links: structuredClone(this.fragment.links)
        }
      : null;
  }

  setFragment(fragment: LeaferGraphContextMenuClipboardFragment | null): void {
    this.fragment = fragment
      ? {
          nodes: structuredClone(fragment.nodes),
          links: structuredClone(fragment.links)
        }
      : null;
  }

  clear(): void {
    this.fragment = null;
  }

  hasFragment(): boolean {
    return Boolean(this.fragment?.nodes.length);
  }
}

const sharedClipboardStore = new LeaferGraphContextMenuClipboardStore();

export function createLeaferGraphContextMenuClipboardStore(): LeaferGraphContextMenuClipboardState {
  return new LeaferGraphContextMenuClipboardStore();
}

export function getSharedLeaferGraphContextMenuClipboardStore(): LeaferGraphContextMenuClipboardState {
  return sharedClipboardStore;
}
