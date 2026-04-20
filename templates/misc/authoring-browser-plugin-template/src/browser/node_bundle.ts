import {
  AUTHORING_BROWSER_TEMPLATE_NODE_BUNDLE_ID,
  AUTHORING_BROWSER_TEMPLATE_NODE_BUNDLE_NAME,
  AUTHORING_BROWSER_TEMPLATE_VERSION,
  authoringBrowserTemplateNodeBundleRequires,
  authoringBrowserTemplateNodePlugin,
  authoringBrowserTemplateQuickCreateNodeType
} from "../developer";
import { registerAuthoringBrowserTemplateBundle } from "./register_bundle";

registerAuthoringBrowserTemplateBundle({
  id: AUTHORING_BROWSER_TEMPLATE_NODE_BUNDLE_ID,
  name: AUTHORING_BROWSER_TEMPLATE_NODE_BUNDLE_NAME,
  kind: "node",
  version: AUTHORING_BROWSER_TEMPLATE_VERSION,
  requires: [...authoringBrowserTemplateNodeBundleRequires],
  plugin: authoringBrowserTemplateNodePlugin,
  quickCreateNodeType: authoringBrowserTemplateQuickCreateNodeType
});
