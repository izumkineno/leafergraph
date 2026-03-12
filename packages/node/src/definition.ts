import type { NodeLifecycle } from "./lifecycle";
import type { NodePropertySpec, NodeSlotSpec, NodeWidgetSpec } from "./types";

export interface NodeDefinition extends NodeLifecycle {
  type: string;
  title?: string;
  category?: string;
  description?: string;
  keywords?: string[];
  inputs?: NodeSlotSpec[];
  outputs?: NodeSlotSpec[];
  properties?: NodePropertySpec[];
  widgets?: NodeWidgetSpec[];
  size?: [number, number];
  minWidth?: number;
  minHeight?: number;
}

export interface WidgetDefinition {
  type: string;
  title?: string;
  description?: string;
  normalize?(value: unknown, spec?: NodeWidgetSpec): unknown;
  serialize?(value: unknown, spec?: NodeWidgetSpec): unknown;
}

export interface NodeModuleScope {
  namespace?: string;
  group?: string;
}

export interface NodeModule {
  scope?: NodeModuleScope;
  nodes?: NodeDefinition[];
  widgets?: WidgetDefinition[];
}
