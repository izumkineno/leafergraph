/**
 * 画布交互提交转正式图操作的 demo-local 工具模块。
 *
 * @remarks
 * `tauri-backend-demo` 不直接依赖 editor 的交互桥实现，
 * 这里仅保留 demo 需要的最小能力：
 * - 节点移动
 * - 节点缩放
 * - 节点折叠切换
 * - 节点 widget 提交
 * - 连线创建
 */
import type {
  GraphDocument,
  GraphOperation,
  LeaferGraphCreateLinkInput,
  LeaferGraphInteractionCommitEvent,
  LeaferGraphMoveNodeInput,
  LeaferGraphResizeNodeInput,
  LeaferGraphUpdateNodeInput
} from "leafergraph";

type GraphOperationType = GraphOperation["type"];
type GraphOperationPayload<TType extends GraphOperationType> = Omit<
  Extract<GraphOperation, { type: TType }>,
  "type" | "operationId" | "timestamp" | "source"
>;

type DemoNodeSnapshot = GraphDocument["nodes"][number];
type DemoNodeWidgetList = NonNullable<DemoNodeSnapshot["widgets"]>;

let demoOperationSeed = 1;
let demoLinkSeed = 1;

function createDemoOperation<TType extends GraphOperationType>(
  type: TType,
  payload: GraphOperationPayload<TType>
): Extract<GraphOperation, { type: TType }> {
  const timestamp = Date.now();
  const operation = {
    ...payload,
    type,
    operationId: `tauri-demo:${type}:${timestamp}:${demoOperationSeed}`,
    timestamp,
    source: "tauri-backend-demo.interaction"
  };

  demoOperationSeed += 1;
  return operation as Extract<GraphOperation, { type: TType }>;
}

function findNodeSnapshot(
  document: GraphDocument,
  nodeId: string
): DemoNodeSnapshot | undefined {
  return document.nodes.find((node) => node.id === nodeId);
}

function ensureLinkCreateInputId(
  input: LeaferGraphCreateLinkInput
): LeaferGraphCreateLinkInput {
  const nextInput = structuredClone(input);
  nextInput.id ??= `tauri-demo:link:${Date.now()}:${demoLinkSeed}`;
  demoLinkSeed += 1;
  return nextInput;
}

function createNodeMoveOperation(
  nodeId: string,
  input: LeaferGraphMoveNodeInput
): Extract<GraphOperation, { type: "node.move" }> {
  return createDemoOperation("node.move", {
    nodeId,
    input: structuredClone(input)
  });
}

function createNodeResizeOperation(
  nodeId: string,
  input: LeaferGraphResizeNodeInput
): Extract<GraphOperation, { type: "node.resize" }> {
  return createDemoOperation("node.resize", {
    nodeId,
    input: structuredClone(input)
  });
}

function createNodeUpdateOperation(
  nodeId: string,
  input: LeaferGraphUpdateNodeInput
): Extract<GraphOperation, { type: "node.update" }> {
  return createDemoOperation("node.update", {
    nodeId,
    input: structuredClone(input)
  });
}

function createLinkCreateOperation(
  input: LeaferGraphCreateLinkInput
): Extract<GraphOperation, { type: "link.create" }> {
  return createDemoOperation("link.create", {
    input: ensureLinkCreateInputId(input)
  });
}

function collectPropertyBackedWidgetNames(
  node: DemoNodeSnapshot | undefined
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
  baseProperties: DemoNodeSnapshot["properties"],
  widgets: DemoNodeWidgetList,
  propertyBackedWidgetNames: ReadonlySet<string>
): DemoNodeSnapshot["properties"] | undefined {
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

function createWidgetCommitUpdateInput(
  document: GraphDocument,
  nodeId: string,
  widgets: DemoNodeWidgetList
): LeaferGraphUpdateNodeInput {
  const node = findNodeSnapshot(document, nodeId);
  const propertyBackedWidgetNames = collectPropertyBackedWidgetNames(node);
  const mirroredProperties = createMirroredWidgetProperties(
    node?.properties,
    widgets,
    propertyBackedWidgetNames
  );

  return {
    widgets: structuredClone(widgets),
    ...(mirroredProperties !== undefined
      ? { properties: structuredClone(mirroredProperties) }
      : {})
  };
}

/**
 * 把一次主包交互提交转换成可提交给 sync session 的正式图操作列表。
 *
 * @remarks
 * 节点多选拖拽会展开成多条 `node.move`，其余交互当前都只产生一条操作。
 */
export function createOperationsFromInteractionCommit(
  document: GraphDocument,
  event: LeaferGraphInteractionCommitEvent
): GraphOperation[] {
  switch (event.type) {
    case "node.move.commit":
      return event.entries.map((entry) =>
        createNodeMoveOperation(entry.nodeId, entry.after)
      );
    case "node.resize.commit":
      return [createNodeResizeOperation(event.nodeId, event.after)];
    case "node.collapse.commit":
      return [
        createNodeUpdateOperation(event.nodeId, {
          flags: {
            collapsed: event.afterCollapsed
          }
        })
      ];
    case "node.widget.commit":
      return [
        createNodeUpdateOperation(
          event.nodeId,
          createWidgetCommitUpdateInput(
            document,
            event.nodeId,
            event.afterWidgets
          )
        )
      ];
    case "link.create.commit":
      return [createLinkCreateOperation(event.input)];
  }
}

