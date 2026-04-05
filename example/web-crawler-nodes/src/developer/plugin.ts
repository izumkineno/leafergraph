import { createAuthoringPlugin } from "@leafergraph/authoring";
import { CrawlerNode } from "./nodes/crawler";
import { ParserNode } from "./nodes/parser";
import { ArrayListNode } from "./nodes/array-list";
import { ProgressRingWidget } from "./widgets/progress-ring";
import { WEB_CRAWLER_NODES_PACKAGE_NAME } from "./shared";

const plugin = createAuthoringPlugin({
  name: WEB_CRAWLER_NODES_PACKAGE_NAME,
  nodes: [CrawlerNode, ParserNode, ArrayListNode],
  widgets: [ProgressRingWidget]
});

export default plugin;
