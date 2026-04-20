import { createAuthoringModule, createAuthoringPlugin } from "@leafergraph/authoring";

import { BasicSumNode, WatchNode } from "./nodes";
import {
  AUTHORING_NODE_TEMPLATE_PACKAGE_NAME,
  AUTHORING_NODE_TEMPLATE_SCOPE,
  AUTHORING_NODE_TEMPLATE_VERSION
} from "./shared";

/** 模板默认导出的全部节点作者类。 */
export const authoringNodeTemplateNodeClasses = [
  BasicSumNode,
  WatchNode
] as const;

/** 宿主可直接安装的节点模块。 */
export const authoringNodeTemplateModule = createAuthoringModule({
  scope: AUTHORING_NODE_TEMPLATE_SCOPE,
  nodes: [...authoringNodeTemplateNodeClasses]
});

/** 宿主可直接放进 `plugins` 的 authoring 插件。 */
export const authoringNodeTemplatePlugin = createAuthoringPlugin({
  name: AUTHORING_NODE_TEMPLATE_PACKAGE_NAME,
  version: AUTHORING_NODE_TEMPLATE_VERSION,
  scope: AUTHORING_NODE_TEMPLATE_SCOPE,
  nodes: [...authoringNodeTemplateNodeClasses]
});
