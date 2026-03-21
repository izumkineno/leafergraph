import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";
import { existsSync, readFileSync, readdirSync, statSync, watch } from "node:fs";
import { fileURLToPath } from "node:url";

import type {
  AdapterBinding,
  CapabilityProfile,
  GraphDocument,
  GraphLink,
  GraphLinkEndpoint,
  NodeSerializeResult,
  NodeSlotSpec
} from "@leafergraph/node";
import type {
  AuthorityCreateLinkInput,
  AuthorityCreateNodeInput,
  AuthorityGraphExecutionEventType,
  AuthorityGraphExecutionState,
  AuthorityGraphOperation,
  AuthorityNodeExecutionEvent,
  AuthorityNodeExecutionState,
  AuthorityNodeStateChangeReason,
  AuthorityOperationResult,
  AuthorityRuntimeControlRequest,
  AuthorityRuntimeControlResult,
  AuthorityFrontendBundlePackage,
  AuthorityFrontendBundleSource,
  AuthorityFrontendBundlesSyncEvent,
  AuthorityRuntimeFeedbackEvent,
  AuthorityUpdateDocumentInput
} from "./protocol.js";

export interface CreateNodeAuthorityRuntimeOptions {
  initialDocument?: GraphDocument;
  authorityName?: string;
  packageDir?: string;
  logger?: Pick<Console, "info" | "warn" | "error">;
}

interface AuthorityNodePackageManifestFrontendBundle {
  bundleId: string;
  slot: "demo" | "node" | "widget";
  fileName: string;
  entry: string;
  enabled?: boolean;
  requires?: string[];
  sha256?: string;
}

interface AuthorityNodePackageManifest {
  packageId: string;
  version: string;
  frontendBundles: AuthorityNodePackageManifestFrontendBundle[];
  backend: {
    node?: {
      entry: string;
      exportName?: string;
    };
  };
  nodeTypes?: string[];
}

export type AuthorityNodeExecutor = (
  node: NodeSerializeResult,
  context: AuthorityExecutionMutationContext
) => AuthorityExecutionMutationResult;

interface LoadedAuthorityNodePackage {
  packageId: string;
  version: string;
  executorsByNodeType: Record<string, AuthorityNodeExecutor>;
  frontendPackage: AuthorityFrontendBundlePackage;
}

export interface NodeAuthorityRuntime {
  getDocument(): GraphDocument;
  submitOperation(operation: AuthorityGraphOperation): AuthorityOperationResult;
  controlRuntime(
    request: AuthorityRuntimeControlRequest
  ): AuthorityRuntimeControlResult;
  replaceDocument(document: GraphDocument): GraphDocument;
  subscribeDocument(listener: (document: GraphDocument) => void): () => void;
  subscribe(listener: (event: AuthorityRuntimeFeedbackEvent) => void): () => void;
  getFrontendBundlesSnapshot(): AuthorityFrontendBundlesSyncEvent;
  subscribeFrontendBundles(
    listener: (event: AuthorityFrontendBundlesSyncEvent) => void
  ): () => void;
  registerPackageExecutors(
    packageId: string,
    executorsByNodeType: Record<string, AuthorityNodeExecutor>
  ): void;
  unregisterPackageExecutors(packageId: string): void;
}

interface AuthorityGraphPlayRun {
  runId: string;
  source: "graph-play" | "graph-step";
  startedAt: number;
  queue: string[];
  stepCount: number;
  timer: ReturnType<typeof setTimeout> | null;
}

interface AuthorityGraphStepTask {
  nodeId: string;
  depth: number;
  trigger: "direct" | "propagated";
  inputValues: unknown[];
}

interface AuthorityGraphStepRun {
  runId: string;
  startedAt: number;
  rootNodeId: string;
  queue: AuthorityGraphStepTask[];
  visitedNodeIds: Set<string>;
  sequence: number;
  stepCount: number;
}

interface ExecuteNodeChainOptions {
  rootNodeId: string;
  source: "node-play" | "graph-play" | "graph-step";
  runId?: string;
  startedAt: number;
  timerRuntime?: AuthorityTimerRuntimeContext;
}

interface AuthorityTimerRuntimeContext {
  registerTimer?: (input: {
    nodeId: string;
    source: "graph-play" | "graph-step";
    runId: string;
    startedAt: number;
    intervalMs: number;
    immediate: boolean;
  }) => void;
  timerTickNodeId?: string;
}

interface AuthorityExecutionMutationContext {
  authorityName: string;
  rootNodeId: string;
  source: "node-play" | "graph-play" | "graph-step";
  runId?: string;
  startedAt: number;
  sequence: number;
  inputValues: readonly unknown[];
  timerRuntime?: AuthorityTimerRuntimeContext;
}

interface AuthorityExecutionMutationResult {
  documentChanged: boolean;
  timerActivated?: boolean;
  outputPayloads: Array<{
    slot: number;
    payload: unknown;
  }>;
}

interface AuthorityActiveGraphTimer {
  timerKey: string;
  runId: string;
  nodeId: string;
  source: "graph-play" | "graph-step";
  startedAt: number;
  intervalMs: number;
  handle: ReturnType<typeof setTimeout>;
}

let graphRunSeed = 1;

const SYSTEM_ON_PLAY_NODE_TYPE = "system/on-play";
const SYSTEM_TIMER_DEFAULT_INTERVAL_MS = 1000;
const DEFAULT_PACKAGE_SCAN_INTERVAL_MS = 1200;
const NODE_EXECUTOR_FACTORY_EXPORT_NAME = "createExecutors";
const runtimeDir = dirname(fileURLToPath(import.meta.url));
const nodeModuleRequire = createRequire(import.meta.url);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function resolveTimerIntervalMs(value: unknown): number {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    return SYSTEM_TIMER_DEFAULT_INTERVAL_MS;
  }

  return Math.max(1, Math.floor(nextValue));
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function resolveNodeBackendTemplateDirectory(runtimeDirectory: string): string {
  const candidates = [
    runtimeDirectory,
    resolve(runtimeDirectory, ".."),
    resolve(runtimeDirectory, "../.."),
    resolve(runtimeDirectory, "../../..")
  ];

  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, "package.json"))) {
      return candidate;
    }
  }

  return resolve(runtimeDirectory, "../..");
}

export function resolveDefaultNodeBackendPackageDir(
  runtimeDirectory = runtimeDir
): string {
  return resolve(
    resolveNodeBackendTemplateDirectory(runtimeDirectory),
    "../timer-node-package-template/packages"
  );
}

function resolveNodeBackendPackageDir(
  inputDir: string | undefined
): string {
  const envDir = process.env.LEAFERGRAPH_NODE_BACKEND_PACKAGE_DIR?.trim();
  const selected =
    inputDir?.trim() || envDir || resolveDefaultNodeBackendPackageDir();

  return isAbsolute(selected) ? selected : resolve(process.cwd(), selected);
}

function resolveNonEmptyText(value: unknown, fieldName: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new Error(`节点包 manifest 缺少 ${fieldName}`);
  }

  return text;
}

function resolveManifestFilePath(
  packageDirectory: string
): string {
  return resolve(packageDirectory, "package.manifest.json");
}

function parseNodePackageManifest(
  manifestText: string
): AuthorityNodePackageManifest {
  const value = JSON.parse(manifestText) as unknown;
  if (typeof value !== "object" || value === null) {
    throw new Error("节点包 manifest 不是对象");
  }

  const record = value as Record<string, unknown>;
  const packageId = resolveNonEmptyText(record.packageId, "packageId");
  const version = resolveNonEmptyText(record.version, "version");
  const frontendBundles = Array.isArray(record.frontendBundles)
    ? record.frontendBundles
    : [];
  const backend =
    typeof record.backend === "object" && record.backend !== null
      ? (record.backend as AuthorityNodePackageManifest["backend"])
      : {};
  const nodeTypes = Array.isArray(record.nodeTypes)
    ? record.nodeTypes
        .map((item) => resolveNonEmptyText(item, "nodeTypes[]"))
        .filter((item, index, items) => items.indexOf(item) === index)
    : [];

  return {
    packageId,
    version,
    frontendBundles: frontendBundles as AuthorityNodePackageManifestFrontendBundle[],
    backend,
    nodeTypes
  };
}

function resolvePackageFrontendBundles(input: {
  packageDirectory: string;
  packageId: string;
  version: string;
  manifestBundles: AuthorityNodePackageManifestFrontendBundle[];
}): AuthorityFrontendBundleSource[] {
  const bundles: AuthorityFrontendBundleSource[] = [];

  for (const manifestBundle of input.manifestBundles) {
    const bundleId = resolveNonEmptyText(manifestBundle.bundleId, "frontendBundles[].bundleId");
    const slot = resolveNonEmptyText(
      manifestBundle.slot,
      "frontendBundles[].slot"
    ) as AuthorityFrontendBundleSource["slot"];
    if (slot !== "demo" && slot !== "node" && slot !== "widget") {
      throw new Error(
        `节点包 ${input.packageId} 的 bundle ${bundleId} 使用了非法 slot: ${slot}`
      );
    }

    const entry = resolveNonEmptyText(manifestBundle.entry, "frontendBundles[].entry");
    const filePath = resolve(input.packageDirectory, entry);
    if (!existsSync(filePath)) {
      throw new Error(`节点包 ${input.packageId} 缺少前端 bundle 文件：${entry}`);
    }

    const sourceCode = readFileSync(filePath, "utf8");
    const hash = createHash("sha256").update(sourceCode).digest("hex");
    const expectedHash =
      typeof manifestBundle.sha256 === "string"
        ? manifestBundle.sha256.trim().toLowerCase()
        : "";
    if (expectedHash && expectedHash !== hash) {
      throw new Error(
        `节点包 ${input.packageId} 的前端 bundle 校验失败：${entry}`
      );
    }

    bundles.push({
      bundleId,
      slot,
      fileName:
        (typeof manifestBundle.fileName === "string" &&
        manifestBundle.fileName.trim().length > 0
          ? manifestBundle.fileName.trim()
          : entry.split(/[\\/]/u).at(-1)) ?? `${slot}.bundle.js`,
      sourceCode,
      enabled: manifestBundle.enabled !== false,
      requires:
        Array.isArray(manifestBundle.requires) &&
        manifestBundle.requires.length > 0
          ? manifestBundle.requires.map((item) =>
              resolveNonEmptyText(item, "frontendBundles[].requires[]")
            )
          : undefined,
      sha256: hash
    });
  }

  return bundles;
}

function loadNodeExecutorsFromPackage(input: {
  packageDirectory: string;
  packageId: string;
  manifest: AuthorityNodePackageManifest;
}): Record<string, AuthorityNodeExecutor> {
  const backendNode = input.manifest.backend.node;
  if (!backendNode) {
    return {};
  }

  const entry = resolveNonEmptyText(backendNode.entry, "backend.node.entry");
  const exportName =
    typeof backendNode.exportName === "string" && backendNode.exportName.trim().length > 0
      ? backendNode.exportName.trim()
      : NODE_EXECUTOR_FACTORY_EXPORT_NAME;
  const entryPath = resolve(input.packageDirectory, entry);
  if (!existsSync(entryPath)) {
    throw new Error(`节点包 ${input.packageId} 缺少后端执行器文件：${entry}`);
  }

  const resolvedPath = nodeModuleRequire.resolve(entryPath);
  delete nodeModuleRequire.cache[resolvedPath];
  const moduleValue = nodeModuleRequire(resolvedPath) as Record<string, unknown>;
  const factory = moduleValue[exportName];

  if (typeof factory !== "function") {
    throw new Error(
      `节点包 ${input.packageId} 的后端执行器导出 ${exportName} 不存在`
    );
  }

  const executors = (factory as () => Record<string, AuthorityNodeExecutor>)();
  if (!executors || typeof executors !== "object") {
    throw new Error(`节点包 ${input.packageId} 的后端执行器导出无效`);
  }

  return executors;
}

function loadNodePackageFromDirectory(
  packageDirectory: string
): LoadedAuthorityNodePackage {
  const manifestFilePath = resolveManifestFilePath(packageDirectory);
  const manifest = parseNodePackageManifest(readFileSync(manifestFilePath, "utf8"));
  const executorsByNodeType = loadNodeExecutorsFromPackage({
    packageDirectory,
    packageId: manifest.packageId,
    manifest
  });
  const frontendBundles = resolvePackageFrontendBundles({
    packageDirectory,
    packageId: manifest.packageId,
    version: manifest.version,
    manifestBundles: manifest.frontendBundles
  });

  return {
    packageId: manifest.packageId,
    version: manifest.version,
    executorsByNodeType,
    frontendPackage: {
      packageId: manifest.packageId,
      version: manifest.version,
      nodeTypes:
        manifest.nodeTypes?.length
          ? [...manifest.nodeTypes]
          : Object.keys(executorsByNodeType),
      bundles: frontendBundles
    }
  };
}

function createDefaultAuthorityDocument(): GraphDocument {
  return {
    documentId: "node-authority-doc",
    revision: "1",
    appKind: "node-backend-demo",
    nodes: [
      {
        id: "node-1",
        type: "demo.pending",
        title: "Node 1",
        layout: { x: 0, y: 0, width: 240, height: 140 },
        flags: {},
        properties: {},
        propertySpecs: [],
        inputs: [],
        outputs: [{ name: "Output", type: "event" }],
        widgets: [],
        data: {}
      },
      {
        id: "node-2",
        type: "demo.pending",
        title: "Node 2",
        layout: { x: 320, y: 0, width: 240, height: 140 },
        flags: {},
        properties: {},
        propertySpecs: [],
        inputs: [{ name: "Input", type: "event" }],
        outputs: [],
        widgets: [],
        data: {}
      }
    ],
    links: [
      {
        id: "link-1",
        source: { nodeId: "node-1", slot: 0 },
        target: { nodeId: "node-2", slot: 0 }
      }
    ],
    meta: {}
  };
}

function nextRevision(revision: GraphDocument["revision"]): GraphDocument["revision"] {
  if (typeof revision === "number") {
    return revision + 1;
  }

  const numericRevision = Number(revision);
  if (Number.isFinite(numericRevision)) {
    return String(numericRevision + 1);
  }

  return `${revision}#1`;
}

function toNodeSlotSpecs(
  slots?: AuthorityCreateNodeInput["inputs"]
): NodeSlotSpec[] | undefined {
  if (!slots) {
    return undefined;
  }

  return slots.map((slot) => (typeof slot === "string" ? { name: slot } : clone(slot)));
}

function createNodeFromInput(
  input: AuthorityCreateNodeInput,
  nextNodeId: () => string
): NodeSerializeResult {
  return {
    id: input.id ?? nextNodeId(),
    type: input.type,
    title: input.title ?? input.type,
    layout: {
      x: input.x,
      y: input.y,
      width: input.width ?? 240,
      height: input.height ?? 140
    },
    flags: clone(input.flags ?? {}),
    properties: clone(input.properties ?? {}),
    propertySpecs: clone(input.propertySpecs ?? []),
    inputs: toNodeSlotSpecs(input.inputs) ?? [],
    outputs: toNodeSlotSpecs(input.outputs) ?? [],
    widgets: clone(input.widgets ?? []),
    data: clone(input.data ?? {})
  };
}

function createLinkFromInput(
  input: AuthorityCreateLinkInput,
  nextLinkId: () => string
): GraphLink {
  return {
    id: input.id ?? nextLinkId(),
    source: clone(input.source),
    target: clone(input.target),
    label: input.label,
    data: input.data ? clone(input.data) : undefined
  };
}

function normalizeLinkEndpoint(endpoint: GraphLinkEndpoint): GraphLinkEndpoint {
  return {
    nodeId: endpoint.nodeId,
    slot: endpoint.slot ?? 0
  };
}

function cloneOptionalRecord(
  value: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  return value ? clone(value) : undefined;
}

function cloneOptionalCapabilityProfile(
  value: CapabilityProfile | null | undefined
): CapabilityProfile | undefined {
  return value === null || value === undefined ? undefined : clone(value);
}

function cloneOptionalAdapterBinding(
  value: AdapterBinding | null | undefined
): AdapterBinding | undefined {
  return value === null || value === undefined ? undefined : clone(value);
}

function patchDocumentRoot(
  document: GraphDocument,
  input: AuthorityUpdateDocumentInput
): GraphDocument {
  return {
    ...document,
    appKind: input.appKind ?? document.appKind,
    meta:
      input.meta !== undefined ? clone(input.meta) : cloneOptionalRecord(document.meta),
    capabilityProfile:
      input.capabilityProfile !== undefined
        ? cloneOptionalCapabilityProfile(input.capabilityProfile)
        : cloneOptionalCapabilityProfile(document.capabilityProfile),
    adapterBinding:
      input.adapterBinding !== undefined
        ? cloneOptionalAdapterBinding(input.adapterBinding)
        : cloneOptionalAdapterBinding(document.adapterBinding)
  };
}

function createIdleGraphExecutionState(): AuthorityGraphExecutionState {
  return { status: "idle", queueSize: 0, stepCount: 0 };
}

function cloneGraphExecutionState(
  state: AuthorityGraphExecutionState
): AuthorityGraphExecutionState {
  return { ...state };
}

function ensureNodeProperties(
  node: NodeSerializeResult
): Record<string, unknown> {
  node.properties ??= {};
  return node.properties;
}

function createAuthorityExecutionContextPayload(
  context: AuthorityExecutionMutationContext
): AuthorityNodeExecutionEvent["executionContext"] {
  return {
    source: context.source,
    runId: context.runId,
    entryNodeId: context.rootNodeId,
    stepIndex: context.sequence,
    startedAt: context.startedAt,
    payload: {
      authority: context.authorityName
    }
  };
}

function resolveFirstDefinedInputValue(
  inputValues: readonly unknown[]
): unknown {
  for (const value of inputValues) {
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function formatAuthorityRuntimeValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : "EMPTY";
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (value === undefined) {
    return "EMPTY";
  }

  if (value === null) {
    return "NULL";
  }

  return "OBJECT";
}

function resolveNodeTitleBase(
  title: string | undefined,
  fallback: string
): string {
  const safeTitle = typeof title === "string" ? title.trim() : "";
  if (!safeTitle) {
    return fallback;
  }

  return safeTitle.replace(/\s+(?:#?\d+|EMPTY|NULL|TRUE|FALSE|OBJECT)$/u, "");
}

function applyAuthorityExecutionMutation(
  node: NodeSerializeResult,
  context: AuthorityExecutionMutationContext,
  executorsByNodeType: ReadonlyMap<string, AuthorityNodeExecutor>
): AuthorityExecutionMutationResult {
  if (node.type === SYSTEM_ON_PLAY_NODE_TYPE) {
    return {
      documentChanged: false,
      outputPayloads: [
        {
          slot: 0,
          payload: createAuthorityExecutionContextPayload(context)
        }
      ]
    };
  }

  const executor = executorsByNodeType.get(node.type);
  if (executor) {
    return executor(node, context);
  }

  const inputValue = resolveFirstDefinedInputValue(context.inputValues);
  if ((node.outputs?.length ?? 0) <= 0) {
    return {
      documentChanged: false,
      outputPayloads: []
    };
  }

  return {
    documentChanged: false,
    outputPayloads: [
      {
        slot: 0,
        payload:
          inputValue === undefined
            ? createAuthorityExecutionContextPayload(context)
            : clone(inputValue)
      }
    ]
  };
}

function createGraphRunId(source: "graph-play" | "graph-step"): string {
  const runId = `graph:${source}:${Date.now()}:${graphRunSeed}`;
  graphRunSeed += 1;
  return runId;
}

function resolveValidatedLinkEndpoint(
  document: GraphDocument,
  endpoint: GraphLinkEndpoint,
  label: "source" | "target"
): { accepted: boolean; endpoint?: GraphLinkEndpoint; reason?: string } {
  const nodeId = endpoint.nodeId?.trim();
  if (!nodeId) {
    return { accepted: false, reason: `${label} 节点不能为空` };
  }

  const slot = endpoint.slot ?? 0;
  if (!Number.isInteger(slot) || slot < 0) {
    return { accepted: false, reason: `${label} slot 必须是非负整数` };
  }

  const node = document.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return { accepted: false, reason: `${label} 节点不存在` };
  }

  const slots = (label === "source" ? node.outputs : node.inputs) ?? [];
  if (!slots[slot]) {
    return { accepted: false, reason: `${label} 端点不存在` };
  }

  return { accepted: true, endpoint: { nodeId, slot } };
}

export function createNodeAuthorityRuntime(
  options: CreateNodeAuthorityRuntimeOptions = {}
): NodeAuthorityRuntime {
  const authorityName = options.authorityName ?? "node-authority";
  const documentListeners = new Set<(document: GraphDocument) => void>();
  const runtimeFeedbackListeners = new Set<
    (event: AuthorityRuntimeFeedbackEvent) => void
  >();
  const nodeExecutionStateMap = new Map<string, AuthorityNodeExecutionState>();
  let generatedNodeSequence = 0;
  let generatedLinkSequence = 0;
  let currentDocument = clone(options.initialDocument ?? createDefaultAuthorityDocument());
  let graphExecutionState = createIdleGraphExecutionState();
  let activeGraphPlayRun: AuthorityGraphPlayRun | null = null;
  let activeGraphStepRun: AuthorityGraphStepRun | null = null;
  const activeGraphTimersByKey = new Map<string, AuthorityActiveGraphTimer>();
  let timerActivatedInCurrentGraphStepTick = false;
  let stepCursor = 0;
  const logger = options.logger ?? console;
  const packageDirectory = resolveNodeBackendPackageDir(options.packageDir);
  const packageExecutorsById = new Map<
    string,
    Record<string, AuthorityNodeExecutor>
  >();
  const frontendPackagesById = new Map<string, AuthorityFrontendBundlePackage>();
  const mergedExecutorsByNodeType = new Map<string, AuthorityNodeExecutor>();
  const frontendBundleListeners = new Set<
    (event: AuthorityFrontendBundlesSyncEvent) => void
  >();
  let packageWatchDisposer: (() => void) | null = null;
  let packageReloadTimer: ReturnType<typeof setTimeout> | null = null;

  const emitRuntimeFeedback = (event: AuthorityRuntimeFeedbackEvent): void => {
    const snapshot = clone(event);
    for (const listener of runtimeFeedbackListeners) {
      listener(snapshot);
    }
  };

  const emitFrontendBundlesSync = (event: AuthorityFrontendBundlesSyncEvent): void => {
    const snapshot = clone(event);
    for (const listener of frontendBundleListeners) {
      listener(snapshot);
    }
  };

  const rebuildMergedExecutors = (): void => {
    mergedExecutorsByNodeType.clear();
    for (const executorsByNodeType of packageExecutorsById.values()) {
      for (const [nodeType, executor] of Object.entries(executorsByNodeType)) {
        mergedExecutorsByNodeType.set(nodeType, executor);
      }
    }
  };

  const getFrontendBundlesSnapshot = (): AuthorityFrontendBundlesSyncEvent => ({
    type: "frontendBundles.sync",
    mode: "full",
    packages: Array.from(frontendPackagesById.values()).map((entry) => clone(entry)),
    emittedAt: Date.now()
  });

  const registerPackageExecutors = (
    packageId: string,
    executorsByNodeType: Record<string, AuthorityNodeExecutor>
  ): void => {
    packageExecutorsById.set(packageId, executorsByNodeType);
    rebuildMergedExecutors();
  };

  const unregisterPackageExecutors = (packageId: string): void => {
    packageExecutorsById.delete(packageId);
    rebuildMergedExecutors();
  };

  const emitDocument = (): void => {
    const snapshot = clone(currentDocument);
    for (const listener of documentListeners) {
      listener(snapshot);
    }
  };

  const hasNodeId = (nodeId: string): boolean =>
    currentDocument.nodes.some((node) => node.id === nodeId);
  const hasLinkId = (linkId: string): boolean =>
    currentDocument.links.some((link) => link.id === linkId);

  const resolveGeneratedNodeId = (): string => {
    do {
      generatedNodeSequence += 1;
    } while (hasNodeId(`${authorityName}-node-${generatedNodeSequence}`));

    return `${authorityName}-node-${generatedNodeSequence}`;
  };

  const resolveGeneratedLinkId = (): string => {
    do {
      generatedLinkSequence += 1;
    } while (hasLinkId(`${authorityName}-link-${generatedLinkSequence}`));

    return `${authorityName}-link-${generatedLinkSequence}`;
  };

  const getNode = (nodeId: string) =>
    currentDocument.nodes.find((node) => node.id === nodeId) ?? null;
  const getLink = (linkId: string) =>
    currentDocument.links.find((link) => link.id === linkId) ?? null;

  const createCurrentSnapshotResult = (
    overrides: Partial<AuthorityOperationResult>
  ): AuthorityOperationResult => ({
    accepted: true,
    changed: false,
    revision: currentDocument.revision,
    document: clone(currentDocument),
    ...overrides
  });

  const commitDocument = (nextDocument: GraphDocument): void => {
    currentDocument = nextDocument;
    emitDocument();
  };

  const createGraphTimerKey = (runId: string, nodeId: string): string =>
    `${runId}::${nodeId}`;

  const hasActiveGraphTimersForRun = (runId: string): boolean => {
    for (const timer of activeGraphTimersByKey.values()) {
      if (timer.runId === runId) {
        return true;
      }
    }

    return false;
  };

  const stopGraphTimerByKey = (timerKey: string): void => {
    const timer = activeGraphTimersByKey.get(timerKey);
    if (!timer) {
      return;
    }

    clearTimeout(timer.handle);
    activeGraphTimersByKey.delete(timerKey);
  };

  const stopGraphTimersForRun = (runId: string): void => {
    for (const [timerKey, timer] of activeGraphTimersByKey.entries()) {
      if (timer.runId !== runId) {
        continue;
      }

      clearTimeout(timer.handle);
      activeGraphTimersByKey.delete(timerKey);
    }
  };

  const stopAllGraphTimersWithoutEvent = (): void => {
    for (const timer of activeGraphTimersByKey.values()) {
      clearTimeout(timer.handle);
    }
    activeGraphTimersByKey.clear();
  };

  const stopActiveGraphPlayWithoutEvent = (): void => {
    if (!activeGraphPlayRun) {
      return;
    }

    stopGraphTimersForRun(activeGraphPlayRun.runId);
    if (activeGraphPlayRun.timer !== null) {
      clearTimeout(activeGraphPlayRun.timer);
    }
    activeGraphPlayRun = null;
  };

  const stopActiveGraphStepWithoutEvent = (): void => {
    if (activeGraphStepRun) {
      stopGraphTimersForRun(activeGraphStepRun.runId);
    }
    activeGraphStepRun = null;
  };

  const resetDocumentCaches = (): void => {
    generatedNodeSequence = 0;
    generatedLinkSequence = 0;
    stopAllGraphTimersWithoutEvent();
    stopActiveGraphPlayWithoutEvent();
    stopActiveGraphStepWithoutEvent();
    nodeExecutionStateMap.clear();
    graphExecutionState = createIdleGraphExecutionState();
    stepCursor = 0;
  };

  const stopActiveRunsForPackageReload = (): void => {
    if (activeGraphPlayRun) {
      finalizeGraphPlayRun(activeGraphPlayRun, "stopped");
      return;
    }

    if (activeGraphStepRun) {
      finalizeGraphStepRun(activeGraphStepRun, "stopped");
    }
  };

  const applyLoadedPackages = (
    loadedPackages: LoadedAuthorityNodePackage[]
  ): void => {
    const previousPackageIds = new Set(frontendPackagesById.keys());
    const nextPackageIds = new Set<string>();
    const upsertPackages: AuthorityFrontendBundlePackage[] = [];
    const removedPackageIds: string[] = [];

    stopActiveRunsForPackageReload();

    for (const loadedPackage of loadedPackages) {
      nextPackageIds.add(loadedPackage.packageId);
      registerPackageExecutors(
        loadedPackage.packageId,
        loadedPackage.executorsByNodeType
      );
      frontendPackagesById.set(loadedPackage.packageId, loadedPackage.frontendPackage);
      upsertPackages.push(clone(loadedPackage.frontendPackage));
      previousPackageIds.delete(loadedPackage.packageId);
    }

    for (const removedPackageId of previousPackageIds) {
      unregisterPackageExecutors(removedPackageId);
      frontendPackagesById.delete(removedPackageId);
      removedPackageIds.push(removedPackageId);
    }

    if (upsertPackages.length > 0) {
      emitFrontendBundlesSync({
        type: "frontendBundles.sync",
        mode: "upsert",
        packages: upsertPackages,
        emittedAt: Date.now()
      });
    }

    if (removedPackageIds.length > 0) {
      emitFrontendBundlesSync({
        type: "frontendBundles.sync",
        mode: "remove",
        removedPackageIds,
        emittedAt: Date.now()
      });
    }

    if (upsertPackages.length === 0 && removedPackageIds.length === 0) {
      emitFrontendBundlesSync(getFrontendBundlesSnapshot());
    }
  };

  const reloadPackagesFromDirectory = (): void => {
    if (!existsSync(packageDirectory)) {
      if (frontendPackagesById.size > 0 || packageExecutorsById.size > 0) {
        applyLoadedPackages([]);
      }
      logger.warn(
        "[node-backend-template]",
        `节点包目录不存在，跳过加载：${packageDirectory}`
      );
      return;
    }

    const directoryEntries = readdirSync(packageDirectory, {
      withFileTypes: true
    });
    const existingPackagesById = new Map<string, LoadedAuthorityNodePackage>();

    for (const [packageId, frontendPackage] of frontendPackagesById.entries()) {
      existingPackagesById.set(packageId, {
        packageId,
        version: frontendPackage.version,
        frontendPackage: clone(frontendPackage),
        executorsByNodeType: {
          ...(packageExecutorsById.get(packageId) ?? {})
        }
      });
    }
    const loadedPackagesById = new Map<string, LoadedAuthorityNodePackage>();

    for (const entry of directoryEntries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const candidateDirectory = resolve(packageDirectory, entry.name);
      const manifestFilePath = resolveManifestFilePath(candidateDirectory);
      if (!existsSync(manifestFilePath)) {
        continue;
      }

      let parsedManifestPackageId: string | null = null;
      try {
        const manifest = parseNodePackageManifest(
          readFileSync(manifestFilePath, "utf8")
        );
        parsedManifestPackageId = manifest.packageId;
      } catch {
        // ignore manifest parse failure here; loadNodePackageFromDirectory will report.
      }

      try {
        const loadedPackage = loadNodePackageFromDirectory(candidateDirectory);
        loadedPackagesById.set(loadedPackage.packageId, loadedPackage);
      } catch (error) {
        logger.error(
          "[node-backend-template]",
          `节点包加载失败（${candidateDirectory}）：${toErrorMessage(error)}`
        );

        if (
          parsedManifestPackageId &&
          existingPackagesById.has(parsedManifestPackageId)
        ) {
          loadedPackagesById.set(
            parsedManifestPackageId,
            existingPackagesById.get(parsedManifestPackageId)!
          );
          logger.warn(
            "[node-backend-template]",
            `节点包 ${parsedManifestPackageId} 保留旧版本，等待下次热更新重试`
          );
        }
      }
    }

    const loadedPackages = Array.from(loadedPackagesById.values()).sort((left, right) =>
      left.packageId.localeCompare(right.packageId)
    );
    applyLoadedPackages(loadedPackages);
  };

  const schedulePackageReload = (): void => {
    if (packageReloadTimer !== null) {
      clearTimeout(packageReloadTimer);
    }

    packageReloadTimer = setTimeout(() => {
      packageReloadTimer = null;
      reloadPackagesFromDirectory();
    }, DEFAULT_PACKAGE_SCAN_INTERVAL_MS);
  };

  const startPackageDirectoryWatcher = (): void => {
    if (packageWatchDisposer) {
      return;
    }

    if (!existsSync(packageDirectory)) {
      return;
    }

    let packageWatcher:
      | ReturnType<typeof watch>
      | null = null;
    try {
      packageWatcher = watch(
        packageDirectory,
        { recursive: true },
        () => {
          schedulePackageReload();
        }
      );
    } catch {
      packageWatcher = watch(
        packageDirectory,
        () => {
          schedulePackageReload();
        }
      );
    }

    packageWatchDisposer = () => {
      packageWatcher?.close();
      packageWatcher = null;
      packageWatchDisposer = null;
    };
  };

  const emitNodeState = (
    nodeId: string,
    reason: AuthorityNodeStateChangeReason,
    exists: boolean
  ): void => {
    emitRuntimeFeedback({
      type: "node.state",
      event: {
        nodeId,
        exists,
        reason,
        timestamp: Date.now()
      }
    });
  };

  const emitLinkPropagation = (
    link: GraphLink,
    chainId: string,
    payload: unknown
  ): void => {
    emitRuntimeFeedback({
      type: "link.propagation",
      event: {
        linkId: link.id,
        chainId,
        sourceNodeId: link.source.nodeId,
        sourceSlot: link.source.slot ?? 0,
        targetNodeId: link.target.nodeId,
        targetSlot: link.target.slot ?? 0,
        payload: payload === undefined ? undefined : clone(payload),
        timestamp: Date.now()
      }
    });
  };

  const emitGraphExecution = (
    type: AuthorityGraphExecutionEventType,
    input: {
      runId?: string;
      source?: "graph-play" | "graph-step";
      nodeId?: string;
      timestamp: number;
    }
  ): void => {
    emitRuntimeFeedback({
      type: "graph.execution",
      event: {
        type,
        state: cloneGraphExecutionState(graphExecutionState),
        runId: input.runId,
        source: input.source,
        nodeId: input.nodeId,
        timestamp: input.timestamp
      }
    });
  };

  const advanceNodeExecutionState = (
    nodeId: string,
    timestamp: number
  ): AuthorityNodeExecutionState => {
    const previousState = nodeExecutionStateMap.get(nodeId) ?? {
      status: "idle",
      runCount: 0
    };
    const nextState: AuthorityNodeExecutionState = {
      status: "success",
      runCount: previousState.runCount + 1,
      lastExecutedAt: timestamp,
      lastSucceededAt: timestamp,
      lastFailedAt: previousState.lastFailedAt,
      lastErrorMessage: previousState.lastErrorMessage
    };
    nodeExecutionStateMap.set(nodeId, nextState);
    return clone(nextState);
  };

  const emitNodeExecution = (
    rootNode: NodeSerializeResult,
    node: NodeSerializeResult,
    input: {
      source: "node-play" | "graph-play" | "graph-step";
      runId?: string;
      chainId: string;
      depth: number;
      sequence: number;
      trigger: "direct" | "propagated";
      startedAt: number;
      timestamp: number;
    }
  ): void => {
    const state = advanceNodeExecutionState(node.id, input.timestamp);
    const event: AuthorityNodeExecutionEvent = {
      chainId: input.chainId,
      rootNodeId: rootNode.id,
      rootNodeType: rootNode.type,
      rootNodeTitle: rootNode.title ?? rootNode.id,
      nodeId: node.id,
      nodeType: node.type,
      nodeTitle: node.title ?? node.id,
      depth: input.depth,
      sequence: input.sequence,
      source: input.source,
      trigger: input.trigger,
      timestamp: input.timestamp,
      executionContext: {
        source: input.source,
        runId: input.runId,
        entryNodeId: rootNode.id,
        stepIndex: input.sequence,
        startedAt: input.startedAt,
        payload: {
          authority: authorityName
        }
      },
      state
    };

    emitRuntimeFeedback({
      type: "node.execution",
      event
    });
    emitNodeState(node.id, "execution", true);
  };

  const updateRunningGraphExecutionState = (
    run: AuthorityGraphPlayRun
  ): void => {
    graphExecutionState = {
      status: "running",
      runId: run.runId,
      queueSize: run.queue.length,
      stepCount: run.stepCount,
      startedAt: run.startedAt,
      stoppedAt: undefined,
      lastSource: run.source
    };
  };

  const registerGraphTimer = (input: {
    nodeId: string;
    source: "graph-play" | "graph-step";
    runId: string;
    startedAt: number;
    intervalMs: number;
    immediate: boolean;
  }): void => {
    const activeRun =
      activeGraphPlayRun?.runId === input.runId
        ? activeGraphPlayRun
        : activeGraphStepRun?.runId === input.runId
          ? {
              runId: activeGraphStepRun.runId,
              source: "graph-step" as const,
              startedAt: activeGraphStepRun.startedAt,
              queue: [],
              stepCount: activeGraphStepRun.stepCount,
              timer: null
            }
          : null;
    if (!activeRun) {
      return;
    }

    const timerKey = createGraphTimerKey(input.runId, input.nodeId);
    stopGraphTimerByKey(timerKey);
    const intervalMs = resolveTimerIntervalMs(input.intervalMs);
    const handle = setTimeout(() => {
      handleActiveGraphTimerTick(timerKey);
    }, intervalMs);

    activeGraphTimersByKey.set(timerKey, {
      timerKey,
      runId: input.runId,
      nodeId: input.nodeId,
      source: input.source,
      startedAt: input.startedAt,
      intervalMs,
      handle
    });
    timerActivatedInCurrentGraphStepTick = true;
  };

  const handleActiveGraphTimerTick = (timerKey: string): void => {
    const timer = activeGraphTimersByKey.get(timerKey);
    if (!timer) {
      return;
    }

    const run = activeGraphPlayRun;
    if (!run || run.runId !== timer.runId || run.source !== timer.source) {
      stopGraphTimerByKey(timer.timerKey);
      return;
    }

    timer.handle = setTimeout(() => {
      handleActiveGraphTimerTick(timer.timerKey);
    }, timer.intervalMs);
    activeGraphTimersByKey.set(timer.timerKey, timer);

    const changed = executeNodeChain({
      rootNodeId: timer.nodeId,
      source: timer.source,
      runId: timer.runId,
      startedAt: timer.startedAt,
      timerRuntime: {
        registerTimer: registerGraphTimer,
        timerTickNodeId: timer.nodeId
      }
    });

    if (!changed) {
      stopGraphTimerByKey(timer.timerKey);
    } else if (activeGraphPlayRun?.runId === timer.runId) {
      activeGraphPlayRun.stepCount += 1;
      updateRunningGraphExecutionState(activeGraphPlayRun);
      emitGraphExecution("advanced", {
        runId: timer.runId,
        source: timer.source,
        nodeId: timer.nodeId,
        timestamp: Date.now()
      });
    }

    if (
      activeGraphPlayRun?.runId === timer.runId &&
      activeGraphPlayRun.queue.length <= 0 &&
      !hasActiveGraphTimersForRun(timer.runId)
    ) {
      finalizeGraphPlayRun(activeGraphPlayRun, "drained");
    }
  };

  const executeNodeChain = (input: ExecuteNodeChainOptions): boolean => {
    const nextDocument = clone(currentDocument);
    const rootNode =
      nextDocument.nodes.find((node) => node.id === input.rootNodeId) ?? null;
    if (!rootNode) {
      return false;
    }

    const chainId = `${authorityName}:${input.source}:${rootNode.id}:${input.startedAt}`;
    const visited = new Set<string>();
    const inputValuesByNodeId = new Map<string, unknown[]>();
    const pendingRuntimeFeedbackEmits: Array<() => void> = [];
    let documentChanged = false;
    let sequence = 0;

    const walk = (
      nodeId: string,
      depth: number,
      trigger: "direct" | "propagated"
    ): void => {
      if (visited.has(nodeId)) {
        return;
      }

      const node = nextDocument.nodes.find((item) => item.id === nodeId) ?? null;
      if (!node) {
        return;
      }

      visited.add(nodeId);
      const currentSequence = sequence;
      sequence += 1;
      const mutationResult = applyAuthorityExecutionMutation(node, {
        authorityName,
        rootNodeId: rootNode.id,
        source: input.source,
        runId: input.runId,
        startedAt: input.startedAt,
        sequence: currentSequence,
        inputValues: inputValuesByNodeId.get(nodeId) ?? [],
        timerRuntime: input.timerRuntime
      }, mergedExecutorsByNodeType);
      documentChanged = documentChanged || mutationResult.documentChanged;
      pendingRuntimeFeedbackEmits.push(() => {
        emitNodeExecution(rootNode, node, {
          source: input.source,
          runId: input.runId,
          chainId,
          depth,
          sequence: currentSequence,
          trigger,
          startedAt: input.startedAt,
          timestamp: Date.now()
        });
      });

      for (const output of mutationResult.outputPayloads) {
        for (const link of nextDocument.links) {
          if (
            link.source.nodeId !== nodeId ||
            (link.source.slot ?? 0) !== output.slot
          ) {
            continue;
          }

          const targetNode =
            nextDocument.nodes.find((item) => item.id === link.target.nodeId) ?? null;
          if (!targetNode) {
            continue;
          }

          const targetInputValues =
            inputValuesByNodeId.get(targetNode.id) ??
            new Array(Math.max(targetNode.inputs?.length ?? 0, 1)).fill(undefined);
          targetInputValues[link.target.slot ?? 0] =
            output.payload === undefined ? undefined : clone(output.payload);
          inputValuesByNodeId.set(targetNode.id, targetInputValues);
          pendingRuntimeFeedbackEmits.push(() => {
            emitLinkPropagation(link, chainId, output.payload);
          });
          walk(targetNode.id, depth + 1, "propagated");
        }
      }
    };

    walk(rootNode.id, 0, "direct");

    if (documentChanged) {
      currentDocument = {
        ...nextDocument,
        revision: nextRevision(currentDocument.revision)
      };
      emitDocument();
    }

    for (const emit of pendingRuntimeFeedbackEmits) {
      emit();
    }
    return true;
  };

  const mergeStepInputValues = (
    currentInputValues: readonly unknown[],
    nextInputValues: readonly unknown[]
  ): unknown[] => {
    const mergedInputValues = new Array(
      Math.max(currentInputValues.length, nextInputValues.length)
    ).fill(undefined);

    for (let index = 0; index < mergedInputValues.length; index += 1) {
      if (index < currentInputValues.length) {
        mergedInputValues[index] = clone(currentInputValues[index]);
      }
      if (index < nextInputValues.length && nextInputValues[index] !== undefined) {
        mergedInputValues[index] = clone(nextInputValues[index]);
      }
    }

    return mergedInputValues;
  };

  const queueGraphStepTaskFront = (
    run: AuthorityGraphStepRun,
    task: AuthorityGraphStepTask
  ): void => {
    if (run.visitedNodeIds.has(task.nodeId)) {
      return;
    }

    const existingTaskIndex = run.queue.findIndex(
      (entry) => entry.nodeId === task.nodeId
    );
    if (existingTaskIndex >= 0) {
      const [existingTask] = run.queue.splice(existingTaskIndex, 1);
      const mergedTask: AuthorityGraphStepTask = {
        ...existingTask,
        depth: Math.min(existingTask.depth, task.depth),
        trigger: existingTask.trigger,
        inputValues: mergeStepInputValues(existingTask.inputValues, task.inputValues)
      };
      run.queue.unshift(mergedTask);
      return;
    }

    run.queue.unshift(task);
  };

  const executeGraphStepRunTick = (
    run: AuthorityGraphStepRun
  ): { changed: boolean; executedNodeId?: string; timerActivated?: boolean } => {
    while (run.queue.length > 0) {
      const task = run.queue.shift();
      if (!task || run.visitedNodeIds.has(task.nodeId)) {
        continue;
      }

      const nextDocument = clone(currentDocument);
      const rootNode =
        nextDocument.nodes.find((node) => node.id === run.rootNodeId) ?? null;
      if (!rootNode) {
        return { changed: false };
      }

      const node = nextDocument.nodes.find((item) => item.id === task.nodeId) ?? null;
      if (!node) {
        continue;
      }

      run.visitedNodeIds.add(task.nodeId);
      const currentSequence = run.sequence;
      run.sequence += 1;
      const chainId = `${authorityName}:graph-step:${run.rootNodeId}:${run.startedAt}`;
      const mutationResult = applyAuthorityExecutionMutation(node, {
        authorityName,
        rootNodeId: run.rootNodeId,
        source: "graph-step",
        runId: run.runId,
        startedAt: run.startedAt,
        sequence: currentSequence,
        inputValues: task.inputValues,
        timerRuntime: {
          registerTimer: registerGraphTimer
        }
      }, mergedExecutorsByNodeType);
      const pendingRuntimeFeedbackEmits: Array<() => void> = [
        () => {
          emitNodeExecution(rootNode, node, {
            source: "graph-step",
            runId: run.runId,
            chainId,
            depth: task.depth,
            sequence: currentSequence,
            trigger: task.trigger,
            startedAt: run.startedAt,
            timestamp: Date.now()
          });
        }
      ];
      const nextTasks: AuthorityGraphStepTask[] = [];

      for (const output of mutationResult.outputPayloads) {
        for (const link of nextDocument.links) {
          if (
            link.source.nodeId !== task.nodeId ||
            (link.source.slot ?? 0) !== output.slot
          ) {
            continue;
          }

          const targetNode =
            nextDocument.nodes.find((item) => item.id === link.target.nodeId) ?? null;
          if (!targetNode || run.visitedNodeIds.has(targetNode.id)) {
            continue;
          }

          const targetInputValues = new Array(
            Math.max(targetNode.inputs?.length ?? 0, 1)
          ).fill(undefined);
          targetInputValues[link.target.slot ?? 0] =
            output.payload === undefined ? undefined : clone(output.payload);
          nextTasks.push({
            nodeId: targetNode.id,
            depth: task.depth + 1,
            trigger: "propagated",
            inputValues: targetInputValues
          });
          pendingRuntimeFeedbackEmits.push(() => {
            emitLinkPropagation(link, chainId, output.payload);
          });
        }
      }

      for (let index = nextTasks.length - 1; index >= 0; index -= 1) {
        queueGraphStepTaskFront(run, nextTasks[index]!);
      }

      if (mutationResult.documentChanged) {
        currentDocument = {
          ...nextDocument,
          revision: nextRevision(currentDocument.revision)
        };
        emitDocument();
      }

      for (const emit of pendingRuntimeFeedbackEmits) {
        emit();
      }

      run.stepCount += 1;
      return {
        changed: true,
        executedNodeId: node.id,
        timerActivated: Boolean(mutationResult.timerActivated)
      };
    }

    return { changed: false };
  };

  const finalizeGraphPlayRun = (
    run: AuthorityGraphPlayRun,
    type: "drained" | "stopped"
  ): void => {
    if (activeGraphPlayRun?.runId !== run.runId) {
      return;
    }

    stopGraphTimersForRun(run.runId);
    if (run.timer !== null) {
      clearTimeout(run.timer);
    }
    activeGraphPlayRun = null;
    const timestamp = Date.now();
    graphExecutionState = {
      status: "idle",
      queueSize: 0,
      stepCount: run.stepCount,
      startedAt: run.startedAt,
      stoppedAt: timestamp,
      lastSource: run.source
    };
    emitGraphExecution(type, {
      runId: run.runId,
      source: run.source,
      timestamp
    });
  };

  const finalizeGraphStepRun = (
    run: AuthorityGraphStepRun,
    type: "drained" | "stopped"
  ): void => {
    if (activeGraphStepRun?.runId !== run.runId) {
      return;
    }

    stopGraphTimersForRun(run.runId);
    activeGraphStepRun = null;
    const timestamp = Date.now();
    graphExecutionState = {
      status: "idle",
      queueSize: 0,
      stepCount: run.stepCount,
      startedAt: run.startedAt,
      stoppedAt: timestamp,
      lastSource: "graph-step"
    };
    emitGraphExecution(type, {
      runId: run.runId,
      source: "graph-step",
      timestamp
    });
  };

  const scheduleNextGraphPlayRunTick = (): void => {
    const run = activeGraphPlayRun;
    if (!run) {
      return;
    }

    run.timer = setTimeout(() => {
      const activeRun = activeGraphPlayRun;
      if (!activeRun || activeRun.runId !== run.runId) {
        return;
      }

      const rootNodeId = activeRun.queue.shift();
      if (!rootNodeId) {
        if (!hasActiveGraphTimersForRun(activeRun.runId)) {
          finalizeGraphPlayRun(activeRun, "drained");
        } else {
          updateRunningGraphExecutionState(activeRun);
        }
        return;
      }

      executeNodeChain({
        rootNodeId,
        source: activeRun.source,
        runId: activeRun.runId,
        startedAt: activeRun.startedAt,
        timerRuntime: {
          registerTimer: registerGraphTimer
        }
      });
      activeRun.stepCount += 1;

      const timestamp = Date.now();
      const hasMore =
        activeRun.queue.length > 0 || hasActiveGraphTimersForRun(activeRun.runId);
      graphExecutionState = {
        status: hasMore ? "running" : "idle",
        runId: hasMore ? activeRun.runId : undefined,
        queueSize: activeRun.queue.length,
        stepCount: activeRun.stepCount,
        startedAt: activeRun.startedAt,
        stoppedAt: hasMore ? undefined : timestamp,
        lastSource: activeRun.source
      };
      emitGraphExecution("advanced", {
        runId: activeRun.runId,
        source: activeRun.source,
        nodeId: rootNodeId,
        timestamp
      });

      if (activeRun.queue.length > 0) {
        scheduleNextGraphPlayRunTick();
        return;
      }

      if (!hasActiveGraphTimersForRun(activeRun.runId)) {
        finalizeGraphPlayRun(activeRun, "drained");
      }
    }, 0);
  };

  const collectGraphEntryNodeIds = (): string[] => {
    return currentDocument.nodes
      .filter(
        (node) =>
          node.type === SYSTEM_ON_PLAY_NODE_TYPE && Boolean(getNode(node.id))
      )
      .map((node) => node.id);
  };

  const createRuntimeControlResult = (
    overrides: Partial<AuthorityRuntimeControlResult>
  ): AuthorityRuntimeControlResult => ({
    accepted: true,
    changed: false,
    state: cloneGraphExecutionState(graphExecutionState),
    ...overrides
  });

  reloadPackagesFromDirectory();
  startPackageDirectoryWatcher();

  return {
    getDocument(): GraphDocument {
      return clone(currentDocument);
    },

    submitOperation(operation: AuthorityGraphOperation): AuthorityOperationResult {
      stopActiveGraphStepWithoutEvent();

      switch (operation.type) {
        case "document.update": {
          const nextDocument = patchDocumentRoot(currentDocument, operation.input);
          if (isDeepStrictEqual(currentDocument, nextDocument)) {
            return createCurrentSnapshotResult({ reason: "文档无变化" });
          }

          commitDocument({
            ...nextDocument,
            revision: nextRevision(currentDocument.revision)
          });
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "node.create": {
          const nextNode = createNodeFromInput(operation.input, resolveGeneratedNodeId);
          const previousNode = getNode(nextNode.id);
          if (previousNode && isDeepStrictEqual(previousNode, nextNode)) {
            return createCurrentSnapshotResult({ reason: "文档无变化" });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            nodes: [...currentDocument.nodes.filter((node) => node.id !== nextNode.id), nextNode]
          });
          emitNodeState(nextNode.id, "created", true);
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "node.update": {
          const node = getNode(operation.nodeId);
          if (!node) {
            return {
              accepted: false,
              changed: false,
              reason: "节点不存在",
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }

          const nextNode: NodeSerializeResult = {
            ...node,
            title: operation.input.title ?? node.title,
            layout: {
              ...node.layout,
              x: operation.input.x ?? node.layout.x,
              y: operation.input.y ?? node.layout.y,
              width: operation.input.width ?? node.layout.width,
              height: operation.input.height ?? node.layout.height
            },
            properties:
              operation.input.properties !== undefined
                ? clone(operation.input.properties)
                : node.properties,
            propertySpecs:
              operation.input.propertySpecs !== undefined
                ? clone(operation.input.propertySpecs)
                : node.propertySpecs,
            inputs:
              operation.input.inputs !== undefined
                ? toNodeSlotSpecs(operation.input.inputs)
                : node.inputs,
            outputs:
              operation.input.outputs !== undefined
                ? toNodeSlotSpecs(operation.input.outputs)
                : node.outputs,
            widgets:
              operation.input.widgets !== undefined
                ? clone(operation.input.widgets)
                : node.widgets,
            data:
              operation.input.data !== undefined ? clone(operation.input.data) : node.data,
            flags:
              operation.input.flags !== undefined
                ? {
                    ...node.flags,
                    ...clone(operation.input.flags)
                  }
                : node.flags
          };
          if (isDeepStrictEqual(node, nextNode)) {
            return createCurrentSnapshotResult({ reason: "文档无变化" });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            nodes: currentDocument.nodes.map((item) =>
              item.id === operation.nodeId ? nextNode : item
            )
          });
          emitNodeState(operation.nodeId, "updated", true);
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "node.move": {
          const node = getNode(operation.nodeId);
          if (!node) {
            return {
              accepted: false,
              changed: false,
              reason: "节点不存在",
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }
          if (node.layout.x === operation.input.x && node.layout.y === operation.input.y) {
            return createCurrentSnapshotResult({ reason: "文档无变化" });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            nodes: currentDocument.nodes.map((item) =>
              item.id === operation.nodeId
                ? {
                    ...item,
                    layout: {
                      ...item.layout,
                      x: operation.input.x,
                      y: operation.input.y
                    }
                  }
                : item
            )
          });
          emitNodeState(operation.nodeId, "moved", true);
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "node.resize": {
          const node = getNode(operation.nodeId);
          if (!node) {
            return {
              accepted: false,
              changed: false,
              reason: "节点不存在",
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }
          if (
            node.layout.width === operation.input.width &&
            node.layout.height === operation.input.height
          ) {
            return createCurrentSnapshotResult({ reason: "文档无变化" });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            nodes: currentDocument.nodes.map((item) =>
              item.id === operation.nodeId
                ? {
                    ...item,
                    layout: {
                      ...item.layout,
                      width: operation.input.width,
                      height: operation.input.height
                    }
                  }
                : item
            )
          });
          emitNodeState(operation.nodeId, "resized", true);
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "node.remove": {
          const node = getNode(operation.nodeId);
          if (!node) {
            return createCurrentSnapshotResult({ reason: "节点不存在" });
          }

          const relatedLinks = currentDocument.links.filter(
            (link) =>
              link.source.nodeId === operation.nodeId ||
              link.target.nodeId === operation.nodeId
          );
          const affectedNodeIds = new Set<string>();
          for (const link of relatedLinks) {
            if (link.source.nodeId !== operation.nodeId) {
              affectedNodeIds.add(link.source.nodeId);
            }
            if (link.target.nodeId !== operation.nodeId) {
              affectedNodeIds.add(link.target.nodeId);
            }
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            nodes: currentDocument.nodes.filter((item) => item.id !== operation.nodeId),
            links: currentDocument.links.filter(
              (link) =>
                link.source.nodeId !== operation.nodeId &&
                link.target.nodeId !== operation.nodeId
            )
          });
          nodeExecutionStateMap.delete(operation.nodeId);
          emitNodeState(operation.nodeId, "removed", false);
          for (const nodeId of affectedNodeIds) {
            if (getNode(nodeId)) {
              emitNodeState(nodeId, "connections", true);
            }
          }
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "link.create": {
          const sourceResolution = resolveValidatedLinkEndpoint(
            currentDocument,
            operation.input.source,
            "source"
          );
          if (!sourceResolution.accepted) {
            return {
              accepted: false,
              changed: false,
              reason: sourceResolution.reason,
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }

          const targetResolution = resolveValidatedLinkEndpoint(
            currentDocument,
            operation.input.target,
            "target"
          );
          if (!targetResolution.accepted) {
            return {
              accepted: false,
              changed: false,
              reason: targetResolution.reason,
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }

          const nextLink = createLinkFromInput(
            {
              ...operation.input,
              source: sourceResolution.endpoint!,
              target: targetResolution.endpoint!
            },
            resolveGeneratedLinkId
          );
          const previousLink = getLink(nextLink.id);
          if (previousLink && isDeepStrictEqual(previousLink, nextLink)) {
            return createCurrentSnapshotResult({ reason: "文档无变化" });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            links: [...currentDocument.links.filter((link) => link.id !== nextLink.id), nextLink]
          });
          emitNodeState(nextLink.source.nodeId, "connections", true);
          emitNodeState(nextLink.target.nodeId, "connections", true);
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "link.remove": {
          const removedLink = getLink(operation.linkId);
          if (!removedLink) {
            return createCurrentSnapshotResult({ reason: "连线不存在" });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            links: currentDocument.links.filter((link) => link.id !== operation.linkId)
          });
          emitNodeState(removedLink.source.nodeId, "connections", true);
          emitNodeState(removedLink.target.nodeId, "connections", true);
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "link.reconnect": {
          const link = getLink(operation.linkId);
          if (!link) {
            return {
              accepted: false,
              changed: false,
              reason: "连线不存在",
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }

          const sourceResolution = operation.input.source
            ? resolveValidatedLinkEndpoint(currentDocument, operation.input.source, "source")
            : { accepted: true as const, endpoint: normalizeLinkEndpoint(link.source) };
          if (!sourceResolution.accepted) {
            return {
              accepted: false,
              changed: false,
              reason: sourceResolution.reason,
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }

          const targetResolution = operation.input.target
            ? resolveValidatedLinkEndpoint(currentDocument, operation.input.target, "target")
            : { accepted: true as const, endpoint: normalizeLinkEndpoint(link.target) };
          if (!targetResolution.accepted) {
            return {
              accepted: false,
              changed: false,
              reason: targetResolution.reason,
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }

          const nextLink: GraphLink = {
            ...link,
            source: sourceResolution.endpoint!,
            target: targetResolution.endpoint!
          };
          if (isDeepStrictEqual(link, nextLink)) {
            return createCurrentSnapshotResult({ reason: "文档无变化" });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            links: currentDocument.links.map((item) =>
              item.id === operation.linkId ? nextLink : item
            )
          });
          const affectedNodeIds = new Set([
            link.source.nodeId,
            link.target.nodeId,
            nextLink.source.nodeId,
            nextLink.target.nodeId
          ]);
          for (const nodeId of affectedNodeIds) {
            if (getNode(nodeId)) {
              emitNodeState(nodeId, "connections", true);
            }
          }
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
      }
    },

    controlRuntime(request: AuthorityRuntimeControlRequest): AuthorityRuntimeControlResult {
      switch (request.type) {
        case "node.play": {
          if (activeGraphPlayRun) {
            return createRuntimeControlResult({
              accepted: false,
              reason: "图级运行中，无法从单节点开始运行"
            });
          }

          stopActiveGraphStepWithoutEvent();
          const changed = executeNodeChain({
            rootNodeId: request.nodeId,
            source: "node-play",
            startedAt: Date.now()
          });
          return createRuntimeControlResult({
            accepted: changed,
            changed,
            reason: changed ? undefined : "节点不存在"
          });
        }
        case "graph.play": {
          if (activeGraphPlayRun) {
            return createRuntimeControlResult({ reason: "图已在运行中" });
          }

          stopActiveGraphStepWithoutEvent();
          const queue = collectGraphEntryNodeIds();
          if (!queue.length) {
            return createRuntimeControlResult({
              reason: "图中没有 On Play 入口节点"
            });
          }

          const startedAt = Date.now();
          const runId = createGraphRunId("graph-play");
          activeGraphPlayRun = {
            runId,
            source: "graph-play",
            startedAt,
            queue,
            stepCount: 0,
            timer: null
          };
          graphExecutionState = {
            status: "running",
            runId,
            queueSize: queue.length,
            stepCount: 0,
            startedAt,
            lastSource: "graph-play"
          };
          stepCursor = 0;
          emitGraphExecution("started", {
            runId,
            source: "graph-play",
            timestamp: startedAt
          });
          scheduleNextGraphPlayRunTick();
          return createRuntimeControlResult({ changed: true });
        }
        case "graph.step": {
          if (activeGraphPlayRun) {
            return createRuntimeControlResult({
              accepted: false,
              reason: "图级运行中，无法单步推进"
            });
          }

          let run = activeGraphStepRun;
          if (!run) {
            const rootNodeIds = collectGraphEntryNodeIds();
            if (!rootNodeIds.length) {
              return createRuntimeControlResult({
                reason: "图中没有 On Play 入口节点"
              });
            }

            if (stepCursor >= rootNodeIds.length) {
              stepCursor = 0;
            }
            const rootNodeId = rootNodeIds[stepCursor];
            stepCursor = (stepCursor + 1) % rootNodeIds.length;
            const startedAt = Date.now();
            const runId = createGraphRunId("graph-step");
            run = {
              runId,
              startedAt,
              rootNodeId,
              queue: [
                {
                  nodeId: rootNodeId,
                  depth: 0,
                  trigger: "direct",
                  inputValues: []
                }
              ],
              visitedNodeIds: new Set<string>(),
              sequence: 0,
              stepCount: 0
            };
            activeGraphStepRun = run;
            graphExecutionState = {
              status: "stepping",
              runId,
              queueSize: 1,
              stepCount: 0,
              startedAt,
              lastSource: "graph-step"
            };
            emitGraphExecution("started", {
              runId,
              source: "graph-step",
              timestamp: startedAt
            });
          }

          timerActivatedInCurrentGraphStepTick = false;
          const executionResult = executeGraphStepRunTick(run);
          const timestamp = Date.now();
          emitGraphExecution("advanced", {
            runId: run.runId,
            source: "graph-step",
            nodeId: executionResult.executedNodeId,
            timestamp
          });

          const promotedToRunning =
            (timerActivatedInCurrentGraphStepTick ||
              Boolean(executionResult.timerActivated)) &&
            hasActiveGraphTimersForRun(run.runId);
          if (promotedToRunning) {
            while (run.queue.length > 0) {
              const continuedResult = executeGraphStepRunTick(run);
              if (!continuedResult.changed) {
                break;
              }

              emitGraphExecution("advanced", {
                runId: run.runId,
                source: "graph-step",
                nodeId: continuedResult.executedNodeId,
                timestamp: Date.now()
              });
            }

            activeGraphStepRun = null;
            activeGraphPlayRun = {
              runId: run.runId,
              source: "graph-step",
              startedAt: run.startedAt,
              queue: [],
              stepCount: run.stepCount,
              timer: null
            };
            updateRunningGraphExecutionState(activeGraphPlayRun);
            return createRuntimeControlResult({
              changed: run.stepCount > 0,
              reason: run.stepCount > 0 ? undefined : "节点不存在"
            });
          }

          const hasMore = run.queue.length > 0;
          graphExecutionState = {
            status: hasMore ? "stepping" : "idle",
            runId: hasMore ? run.runId : undefined,
            queueSize: run.queue.length,
            stepCount: run.stepCount,
            startedAt: run.startedAt,
            stoppedAt: hasMore ? undefined : timestamp,
            lastSource: "graph-step"
          };
          if (!hasMore) {
            finalizeGraphStepRun(run, "drained");
          }
          return createRuntimeControlResult({
            changed: executionResult.changed,
            reason: executionResult.changed ? undefined : "节点不存在"
          });
        }
        case "graph.stop": {
          if (activeGraphPlayRun) {
            finalizeGraphPlayRun(activeGraphPlayRun, "stopped");
            return createRuntimeControlResult({ changed: true });
          }

          if (activeGraphStepRun) {
            finalizeGraphStepRun(activeGraphStepRun, "stopped");
            return createRuntimeControlResult({ changed: true });
          }

          return createRuntimeControlResult({ reason: "当前没有活动中的图运行" });
        }
      }

      return createRuntimeControlResult({
        accepted: false,
        reason: "不支持的 runtime control"
      });
    },

    replaceDocument(document: GraphDocument): GraphDocument {
      currentDocument = clone(document);
      resetDocumentCaches();
      emitDocument();
      return clone(currentDocument);
    },

    subscribeDocument(listener: (document: GraphDocument) => void): () => void {
      documentListeners.add(listener);
      return () => {
        documentListeners.delete(listener);
      };
    },

    subscribe(listener: (event: AuthorityRuntimeFeedbackEvent) => void): () => void {
      runtimeFeedbackListeners.add(listener);
      return () => {
        runtimeFeedbackListeners.delete(listener);
      };
    },

    getFrontendBundlesSnapshot(): AuthorityFrontendBundlesSyncEvent {
      return getFrontendBundlesSnapshot();
    },

    subscribeFrontendBundles(
      listener: (event: AuthorityFrontendBundlesSyncEvent) => void
    ): () => void {
      frontendBundleListeners.add(listener);
      return () => {
        frontendBundleListeners.delete(listener);
      };
    },

    registerPackageExecutors(
      packageId: string,
      executorsByNodeType: Record<string, AuthorityNodeExecutor>
    ): void {
      registerPackageExecutors(packageId, executorsByNodeType);
    },

    unregisterPackageExecutors(packageId: string): void {
      unregisterPackageExecutors(packageId);
    }
  };
}
