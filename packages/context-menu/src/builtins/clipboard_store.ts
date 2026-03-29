import type {
  LeaferContextMenuClipboardFragment,
  LeaferContextMenuClipboardState
} from "./types";

class LeaferContextMenuClipboardStore implements LeaferContextMenuClipboardState {
  private fragment: LeaferContextMenuClipboardFragment | null = null;

  getFragment(): LeaferContextMenuClipboardFragment | null {
    return this.fragment
      ? {
          nodes: structuredClone(this.fragment.nodes),
          links: structuredClone(this.fragment.links)
        }
      : null;
  }

  setFragment(fragment: LeaferContextMenuClipboardFragment | null): void {
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

const sharedClipboardStore = new LeaferContextMenuClipboardStore();

export function getSharedLeaferContextMenuClipboardStore(): LeaferContextMenuClipboardState {
  return sharedClipboardStore;
}
