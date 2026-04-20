import {
  WEB_CRAWLER_NODES_BUNDLE_ID,
  WEB_CRAWLER_NODES_BUNDLE_NAME,
  WEB_CRAWLER_NODES_VERSION,
  webCrawlerNodesQuickCreateNodeType
} from "../developer/index";
import plugin from "../index";
import { registerWebCrawlerNodesBundle } from "./register_bundle";

registerWebCrawlerNodesBundle({
  id: WEB_CRAWLER_NODES_BUNDLE_ID,
  name: WEB_CRAWLER_NODES_BUNDLE_NAME,
  kind: "node",
  version: WEB_CRAWLER_NODES_VERSION,
  plugin: plugin,
  quickCreateNodeType: webCrawlerNodesQuickCreateNodeType
});
