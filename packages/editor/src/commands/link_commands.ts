import type {
  LeaferGraph,
  LeaferGraphCreateLinkInput,
  LeaferGraphLinkData
} from "leafergraph";

/** 连线重连时允许覆写的端点补丁。 */
export interface EditorLinkReconnectInput {
  source?: LeaferGraphCreateLinkInput["source"];
  target?: LeaferGraphCreateLinkInput["target"];
}

/** editor 当前阶段的最小连线命令控制器。 */
export interface EditorLinkCommandController {
  /** 根据连线 ID 读取正式连线快照。 */
  getLink(linkId: string): LeaferGraphLinkData | undefined;
  /** 判断某条连线当前是否存在。 */
  hasLink(linkId: string): boolean;
  /** 创建一条正式连线。 */
  createLink(input: LeaferGraphCreateLinkInput): LeaferGraphLinkData;
  /** 删除一条正式连线。 */
  removeLink(linkId: string): boolean;
  /** 使用新端点重连一条既有连线，并尽量保留原始 ID。 */
  reconnectLink(
    linkId: string,
    input: EditorLinkReconnectInput
  ): LeaferGraphLinkData | undefined;
}

/** 深拷贝正式连线快照。 */
export function cloneEditorLink(link: LeaferGraphLinkData): LeaferGraphLinkData {
  return structuredClone(link);
}

/** 用新的端点补丁构造下一份正式连线输入。 */
export function createReconnectLinkInput(
  link: LeaferGraphLinkData,
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
  left: Pick<LeaferGraphLinkData, "source" | "target">,
  right: Pick<LeaferGraphLinkData, "source" | "target">
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
  graph: LeaferGraph
): EditorLinkCommandController {
  return {
    getLink(linkId: string): LeaferGraphLinkData | undefined {
      return graph.getLink(linkId);
    },

    hasLink(linkId: string): boolean {
      return Boolean(graph.getLink(linkId));
    },

    createLink(input: LeaferGraphCreateLinkInput): LeaferGraphLinkData {
      return graph.createLink(structuredClone(input));
    },

    removeLink(linkId: string): boolean {
      return graph.removeLink(linkId);
    },

    reconnectLink(
      linkId: string,
      input: EditorLinkReconnectInput
    ): LeaferGraphLinkData | undefined {
      const currentLink = graph.getLink(linkId);
      if (!currentLink) {
        return undefined;
      }

      const nextInput = createReconnectLinkInput(currentLink, input);
      if (isSameLinkEndpoint(currentLink, nextInput)) {
        return currentLink;
      }

      if (!graph.removeLink(linkId)) {
        return undefined;
      }

      try {
        return graph.createLink(nextInput);
      } catch (error) {
        try {
          graph.createLink(currentLink);
        } catch {
          // 如果恢复旧连线也失败，当前阶段保留第一次错误作为真正根因。
        }

        throw error;
      }
    }
  };
}
