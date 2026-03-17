import type {
  GraphLink,
  GraphOperation,
  LeaferGraph,
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphResizeNodeInput
} from "leafergraph";

type GraphOperationType = GraphOperation["type"];

type GraphOperationPayload<TType extends GraphOperationType> = Omit<
  Extract<GraphOperation, { type: TType }>,
  "type" | "operationId" | "timestamp" | "source"
>;

/** editor 命令层复用的正式节点快照类型。 */
export type EditorGraphNodeSnapshot = NonNullable<
  ReturnType<LeaferGraph["getNodeSnapshot"]>
>;

let editorGraphOperationSeed = 1;

/**
 * 创建一条带稳定元数据的 editor 图操作。
 *
 * @remarks
 * 当前阶段统一由 editor 生成 `operationId / timestamp / source`，
 * 这样命令总线、历史记录和局部命令控制器不会再各自维护一套拼装逻辑。
 */
export function createEditorGraphOperation<TType extends GraphOperationType>(
  type: TType,
  payload: GraphOperationPayload<TType>,
  source = "editor"
): Extract<GraphOperation, { type: TType }> {
  const timestamp = Date.now();
  const operation = {
    ...payload,
    type,
    operationId: `editor:${type}:${timestamp}:${editorGraphOperationSeed}`,
    timestamp,
    source
  };

  editorGraphOperationSeed += 1;
  return operation as Extract<GraphOperation, { type: TType }>;
}

/** 把正式节点快照重新包装成 `node.create` 可消费的输入。 */
export function createNodeInputFromSnapshot(
  snapshot: EditorGraphNodeSnapshot
): LeaferGraphCreateNodeInput {
  return structuredClone({
    id: snapshot.id,
    type: snapshot.type,
    title: snapshot.title,
    x: snapshot.layout.x,
    y: snapshot.layout.y,
    width: snapshot.layout.width,
    height: snapshot.layout.height,
    properties: snapshot.properties,
    propertySpecs: snapshot.propertySpecs,
    inputs: snapshot.inputs,
    outputs: snapshot.outputs,
    widgets: snapshot.widgets,
    data: snapshot.data
  } satisfies LeaferGraphCreateNodeInput);
}

/** 生成一条 `node.create` 操作。 */
export function createNodeCreateOperation(
  input: LeaferGraphCreateNodeInput,
  source = "editor"
): Extract<GraphOperation, { type: "node.create" }> {
  return createEditorGraphOperation(
    "node.create",
    {
      input: structuredClone(input)
    },
    source
  );
}

/** 从正式节点快照生成一条 `node.create` 操作。 */
export function createNodeCreateOperationFromSnapshot(
  snapshot: EditorGraphNodeSnapshot,
  source = "editor"
): Extract<GraphOperation, { type: "node.create" }> {
  return createEditorGraphOperation(
    "node.create",
    {
      input: createNodeInputFromSnapshot(snapshot)
    },
    source
  );
}

/** 生成一条 `node.remove` 操作。 */
export function createNodeRemoveOperation(
  nodeId: string,
  source = "editor"
): Extract<GraphOperation, { type: "node.remove" }> {
  return createEditorGraphOperation(
    "node.remove",
    {
      nodeId
    },
    source
  );
}

/** 生成一条 `node.resize` 操作。 */
export function createNodeResizeOperation(
  nodeId: string,
  size: LeaferGraphResizeNodeInput,
  source = "editor"
): Extract<GraphOperation, { type: "node.resize" }> {
  return createEditorGraphOperation(
    "node.resize",
    {
      nodeId,
      input: structuredClone(size)
    },
    source
  );
}

/** 把正式连线快照转成 `link.create` 可消费的输入。 */
export function createLinkInputFromSnapshot(
  link: GraphLink | LeaferGraphCreateLinkInput
): LeaferGraphCreateLinkInput {
  return structuredClone({
    id: link.id,
    source: link.source,
    target: link.target,
    label: link.label,
    data: link.data
  } satisfies LeaferGraphCreateLinkInput);
}

/** 从正式连线快照生成一条 `link.create` 操作。 */
export function createLinkCreateOperation(
  link: GraphLink | LeaferGraphCreateLinkInput,
  source = "editor"
): Extract<GraphOperation, { type: "link.create" }> {
  return createEditorGraphOperation(
    "link.create",
    {
      input: createLinkInputFromSnapshot(link)
    },
    source
  );
}

/** 生成一条 `link.remove` 操作。 */
export function createLinkRemoveOperation(
  linkId: string,
  source = "editor"
): Extract<GraphOperation, { type: "link.remove" }> {
  return createEditorGraphOperation(
    "link.remove",
    {
      linkId
    },
    source
  );
}

/** 生成一条 `link.reconnect` 操作。 */
export function createLinkReconnectOperation(
  linkId: string,
  input: {
    source?: GraphLink["source"];
    target?: GraphLink["target"];
  },
  source = "editor"
): Extract<GraphOperation, { type: "link.reconnect" }> {
  return createEditorGraphOperation(
    "link.reconnect",
    {
      linkId,
      input: structuredClone(input)
    },
    source
  );
}

/** 用新的来源信息重建一条正式图操作。 */
export function recreateGraphOperation(
  operation: GraphOperation,
  source = operation.source
): GraphOperation {
  switch (operation.type) {
    case "node.create":
      return createEditorGraphOperation(
        "node.create",
        {
          input: structuredClone(operation.input)
        },
        source
      );
    case "node.update":
      return createEditorGraphOperation(
        "node.update",
        {
          nodeId: operation.nodeId,
          input: structuredClone(operation.input)
        },
        source
      );
    case "node.move":
      return createEditorGraphOperation(
        "node.move",
        {
          nodeId: operation.nodeId,
          input: structuredClone(operation.input)
        },
        source
      );
    case "node.resize":
      return createEditorGraphOperation(
        "node.resize",
        {
          nodeId: operation.nodeId,
          input: structuredClone(operation.input)
        },
        source
      );
    case "node.remove":
      return createEditorGraphOperation(
        "node.remove",
        {
          nodeId: operation.nodeId
        },
        source
      );
    case "link.create":
      return createEditorGraphOperation(
        "link.create",
        {
          input: structuredClone(operation.input)
        },
        source
      );
    case "link.remove":
      return createEditorGraphOperation(
        "link.remove",
        {
          linkId: operation.linkId
        },
        source
      );
    case "link.reconnect":
      return createEditorGraphOperation(
        "link.reconnect",
        {
          linkId: operation.linkId,
          input: structuredClone(operation.input)
        },
        source
      );
  }
}
