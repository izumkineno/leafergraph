import { describe, expect, test } from "bun:test";

import authorityOpenRpcDocument from "../../../templates/backend/shared/openrpc/authority.openrpc.json";
import {
  EDITOR_REMOTE_AUTHORITY_METHODS,
  EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS,
  authorityOpenRpcDocument as generatedAuthorityOpenRpcDocument,
  validateMethodParams,
  validateMethodResult,
  validateNotificationParams
} from "../src/session/authority_openrpc";

function toSortedList(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function createDocument(revision: string) {
  return {
    documentId: "protocol-doc",
    revision,
    appKind: "protocol-test",
    nodes: [],
    links: [],
    meta: {}
  };
}

describe("authority_openrpc_runtime", () => {
  test("应让 editor 协议常量与共享 OpenRPC methods 和 notifications 完全一致", () => {
    expect(
      toSortedList(
        authorityOpenRpcDocument.methods.map((method) => method.name)
      )
    ).toEqual(toSortedList(Object.values(EDITOR_REMOTE_AUTHORITY_METHODS)));

    expect(
      toSortedList(
        authorityOpenRpcDocument["x-notifications"].map(
          (notification) => notification.name
        )
      )
    ).toEqual(
      toSortedList(Object.values(EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS))
    );
  });

  test("应让 editor 生成的 rpc.discover 文档与共享 OpenRPC 真源一致", () => {
    expect(generatedAuthorityOpenRpcDocument).toEqual(authorityOpenRpcDocument);
  });

  test("应校验 submitOperation params，并拒绝不满足 anyOf 必填分支的 graph operation", () => {
    expect(
      validateMethodParams("authority.submitOperation", {
        operation: {
          type: "node.move",
          operationId: "op-1",
          timestamp: 1,
          source: "protocol.test",
          nodeId: "node-a",
          input: {
            x: 10,
            y: 20
          }
        },
        context: {
          currentDocument: createDocument("1"),
          pendingOperationIds: ["op-1"]
        }
      })
    ).toEqual({
      operation: {
        type: "node.move",
        operationId: "op-1",
        timestamp: 1,
        source: "protocol.test",
        nodeId: "node-a",
        input: {
          x: 10,
          y: 20
        }
      },
      context: {
        currentDocument: createDocument("1"),
        pendingOperationIds: ["op-1"]
      }
    });

    expect(() =>
      validateMethodParams("authority.submitOperation", {
        operation: {
          type: "link.reconnect",
          operationId: "op-2",
          timestamp: 2,
          source: "protocol.test",
          linkId: "link-a",
          input: {}
        },
        context: {
          currentDocument: createDocument("1"),
          pendingOperationIds: ["op-2"]
        }
      })
    ).toThrow();
  });

  test("应忽略 submitOperation params 中会被 JSON 序列化丢弃的可选 undefined 字段", () => {
    expect(
      validateMethodParams("authority.submitOperation", {
        operation: {
          type: "node.remove",
          operationId: "op-3",
          timestamp: 3,
          source: "protocol.test",
          nodeId: "node-a"
        },
        context: {
          currentDocument: {
            ...createDocument("1"),
            capabilityProfile: undefined,
            adapterBinding: undefined
          },
          pendingOperationIds: ["op-3"]
        }
      })
    ).toEqual({
      operation: {
        type: "node.remove",
        operationId: "op-3",
        timestamp: 3,
        source: "protocol.test",
        nodeId: "node-a"
      },
      context: {
        currentDocument: createDocument("1"),
        pendingOperationIds: ["op-3"]
      }
    });
  });

  test("应校验 method result 与 notification params", () => {
    expect(
      validateMethodResult("authority.getDocument", createDocument("2"))
    ).toEqual(createDocument("2"));

    expect(() =>
      validateMethodResult("authority.getDocument", {
        accepted: true,
        changed: true,
        revision: "2"
      })
    ).toThrow();

    expect(
      validateNotificationParams("authority.documentDiff", {
        documentId: "protocol-doc",
        baseRevision: "1",
        revision: "2",
        emittedAt: 1,
        operations: [],
        fieldChanges: []
      })
    ).toEqual({
      documentId: "protocol-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 1,
      operations: [],
      fieldChanges: []
    });

    expect(() =>
      validateNotificationParams("authority.documentDiff", {
        documentId: "protocol-doc",
        revision: "2",
        emittedAt: 1,
        operations: [],
        fieldChanges: []
      })
    ).toThrow();
  });
});
