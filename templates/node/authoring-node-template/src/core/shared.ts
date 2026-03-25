export const AUTHORING_NODE_TEMPLATE_PACKAGE_NAME =
  "@template/authoring-node-template";

export const AUTHORING_NODE_TEMPLATE_VERSION = "0.1.0";

export const AUTHORING_NODE_TEMPLATE_SCOPE = {
  namespace: "authoring-node-template",
  group: "Authoring Node Template"
} as const;

export const AUTHORING_NODE_TEMPLATE_NODE_WIDTH = 288;
export const AUTHORING_NODE_TEMPLATE_NODE_MIN_HEIGHT = 184;

export const AUTHORING_NODE_TEMPLATE_BASIC_SUM_LOCAL_TYPE = "basic-sum";
export const AUTHORING_NODE_TEMPLATE_WATCH_LOCAL_TYPE = "watch";
export const AUTHORING_NODE_TEMPLATE_WATCH_WIDGET_NAME = "watch-text";

export function resolveAuthoringNodeTemplateType(localType: string): string {
  return `${AUTHORING_NODE_TEMPLATE_SCOPE.namespace}/${localType}`;
}

export const AUTHORING_NODE_TEMPLATE_BASIC_SUM_TYPE =
  resolveAuthoringNodeTemplateType(
    AUTHORING_NODE_TEMPLATE_BASIC_SUM_LOCAL_TYPE
  );

export const AUTHORING_NODE_TEMPLATE_WATCH_TYPE =
  resolveAuthoringNodeTemplateType(AUTHORING_NODE_TEMPLATE_WATCH_LOCAL_TYPE);
