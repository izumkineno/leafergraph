import { createAuthoringPlugin } from "@leafergraph/authoring";

import {
  AUTHORING_TEXT_WIDGET_TEMPLATE_PACKAGE_NAME,
  AUTHORING_TEXT_WIDGET_TEMPLATE_VERSION
} from "./shared";
import { TextReadoutWidget } from "./widgets";

export * from "./shared";
export * from "./widgets";

export const authoringTextWidgetTemplatePlugin = createAuthoringPlugin({
  name: AUTHORING_TEXT_WIDGET_TEMPLATE_PACKAGE_NAME,
  version: AUTHORING_TEXT_WIDGET_TEMPLATE_VERSION,
  widgets: [TextReadoutWidget]
});
