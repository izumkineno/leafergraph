import { authoringBrowserTemplateDemoDocument } from "../presets";
import {
  AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME,
  AUTHORING_BROWSER_TEMPLATE_VERSION
} from "../core/shared";
import { registerAuthoringBrowserTemplateBundle } from "./register_bundle";

registerAuthoringBrowserTemplateBundle({
  id: `${AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME}/demo`,
  name: "Authoring Browser Demo",
  kind: "demo",
  version: AUTHORING_BROWSER_TEMPLATE_VERSION,
  requires: [
    `${AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME}/widget`,
    `${AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME}/node`
  ],
  document: authoringBrowserTemplateDemoDocument
});
