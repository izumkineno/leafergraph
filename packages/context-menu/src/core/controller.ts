/**
 * 右键菜单状态机控制器。
 *
 * @remarks
 * 负责管理：
 * - 根菜单打开 / 关闭
 * - 子菜单 open path
 * - roving focus
 * - checkbox / radio 非受控状态
 * - lazy submenu children 加载
 */

import {
  findContextMenuItemByKey,
  flattenContextMenuLevelItems,
  isFocusableContextMenuItem,
  normalizeContextMenuItems,
  resolveContextMenuLevelItems,
  type ContextMenuLazyChildrenState,
  type ContextMenuSelectionState
} from "./normalize";
import type {
  ContextMenuContext,
  ContextMenuController,
  ContextMenuGroupItem,
  ContextMenuItem,
  ContextMenuOpenState,
  ContextMenuRadioItem,
  ContextMenuResolver,
  ContextMenuSubmenuItem,
  CreateContextMenuControllerOptions,
  SubmenuTriggerMode
} from "./types";

interface ContextMenuControllerRuntimeState {
  context: ContextMenuContext | null;
  sourceItems: ContextMenuItem[];
  resolvedItems: ContextMenuItem[];
  openPath: string[];
  focusedKeys: (string | null)[];
  controlledOpenPath?: readonly string[];
}

export function createContextMenuController(
  options: CreateContextMenuControllerOptions = {}
): ContextMenuController {
  const listeners = new Set<(state: ContextMenuOpenState) => void>();
  const adapterCleanups: Array<() => void> = [];
  let rendererCleanup: (() => void) | undefined;
  let resolveItems = options.resolveItems;

  const selectionState: ContextMenuSelectionState = {
    checkboxState: new Map(),
    radioState: new Map(),
    lazyChildrenState: new Map()
  };

  const runtimeState: ContextMenuControllerRuntimeState = {
    context: null,
    sourceItems: [],
    resolvedItems: [],
    openPath: options.controlledOpenPath ? [...options.controlledOpenPath] : [],
    focusedKeys: [],
    controlledOpenPath: options.controlledOpenPath
  };

  const emit = (): void => {
    const snapshot: ContextMenuOpenState = {
      open: Boolean(runtimeState.context),
      context: runtimeState.context,
      items: runtimeState.resolvedItems,
      openPath: [...getOpenPath()],
      focusedKeys: [...runtimeState.focusedKeys]
    };

    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const refreshResolvedItems = (): void => {
    if (!runtimeState.context) {
      runtimeState.resolvedItems = [];
      runtimeState.focusedKeys = [];
      return;
    }

    runtimeState.resolvedItems = normalizeContextMenuItems(
      runtimeState.sourceItems,
      runtimeState.context,
      selectionState
    );
    syncFocusForCurrentOpenPath();
  };

  const getOpenPath = (): readonly string[] =>
    runtimeState.controlledOpenPath ?? runtimeState.openPath;

  const commitOpenPath = (nextOpenPath: readonly string[]): void => {
    const normalizedOpenPath = [...nextOpenPath];
    const currentOpenPath = [...getOpenPath()];
    if (isSameOpenPath(currentOpenPath, normalizedOpenPath)) {
      return;
    }

    if (runtimeState.controlledOpenPath) {
      options.onOpenPathChange?.(normalizedOpenPath);
    } else {
      runtimeState.openPath = normalizedOpenPath;
      options.onOpenPathChange?.([...runtimeState.openPath]);
    }

    syncFocusForCurrentOpenPath();
    emit();
  };

  const resolvePanelFocusableItems = (level: number): ContextMenuItem[] =>
    flattenContextMenuLevelItems(
      resolveContextMenuLevelItems(runtimeState.resolvedItems, getOpenPath().slice(0, level))
    ).filter(isFocusableContextMenuItem);

  const findFirstFocusableKey = (level: number): string | null =>
    resolvePanelFocusableItems(level)[0]?.key ?? null;

  const syncFocusForCurrentOpenPath = (): void => {
    const levels = getOpenPath().length + 1;
    const nextFocusedKeys = [...runtimeState.focusedKeys];

    for (let level = 0; level < levels; level += 1) {
      const levelItems = resolvePanelFocusableItems(level);
      if (!levelItems.length) {
        nextFocusedKeys[level] = null;
        continue;
      }

      const currentFocusedKey = nextFocusedKeys[level];
      if (currentFocusedKey && levelItems.some((item) => item.key === currentFocusedKey)) {
        continue;
      }

      nextFocusedKeys[level] = levelItems[0]?.key ?? null;
    }

    runtimeState.focusedKeys = nextFocusedKeys.slice(0, levels);
  };

  const loadLazyChildrenIfNeeded = async (
    item: ContextMenuSubmenuItem
  ): Promise<void> => {
    if (!runtimeState.context || !item.lazyChildren) {
      return;
    }

    const currentState = selectionState.lazyChildrenState.get(item.key);
    if (currentState?.status === "loading" || currentState?.status === "loaded") {
      return;
    }

    selectionState.lazyChildrenState.set(item.key, {
      status: "loading"
    });
    refreshResolvedItems();
    emit();

    try {
      const items = await item.lazyChildren(runtimeState.context);
      const nextState: ContextMenuLazyChildrenState = {
        status: "loaded",
        items
      };
      selectionState.lazyChildrenState.set(item.key, nextState);
    } catch (error) {
      selectionState.lazyChildrenState.set(item.key, {
        status: "error",
        error
      });
    }

    refreshResolvedItems();
    emit();
  };

  const open = (context: ContextMenuContext, items?: ContextMenuItem[]): void => {
    const previousContext = runtimeState.context;
    if (options.onBeforeOpen?.(context) === false) {
      return;
    }

    if (previousContext && previousContext !== context) {
      options.onClose?.(previousContext);
    }

    runtimeState.context = context;
    runtimeState.sourceItems = items ?? resolveItems?.(context) ?? [];
    refreshResolvedItems();
    if (!runtimeState.resolvedItems.length) {
      runtimeState.context = null;
      runtimeState.sourceItems = [];
      runtimeState.resolvedItems = [];
      runtimeState.focusedKeys = [];
      if (!runtimeState.controlledOpenPath) {
        runtimeState.openPath = [];
      }
      emit();
      return;
    }

    if (!runtimeState.controlledOpenPath) {
      runtimeState.openPath = [];
    }

    runtimeState.focusedKeys = [findFirstFocusableKey(0)];
    emit();
    options.onOpen?.(context);
  };

  const close = (): void => {
    if (!runtimeState.context) {
      return;
    }

    const previousContext = runtimeState.context;
    runtimeState.context = null;
    runtimeState.sourceItems = [];
    runtimeState.resolvedItems = [];
    runtimeState.focusedKeys = [];
    if (!runtimeState.controlledOpenPath) {
      runtimeState.openPath = [];
    }

    emit();
    options.onClose?.(previousContext);
  };

  const setOpenPath = (nextOpenPath: readonly string[]): void => {
    if (!runtimeState.context) {
      return;
    }

    commitOpenPath(nextOpenPath);
    for (const key of nextOpenPath) {
      const submenu = findContextMenuItemByKey(runtimeState.resolvedItems, key);
      if (submenu?.kind === "submenu") {
        void loadLazyChildrenIfNeeded(submenu);
      }
    }
  };

  const closeToLevel = (level: number): void => {
    if (level <= 0) {
      setOpenPath([]);
      return;
    }

    setOpenPath(getOpenPath().slice(0, level));
  };

  const setFocusedKey = (level: number, key: string | null): void => {
    if (runtimeState.focusedKeys[level] === key) {
      return;
    }

    runtimeState.focusedKeys[level] = key;
    emit();
  };

  const focusByOffset = (level: number, offset: 1 | -1): void => {
    const items = resolvePanelFocusableItems(level);
    if (!items.length) {
      setFocusedKey(level, null);
      return;
    }

    const currentFocusedKey = runtimeState.focusedKeys[level];
    const currentIndex = items.findIndex((item) => item.key === currentFocusedKey);
    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + offset + items.length) % items.length;

    setFocusedKey(level, items[nextIndex]?.key ?? null);
  };

  const focusHome = (level: number): void => {
    setFocusedKey(level, findFirstFocusableKey(level));
  };

  const focusEnd = (level: number): void => {
    const items = resolvePanelFocusableItems(level);
    setFocusedKey(level, items.at(-1)?.key ?? null);
  };

  const activateItem = async (item: ContextMenuItem): Promise<void> => {
    if (!runtimeState.context || (item.kind !== "separator" && "disabled" in item && item.disabled)) {
      return;
    }

    switch (item.kind) {
      case "group":
      case "separator":
        return;
      case "submenu": {
        const nextPath = [...getOpenPath(), item.key];
        setOpenPath(nextPath);
        return;
      }
      case "checkbox": {
        const sourceItem = findContextMenuItemByKey(
          runtimeState.sourceItems,
          item.key
        );
        const nextChecked = !Boolean(item.checked);
        if (sourceItem?.kind === "checkbox" && sourceItem.checked === undefined) {
          selectionState.checkboxState.set(item.key, nextChecked);
        }
        refreshResolvedItems();
        emit();
        await item.onCheckedChange?.(nextChecked, runtimeState.context);
        if (item.closeOnSelect ?? true) {
          close();
        }
        return;
      }
      case "radio": {
        const radioItem = item as ContextMenuRadioItem;
        const sourceItem = findContextMenuItemByKey(
          runtimeState.sourceItems,
          item.key
        );
        if (sourceItem?.kind === "radio" && sourceItem.checked === undefined) {
          selectionState.radioState.set(radioItem.groupKey, radioItem.value);
        }
        refreshResolvedItems();
        emit();
        await radioItem.onCheckedChange?.(true, runtimeState.context);
        if (item.closeOnSelect ?? true) {
          close();
        }
        return;
      }
      default:
        await item.onSelect?.(runtimeState.context);
        if (item.closeOnSelect ?? true) {
          close();
        }
    }
  };

  const activateKey = async (level: number, key: string): Promise<void> => {
    const levelItems = resolvePanelFocusableItems(level);
    const item = levelItems.find((currentItem) => currentItem.key === key);
    if (!item) {
      return;
    }

    await activateItem(item);
  };

  const activateFocused = async (level: number): Promise<void> => {
    const focusedKey = runtimeState.focusedKeys[level];
    if (!focusedKey) {
      return;
    }

    await activateKey(level, focusedKey);
  };

  const setResolver = (resolver?: ContextMenuResolver): void => {
    resolveItems = resolver;
    if (runtimeState.context) {
      runtimeState.sourceItems = resolveItems?.(runtimeState.context) ?? [];
      refreshResolvedItems();
      emit();
    }
  };

  const setControlledOpenPath = (
    nextControlledOpenPath?: readonly string[] | null
  ): void => {
    runtimeState.controlledOpenPath = nextControlledOpenPath ?? undefined;
    if (runtimeState.controlledOpenPath) {
      syncFocusForCurrentOpenPath();
      emit();
    }
  };

  const getSubmenuTriggerMode = (
    item?: ContextMenuSubmenuItem
  ): SubmenuTriggerMode => item?.submenuTriggerMode ?? options.submenuTriggerMode ?? "hover+click";

  const getOpenDelay = (item?: ContextMenuSubmenuItem): number =>
    item?.openDelay ?? options.openDelay ?? 0;

  const getCloseDelay = (item?: ContextMenuSubmenuItem): number =>
    item?.closeDelay ?? options.closeDelay ?? 100;

  const subscribe = (listener: (state: ContextMenuOpenState) => void): (() => void) => {
    listeners.add(listener);
    listener({
      open: Boolean(runtimeState.context),
      context: runtimeState.context,
      items: runtimeState.resolvedItems,
      openPath: [...getOpenPath()],
      focusedKeys: [...runtimeState.focusedKeys]
    });

    return () => {
      listeners.delete(listener);
    };
  };

  const controller: ContextMenuController = {
    getState(): ContextMenuOpenState {
      return {
        open: Boolean(runtimeState.context),
        context: runtimeState.context,
        items: runtimeState.resolvedItems,
        openPath: [...getOpenPath()],
        focusedKeys: [...runtimeState.focusedKeys]
      };
    },
    subscribe,
    setResolver,
    open,
    close,
    setOpenPath,
    closeToLevel,
    setFocusedKey,
    focusNext(level: number): void {
      focusByOffset(level, 1);
    },
    focusPrevious(level: number): void {
      focusByOffset(level, -1);
    },
    focusHome,
    focusEnd,
    activateItem,
    activateFocused,
    activateKey,
    setControlledOpenPath,
    getSubmenuTriggerMode,
    getOpenDelay,
    getCloseDelay,
    destroy(): void {
      rendererCleanup?.();
      rendererCleanup = undefined;
      for (const cleanup of adapterCleanups.splice(0, adapterCleanups.length)) {
        cleanup();
      }
      close();
      listeners.clear();
    }
  };

  for (const adapter of options.adapters ?? []) {
    adapterCleanups.push(adapter.connect(controller));
  }

  if (options.renderer) {
    rendererCleanup = options.renderer.connect(controller);
  }

  return controller;
}

export function isContextMenuGroupItem(
  item: ContextMenuItem
): item is ContextMenuGroupItem {
  return item.kind === "group";
}

function isSameOpenPath(
  left: readonly string[],
  right: readonly string[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}
