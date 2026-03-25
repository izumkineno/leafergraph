export const AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME =
  "@template/authoring-browser-plugin-template";

export const AUTHORING_BROWSER_TEMPLATE_VERSION = "0.1.0";

export const AUTHORING_BROWSER_TEMPLATE_SCOPE = {
  namespace: "authoring-browser-template",
  group: "Authoring Browser Template"
} as const;

export const AUTHORING_BROWSER_TEMPLATE_NODE_WIDTH = 288;
export const AUTHORING_BROWSER_TEMPLATE_NODE_MIN_HEIGHT = 184;

export const AUTHORING_BROWSER_TEMPLATE_SUM_LOCAL_TYPE = "sum";
export const AUTHORING_BROWSER_TEMPLATE_PULSE_COUNTER_LOCAL_TYPE =
  "pulse-counter";
export const AUTHORING_BROWSER_TEMPLATE_WATCH_LOCAL_TYPE = "watch";

export const AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_TYPE =
  "authoring-browser-template/text-readout";

export const AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_NAME = "readout";

export const AUTHORING_BROWSER_TEMPLATE_DEMO_DOCUMENT_ID =
  "authoring-browser-template-demo-document";

export function resolveAuthoringBrowserTemplateType(localType: string): string {
  return `${AUTHORING_BROWSER_TEMPLATE_SCOPE.namespace}/${localType}`;
}

export const AUTHORING_BROWSER_TEMPLATE_SUM_TYPE =
  resolveAuthoringBrowserTemplateType(
    AUTHORING_BROWSER_TEMPLATE_SUM_LOCAL_TYPE
  );

export const AUTHORING_BROWSER_TEMPLATE_PULSE_COUNTER_TYPE =
  resolveAuthoringBrowserTemplateType(
    AUTHORING_BROWSER_TEMPLATE_PULSE_COUNTER_LOCAL_TYPE
  );

export const AUTHORING_BROWSER_TEMPLATE_WATCH_TYPE =
  resolveAuthoringBrowserTemplateType(
    AUTHORING_BROWSER_TEMPLATE_WATCH_LOCAL_TYPE
  );
