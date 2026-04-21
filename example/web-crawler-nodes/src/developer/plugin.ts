import { createAuthoringPlugin } from "@leafergraph/extensions/authoring";
import { CrawlerNode } from "./nodes/crawler";
import { ParserNode } from "./nodes/parser";
import { ArrayListNode } from "./nodes/array-list";
import { WEB_CRAWLER_NODES_PACKAGE_NAME } from "./shared";

const plugin = createAuthoringPlugin({
  name: WEB_CRAWLER_NODES_PACKAGE_NAME,
  nodes: [CrawlerNode, ParserNode, ArrayListNode]
});

export default plugin;
