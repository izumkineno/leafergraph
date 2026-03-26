/**
 * 连线命令控制器模块。
 *
 * @remarks
 * 负责 editor 里的连线创建、删除和重连命令，
 * 并把结果回填到 session、菜单绑定和选区语义。
 */
import type {
  GraphLink,
  LeaferGraph,
  LeaferGraphCreateLinkInput
} from "leafergraph";
import {
  createLinkCreateOperation,
  createLinkReconnectOperation,
  createLinkRemoveOperation,
  ensureLinkCreateInputId
} from "./graph_operation_utils";
import type { EditorGraphDocumentSession } from "../session/graph_document_session";

/** 连线重连时允许覆写的端点补丁。 */
export interface EditorLinkReconnectInput {
  source?: LeaferGraphCreateLinkInput["source"];
  target?: LeaferGraphCreateLinkInput["target"];
}

/** editor 当前阶段的最小连线命令控制器。 */
export interface EditorLinkCommandController {
  /** 根据连线 ID 读取正式连线快照。 */
  getLink(linkId: string): GraphLink | undefined;
  /** 判断某条连线当前是否存在。 */
  hasLink(linkId: string): boolean;
  /** 创建一条正式连线。 */
  createLink(input: LeaferGraphCreateLinkInput): GraphLink;
  /** 删除一条正式连线。 */
  removeLink(linkId: string): boolean;
  /** 使用新端点重连一条既有连线，并尽量保留原始 ID。 */
  reconnectLink(
    linkId: string,
    input: EditorLinkReconnectInput
  ): GraphLink | undefined;
}

/** 深拷贝正式连线快照。 */
export function cloneEditorLink(link: GraphLink): GraphLink {
  return structuredClone(link);
}

/** 把创建输入包装成正式连线快照。 */
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

/** 用新的端点补丁构造下一份正式连线输入。 */
export function createReconnectLinkInput(
  link: GraphLink,
  input: EditorLinkReconnectInput
): LeaferGraphCreateLinkInput {
  return structuredClone({
    id: link.id,
    source: input.source ?? link.source,
    target: input.target ?? link.target,
    label: link.label,
    data: link.data
  } satisfies LeaferGraphCreateLinkInput);
}

/** 判断两条正式连线是否表达了同一组端点。 */
export function isSameLinkEndpoint(
  left: Pick<GraphLink, "source" | "target">,
  right: Pick<GraphLink, "source" | "target">
): boolean {
  return (
    left.source.nodeId === right.source.nodeId &&
    (left.source.slot ?? 0) === (right.source.slot ?? 0) &&
    left.target.nodeId === right.target.nodeId &&
    (left.target.slot ?? 0) === (right.target.slot ?? 0)
  );
}

/**
 * 创建 editor 当前阶段的最小连线命令控制器。
 *
 * @remarks
 * 这一层先只收敛正式 `create / remove / reconnect` 三条链，
 * 让命令总线、历史记录和未来的右键菜单 / 快捷键共用同一条实现。
 */
export function createEditorLinkCommandController(
  options: {
    graph: LeaferGraph;
    session: EditorGraphDocumentSession;
  }
): EditorLinkCommandController {
  return {
    getLink(linkId: string): GraphLink | undefined {
      return options.graph.getLink(linkId);
    },

    hasLink(linkId: string): boolean {
      return Boolean(options.graph.getLink(linkId));
    },

    createLink(input: LeaferGraphCreateLinkInput): GraphLink {
      const nextInput = ensureLinkCreateInputId(input);
      const result = options.session.submitOperation(
        createLinkCreateOperation(nextInput)
      );
      if (!result.accepted) {
        throw new Error(result.reason ?? "创建连线失败");
      }

      const linkId = result.affectedLinkIds[0] ?? nextInput.id;
      const link = linkId ? options.graph.getLink(linkId) : undefined;
      if (link) {
        return link;
      }

      return createPendingLinkSnapshot(nextInput);
    },

    removeLink(linkId: string): boolean {
      const result = options.session.submitOperation(
        createLinkRemoveOperation(linkId)
      );
      return result.accepted;
    },

    reconnectLink(
      linkId: string,
      input: EditorLinkReconnectInput
    ): GraphLink | undefined {
      const currentLink = options.graph.getLink(linkId);
      if (!currentLink) {
        return undefined;
      }

      const nextInput = createReconnectLinkInput(currentLink, input);
      if (isSameLinkEndpoint(currentLink, nextInput)) {
        return currentLink;
      }

      const result = options.session.submitOperation(
        createLinkReconnectOperation(linkId, structuredClone(input))
      );
      if (!result.accepted) {
        throw new Error(result.reason ?? "重连连线失败");
      }

      if (result.changed) {
        return options.graph.getLink(linkId) ?? createPendingLinkSnapshot(nextInput);
      }

      return createPendingLinkSnapshot(nextInput);
    }
  };
}
