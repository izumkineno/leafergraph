import {
  createAuthoringModule,
  createAuthoringPlugin
} from "@leafergraph/authoring";

import { PulseCounterNode, SumNode, WatchNode } from "./nodes";
import {
  AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME,
  AUTHORING_BROWSER_TEMPLATE_SCOPE,
  AUTHORING_BROWSER_TEMPLATE_VERSION
} from "./shared";
import { TextReadoutWidget } from "./widgets";

export const authoringBrowserTemplateNodeClasses = [
  SumNode,
  PulseCounterNode,
  WatchNode
] as const;

export const authoringBrowserTemplateModule = createAuthoringModule({
  scope: AUTHORING_BROWSER_TEMPLATE_SCOPE,
  nodes: [...authoringBrowserTemplateNodeClasses]
});

export const authoringBrowserTemplateWidgetPlugin = createAuthoringPlugin({
  name: `${AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME}/widget-plugin`,
  version: AUTHORING_BROWSER_TEMPLATE_VERSION,
  widgets: [TextReadoutWidget]
});

export const authoringBrowserTemplateNodePlugin = createAuthoringPlugin({
  name: `${AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME}/node-plugin`,
  version: AUTHORING_BROWSER_TEMPLATE_VERSION,
  scope: AUTHORING_BROWSER_TEMPLATE_SCOPE,
  nodes: [...authoringBrowserTemplateNodeClasses]
});

export const authoringBrowserTemplatePlugin = createAuthoringPlugin({
  name: AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME,
  version: AUTHORING_BROWSER_TEMPLATE_VERSION,
  scope: AUTHORING_BROWSER_TEMPLATE_SCOPE,
  widgets: [TextReadoutWidget],
  nodes: [...authoringBrowserTemplateNodeClasses]
});
