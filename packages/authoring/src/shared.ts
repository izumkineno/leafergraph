/**
 * Shared authoring helpers and basic types.
 */

export {
  clonePropertySpec,
  clonePropertySpecs,
  cloneRecord,
  cloneSlotSpec,
  cloneSlotSpecs,
  cloneValue,
  cloneWidgetSpec,
  cloneWidgetSpecs
} from "@leafergraph/node";

export type NodeProps = Record<string, unknown>;
export type NodeInputs = Record<string, unknown>;
export type NodeOutputs = Record<string, unknown>;
export type NodeState = Record<string, unknown>;
export type WidgetState = Record<string, unknown>;

export function cloneStringList(list?: string[]): string[] | undefined {
  return list ? [...list] : undefined;
}

export function assertNonEmptyText(value: string, label: string): string {
  const safeValue = value.trim();
  if (!safeValue) {
    throw new Error(`${label}不能为空`);
  }

  return safeValue;
}

export function assertUniqueNames(
  items: Array<{ name: string }>,
  label: string
): void {
  const seen = new Set<string>();

  for (const item of items) {
    const safeName = item.name.trim();
    if (!safeName) {
      throw new Error(`${label}名称不能为空`);
    }

    if (seen.has(safeName)) {
      throw new Error(`${label}名称重复: ${safeName}`);
    }

    seen.add(safeName);
  }
}
