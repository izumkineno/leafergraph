import type { GraphDocument, NodeDefinition, NodeModule } from "@leafergraph/node";
import type { LeaferGraphWidgetEntry } from "@leafergraph/contracts";
import type { RuntimeBridgeArtifactData } from "./artifact.js";

type RuntimeBridgeModuleNamespace = Record<string, unknown>;
export type RuntimeBridgeModuleDependencyNamespace = Record<string, unknown>;

const GLOBAL_DEPENDENCY_KEY = "__LEAFERGRAPH_RUNTIME_BRIDGE_MODULE_DEPS__";
const dependencyShimUrlCache = new Map<string, string>();
const serverModuleSpecifierCache = new Map<string, string>();
let serverModuleDirectoryPromise: Promise<string> | null = null;

/**
 * 把 artifact 解析成可 import 的 JS specifier。
 */
export async function createModuleSpecifierFromArtifact(
  artifact: RuntimeBridgeArtifactData
): Promise<string> {
  if (artifact.kind === "url") {
    return artifact.url;
  }

  const contentType = artifact.contentType || "text/javascript";
  if (shouldUseInlineDataModuleSpecifier()) {
    return `data:${contentType};base64,${encodeBytesToBase64(artifact.bytes)}`;
  }

  return createServerModuleSpecifier(
    new TextDecoder().decode(artifact.bytes),
    "artifact"
  );
}

/**
 * 加载 JS artifact。
 */
export async function importModuleNamespaceFromArtifact(
  artifact: RuntimeBridgeArtifactData
): Promise<RuntimeBridgeModuleNamespace> {
  const specifier = await createRewrittenModuleSpecifierFromArtifact(artifact);
  return (await import(
    /* @vite-ignore */ specifier
  )) as RuntimeBridgeModuleNamespace;
}

/**
 * 注册一个可供 runtime-bridge artifact 解析期使用的裸依赖。
 */
export function registerRuntimeBridgeModuleDependency(
  specifier: string,
  moduleNamespace: RuntimeBridgeModuleDependencyNamespace
): void {
  const registry = getRuntimeDependencyRegistry();
  registry[specifier] = moduleNamespace;
  dependencyShimUrlCache.delete(specifier);
}

/**
 * 批量注册 runtime-bridge artifact 解析期依赖。
 */
export function registerRuntimeBridgeModuleDependencies(
  dependencies: Record<string, RuntimeBridgeModuleDependencyNamespace>
): void {
  for (const [specifier, moduleNamespace] of Object.entries(dependencies)) {
    registerRuntimeBridgeModuleDependency(specifier, moduleNamespace);
  }
}

/**
 * 获取当前已注册的 runtime-bridge 依赖 specifier 列表。
 */
export function listRuntimeBridgeModuleDependencies(): string[] {
  return Object.keys(getRuntimeDependencyRegistry());
}

/**
 * 解析节点 artifact 导出。
 */
export function resolveNodeModuleExport(
  namespace: RuntimeBridgeModuleNamespace
): NodeModule | NodeDefinition[] {
  const candidates = collectExportCandidates(namespace);
  const aggregatedDefinitions: NodeDefinition[] = [];
  let firstNodeModule: NodeModule | null = null;

  for (const value of candidates) {
    if (isNodeModule(value)) {
      firstNodeModule ??= value;
      for (const node of value.nodes ?? []) {
        if (isResolvedNodeDefinitionValue(node)) {
          aggregatedDefinitions.push(node);
          continue;
        }

        aggregatedDefinitions.push(
          ...collectNodeDefinitionsRecursive(node, new Set<unknown>(), 0)
        );
      }
      continue;
    }

    if (isNodeDefinitionArray(value)) {
      aggregatedDefinitions.push(...value);
      continue;
    }

    aggregatedDefinitions.push(...resolveNodeDefinitionsLike(value));
  }

  const uniqueDefinitions = dedupeNodeDefinitionsByType(aggregatedDefinitions);
  if (uniqueDefinitions.length > 0) {
    if (
      firstNodeModule &&
      uniqueDefinitions.length === (firstNodeModule.nodes?.length ?? 0)
    ) {
      if (!nodeModuleContainsResolvedDefinitions(firstNodeModule)) {
        return firstNodeModule.scope
          ? {
              ...firstNodeModule,
              nodes: uniqueDefinitions
            }
          : uniqueDefinitions;
      }

      return firstNodeModule;
    }

    return uniqueDefinitions;
  }

  throw new Error(
    "节点 artifact 必须导出可解析的 NodeModule、NodeDefinition[] 或 authoring node/module。"
  );
}

/**
 * 解析节点 artifact 实际导出的节点类型列表。
 */
export function resolveNodeTypesExport(
  namespace: RuntimeBridgeModuleNamespace
): string[] {
  return collectUniqueTypes(
    getResolvedNodeDefinitions(namespace).map((definition) => definition.type)
  );
}

/**
 * 解析节点 artifact 里声明使用的 widget 类型列表。
 */
export function collectNodeWidgetTypesExport(
  namespace: RuntimeBridgeModuleNamespace
): string[] {
  const widgetTypes: string[] = [];

  for (const definition of getResolvedNodeDefinitions(namespace)) {
    if (Array.isArray(definition.widgets)) {
      for (const widget of definition.widgets) {
        widgetTypes.push(widget.type);
      }
    }

    if (!Array.isArray(definition.properties)) {
      continue;
    }

    for (const property of definition.properties) {
      if (property.widget?.type) {
        widgetTypes.push(property.widget.type);
      }
    }
  }

  return collectUniqueTypes(widgetTypes);
}

/**
 * 解析组件 artifact 导出。
 */
export function resolveWidgetEntriesExport(
  namespace: RuntimeBridgeModuleNamespace
): LeaferGraphWidgetEntry[] {
  const candidates = collectExportCandidates(namespace);
  const aggregatedEntries: LeaferGraphWidgetEntry[] = [];

  for (const value of candidates) {
    if (isWidgetEntryArray(value)) {
      aggregatedEntries.push(...value);
      continue;
    }

    aggregatedEntries.push(...resolveWidgetEntriesLike(value));
  }

  const uniqueEntries = dedupeWidgetEntriesByType(aggregatedEntries);
  if (uniqueEntries.length > 0) {
    return uniqueEntries;
  }

  throw new Error("组件 artifact 必须导出 LeaferGraphWidgetEntry[]。");
}

/**
 * 解析组件 artifact 实际导出的 widget 类型列表。
 */
export function resolveWidgetTypesExport(
  namespace: RuntimeBridgeModuleNamespace
): string[] {
  return collectUniqueTypes(
    resolveWidgetEntriesExport(namespace).map((entry) => entry.type)
  );
}

/**
 * 读取 blueprint document artifact。
 */
export async function readGraphDocumentFromArtifact(
  artifact: RuntimeBridgeArtifactData
): Promise<GraphDocument> {
  if (artifact.kind === "bytes") {
    return JSON.parse(new TextDecoder().decode(artifact.bytes)) as GraphDocument;
  }

  const response = await fetch(artifact.url);
  if (!response.ok) {
    throw new Error(`读取 blueprint artifact 失败: ${response.status}`);
  }
  return (await response.json()) as GraphDocument;
}

/**
 * 收集 blueprint document 实际使用的节点 / widget 类型。
 */
export function collectGraphDocumentUsedTypes(document: GraphDocument): {
  nodeTypes: string[];
  widgetTypes: string[];
} {
  const nodeTypes: string[] = [];
  const widgetTypes: string[] = [];

  for (const node of document.nodes) {
    nodeTypes.push(node.type);

    if (Array.isArray(node.widgets)) {
      for (const widget of node.widgets) {
        widgetTypes.push(widget.type);
      }
    }

    if (Array.isArray(node.propertySpecs)) {
      for (const property of node.propertySpecs) {
        if (property.widget?.type) {
          widgetTypes.push(property.widget.type);
        }
      }
    }
  }

  return {
    nodeTypes: collectUniqueTypes(nodeTypes),
    widgetTypes: collectUniqueTypes(widgetTypes)
  };
}

async function createRewrittenModuleSpecifierFromArtifact(
  artifact: RuntimeBridgeArtifactData
): Promise<string> {
  const sourceText = await readJavaScriptArtifactSource(artifact);
  const rewrittenSource = await rewriteRuntimeDependencies(
    sourceText.replace(/^\/\/# sourceMappingURL=.*$/gm, "")
  );
  if (shouldUseInlineDataModuleSpecifier()) {
    return `data:text/javascript;base64,${encodeBytesToBase64(
      new TextEncoder().encode(rewrittenSource)
    )}`;
  }

  return createServerModuleSpecifier(rewrittenSource, "runtime-bridge-artifact");
}

async function readJavaScriptArtifactSource(
  artifact: RuntimeBridgeArtifactData
): Promise<string> {
  if (artifact.kind === "bytes") {
    return new TextDecoder().decode(artifact.bytes);
  }

  const response = await fetch(artifact.url);
  if (!response.ok) {
    throw new Error(`读取 JS artifact 失败: ${response.status}`);
  }
  return await response.text();
}

async function rewriteRuntimeDependencies(sourceText: string): Promise<string> {
  let nextSource = sourceText;

  for (const specifier of listRuntimeBridgeModuleDependencies()) {
    if (!nextSource.includes(specifier)) {
      continue;
    }

    const shimUrl = await ensureRuntimeDependencyShim(specifier);
    const specifierPattern = new RegExp(
      `([\"'])${escapeRegExp(specifier)}\\1`,
      "g"
    );
    nextSource = nextSource.replace(specifierPattern, `"${shimUrl}"`);
  }

  return nextSource;
}

async function ensureRuntimeDependencyShim(specifier: string): Promise<string> {
  const cachedUrl = dependencyShimUrlCache.get(specifier);
  if (cachedUrl) {
    return cachedUrl;
  }

  const registry = getRuntimeDependencyRegistry();
  const moduleNamespace = registry[specifier];
  if (!moduleNamespace) {
    throw new Error(`runtime-bridge 未注册模块依赖: ${specifier}`);
  }

  const shimSource = buildDependencyExportLines(specifier, moduleNamespace);
  const shimUrl = shouldUseInlineDataModuleSpecifier()
    ? `data:text/javascript;base64,${encodeBytesToBase64(
        new TextEncoder().encode(shimSource)
      )}`
    : await createServerModuleSpecifier(
        shimSource,
        `runtime-bridge-dependency-${specifier}`
      );
  dependencyShimUrlCache.set(specifier, shimUrl);
  return shimUrl;
}

function shouldUseInlineDataModuleSpecifier(): boolean {
  const globalObject = globalThis as typeof globalThis & {
    Bun?: unknown;
    process?: {
      versions?: {
        node?: string;
      };
    };
  };

  if (globalObject.Bun) {
    return false;
  }

  if (globalObject.process?.versions?.node) {
    return false;
  }

  return typeof window !== "undefined" && typeof document !== "undefined";
}

async function createServerModuleSpecifier(
  sourceText: string,
  label: string
): Promise<string> {
  const cacheKey = await computeStableSourceHash(sourceText);
  const cachedSpecifier = serverModuleSpecifierCache.get(cacheKey);
  if (cachedSpecifier) {
    return cachedSpecifier;
  }

  const [{ writeFile }, pathModule, { pathToFileURL }] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
    import("node:url")
  ]);
  const directory = await ensureServerModuleDirectory();
  const fileName = `${sanitizeModuleFileName(label)}-${cacheKey}.mjs`;
  const filePath = pathModule.join(directory, fileName);
  await writeFile(filePath, sourceText, "utf8");
  const specifier = pathToFileURL(filePath).href;
  serverModuleSpecifierCache.set(cacheKey, specifier);
  return specifier;
}

async function ensureServerModuleDirectory(): Promise<string> {
  serverModuleDirectoryPromise ??= (async () => {
    const [{ mkdir }, pathModule, { tmpdir }] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
      import("node:os")
    ]);
    const directory = pathModule.join(
      tmpdir(),
      "leafergraph-runtime-bridge-modules"
    );
    await mkdir(directory, { recursive: true });
    return directory;
  })();

  return serverModuleDirectoryPromise;
}

async function computeStableSourceHash(sourceText: string): Promise<string> {
  try {
    const { createHash } = await import("node:crypto");
    return createHash("sha256").update(sourceText).digest("hex").slice(0, 24);
  } catch {
    return String(Math.abs(hashStringFallback(sourceText)));
  }
}

function hashStringFallback(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function sanitizeModuleFileName(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || "runtime-bridge-module";
}

function buildDependencyExportLines(
  specifier: string,
  moduleNamespace: RuntimeBridgeModuleDependencyNamespace
): string {
  const lines = [
    `const namespace = globalThis[${JSON.stringify(
      GLOBAL_DEPENDENCY_KEY
    )}][${JSON.stringify(specifier)}];`
  ];

  for (const exportName of Object.keys(moduleNamespace)) {
    if (exportName === "default") {
      continue;
    }
    if (!isValidJavaScriptIdentifier(exportName)) {
      continue;
    }

    lines.push(
      `export const ${exportName} = namespace[${JSON.stringify(exportName)}];`
    );
  }

  if ("default" in moduleNamespace) {
    lines.push("export default namespace.default;");
  }

  return lines.join("\n");
}

function collectExportCandidates(
  namespace: RuntimeBridgeModuleNamespace
): unknown[] {
  const candidates: unknown[] = [];

  if ("default" in namespace) {
    candidates.push(namespace.default);
  }

  for (const [key, value] of Object.entries(namespace)) {
    if (key === "default") {
      continue;
    }
    candidates.push(value);
  }

  return candidates;
}

function isNodeModule(value: unknown): value is NodeModule {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as NodeModule).nodes)
  );
}

function nodeModuleContainsResolvedDefinitions(module: NodeModule): boolean {
  return (module.nodes ?? []).every((node) => isResolvedNodeDefinitionValue(node));
}

function isResolvedNodeDefinitionValue(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return !isWidgetEntryLikeRecord(record) && isLikelyNodeDefinitionRecord(record);
}

function isNodeDefinitionArray(value: unknown): value is NodeDefinition[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as NodeDefinition).type === "string"
    )
  );
}

function isWidgetEntryArray(value: unknown): value is LeaferGraphWidgetEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as LeaferGraphWidgetEntry).type === "string" &&
        "renderer" in (item as LeaferGraphWidgetEntry)
    )
  );
}

function getResolvedNodeDefinitions(
  namespace: RuntimeBridgeModuleNamespace
): NodeDefinition[] {
  const resolved = resolveNodeModuleExport(namespace);
  return isNodeModule(resolved) ? resolved.nodes ?? [] : resolved;
}

function resolveNodeDefinitionsLike(value: unknown): NodeDefinition[] {
  return dedupeNodeDefinitionsByType(
    collectNodeDefinitionsRecursive(value, new Set<unknown>(), 0)
  );
}

function resolveNodeDefinitionLike(value: unknown): NodeDefinition | null {
  if (typeof value !== "object" && typeof value !== "function") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (isWidgetEntryLikeRecord(record)) {
    return null;
  }

  if (isLikelyNodeDefinitionRecord(record)) {
    return value as NodeDefinition;
  }

  for (const candidateKey of [
    "meta",
    "definition",
    "node",
    "nodeClass",
    "NodeClass",
    "class",
    "klass",
    "ctor",
    "browserNode",
    "authorityNode"
  ] as const) {
    const candidate = record[candidateKey];
    if (!candidate || candidate === value) {
      continue;
    }

    const resolved = resolveNodeDefinitionLike(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function isLikelyNodeDefinitionRecord(record: Record<string, unknown>): boolean {
  if (typeof record.type !== "string") {
    return false;
  }

  if (
    ("normalize" in record || "serialize" in record) &&
    !NODE_DEFINITION_HINT_KEYS.some((key) => key in record)
  ) {
    return false;
  }

  if ("title" in record || "description" in record) {
    return true;
  }

  for (const key of NODE_DEFINITION_HINT_KEYS) {
    if (key in record) {
      return true;
    }
  }

  return false;
}

function isWidgetEntryLikeRecord(record: Record<string, unknown>): boolean {
  return typeof record.type === "string" && "renderer" in record;
}

const NODE_DEFINITION_HINT_KEYS = [
  "inputs",
  "outputs",
  "properties",
  "widgets",
  "category",
  "keywords",
  "size",
  "resize",
  "shell",
  "onCreate",
  "onConfigure",
  "onSerialize",
  "onExecute",
  "onPropertyChanged",
  "onInputAdded",
  "onOutputAdded",
  "onConnectionsChange",
  "onAction",
  "onTrigger"
] as const;

function collectNodeDefinitionsRecursive(
  value: unknown,
  seen: Set<unknown>,
  depth: number
): NodeDefinition[] {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    return [];
  }
  if (seen.has(value) || depth > 6) {
    return [];
  }
  seen.add(value);

  const directDefinition = resolveNodeDefinitionLike(value);
  if (directDefinition) {
    return [directDefinition];
  }

  const collected: NodeDefinition[] = [];
  const record = value as Record<string, unknown>;

  if (Array.isArray(record.nodes)) {
    for (const item of record.nodes) {
      collected.push(...collectNodeDefinitionsRecursive(item, seen, depth + 1));
    }
  }

  for (const candidateKey of [
    "meta",
    "definition",
    "node",
    "nodeClass",
    "NodeClass",
    "class",
    "klass",
    "ctor",
    "browserNode",
    "authorityNode"
  ] as const) {
    const candidate = record[candidateKey];
    if (!candidate || candidate === value) {
      continue;
    }
    collected.push(...collectNodeDefinitionsRecursive(candidate, seen, depth + 1));
  }

  if (isPlainObject(value)) {
    for (const candidate of Object.values(record)) {
      if (!candidate || candidate === value) {
        continue;
      }
      collected.push(...collectNodeDefinitionsRecursive(candidate, seen, depth + 1));
    }
  }

  return collected;
}

function resolveWidgetEntriesLike(value: unknown): LeaferGraphWidgetEntry[] {
  return dedupeWidgetEntriesByType(
    collectWidgetEntriesRecursive(value, new Set<unknown>(), 0)
  );
}

function resolveWidgetEntryLike(value: unknown): LeaferGraphWidgetEntry | null {
  if (typeof value !== "object" && typeof value !== "function") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.type === "string" && "renderer" in record) {
    return value as LeaferGraphWidgetEntry;
  }

  for (const candidateKey of [
    "entry",
    "widget",
    "widgetEntry",
    "definition",
    "meta"
  ] as const) {
    const candidate = record[candidateKey];
    if (!candidate || candidate === value) {
      continue;
    }

    const resolved = resolveWidgetEntryLike(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function collectWidgetEntriesRecursive(
  value: unknown,
  seen: Set<unknown>,
  depth: number
): LeaferGraphWidgetEntry[] {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    return [];
  }
  if (seen.has(value) || depth > 6) {
    return [];
  }
  seen.add(value);

  const directEntry = resolveWidgetEntryLike(value);
  if (directEntry) {
    return [directEntry];
  }

  const collected: LeaferGraphWidgetEntry[] = [];
  const record = value as Record<string, unknown>;

  if (Array.isArray(record.widgets)) {
    for (const item of record.widgets) {
      collected.push(...collectWidgetEntriesRecursive(item, seen, depth + 1));
    }
  }

  for (const candidateKey of [
    "entry",
    "widget",
    "widgetEntry",
    "definition",
    "meta"
  ] as const) {
    const candidate = record[candidateKey];
    if (!candidate || candidate === value) {
      continue;
    }
    collected.push(...collectWidgetEntriesRecursive(candidate, seen, depth + 1));
  }

  if (isPlainObject(value)) {
    for (const candidate of Object.values(record)) {
      if (!candidate || candidate === value) {
        continue;
      }
      collected.push(...collectWidgetEntriesRecursive(candidate, seen, depth + 1));
    }
  }

  return collected;
}

function getRuntimeDependencyRegistry(): Record<
  string,
  RuntimeBridgeModuleDependencyNamespace
> {
  const globalObject = globalThis as typeof globalThis & {
    [GLOBAL_DEPENDENCY_KEY]?: Record<string, RuntimeBridgeModuleDependencyNamespace>;
  };
  const currentRegistry = globalObject[GLOBAL_DEPENDENCY_KEY];
  if (currentRegistry) {
    return currentRegistry;
  }

  const nextRegistry: Record<string, RuntimeBridgeModuleDependencyNamespace> = {};
  globalObject[GLOBAL_DEPENDENCY_KEY] = nextRegistry;
  return nextRegistry;
}

function isValidJavaScriptIdentifier(value: string): boolean {
  return /^[$A-Z_a-z][$\w]*$/u.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  const globalBuffer = (globalThis as typeof globalThis & {
    Buffer?: {
      from(input: Uint8Array): { toString(encoding: "base64"): string };
    };
  }).Buffer;

  if (globalBuffer) {
    return globalBuffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  if (typeof btoa !== "function") {
    throw new Error("当前环境缺少 base64 编码能力。");
  }

  return btoa(binary);
}

function collectUniqueTypes(types: readonly string[]): string[] {
  return [...new Set(types.filter((type) => typeof type === "string" && type.trim()))];
}

function dedupeNodeDefinitionsByType(
  definitions: readonly NodeDefinition[]
): NodeDefinition[] {
  const deduped = new Map<string, NodeDefinition>();

  for (const definition of definitions) {
    if (!definition?.type || deduped.has(definition.type)) {
      continue;
    }
    deduped.set(definition.type, definition);
  }

  return [...deduped.values()];
}

function dedupeWidgetEntriesByType(
  entries: readonly LeaferGraphWidgetEntry[]
): LeaferGraphWidgetEntry[] {
  const deduped = new Map<string, LeaferGraphWidgetEntry>();

  for (const entry of entries) {
    if (!entry?.type || deduped.has(entry.type)) {
      continue;
    }
    deduped.set(entry.type, entry);
  }

  return [...deduped.values()];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
