/**
 * 这份文件集中放“项目级信息”。
 *
 * 开发者如果只是想改包名、Widget 类型或 browser bundle 展示名，
 * 优先修改这里即可。
 */
export const AUTHORING_TEXT_WIDGET_TEMPLATE_PACKAGE_NAME =
  "@template/authoring-text-widget-template";

/** 模板默认版本号，同时用于 ESM 导出和 browser bundle manifest。 */
export const AUTHORING_TEXT_WIDGET_TEMPLATE_VERSION = "0.1.0";

/** `TextReadoutWidget` 的最终 Widget 类型。 */
export const AUTHORING_TEXT_WIDGET_TEMPLATE_WIDGET_TYPE =
  "authoring-text-widget-template/text-readout";

/** browser `widget.iife.js` 的 bundle id。 */
export const AUTHORING_TEXT_WIDGET_TEMPLATE_WIDGET_BUNDLE_ID =
  `${AUTHORING_TEXT_WIDGET_TEMPLATE_PACKAGE_NAME}/widget`;

/** browser `widget.iife.js` 的展示名。 */
export const AUTHORING_TEXT_WIDGET_TEMPLATE_WIDGET_BUNDLE_NAME =
  "Authoring Text Widget Template Bundle";
