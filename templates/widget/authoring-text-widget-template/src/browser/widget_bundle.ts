import {
  AUTHORING_TEXT_WIDGET_TEMPLATE_WIDGET_BUNDLE_ID,
  AUTHORING_TEXT_WIDGET_TEMPLATE_WIDGET_BUNDLE_NAME,
  AUTHORING_TEXT_WIDGET_TEMPLATE_VERSION,
  authoringTextWidgetTemplatePlugin
} from "../developer";
import { registerAuthoringTextWidgetTemplateBundle } from "./register_bundle";

registerAuthoringTextWidgetTemplateBundle({
  id: AUTHORING_TEXT_WIDGET_TEMPLATE_WIDGET_BUNDLE_ID,
  name: AUTHORING_TEXT_WIDGET_TEMPLATE_WIDGET_BUNDLE_NAME,
  kind: "widget",
  version: AUTHORING_TEXT_WIDGET_TEMPLATE_VERSION,
  plugin: authoringTextWidgetTemplatePlugin
});
