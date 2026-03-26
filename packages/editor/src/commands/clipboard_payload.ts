/**
 * LeaferGraph 剪贴板 payload 模块。
 *
 * @remarks
 * 负责 editor 节点复制粘贴所需的 payload 序列化、反序列化和快照重建，
 * 让内存剪贴板与浏览器剪贴板共用同一份结构。
 */
import type {
  GraphLink,
  LeaferGraph,
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput
} from "leafergraph";
import type { NodeSerializeResult } from "@leafergraph/node";
import {
  createLinkCreateOperation,
  createNodeCreateOperation,
  ensureLinkCreateInputId,
  ensureNodeCreateInputId
} from "./graph_operation_utils";
import { sanitizePersistedNodeFlags } from "./node_flag_utils";
import type { EditorGraphDocumentSession } from "../session/graph_document_session";

/** editor 写入系统剪贴板的 LeaferGraph JSON 负载。 */
export interface LeaferGraphClipboardPayload {
  kind: "leafergraph/clipboard";
  version: 1;
  anchor: {
    x: number;
    y: number;
  };
  nodes: NodeSerializeResult[];
  links: GraphLink[];
}

type ClipboardNodeSnapshot = NonNullable<ReturnType<LeaferGraph["getNodeSnapshot"]>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeNodeIdList(nodeIds: readonly string[]): string[] {
  const orderedNodeIds: string[] = [];
  const nodeIdSet = new Set<string>();

  for (const nodeId of nodeIds) {
    const safeNodeId = nodeId.trim();
    if (!safeNodeId || nodeIdSet.has(safeNodeId)) {
      continue;
    }

    nodeIdSet.add(safeNodeId);
    orderedNodeIds.push(safeNodeId);
  }

  return orderedNodeIds;
}

function cloneClipboardLink(link: GraphLink): GraphLink {
  return structuredClone(link);
}

function isClipboardInternalLink(
  link: GraphLink,
  nodeIdSet: ReadonlySet<string>
): boolean {
  return (
    nodeIdSet.has(link.source.nodeId) && nodeIdSet.has(link.target.nodeId)
  );
}

function captureClipboardLinks(
  graph: LeaferGraph,
  nodeIds: readonly string[]
): GraphLink[] {
  const orderedNodeIds = normalizeNodeIdList(nodeIds);
  if (!orderedNodeIds.length) {
    return [];
  }

  const nodeIdSet = new Set(orderedNodeIds);
  const linkMap = new Map<string, GraphLink>();

  for (const nodeId of orderedNodeIds) {
    for (const link of graph.findLinksByNode(nodeId)) {
      if (!isClipboardInternalLink(link, nodeIdSet)) {
        continue;
      }

      if (!linkMap.has(link.id)) {
        linkMap.set(link.id, cloneClipboardLink(link));
      }
    }
  }

  return [...linkMap.values()];
}

function createNodeInputFromPayloadNode(
  snapshot: NodeSerializeResult,
  x: number = snapshot.layout.x,
  y: number = snapshot.layout.y
): LeaferGraphCreateNodeInput {
  return structuredClone({
    type: snapshot.type,
    title: snapshot.title,
    x: Math.round(x),
    y: Math.round(y),
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

function createPendingNodeSnapshot(
  input: LeaferGraphCreateNodeInput
): ClipboardNodeSnapshot {
  const normalizedInput = ensureNodeCreateInputId(input);
  return {
    id: normalizedInput.id ?? "",
    type: normalizedInput.type,
    title: normalizedInput.title ?? normalizedInput.type,
    layout: {
      x: normalizedInput.x,
      y: normalizedInput.y,
      width: normalizedInput.width ?? 240,
      height: normalizedInput.height ?? 140
    },
    flags: sanitizePersistedNodeFlags(normalizedInput.flags) ?? {},
    properties: structuredClone(normalizedInput.properties ?? {}),
    propertySpecs: structuredClone(normalizedInput.propertySpecs ?? []),
    inputs: structuredClone(
      normalizedInput.inputs ?? []
    ) as ClipboardNodeSnapshot["inputs"],
    outputs: structuredClone(
      normalizedInput.outputs ?? []
    ) as ClipboardNodeSnapshot["outputs"],
    widgets: structuredClone(normalizedInput.widgets ?? []),
    data: structuredClone(normalizedInput.data ?? {})
  };
}

function createPendingLinkSnapshot(
  input: LeaferGraphCreateLinkInput
): GraphLink {
  const normalizedInput = ensureLinkCreateInputId(input);
  return {
    id: normalizedInput.id ?? "",
    source: structuredClone(normalizedInput.source),
    target: structuredClone(normalizedInput.target),
    label: normalizedInput.label,
    data: structuredClone(normalizedInput.data)
  };
}

function isClipboardPortShape(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.nodeId === "string" &&
    (value.direction === undefined ||
      value.direction === "input" ||
      value.direction === "output") &&
    (value.slot === undefined || isFiniteNumber(value.slot))
  );
}

function isClipboardLinkShape(value: unknown): value is GraphLink {
  if (!isRecord(value) || typeof value.id !== "string") {
    return false;
  }

  return (
    isClipboardPortShape(value.source) && isClipboardPortShape(value.target)
  );
}

function isClipboardNodeShape(value: unknown): value is NodeSerializeResult {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.type !== "string"
  ) {
    return false;
  }

  if (!isRecord(value.layout)) {
    return false;
  }

  return (
    isFiniteNumber(value.layout.x) &&
    isFiniteNumber(value.layout.y) &&
    (value.layout.width === undefined || isFiniteNumber(value.layout.width)) &&
    (value.layout.height === undefined || isFiniteNumber(value.layout.height))
  );
}

/** 把 LeaferGraph 剪贴板负载序列化为可写入浏览器剪贴板的 JSON。 */
export function serializeLeaferGraphClipboardPayload(
  payload: LeaferGraphClipboardPayload
): string {
  return JSON.stringify(payload);
}

/** 从浏览器剪贴板文本中恢复 LeaferGraph JSON 负载。 */
export function parseLeaferGraphClipboardPayload(
  text: string
): LeaferGraphClipboardPayload | null {
  if (!text.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    if (
      parsed.kind !== "leafergraph/clipboard" ||
      parsed.version !== 1 ||
      !isRecord(parsed.anchor) ||
      !isFiniteNumber(parsed.anchor.x) ||
      !isFiniteNumber(parsed.anchor.y) ||
      !Array.isArray(parsed.nodes) ||
      !Array.isArray(parsed.links)
    ) {
      return null;
    }

    if (
      !parsed.nodes.every((node) => isClipboardNodeShape(node)) ||
      !parsed.links.every((link) => isClipboardLinkShape(link))
    ) {
      return null;
    }

    return structuredClone(parsed as unknown as LeaferGraphClipboardPayload);
  } catch {
    return null;
  }
}

/** 根据一组节点 ID 抓取当前图中的剪贴板 JSON 负载。 */
export function copyNodesToClipboardPayload(
  graph: LeaferGraph,
  nodeIds: readonly string[]
): LeaferGraphClipboardPayload | null {
  const orderedNodeIds = normalizeNodeIdList(nodeIds);
  const nodes = orderedNodeIds
    .map((nodeId) => graph.getNodeSnapshot(nodeId))
    .filter((node): node is NodeSerializeResult => Boolean(node))
    .map((node) => structuredClone(node));

  if (!nodes.length) {
    return null;
  }

  return {
    kind: "leafergraph/clipboard",
    version: 1,
    anchor: {
      x: Math.min(...nodes.map((node) => node.layout.x)),
      y: Math.min(...nodes.map((node) => node.layout.y))
    },
    nodes,
    links: captureClipboardLinks(graph, orderedNodeIds)
  };
}

/** 按新的节点 ID 映射关系重建剪贴板中的内部连线快照。 */
export function createClipboardLinkSnapshotsFromPayload(
  payload: LeaferGraphClipboardPayload,
  nodeIdMap: ReadonlyMap<string, string>
): GraphLink[] {
  return payload.links
    .map((link) => {
      const sourceNodeId = nodeIdMap.get(link.source.nodeId);
      const targetNodeId = nodeIdMap.get(link.target.nodeId);
      if (!sourceNodeId || !targetNodeId) {
        return null;
      }

      const nextInput = ensureLinkCreateInputId({
        source: {
          ...structuredClone(link.source),
          nodeId: sourceNodeId
        },
        target: {
          ...structuredClone(link.target),
          nodeId: targetNodeId
        },
        label: link.label,
        data: structuredClone(link.data)
      } satisfies LeaferGraphCreateLinkInput);

      return createPendingLinkSnapshot(nextInput);
    })
    .filter((link): link is GraphLink => Boolean(link));
}

function createClipboardNodeCreateInputs(
  payload: LeaferGraphClipboardPayload,
  x: number,
  y: number
): Array<{
  sourceNodeId: string;
  input: LeaferGraphCreateNodeInput;
}> {
  return payload.nodes.map((node) => ({
    sourceNodeId: node.id,
    input: ensureNodeCreateInputId(
      createNodeInputFromPayloadNode(
        node,
        x + (node.layout.x - payload.anchor.x),
        y + (node.layout.y - payload.anchor.y)
      )
    )
  }));
}

/** 从剪贴板 JSON 负载恢复节点、连线与待提交操作。 */
export function createNodesFromClipboardPayload(
  graph: LeaferGraph,
  session: EditorGraphDocumentSession,
  payload: LeaferGraphClipboardPayload,
  x: number,
  y: number
): ClipboardNodeSnapshot[] {
  const createdNodeEntries = createClipboardNodeCreateInputs(payload, x, y)
    .map(({ sourceNodeId, input }) => {
      const result = session.submitOperation(createNodeCreateOperation(input));
      if (!result.accepted) {
        return null;
      }

      const snapshot =
        graph.getNodeSnapshot(result.affectedNodeIds[0] ?? input.id ?? "") ??
        createPendingNodeSnapshot(input);

      return {
        sourceNodeId,
        snapshot
      };
    })
    .filter(
      (
        entry
      ): entry is {
        sourceNodeId: string;
        snapshot: ClipboardNodeSnapshot;
      } => Boolean(entry)
    );

  const nodeIdMap = new Map(
    createdNodeEntries.map(({ sourceNodeId, snapshot }) => [
      sourceNodeId,
      snapshot.id
    ])
  );
  const linkSnapshots = createClipboardLinkSnapshotsFromPayload(
    payload,
    nodeIdMap
  );

  for (const link of linkSnapshots) {
    session.submitOperation(createLinkCreateOperation(link));
  }

  return createdNodeEntries.map(({ snapshot }) => snapshot);
}
