import type { NodeDefinition, NodeModule, NodeModuleScope, WidgetDefinition } from "./definition";
import type { NodeRegistry, RegisterNodeOptions } from "./registry";
import { cloneDefinition } from "./utils";

export interface InstallNodeModuleOptions extends RegisterNodeOptions {
  scope?: NodeModuleScope;
}

export interface ResolvedNodeModule {
  scope: NodeModuleScope;
  nodes: NodeDefinition[];
  widgets: WidgetDefinition[];
}

export function installNodeModule(
  registry: NodeRegistry,
  module: NodeModule,
  options: InstallNodeModuleOptions = {}
): ResolvedNodeModule {
  const resolved = resolveNodeModule(module, options);

  for (const widget of resolved.widgets) {
    registry.registerWidget(widget, {
      overwrite: options.overwrite
    });
  }

  for (const node of resolved.nodes) {
    registry.register(node, options);
  }

  return resolved;
}

export function resolveNodeModule(
  module: NodeModule,
  options: InstallNodeModuleOptions = {}
): ResolvedNodeModule {
  const scope = resolveNodeModuleScope(module.scope, options.scope);

  return {
    scope,
    widgets: module.widgets?.map((widget) => ({ ...widget, type: widget.type.trim() })) ?? [],
    nodes: module.nodes?.map((definition) => applyNodeModuleScope(definition, scope)) ?? []
  };
}

export function resolveNodeModuleScope(
  baseScope?: NodeModuleScope,
  overrideScope?: NodeModuleScope
): NodeModuleScope {
  const namespace = normalizeNamespace(overrideScope?.namespace ?? baseScope?.namespace);
  const group = normalizeGroup(overrideScope?.group ?? baseScope?.group);

  return {
    namespace,
    group
  };
}

export function applyNodeModuleScope(
  definition: NodeDefinition,
  scope: NodeModuleScope
): NodeDefinition {
  const next = cloneDefinition(definition);
  const type = next.type.trim();

  next.type = resolveScopedNodeType(type, scope.namespace);

  if (!next.category) {
    next.category = scope.group;
  }

  return next;
}

export function resolveScopedNodeType(type: string, namespace?: string): string {
  const safeType = type.trim();
  const safeNamespace = normalizeNamespace(namespace);

  if (!safeNamespace || isScopedNodeType(safeType)) {
    return safeType;
  }

  return `${safeNamespace}/${safeType}`;
}

export function isScopedNodeType(type: string): boolean {
  return /[/:]/.test(type);
}

function normalizeNamespace(namespace?: string): string | undefined {
  const value = namespace?.trim().replace(/[/\\]+/g, "/").replace(/^\/+|\/+$/g, "");
  return value || undefined;
}

function normalizeGroup(group?: string): string | undefined {
  const value = group?.trim();
  return value || undefined;
}
