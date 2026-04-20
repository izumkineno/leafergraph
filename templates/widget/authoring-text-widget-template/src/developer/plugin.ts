import { createAuthoringPlugin } from "@leafergraph/authoring";

import {
  AUTHORING_TEXT_WIDGET_TEMPLATE_PACKAGE_NAME,
  AUTHORING_TEXT_WIDGET_TEMPLATE_VERSION
} from "./shared";
import { TextReadoutWidget } from "./widgets";

/** 宿主可直接放进 `plugins` 的文字 Widget 插件。 */
export const authoringTextWidgetTemplatePlugin = createAuthoringPlugin({
  name: AUTHORING_TEXT_WIDGET_TEMPLATE_PACKAGE_NAME,
  version: AUTHORING_TEXT_WIDGET_TEMPLATE_VERSION,
  widgets: [TextReadoutWidget]
});
