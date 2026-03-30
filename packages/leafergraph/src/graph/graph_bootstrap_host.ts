/**
 * 图启动装配宿主模块。
 *
 * @remarks
 * 负责模块安装、插件安装以及启动期图恢复顺序。
 */

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
} from "@leafergraph/contracts";
import type { LeaferGraphWidgetRegistry } from "@leafergraph/widget-runtime";

/** 已安装插件的登记信息。 */
interface InstalledPluginRecord {
  name: string;
  version?: string;
  nodeTypes: string[];
  widgetTypes: string[];
}

/**
 * 启动装配宿主依赖的最小运行时能力。
 *
 * @remarks
 * 启动宿主只关心“安装顺序”和“注册入口”，
 * 真正的节点注册表、Widget 注册表与图恢复实现都通过外部注入，
 * 这样既方便测试，也能避免启动层直接耦合到具体场景实现。
 */
interface LeaferGraphBootstrapHostOptions {
  nodeRegistry: NodeRegistry;
  widgetRegistry: LeaferGraphWidgetRegistry;
  replaceGraphDocument(document?: LeaferGraphOptions["document"]): void;
}

/**
 * 启动宿主对外暴露的最小运行时壳面。
 *
 * @remarks
 * 入口层只需要模块安装、插件安装、注册表读写和统一初始化这几类能力，
 * 因此这里刻意不暴露更底层的场景、交互或渲染细节。
 */
export interface LeaferGraphBootstrapRuntimeLike {
  use(plugin: LeaferGraphNodePlugin): Promise<void>;
  installModule(
    module: NodeModule,
    options?: InstallNodeModuleOptions
  ): ResolvedNodeModule;
  initialize(options: LeaferGraphOptions): Promise<void>;
  replaceGraphDocument(document?: LeaferGraphOptions["document"]): void;
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
 * 1. 节点模块安装
 * 2. 插件安装与插件上下文组装
 * 3. 启动期 `modules/plugins/document` 初始化顺序
 */
export class LeaferGraphBootstrapHost implements LeaferGraphBootstrapRuntimeLike {
  private readonly options: LeaferGraphBootstrapHostOptions;
  private readonly installedPlugins = new Map<string, InstalledPluginRecord>();

  constructor(options: LeaferGraphBootstrapHostOptions) {
    this.options = options;
  }

  /** 安装一个静态节点模块。 */
  installModule(
    module: NodeModule,
    options?: InstallNodeModuleOptions
  ): ResolvedNodeModule {
    return installNodeModule(this.options.nodeRegistry, module, options);
  }

  /**
   * 安装一个外部节点插件。
   *
   * @remarks
   * 插件可以通过上下文继续安装节点模块、注册节点和注册 Widget，
   * 宿主会同时记录它实际注册了哪些类型，方便调试和后续观测。
   *
   * @param plugin - 待安装的插件对象。
   */
  async use(plugin: LeaferGraphNodePlugin): Promise<void> {
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
        // 这里的登记信息只用于可观测性，不参与正式注册流程本身。
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

    // 插件既可以同步安装，也可以异步拉起自己的注册逻辑；这里统一 await 保证顺序稳定。
    await plugin.install(context);

    this.installedPlugins.set(plugin.name, {
      name: plugin.name,
      version: plugin.version,
      nodeTypes,
      widgetTypes
    });
  }

  /**
   * 执行启动期安装流程，然后恢复初始文档。
   * 顺序保持为：模块 -> 插件 -> 文档恢复。
   *
   * @param options - 主包初始化配置。
   */
  async initialize(options: LeaferGraphOptions): Promise<void> {
    // 模块优先进入注册表，后续插件才能安全查询并复用这些节点定义。
    for (const module of options.modules ?? []) {
      this.installModule(module);
    }

    // 插件阶段允许继续注册 Widget、节点或二次安装模块。
    for (const plugin of options.plugins ?? []) {
      await this.use(plugin);
    }

    // 等注册表完全就绪后再恢复文档，避免启动时出现“节点已在图里，但类型还没注册”的半状态。
    this.options.replaceGraphDocument(options.document);
  }

  /** 直接替换当前正式文档。 */
  replaceGraphDocument(document?: LeaferGraphOptions["document"]): void {
    this.options.replaceGraphDocument(document);
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
