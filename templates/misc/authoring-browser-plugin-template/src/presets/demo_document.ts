import type { GraphDocument } from "leafergraph";

import { authoringBrowserTemplateDemoPreset } from "../developer";

/** 预设层只负责把开发者入口提供的数据装配成正式 GraphDocument。 */
export const authoringBrowserTemplateDemoDocument: GraphDocument = {
  documentId: authoringBrowserTemplateDemoPreset.documentId,
  revision: 1,
  appKind: "leafergraph-local",
  nodes: authoringBrowserTemplateDemoPreset.nodes,
  links: authoringBrowserTemplateDemoPreset.links
};
