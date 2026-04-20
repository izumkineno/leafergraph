import {
  createAuthoringModule,
  createAuthoringPlugin
} from "@leafergraph/authoring";

import { authoringBasicNodeClasses } from "./nodes";
import {
  AUTHORING_BASIC_NODES_PACKAGE_NAME,
  AUTHORING_BASIC_NODES_VERSION
} from "./shared";
import { StatusReadoutWidget } from "./widgets";

export const authoringBasicNodesModule = createAuthoringModule({
  nodes: [...authoringBasicNodeClasses]
});

export const authoringBasicNodesPlugin = createAuthoringPlugin({
  name: AUTHORING_BASIC_NODES_PACKAGE_NAME,
  version: AUTHORING_BASIC_NODES_VERSION,
  widgets: [StatusReadoutWidget],
  nodes: [...authoringBasicNodeClasses]
});
