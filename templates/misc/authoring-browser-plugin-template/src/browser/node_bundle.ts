import { authoringBrowserTemplateNodePlugin } from "../core/module";
import {
  AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME,
  AUTHORING_BROWSER_TEMPLATE_VERSION,
  AUTHORING_BROWSER_TEMPLATE_WATCH_TYPE
} from "../core/shared";
import { registerAuthoringBrowserTemplateBundle } from "./register_bundle";

registerAuthoringBrowserTemplateBundle({
  id: `${AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME}/node`,
  name: "Authoring Browser Node Bundle",
  kind: "node",
  version: AUTHORING_BROWSER_TEMPLATE_VERSION,
  requires: [`${AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME}/widget`],
  plugin: authoringBrowserTemplateNodePlugin,
  quickCreateNodeType: AUTHORING_BROWSER_TEMPLATE_WATCH_TYPE
});
