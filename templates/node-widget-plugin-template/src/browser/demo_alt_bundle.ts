import { templateAlternateDemoDocument } from "../demo-document";
import {
  TEMPLATE_PLUGIN_NAME,
  TEMPLATE_PLUGIN_VERSION
} from "../shared";
import { registerTemplateBundle } from "./register_bundle";

registerTemplateBundle({
  id: `${TEMPLATE_PLUGIN_NAME}/demo-alt`,
  name: "Template Alternate Demo Document",
  kind: "demo",
  version: TEMPLATE_PLUGIN_VERSION,
  requires: [
    `${TEMPLATE_PLUGIN_NAME}/node`,
    `${TEMPLATE_PLUGIN_NAME}/widget`
  ],
  document: templateAlternateDemoDocument
});
