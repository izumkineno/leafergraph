import * as NodeSDK from "@leafergraph/node";
import {
  installNodeModule,
  type InstallNodeModuleOptions,
  type NodeDefinition,
  type NodeModule,
  type NodeRegistry,
  type RegisterNodeOptions,
  type RegisterWidgetOptions,
  type ResolvedNodeModule
} from "@leafergraph/node";
import * as LeaferUI from "leafer-ui";
import type {
  LeaferGraphNodePlugin,
  LeaferGraphNodePluginContext,
  LeaferGraphOptions,
  LeaferGraphWidgetEntry
} from "../api/plugin";
import { BasicWidgetLibrary } from "../widgets/basic";
import type { LeaferGraphWidgetRegistry } from "../widgets/widget_registry";

/** 已安装插件的登记信息。 */
interface InstalledPluginRecord {
  name: string;
  version?: string;
  nodeTypes: string[];
  widgetTypes: string[];
}

interface LeaferGraphBootstrapHostOptions {
  nodeRegistry: NodeRegistry;
  widgetRegistry: LeaferGraphWidgetRegistry;
  restoreGraph(graph?: LeaferGraphOptions["graph"]): void;
}

/** 启动宿主对外暴露的最小运行时壳面。 */
export interface LeaferGraphBootstrapRuntimeLike {
  use(plugin: LeaferGraphNodePlugin): Promise<void>;
  installModule(
    module: NodeModule,
    options?: InstallNodeModuleOptions
  ): ResolvedNodeModule;
  initialize(options: LeaferGraphOptions): Promise<void>;
  registerNode(definition: NodeDefinition, options?: RegisterNodeOptions): void;
  listNodes(): NodeDefinition[];
  registerWidget(
    entry: LeaferGraphWidgetEntry,
    options?: RegisterWidgetOptions
  ): void;
  getWidget(type: string): LeaferGraphWidgetEntry | undefined;
  listWidgets(): LeaferGraphWidgetEntry[];
}

/**
 * 启动装配宿主。
 * 当前集中收口：
 * 1. 内建 Widget 注册
 * 2. 节点模块安装
 * 3. 插件安装与插件上下文组装
 * 4. 启动期 `modules/plugins/graph` 初始化顺序
 */
export class LeaferGraphBootstrapHost implements LeaferGraphBootstrapRuntimeLike {
  private readonly options: LeaferGraphBootstrapHostOptions;
  private readonly installedPlugins = new Map<string, InstalledPluginRecord>();
  private builtinWidgetsRegistered = false;

  constructor(options: LeaferGraphBootstrapHostOptions) {
    this.options = options;
  }

  /** 确保内建 Widget 只注册一次，避免重复覆盖外部状态。 */
  ensureBuiltinWidgetsRegistered(): void {
    if (this.builtinWidgetsRegistered) {
      return;
    }

    const builtinWidgets = new BasicWidgetLibrary().createEntries();
    for (const entry of builtinWidgets) {
      this.options.widgetRegistry.registerWidget(entry, { overwrite: true });
    }

    this.builtinWidgetsRegistered = true;
  }

  /** 安装一个静态节点模块。 */
  installModule(
    module: NodeModule,
    options?: InstallNodeModuleOptions
  ): ResolvedNodeModule {
    return installNodeModule(this.options.nodeRegistry, module, options);
  }

  /** 安装一个外部节点插件。 */
  async use(plugin: LeaferGraphNodePlugin): Promise<void> {
    this.ensureBuiltinWidgetsRegistered();

    if (this.installedPlugins.has(plugin.name)) {
      return;
    }

    const nodeTypes: string[] = [];
    const widgetTypes: string[] = [];
    const recordType = (list: string[], type: string): void => {
      const safeType = type.trim();
      if (safeType && !list.includes(safeType)) {
        list.push(safeType);
      }
    };

    const context: LeaferGraphNodePluginContext = {
      sdk: NodeSDK,
      ui: LeaferUI,
      installModule: (module, options) => {
        const resolved = this.installModule(module, options);
        for (const node of resolved.nodes) {
          recordType(nodeTypes, node.type);
        }
      },
      registerNode: (definition, options) => {
        this.registerNode(definition, options);
        recordType(nodeTypes, definition.type);
      },
      registerWidget: (entry, options) => {
        this.registerWidget(entry, options);
        recordType(widgetTypes, entry.type);
      },
      hasNode: (type) => this.options.nodeRegistry.hasNode(type),
      hasWidget: (type) => this.options.widgetRegistry.hasWidget(type),
      getWidget: (type) => this.options.widgetRegistry.getWidget(type),
      listWidgets: () => this.options.widgetRegistry.listWidgets(),
      getNode: (type) => this.options.nodeRegistry.getNode(type),
      listNodes: () => this.options.nodeRegistry.listNodes()
    };

    await plugin.install(context);

    this.installedPlugins.set(plugin.name, {
      name: plugin.name,
      version: plugin.version,
      nodeTypes,
      widgetTypes
    });
  }

  /**
   * 执行启动期安装流程，然后恢复初始图数据。
   * 顺序保持为：内建 Widget -> 模块 -> 插件 -> 图恢复。
   */
  async initialize(options: LeaferGraphOptions): Promise<void> {
    this.ensureBuiltinWidgetsRegistered();

    for (const module of options.modules ?? []) {
      this.installModule(module);
    }

    for (const plugin of options.plugins ?? []) {
      await this.use(plugin);
    }

    this.options.restoreGraph(options.graph);
  }

  /** 注册单个节点定义。 */
  registerNode(
    definition: NodeDefinition,
    options?: RegisterNodeOptions
  ): void {
    this.options.nodeRegistry.registerNode(definition, options);
  }

  /** 列出当前已注册节点。 */
  listNodes(): NodeDefinition[] {
    return this.options.nodeRegistry.listNodes();
  }

  /** 注册单个完整 Widget 条目。 */
  registerWidget(
    entry: LeaferGraphWidgetEntry,
    options?: RegisterWidgetOptions
  ): void {
    this.options.widgetRegistry.registerWidget(entry, options);
  }

  /** 读取单个 Widget 条目。 */
  getWidget(type: string): LeaferGraphWidgetEntry | undefined {
    return this.options.widgetRegistry.getWidget(type);
  }

  /** 列出当前已注册 Widget。 */
  listWidgets(): LeaferGraphWidgetEntry[] {
    return this.options.widgetRegistry.listWidgets();
  }
}
