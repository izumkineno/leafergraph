import {
  AUTHORING_NODE_TEMPLATE_NODE_BUNDLE_ID,
  AUTHORING_NODE_TEMPLATE_NODE_BUNDLE_NAME,
  AUTHORING_NODE_TEMPLATE_VERSION,
  authoringNodeTemplatePlugin,
  authoringNodeTemplateQuickCreateNodeType
} from "../developer";
import { registerAuthoringNodeTemplateBundle } from "./register_bundle";

registerAuthoringNodeTemplateBundle({
  id: AUTHORING_NODE_TEMPLATE_NODE_BUNDLE_ID,
  name: AUTHORING_NODE_TEMPLATE_NODE_BUNDLE_NAME,
  kind: "node",
  version: AUTHORING_NODE_TEMPLATE_VERSION,
  plugin: authoringNodeTemplatePlugin,
  quickCreateNodeType: authoringNodeTemplateQuickCreateNodeType
});
