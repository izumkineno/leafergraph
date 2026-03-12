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

export interface LeaferGraphWidgetBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LeaferGraphWidgetRenderInstance {
  update?(newValue: unknown): void;
  destroy?(): void;
}

export interface LeaferGraphWidgetRendererContext {
  ui: typeof import("leafer-ui");
  group: Group;
  node: NodeRuntimeState;
  widget: NodeWidgetSpec;
  value: unknown;
  bounds: LeaferGraphWidgetBounds;
}

export interface LeaferGraphWidgetRenderer {
  (
    context: LeaferGraphWidgetRendererContext
  ): LeaferGraphWidgetRenderInstance | void;
}

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

export interface LeaferGraphNodePlugin {
  name: string;
  version?: string;
  install(context: LeaferGraphNodePluginContext): void | Promise<void>;
}

export interface LeaferGraphOptions extends BaseLeaferGraphOptions {
  plugins?: LeaferGraphNodePlugin[];
}
