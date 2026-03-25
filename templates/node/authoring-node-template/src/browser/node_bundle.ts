import { authoringNodeTemplatePlugin } from "../core/module";
import {
  AUTHORING_NODE_TEMPLATE_PACKAGE_NAME,
  AUTHORING_NODE_TEMPLATE_VERSION,
  AUTHORING_NODE_TEMPLATE_WATCH_TYPE
} from "../core/shared";
import { registerAuthoringNodeTemplateBundle } from "./register_bundle";

registerAuthoringNodeTemplateBundle({
  id: `${AUTHORING_NODE_TEMPLATE_PACKAGE_NAME}/node`,
  name: "Authoring Node Template Bundle",
  kind: "node",
  version: AUTHORING_NODE_TEMPLATE_VERSION,
  plugin: authoringNodeTemplatePlugin,
  quickCreateNodeType: AUTHORING_NODE_TEMPLATE_WATCH_TYPE
});
