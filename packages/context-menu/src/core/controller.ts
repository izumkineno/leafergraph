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

/**
 * 创建上下文菜单控制器。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createContextMenuController(
  options: CreateContextMenuControllerOptions = {}
): ContextMenuController {
  // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
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

  /**
   * 处理 `emit` 相关逻辑。
   *
   * @returns 无返回值。
   */
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

  /**
   * 处理 `refreshResolvedItems` 相关逻辑。
   *
   * @returns 无返回值。
   */
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

  /**
   * 获取打开路径。
   *
   * @returns 处理后的结果。
   */
  const getOpenPath = (): readonly string[] =>
    runtimeState.controlledOpenPath ?? runtimeState.openPath;

  /**
   * 提交打开路径。
   *
   * @param nextOpenPath - 下一步打开路径。
   * @returns 无返回值。
   */
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

  /**
   * 解析面板可聚焦项目。
   *
   * @param level - 层级。
   * @returns 处理后的结果。
   */
  const resolvePanelFocusableItems = (level: number): ContextMenuItem[] =>
    flattenContextMenuLevelItems(
      resolveContextMenuLevelItems(runtimeState.resolvedItems, getOpenPath().slice(0, level))
    ).filter(isFocusableContextMenuItem);

  /**
   * 查找`First` 可聚焦键值。
   *
   * @param level - 层级。
   * @returns 处理后的结果。
   */
  const findFirstFocusableKey = (level: number): string | null =>
    resolvePanelFocusableItems(level)[0]?.key ?? null;

  /**
   * 为`Current` 打开路径同步焦点。
   *
   * @returns 无返回值。
   */
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

  /**
   * 处理 `loadLazyChildrenIfNeeded` 相关逻辑。
   *
   * @param item - 项目。
   * @returns 无返回值。
   */
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

  /**
   * 处理 `open` 相关逻辑。
   *
   * @param context - 当前上下文。
   * @param items - 项目。
   * @returns 无返回值。
   */
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

  /**
   * 处理 `close` 相关逻辑。
   *
   * @returns 无返回值。
   */
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

  /**
   * 设置打开路径。
   *
   * @param nextOpenPath - 下一步打开路径。
   * @returns 无返回值。
   */
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

  /**
   * 处理 `closeToLevel` 相关逻辑。
   *
   * @param level - 层级。
   * @returns 无返回值。
   */
  const closeToLevel = (level: number): void => {
    if (level <= 0) {
      setOpenPath([]);
      return;
    }

    setOpenPath(getOpenPath().slice(0, level));
  };

  // 再按当前规则组合结果，并把派生数据一并收口到输出里。
  /**
   * 设置`Focused` 键值。
   *
   * @param level - 层级。
   * @param key - 键值。
   * @returns 无返回值。
   */
  const setFocusedKey = (level: number, key: string | null): void => {
    if (runtimeState.focusedKeys[level] === key) {
      return;
    }

    runtimeState.focusedKeys[level] = key;
    emit();
  };

  /**
   * 处理 `focusByOffset` 相关逻辑。
   *
   * @param level - 层级。
   * @param offset - 偏移量。
   * @returns 无返回值。
   */
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

  /**
   * 处理 `focusHome` 相关逻辑。
   *
   * @param level - 层级。
   * @returns 无返回值。
   */
  const focusHome = (level: number): void => {
    setFocusedKey(level, findFirstFocusableKey(level));
  };

  /**
   * 处理 `focusEnd` 相关逻辑。
   *
   * @param level - 层级。
   * @returns 无返回值。
   */
  const focusEnd = (level: number): void => {
    const items = resolvePanelFocusableItems(level);
    setFocusedKey(level, items.at(-1)?.key ?? null);
  };

  /**
   * 处理 `activateItem` 相关逻辑。
   *
   * @param item - 项目。
   * @returns 无返回值。
   */
  const activateItem = async (item: ContextMenuItem): Promise<void> => {
    // 先整理当前阶段需要的输入、状态与依赖。
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
          // 再执行核心逻辑，并把结果或副作用统一收口。
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

  /**
   * 处理 `activateKey` 相关逻辑。
   *
   * @param level - 层级。
   * @param key - 键值。
   * @returns 无返回值。
   */
  const activateKey = async (level: number, key: string): Promise<void> => {
    const levelItems = resolvePanelFocusableItems(level);
    const item = levelItems.find((currentItem) => currentItem.key === key);
    if (!item) {
      return;
    }

    await activateItem(item);
  };

  /**
   * 处理 `activateFocused` 相关逻辑。
   *
   * @param level - 层级。
   * @returns 无返回值。
   */
  const activateFocused = async (level: number): Promise<void> => {
    const focusedKey = runtimeState.focusedKeys[level];
    if (!focusedKey) {
      return;
    }

    await activateKey(level, focusedKey);
  };

  /**
   * 设置解析器。
   *
   * @param resolver - 解析器。
   * @returns 无返回值。
   */
  const setResolver = (resolver?: ContextMenuResolver): void => {
    resolveItems = resolver;
    if (runtimeState.context) {
      runtimeState.sourceItems = resolveItems?.(runtimeState.context) ?? [];
      refreshResolvedItems();
      emit();
    }
  };

  /**
   * 设置`Controlled` 打开路径。
   *
   * @param nextControlledOpenPath - 下一步`Controlled` 打开路径。
   * @returns 无返回值。
   */
  const setControlledOpenPath = (
    nextControlledOpenPath?: readonly string[] | null
  ): void => {
    runtimeState.controlledOpenPath = nextControlledOpenPath ?? undefined;
    if (runtimeState.controlledOpenPath) {
      syncFocusForCurrentOpenPath();
      emit();
    }
  };

  /**
   * 获取子菜单触发模式。
   *
   * @param item - 项目。
   * @returns 处理后的结果。
   */
  const getSubmenuTriggerMode = (
    item?: ContextMenuSubmenuItem
  ): SubmenuTriggerMode => item?.submenuTriggerMode ?? options.submenuTriggerMode ?? "hover+click";

  /**
   * 获取打开延迟。
   *
   * @param item - 项目。
   * @returns 处理后的结果。
   */
  const getOpenDelay = (item?: ContextMenuSubmenuItem): number =>
    item?.openDelay ?? options.openDelay ?? 0;

  /**
   * 获取关闭延迟。
   *
   * @param item - 项目。
   * @returns 处理后的结果。
   */
  const getCloseDelay = (item?: ContextMenuSubmenuItem): number =>
    item?.closeDelay ?? options.closeDelay ?? 100;

  /**
   * 处理 `subscribe` 相关逻辑。
   *
   * @param listener - 需要注册的监听器。
   * @returns 用于取消当前订阅的清理函数。
   */
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

/**
 * 判断是否为上下文菜单分组项目。
 *
 * @param item - 项目。
 * @returns 对应的判断结果。
 */
export function isContextMenuGroupItem(
  item: ContextMenuItem
): item is ContextMenuGroupItem {
  return item.kind === "group";
}

/**
 * 判断是否为`Same` 打开路径。
 *
 * @param left - `left`。
 * @param right - `right`。
 * @returns 对应的判断结果。
 */
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
