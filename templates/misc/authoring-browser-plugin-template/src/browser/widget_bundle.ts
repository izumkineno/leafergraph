import {
  AUTHORING_BROWSER_TEMPLATE_WIDGET_BUNDLE_ID,
  AUTHORING_BROWSER_TEMPLATE_WIDGET_BUNDLE_NAME,
  AUTHORING_BROWSER_TEMPLATE_VERSION,
  authoringBrowserTemplateWidgetPlugin
} from "../developer";
import { registerAuthoringBrowserTemplateBundle } from "./register_bundle";

registerAuthoringBrowserTemplateBundle({
  id: AUTHORING_BROWSER_TEMPLATE_WIDGET_BUNDLE_ID,
  name: AUTHORING_BROWSER_TEMPLATE_WIDGET_BUNDLE_NAME,
  kind: "widget",
  version: AUTHORING_BROWSER_TEMPLATE_VERSION,
  plugin: authoringBrowserTemplateWidgetPlugin
});
