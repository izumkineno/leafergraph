import { authoringTextWidgetTemplatePlugin } from "../core";
import {
  AUTHORING_TEXT_WIDGET_TEMPLATE_PACKAGE_NAME,
  AUTHORING_TEXT_WIDGET_TEMPLATE_VERSION
} from "../core/shared";
import { registerAuthoringTextWidgetTemplateBundle } from "./register_bundle";

registerAuthoringTextWidgetTemplateBundle({
  id: `${AUTHORING_TEXT_WIDGET_TEMPLATE_PACKAGE_NAME}/widget`,
  name: "Authoring Text Widget Template Bundle",
  kind: "widget",
  version: AUTHORING_TEXT_WIDGET_TEMPLATE_VERSION,
  plugin: authoringTextWidgetTemplatePlugin
});
