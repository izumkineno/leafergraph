/**
 * 右键菜单 schema 规范化工具。
 *
 * @remarks
 * 负责把原始配置解析成当前上下文下真正可见、可用的菜单树，
 * 并统一处理排序、目标过滤、受控 / 非受控勾选状态等逻辑。
 */

import type {
  ContextMenuCheckboxItem,
  ContextMenuContext,
  ContextMenuGroupItem,
  ContextMenuItem,
  ContextMenuRadioItem,
  ContextMenuSeparatorItem,
  ContextMenuSubmenuItem
} from "./types";

export interface ContextMenuSelectionState {
  checkboxState: Map<string, boolean>;
  radioState: Map<string, string>;
  lazyChildrenState: Map<string, ContextMenuLazyChildrenState>;
}

export interface ContextMenuLazyChildrenState {
  status: "idle" | "loading" | "loaded" | "error";
  items?: ContextMenuItem[];
  error?: unknown;
}

/**
 * 规范化上下文菜单项目。
 *
 * @param items - 项目。
 * @param context - 当前上下文。
 * @param selectionState - 当前状态。
 * @returns 处理后的结果。
 */
export function normalizeContextMenuItems(
  items: readonly ContextMenuItem[],
  context: ContextMenuContext,
  selectionState: ContextMenuSelectionState
): ContextMenuItem[] {
  // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
  const normalized: ContextMenuItem[] = [];

  for (const item of sortContextMenuItems(items)) {
    if (item.kind !== "separator" && !isContextMenuItemVisible(item, context)) {
      continue;
    }

    if (item.kind === "group") {
      const children = normalizeContextMenuItems(
        item.children,
        context,
        selectionState
      );
      if (!children.length) {
        continue;
      }

      normalized.push({
        ...item,
        children
      });
      continue;
    }

    if (item.kind === "submenu") {
      const children = resolveSubmenuChildren(item, selectionState);
      const normalizedChildren = children
        ? normalizeContextMenuItems(children, context, selectionState)
        : [];
      if (!normalizedChildren.length && !item.lazyChildren) {
        // 再按当前规则组合结果，并把派生数据一并收口到输出里。
        continue;
      }

      normalized.push({
        ...item,
        disabled: resolveItemDisabled(item, context),
        children: normalizedChildren
      });
      continue;
    }

    if (item.kind === "checkbox") {
      normalized.push({
        ...item,
        disabled: resolveItemDisabled(item, context),
        checked: resolveCheckboxChecked(item, selectionState)
      });
      continue;
    }

    if (item.kind === "radio") {
      normalized.push({
        ...item,
        disabled: resolveItemDisabled(item, context),
        checked: resolveRadioChecked(item, selectionState)
      });
      continue;
    }

    if (item.kind === "separator") {
      normalized.push(item);
      continue;
    }

    normalized.push({
      ...item,
      disabled: resolveItemDisabled(item, context)
    });
  }

  return trimContextMenuSeparators(normalized);
}

/**
 * 裁剪上下文菜单分隔符。
 *
 * @param items - 项目。
 * @returns 裁剪上下文菜单分隔符的结果。
 */
export function trimContextMenuSeparators(
  items: readonly ContextMenuItem[]
): ContextMenuItem[] {
  const normalized: ContextMenuItem[] = [];

  for (const item of items) {
    const previous = normalized.at(-1);
    if (item.kind === "separator" && (!previous || previous.kind === "separator")) {
      continue;
    }

    normalized.push(item);
  }

  while (normalized[0]?.kind === "separator") {
    normalized.shift();
  }

  while (normalized.at(-1)?.kind === "separator") {
    normalized.pop();
  }

  return normalized;
}

/**
 * 展平上下文菜单层级项目。
 *
 * @param items - 项目。
 * @returns 展平上下文菜单层级项目的结果。
 */
export function flattenContextMenuLevelItems(
  items: readonly ContextMenuItem[]
): ContextMenuItem[] {
  const flattened: ContextMenuItem[] = [];

  for (const item of items) {
    if (item.kind === "group") {
      flattened.push(...flattenContextMenuLevelItems(item.children));
      continue;
    }

    flattened.push(item);
  }

  return flattened;
}

/**
 * 判断是否为可聚焦上下文菜单项目。
 *
 * @param item - 项目。
 * @returns 对应的判断结果。
 */
export function isFocusableContextMenuItem(
  item: ContextMenuItem
): item is Exclude<ContextMenuItem, ContextMenuSeparatorItem | ContextMenuGroupItem> {
  if (item.kind === "separator" || item.kind === "group") {
    return false;
  }

  return !item.disabled;
}

/**
 * 按路径查找上下文菜单项目。
 *
 * @param items - 项目。
 * @param itemPath - 项目路径。
 * @returns 处理后的结果。
 */
export function findContextMenuItemByPath(
  items: readonly ContextMenuItem[],
  itemPath: readonly string[]
): ContextMenuItem | undefined {
  if (!itemPath.length) {
    return undefined;
  }

  let currentItems = items;
  let currentItem: ContextMenuItem | undefined;

  for (const key of itemPath) {
    currentItem = findContextMenuItemByKey(currentItems, key);
    if (!currentItem) {
      return undefined;
    }

    if (currentItem.kind === "submenu") {
      currentItems = currentItem.children ?? [];
      continue;
    }

    if (currentItem.kind === "group") {
      currentItems = currentItem.children;
      continue;
    }
  }

  return currentItem;
}

/**
 * 按键值查找上下文菜单项目。
 *
 * @param items - 项目。
 * @param key - 键值。
 * @returns 处理后的结果。
 */
export function findContextMenuItemByKey(
  items: readonly ContextMenuItem[],
  key: string
): ContextMenuItem | undefined {
  for (const item of items) {
    if ("key" in item && item.key === key) {
      return item;
    }

    if (item.kind === "group") {
      const child = findContextMenuItemByKey(item.children, key);
      if (child) {
        return child;
      }
    }

    if (item.kind === "submenu" && item.children?.length) {
      const child = findContextMenuItemByKey(item.children, key);
      if (child) {
        return child;
      }
    }
  }

  return undefined;
}

/**
 * 解析上下文菜单层级项目。
 *
 * @param items - 项目。
 * @param openPath - 打开路径。
 * @returns 处理后的结果。
 */
export function resolveContextMenuLevelItems(
  items: readonly ContextMenuItem[],
  openPath: readonly string[]
): ContextMenuItem[] {
  let currentItems = items;

  for (const submenuKey of openPath) {
    const currentItem = findContextMenuItemByKey(currentItems, submenuKey);
    if (!currentItem || currentItem.kind !== "submenu") {
      return [];
    }

    currentItems = [...(currentItem.children ?? [])];
  }

  return [...currentItems];
}

/**
 * 排序上下文菜单项目。
 *
 * @param items - 项目。
 * @returns 排序上下文菜单项目的结果。
 */
function sortContextMenuItems(
  items: readonly ContextMenuItem[]
): ContextMenuItem[] {
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftOrder = "order" in left.item ? left.item.order ?? 0 : 0;
      const rightOrder = "order" in right.item ? right.item.order ?? 0 : 0;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.index - right.index;
    })
    .map(({ item }) => item);
}

/**
 * 判断是否为上下文菜单项目可见状态。
 *
 * @param item - 项目。
 * @param context - 当前上下文。
 * @returns 对应的判断结果。
 */
function isContextMenuItemVisible(
  item: Exclude<ContextMenuItem, ContextMenuSeparatorItem>,
  context: ContextMenuContext
): boolean {
  if (item.hidden) {
    return false;
  }

  if (item.targetKinds?.length && !item.targetKinds.includes(context.target.kind)) {
    return false;
  }

  if (
    item.excludeTargetKinds?.length &&
    item.excludeTargetKinds.includes(context.target.kind)
  ) {
    return false;
  }

  return item.when?.(context) ?? true;
}

/**
 * 解析项目`Disabled`。
 *
 * @param item - 项目。
 * @param context - 当前上下文。
 * @returns 对应的判断结果。
 */
function resolveItemDisabled(
  item: Exclude<ContextMenuItem, ContextMenuSeparatorItem>,
  context: ContextMenuContext
): boolean {
  if (item.disabled) {
    return true;
  }

  const enabled = item.enableWhen?.(context);
  return enabled === undefined ? false : !enabled;
}

/**
 * 解析子菜单子项。
 *
 * @param item - 项目。
 * @param selectionState - 当前状态。
 * @returns 处理后的结果。
 */
function resolveSubmenuChildren(
  item: ContextMenuSubmenuItem,
  selectionState: ContextMenuSelectionState
): ContextMenuItem[] | undefined {
  if (item.children) {
    return item.children;
  }

  return selectionState.lazyChildrenState.get(item.key)?.items;
}

/**
 * 解析复选框`Checked`。
 *
 * @param item - 项目。
 * @param selectionState - 当前状态。
 * @returns 对应的判断结果。
 */
function resolveCheckboxChecked(
  item: ContextMenuCheckboxItem,
  selectionState: ContextMenuSelectionState
): boolean {
  if (item.checked !== undefined) {
    return item.checked;
  }

  if (!selectionState.checkboxState.has(item.key)) {
    selectionState.checkboxState.set(item.key, item.defaultChecked ?? false);
  }

  return selectionState.checkboxState.get(item.key) ?? false;
}

/**
 * 解析单选项`Checked`。
 *
 * @param item - 项目。
 * @param selectionState - 当前状态。
 * @returns 对应的判断结果。
 */
function resolveRadioChecked(
  item: ContextMenuRadioItem,
  selectionState: ContextMenuSelectionState
): boolean {
  if (item.checked !== undefined) {
    return item.checked;
  }

  if (!selectionState.radioState.has(item.groupKey) && item.defaultChecked) {
    selectionState.radioState.set(item.groupKey, item.value);
  }

  return selectionState.radioState.get(item.groupKey) === item.value;
}
