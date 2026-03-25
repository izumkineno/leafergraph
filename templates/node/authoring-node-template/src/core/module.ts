import {
  createAuthoringModule,
  createAuthoringPlugin
} from "@leafergraph/authoring";

import { BasicSumNode, WatchNode } from "./nodes";
import {
  AUTHORING_NODE_TEMPLATE_PACKAGE_NAME,
  AUTHORING_NODE_TEMPLATE_SCOPE,
  AUTHORING_NODE_TEMPLATE_VERSION
} from "./shared";

export const authoringNodeTemplateNodeClasses = [
  BasicSumNode,
  WatchNode
] as const;

export const authoringNodeTemplateModule = createAuthoringModule({
  scope: AUTHORING_NODE_TEMPLATE_SCOPE,
  nodes: [...authoringNodeTemplateNodeClasses]
});

export const authoringNodeTemplatePlugin = createAuthoringPlugin({
  name: AUTHORING_NODE_TEMPLATE_PACKAGE_NAME,
  version: AUTHORING_NODE_TEMPLATE_VERSION,
  scope: AUTHORING_NODE_TEMPLATE_SCOPE,
  nodes: [...authoringNodeTemplateNodeClasses]
});
