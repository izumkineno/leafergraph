import type {
  InstallNodeModuleOptions,
  LeaferGraphOptions as BaseLeaferGraphOptions,
  NodeDefinition,
  NodeModule,
  NodeRuntimeState,
  NodeWidgetSpec,
  RegisterNodeOptions,
  RegisterWidgetOptions,
  WidgetDefinition
} from "@leafergraph/node";
import type { Group } from "leafer-ui";

/**
 * Widget 在节点内部的布局边界。
 * 主包会把这块矩形区域交给 renderer 自己决定如何使用。
 */
export interface LeaferGraphWidgetBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Widget renderer 返回的最小生命周期实例。
 * 由宿主持有并在数值变化、节点销毁时主动调度。
 */
export interface LeaferGraphWidgetRenderInstance {
  update?(newValue: unknown): void;
  destroy?(): void;
}

/**
 * 调用 Widget renderer 时传入的上下文。
 */
export interface LeaferGraphWidgetRendererContext {
  ui: typeof import("leafer-ui");
  group: Group;
  node: NodeRuntimeState;
  widget: NodeWidgetSpec;
  value: unknown;
  bounds: LeaferGraphWidgetBounds;
}

/**
 * Widget renderer 协议。
 * 首次执行负责 Mount，返回值负责后续 Update / Destroy。
 */
export interface LeaferGraphWidgetRenderer {
  (
    context: LeaferGraphWidgetRendererContext
  ): LeaferGraphWidgetRenderInstance | void;
}

/**
 * 外部节点插件在安装阶段可使用的宿主上下文。
 */
export interface LeaferGraphNodePluginContext {
  sdk: typeof import("@leafergraph/node");
  ui: typeof import("leafer-ui");
  installModule: (module: NodeModule, options?: InstallNodeModuleOptions) => void;
  registerNode: (definition: NodeDefinition, options?: RegisterNodeOptions) => void;
  registerWidget: (definition: WidgetDefinition, options?: RegisterWidgetOptions) => void;
  registerWidgetRenderer: (type: string, renderer: LeaferGraphWidgetRenderer) => void;
  hasNode: (type: string) => boolean;
  hasWidget: (type: string) => boolean;
  getNode: (type: string) => NodeDefinition | undefined;
  listNodes: () => NodeDefinition[];
}

/**
 * 外部节点插件对象。
 */
export interface LeaferGraphNodePlugin {
  name: string;
  version?: string;
  install(context: LeaferGraphNodePluginContext): void | Promise<void>;
}

/**
 * 主包初始化配置。
 * 在基础 demo 配置上，额外支持插件批量安装。
 */
export interface LeaferGraphOptions extends BaseLeaferGraphOptions {
  plugins?: LeaferGraphNodePlugin[];
}
