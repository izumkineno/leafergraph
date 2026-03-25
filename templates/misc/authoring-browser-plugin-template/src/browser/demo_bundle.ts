import { authoringBrowserTemplateDemoDocument } from "../presets";
import {
  AUTHORING_BROWSER_TEMPLATE_DEMO_BUNDLE_ID,
  AUTHORING_BROWSER_TEMPLATE_DEMO_BUNDLE_NAME,
  AUTHORING_BROWSER_TEMPLATE_VERSION,
  authoringBrowserTemplateDemoBundleRequires
} from "../developer";
import { registerAuthoringBrowserTemplateBundle } from "./register_bundle";

registerAuthoringBrowserTemplateBundle({
  id: AUTHORING_BROWSER_TEMPLATE_DEMO_BUNDLE_ID,
  name: AUTHORING_BROWSER_TEMPLATE_DEMO_BUNDLE_NAME,
  kind: "demo",
  version: AUTHORING_BROWSER_TEMPLATE_VERSION,
  requires: [...authoringBrowserTemplateDemoBundleRequires],
  document: authoringBrowserTemplateDemoDocument
});
