import type {
  GraphLink,
  GraphOperation,
  LeaferGraph,
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphMoveNodeInput,
  LeaferGraphResizeNodeInput,
  LeaferGraphUpdateDocumentInput,
  LeaferGraphUpdateNodeInput
} from "leafergraph";
import { sanitizePersistedNodeFlags } from "./node_flag_utils";

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
let editorGraphEntitySeed = 1;

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

/** 为 editor 侧待创建实体生成稳定 ID。 */
export function createEditorGraphEntityId(
  kind: "node" | "link"
): string {
  const entityId = `editor:${kind}:${Date.now()}:${editorGraphEntitySeed}`;
  editorGraphEntitySeed += 1;
  return entityId;
}

/** 确保节点创建输入具备稳定 ID。 */
export function ensureNodeCreateInputId(
  input: LeaferGraphCreateNodeInput
): LeaferGraphCreateNodeInput {
  const nextInput = structuredClone(input);
  nextInput.id ??= createEditorGraphEntityId("node");
  return nextInput;
}

/** 确保连线创建输入具备稳定 ID。 */
export function ensureLinkCreateInputId(
  input: LeaferGraphCreateLinkInput
): LeaferGraphCreateLinkInput {
  const nextInput = structuredClone(input);
  nextInput.id ??= createEditorGraphEntityId("link");
  return nextInput;
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
    data: snapshot.data,
    flags: sanitizePersistedNodeFlags(snapshot.flags)
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

/** 生成一条 `document.update` 操作。 */
export function createDocumentUpdateOperation(
  input: LeaferGraphUpdateDocumentInput,
  source = "editor"
): Extract<GraphOperation, { type: "document.update" }> {
  return createEditorGraphOperation(
    "document.update",
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

/** 生成一条 `node.update` 操作。 */
export function createNodeUpdateOperation(
  nodeId: string,
  input: LeaferGraphUpdateNodeInput,
  source = "editor"
): Extract<GraphOperation, { type: "node.update" }> {
  return createEditorGraphOperation(
    "node.update",
    {
      nodeId,
      input: structuredClone(input)
    },
    source
  );
}

/** 生成一条 `node.move` 操作。 */
export function createNodeMoveOperation(
  nodeId: string,
  position: LeaferGraphMoveNodeInput,
  source = "editor"
): Extract<GraphOperation, { type: "node.move" }> {
  return createEditorGraphOperation(
    "node.move",
    {
      nodeId,
      input: structuredClone(position)
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
    case "document.update":
      return createEditorGraphOperation(
        "document.update",
        {
          input: structuredClone(operation.input)
        },
        source
      );
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
