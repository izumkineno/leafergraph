export type EditorWorkspacePaneSide = "left" | "right";

/** 工作区左右 pane 持久化使用的本地存储 key。 */
export const EDITOR_WORKSPACE_PANE_STORAGE_KEYS: Readonly<
  Record<EditorWorkspacePaneSide, string>
> = {
  left: "leafergraph.editor.workspace.left-pane-open",
  right: "leafergraph.editor.workspace.right-pane-open"
};

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function parsePersistedPaneOpen(
  value: string | null,
  fallback: boolean
): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

/** 读取单侧 pane 的初始可见性。 */
export function resolveInitialWorkspacePaneOpen(
  side: EditorWorkspacePaneSide,
  fallback: boolean
): boolean {
  const storage = getBrowserStorage();
  if (!storage) {
    return fallback;
  }

  try {
    return parsePersistedPaneOpen(
      storage.getItem(EDITOR_WORKSPACE_PANE_STORAGE_KEYS[side]),
      fallback
    );
  } catch {
    return fallback;
  }
}

/** 持久化单侧 pane 的可见性。 */
export function persistWorkspacePaneOpen(
  side: EditorWorkspacePaneSide,
  open: boolean
): void {
  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(EDITOR_WORKSPACE_PANE_STORAGE_KEYS[side], String(open));
  } catch {
    // 忽略浏览器存储写入失败，保持 editor 可继续工作。
  }
}
