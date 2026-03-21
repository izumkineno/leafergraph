import type { GraphDocument, LeaferGraphUpdateNodeInput } from "leafergraph";

type EditorNodeSnapshot = GraphDocument["nodes"][number];
type EditorNodeWidgetList = NonNullable<EditorNodeSnapshot["widgets"]>;

function cloneUpdateInput(
  input: LeaferGraphUpdateNodeInput
): LeaferGraphUpdateNodeInput {
  return structuredClone(input);
}

function findNodeSnapshot(
  document: GraphDocument,
  nodeId: string
): EditorNodeSnapshot | undefined {
  return document.nodes.find((node) => node.id === nodeId);
}

function collectPropertyBackedWidgetNames(
  node: EditorNodeSnapshot | undefined
): Set<string> {
  const widgetNames = new Set<string>();

  for (const propertyName of Object.keys(node?.properties ?? {})) {
    const safePropertyName = propertyName.trim();
    if (safePropertyName) {
      widgetNames.add(safePropertyName);
    }
  }

  for (const propertySpec of node?.propertySpecs ?? []) {
    const safePropertyName = propertySpec.name.trim();
    if (safePropertyName) {
      widgetNames.add(safePropertyName);
    }
  }

  return widgetNames;
}

function createMirroredWidgetProperties(
  baseProperties: EditorNodeSnapshot["properties"],
  widgets: EditorNodeWidgetList,
  propertyBackedWidgetNames: ReadonlySet<string>
): EditorNodeSnapshot["properties"] | undefined {
  let mirrored = false;
  const nextProperties: Record<string, unknown> = structuredClone(
    baseProperties ?? {}
  );

  for (const widget of widgets) {
    const widgetName = widget.name.trim();
    if (!widgetName || !propertyBackedWidgetNames.has(widgetName)) {
      continue;
    }

    mirrored = true;
    nextProperties[widgetName] = structuredClone(widget.value);
  }

  return mirrored ? nextProperties : undefined;
}

/**
 * 为节点 widget 提交生成正式 `node.update` 输入。
 *
 * @remarks
 * 远端 authority 以 `properties` 作为持久化事实源；
 * 因此当 widget 名命中现有 property / propertySpec 时，
 * 这里会把 widget 值同时镜像回同名 property。
 */
export function createWidgetCommitUpdateInputs(options: {
  document: GraphDocument;
  nodeId: string;
  beforeWidgets: EditorNodeWidgetList;
  afterWidgets: EditorNodeWidgetList;
}): {
  beforeInput: LeaferGraphUpdateNodeInput;
  afterInput: LeaferGraphUpdateNodeInput;
} {
  const node = findNodeSnapshot(options.document, options.nodeId);
  const propertyBackedWidgetNames = collectPropertyBackedWidgetNames(node);
  const beforeProperties = createMirroredWidgetProperties(
    node?.properties,
    options.beforeWidgets,
    propertyBackedWidgetNames
  );
  const afterProperties = createMirroredWidgetProperties(
    node?.properties,
    options.afterWidgets,
    propertyBackedWidgetNames
  );

  return {
    beforeInput: cloneUpdateInput({
      widgets: structuredClone(options.beforeWidgets),
      ...(beforeProperties !== undefined
        ? { properties: structuredClone(beforeProperties) }
        : {})
    }),
    afterInput: cloneUpdateInput({
      widgets: structuredClone(options.afterWidgets),
      ...(afterProperties !== undefined
        ? { properties: structuredClone(afterProperties) }
        : {})
    })
  };
}
