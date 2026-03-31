/**
 * 节点 slot 视觉规则工具。
 *
 * @remarks
 * 负责把 slot 的“类型 -> 形状 / 颜色”规则集中到一处，
 * 让节点壳、正式连线和拖线预览都复用同一套归一逻辑。
 */

import type {
  NodeRuntimeState,
  NodeSlotShape,
  NodeSlotSpec,
  SlotDirection,
  SlotType
} from "@leafergraph/node";

/** 事件族类型统一映射到同一个可比较语义。 */
const SLOT_TYPE_COMPARE_ALIAS_MAP: Readonly<Record<string, string>> = {
  exec: "event",
  trigger: "event",
  flow: "event"
};

export interface ResolveSlotTypeFillOptions {
  slotTypeFillMap: Readonly<Record<string, string>>;
  genericFill?: string;
}

type NodeSlotStateLike = Pick<NodeRuntimeState, "inputs" | "outputs">;

/**
 * 读取某个节点某个方向某个槽位的正式 slot 声明。
 *
 * @remarks
 * 当前统一在这里做索引归一，避免调用方每次都重复写边界判断。
 *
 * @param node - 节点。
 * @param direction - `direction`。
 * @param slot - 槽位。
 * @returns 处理后的结果。
 */
export function resolveNodeSlotSpec(
  node: NodeSlotStateLike,
  direction: SlotDirection,
  slot: number
): NodeSlotSpec | undefined {
  const safeSlot = normalizeSlotIndex(slot);
  return direction === "input"
    ? node.inputs[safeSlot]
    : node.outputs[safeSlot];
}

/**
 * 解析某个 slot 最终应展示成什么形状。
 *
 * @remarks
 * 优先尊重显式 `shape`，否则再按类型推导默认形状。
 *
 * @param slot - 槽位。
 * @returns 处理后的结果。
 */
export function resolveNodeSlotShape(
  slot: Pick<NodeSlotSpec, "shape" | "type"> | undefined
): NodeSlotShape {
  if (slot?.shape) {
    return slot.shape;
  }

  return isEventSlotType(slot?.type) ? "box" : "circle";
}

/**
 *  判断当前 slot 类型是否属于事件族。
 *
 * @param type - 类型。
 * @returns 对应的判断结果。
 */
export function isEventSlotType(type: SlotType | undefined): boolean {
  return normalizeComparableSlotTypes(type).includes("event");
}

/**
 * 根据 slot 类型解析默认展示色。
 *
 * @remarks
 * 这里不处理 `slot.color`，显式颜色覆盖由上层自己决定优先级。
 *
 * @param type - 类型。
 * @param options - 可选配置项。
 * @returns 处理后的结果。
 */
export function resolveSlotTypeFill(
  type: SlotType | undefined,
  options: ResolveSlotTypeFillOptions
): string | undefined {
  if (type === 0) {
    return options.genericFill;
  }

  if (typeof type !== "string") {
    return undefined;
  }

  for (const candidate of createSlotTypeCandidates(type)) {
    const color = options.slotTypeFillMap[candidate];
    if (color) {
      return color;
    }
  }

  return undefined;
}

/**
 * 解析某个节点某个 slot 的最终展示色。
 *
 * @remarks
 * 当前只负责 slot 本身颜色，不决定正式连线或拖线预览的最终回退色。
 *
 * @param node - 节点。
 * @param direction - `direction`。
 * @param slot - 槽位。
 * @param options - 可选配置项。
 * @returns 处理后的结果。
 */
export function resolveNodeSlotFill(
  node: NodeSlotStateLike,
  direction: SlotDirection,
  slot: number,
  options: ResolveSlotTypeFillOptions
): string | undefined {
  const slotSpec = resolveNodeSlotSpec(node, direction, slot);
  if (typeof slotSpec?.color === "string" && slotSpec.color.trim()) {
    return slotSpec.color;
  }

  return resolveSlotTypeFill(slotSpec?.type, options);
}

/**
 * 把 slot 类型归一成可比较 token。
 *
 * @remarks
 * 这条链路只服务“类型兼容 / 事件族归一”判断，
 * 因此会把 `exec / trigger / flow` 统一成 `event`。
 *
 * @param type - 类型。
 * @returns 处理后的结果。
 */
export function normalizeComparableSlotTypes(
  type: SlotType | undefined
): string[] {
  if (type === undefined || type === 0) {
    return [];
  }

  const comparable = new Set<string>();
  for (const token of createSlotTypeCandidates(type)) {
    const normalized = SLOT_TYPE_COMPARE_ALIAS_MAP[token] ?? token;
    if (normalized) {
      comparable.add(normalized);
    }
  }

  return [...comparable];
}

/**
 *  为节点壳 glyph 和高亮框统一解析角半径。
 *
 * @param shape - `shape`。
 * @param size - `size`。
 * @returns 处理后的结果。
 */
export function resolveSlotCornerRadius(
  shape: NodeSlotShape,
  size: number
): number {
  if (shape === "circle") {
    return 999;
  }

  return Math.max(2, Math.round(size * 0.18));
}

/**
 *  统一归一 slot 索引，避免访问运行时数组时出现负值或浮点索引。
 *
 * @param slot - 槽位。
 * @returns 处理后的结果。
 */
function normalizeSlotIndex(slot: number | undefined): number {
  if (typeof slot !== "number" || !Number.isFinite(slot)) {
    return 0;
  }

  return Math.max(0, Math.floor(slot));
}

/**
 * 生成 slot 类型匹配和着色要用到的候选 token。
 *
 * @remarks
 * 这里会同时保留：
 * - 原始 token
 * - 去掉数组后缀 `[]` 的 token
 * - 常见分隔符拆开的 token
 *
 * @param type - 类型。
 * @returns 创建后的结果对象。
 */
function createSlotTypeCandidates(type: SlotType): string[] {
  if (type === 0) {
    return [];
  }

  const normalized = String(type).trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const candidates = new Set<string>();
  candidates.add(normalized);

  const baseToken = normalized.replace(/\[\]$/, "");
  if (baseToken) {
    candidates.add(baseToken);
  }

  for (const token of normalized.split(/[\s,|/:]+/)) {
    const trimmed = token.trim();
    if (!trimmed) {
      continue;
    }

    candidates.add(trimmed);
    const trimmedBase = trimmed.replace(/\[\]$/, "");
    if (trimmedBase) {
      candidates.add(trimmedBase);
    }
  }

  return [...candidates];
}
