import { describe, expect, test } from "bun:test";

import authorityOpenRpcDocument from "../../../templates/backend/shared/openrpc/authority.openrpc.json";
import {
  EDITOR_REMOTE_AUTHORITY_METHODS,
  EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS
} from "../src/session/graph_document_authority_protocol";

function toSortedList(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

describe("graph_document_authority_protocol", () => {
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
});
