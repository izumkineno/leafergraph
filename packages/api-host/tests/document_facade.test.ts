import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "@leafergraph/core/node";
import { LeaferGraphApiHost } from "@leafergraph/api-host";
import { getLeaferGraphApiHost } from "@leafergraph/api-host/leafer_graph";

describe("document facade", () => {
  test("LeaferGraphApiHost.getGraphDocument 返回的文档会被 facade 读取", () => {
    const document: GraphDocument = {
      documentId: "graph-doc",
      revision: "1",
      appKind: "test",
      nodes: [],
      links: []
    };

    const host = {
      getGraphDocument() {
        return document;
      }
    } as unknown as LeaferGraphApiHost<any, any, any>;

    expect(host.getGraphDocument()).toBe(document);
    expect(typeof getLeaferGraphApiHost).toBe("function");
  });
});
