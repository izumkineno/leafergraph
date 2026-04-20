import { createAuthoringModule } from "@leafergraph/authoring";
import { WEB_CRAWLER_NODES_SCOPE } from "./shared";
import { CrawlerNode } from "./nodes/crawler";
import { ParserNode } from "./nodes/parser";
import { ArrayListNode } from "./nodes/array-list";

export const module = createAuthoringModule({
  scope: WEB_CRAWLER_NODES_SCOPE,
  nodes: [CrawlerNode, ParserNode, ArrayListNode]
});

export default module;