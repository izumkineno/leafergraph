/**
 * 这份模板把“插件级常量”和“模块级常量”集中放在一个文件里，
 * 目的是让你复制出去之后，只改这一处就能完成大多数命名替换。
 */

/** 插件包名称，建议与 npm 包名保持一致。 */
export const TEMPLATE_PLUGIN_NAME = "@template/node-widget-demo";

/** 模板版本号。 */
export const TEMPLATE_PLUGIN_VERSION = "0.1.0";

/**
 * 模块级作用域。
 * `namespace` 会决定节点安装到宿主后的最终类型前缀；
 * `group` 会作为默认菜单分组或节点分组。
 */
export const TEMPLATE_MODULE_SCOPE = {
  namespace: "template",
  group: "Template"
} as const;

/** 模板里统一复用的节点宽度。 */
export const TEMPLATE_NODE_WIDTH = 288;

/** 模板里统一复用的节点最小高度。 */
export const TEMPLATE_NODE_MIN_HEIGHT = 184;

/** 供演示用的基础控制 widget 名称。 */
export const TEMPLATE_CONTROL_WIDGET_NAME = "primary-control";

/** 分类节点的局部类型。安装后会自动变成 `template/category-node`。 */
export const TEMPLATE_CATEGORY_NODE_LOCAL_TYPE = "category-node";

/** 基础组件节点的局部类型。 */
export const TEMPLATE_BASIC_WIDGET_NODE_LOCAL_TYPE = "basic-widgets";

/** 外部 widget 节点的局部类型。 */
export const TEMPLATE_EXTERNAL_WIDGET_NODE_LOCAL_TYPE = "external-widget-node";

/** 外部 widget 的完整类型。widget 不走模块 scope，因此这里直接写最终值。 */
export const TEMPLATE_EXTERNAL_STATUS_WIDGET_TYPE = "template/external-status";

/** 宿主真正会看到的分类节点类型。 */
export const TEMPLATE_CATEGORY_NODE_TYPE = resolveTemplateScopedNodeType(
  TEMPLATE_CATEGORY_NODE_LOCAL_TYPE
);

/** 宿主真正会看到的基础组件节点类型。 */
export const TEMPLATE_BASIC_WIDGET_NODE_TYPE = resolveTemplateScopedNodeType(
  TEMPLATE_BASIC_WIDGET_NODE_LOCAL_TYPE
);

/** 宿主真正会看到的外部 widget 节点类型。 */
export const TEMPLATE_EXTERNAL_WIDGET_NODE_TYPE = resolveTemplateScopedNodeType(
  TEMPLATE_EXTERNAL_WIDGET_NODE_LOCAL_TYPE
);

/**
 * 用模块级 namespace 生成最终节点类型。
 * 这样节点定义文件里可以只写局部类型，模板 graph 数据仍然能拿到最终类型。
 */
export function resolveTemplateScopedNodeType(localType: string): string {
  return `${TEMPLATE_MODULE_SCOPE.namespace}/${localType}`;
}

/**
 * 创建模板里反复复用的 slider widget。
 * 它主要用于：
 * 1. 分类节点上的最小演示控件
 * 2. 默认图数据里的视觉反馈
 */
export function createTemplateControlWidget(
  label: string,
  progress: number,
  displayValue?: string
) {
  return {
    type: "slider" as const,
    name: TEMPLATE_CONTROL_WIDGET_NAME,
    value: progress,
    options: {
      label,
      ...(displayValue !== undefined ? { displayValue } : {})
    }
  };
}
