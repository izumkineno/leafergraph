import { authoringBrowserTemplateWidgetPlugin } from "../core/module";
import {
  AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME,
  AUTHORING_BROWSER_TEMPLATE_VERSION
} from "../core/shared";
import { registerAuthoringBrowserTemplateBundle } from "./register_bundle";

registerAuthoringBrowserTemplateBundle({
  id: `${AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME}/widget`,
  name: "Authoring Browser Widget Bundle",
  kind: "widget",
  version: AUTHORING_BROWSER_TEMPLATE_VERSION,
  plugin: authoringBrowserTemplateWidgetPlugin
});
