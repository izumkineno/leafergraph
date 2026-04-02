import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "@leafergraph/node";
import { LeaferGraph } from "../src/index";

describe("document facade", () => {
  test("LeaferGraph.getGraphDocument 应委托给 apiHost", () => {
    const document: GraphDocument = {
      documentId: "graph-doc",
      revision: "1",
      appKind: "test",
      nodes: [],
      links: []
    };

    const fakeGraph = {
      apiHost: {
        getGraphDocument() {
          return document;
        }
      }
    } as unknown as LeaferGraph;

    expect(LeaferGraph.prototype.getGraphDocument.call(fakeGraph)).toBe(document);
  });
});
