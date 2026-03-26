import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  resolveOpenRpcDocumentPath,
  resolveOpenRpcSchemaRoot
} from "./openrpc_paths";

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(TOOL_DIR, "..");
const OPENRPC_PATH = resolveOpenRpcDocumentPath();
const SCHEMA_ROOT = resolveOpenRpcSchemaRoot();
const GENERATED_ROOT = resolve(
  PACKAGE_ROOT,
  "src/session/authority_openrpc/_generated"
);

const ALLOWED_SCHEMA_KEYS = new Set([
  "$id",
  "$ref",
  "$schema",
  "additionalProperties",
  "allOf",
  "anyOf",
  "const",
  "enum",
  "items",
  "maxItems",
  "maxLength",
  "maximum",
  "minItems",
  "minLength",
  "minimum",
  "oneOf",
  "properties",
  "required",
  "type"
]);

const METHOD_TYPE_IMPORTS = [
  ["GraphDocument", "leafergraph"],
  ["GraphDocumentDiff", "leafergraph"],
  ["GraphOperation", "leafergraph"],
  ["RuntimeFeedbackEvent", "leafergraph"],
  ["EditorFrontendBundleSource", "../../../loader/types"],
  ["EditorRemoteAuthorityOperationContext", "../../graph_document_authority_client"],
  ["EditorRemoteAuthorityOperationResult", "../../graph_document_authority_client"],
  ["EditorRemoteAuthorityReplaceDocumentContext", "../../graph_document_authority_client"],
  ["EditorRemoteAuthorityRuntimeControlRequest", "../../graph_document_authority_client"],
  ["EditorRemoteAuthorityRuntimeControlResult", "../../graph_document_authority_client"]
];

const METHOD_MODEL_MAP = {
  "rpc.discover": {
    paramsType: "undefined",
    resultType: "EditorRemoteAuthorityOpenRpcDocument"
  },
  "authority.getDocument": {
    paramsType: "undefined",
    resultType: "GraphDocument"
  },
  "authority.submitOperation": {
    paramsType: "EditorRemoteAuthoritySubmitOperationRequest['params']",
    resultType: "EditorRemoteAuthorityOperationResult"
  },
  "authority.replaceDocument": {
    paramsType: "EditorRemoteAuthorityReplaceDocumentRequest['params']",
    resultType: "GraphDocument | null"
  },
  "authority.controlRuntime": {
    paramsType: "EditorRemoteAuthorityControlRuntimeRequest['params']",
    resultType: "EditorRemoteAuthorityRuntimeControlResult"
  }
};

const NOTIFICATION_MODEL_MAP = {
  "authority.document": {
    paramsType: "EditorRemoteAuthorityDocumentTransportEvent['document']"
  },
  "authority.documentDiff": {
    paramsType: "EditorRemoteAuthorityDocumentDiffTransportEvent['diff']"
  },
  "authority.runtimeFeedback": {
    paramsType: "EditorRemoteAuthorityRuntimeFeedbackTransportEvent['event']"
  },
  "authority.frontendBundlesSync": {
    paramsType: "EditorRemoteAuthorityFrontendBundlesSyncTransportEvent['event']"
  }
};

function toTsLiteral(value) {
  return JSON.stringify(value, null, 2);
}

function schemaKeyFromPath(fileName) {
  return fileName
    .replace(/\\/g, "/")
    .split("/")
    .at(-1)
    ?.replace(/\.schema\.json$/u, "")
    ?.replace(/\.json$/u, "") ?? fileName;
}

function createHeader() {
  return "// 此文件由 examples/editor/tools/generate_from_openrpc.ts 自动生成。\n\n";
}

function pascalCase(value) {
  return value
    .replace(/[.-]/gu, "_")
    .split("_")
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join("");
}

function validateSupportedSchema(schema, location, propertyMap = false) {
  if (Array.isArray(schema)) {
    schema.forEach((item, index) => {
      validateSupportedSchema(item, `${location}[${index}]`);
    });
    return;
  }

  if (!schema || typeof schema !== "object") {
    return;
  }

  if (propertyMap) {
    for (const [key, value] of Object.entries(schema)) {
      validateSupportedSchema(value, `${location}.${key}`);
    }
    return;
  }

  const unsupportedKeys = Object.keys(schema).filter(
    (key) => !ALLOWED_SCHEMA_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(
      `${location} 含有当前 editor 生成器未支持的 schema 关键字: ${unsupportedKeys.join(", ")}`
    );
  }

  for (const [key, value] of Object.entries(schema)) {
    validateSupportedSchema(value, `${location}.${key}`, key === "properties");
  }
}

function rewriteRefs(value, sourcePath) {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteRefs(item, sourcePath));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (typeof value.$ref === "string") {
    const targetPath = resolve(dirname(sourcePath), value.$ref);
    return {
      $ref: schemaKeyFromPath(targetPath)
    };
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      rewriteRefs(child, sourcePath)
    ])
  );
}

function loadOpenRpcDocument() {
  return JSON.parse(readFileSync(OPENRPC_PATH, "utf8"));
}

function loadSchemaBundle() {
  const entries = {};
  for (const fileName of readdirSync(SCHEMA_ROOT).sort()) {
    if (!fileName.endsWith(".json")) {
      continue;
    }
    const absolutePath = resolve(SCHEMA_ROOT, fileName);
    const schema = JSON.parse(readFileSync(absolutePath, "utf8"));
    validateSupportedSchema(schema, fileName);
    entries[schemaKeyFromPath(fileName)] = rewriteRefs(schema, absolutePath);
  }
  return entries;
}

function buildMethodDescriptors(openRpcDocument) {
  return Object.fromEntries(
    openRpcDocument.methods.map((method) => {
      const params = method.params ?? [];
      return [
        method.name,
        {
          paramsSchema:
            params.length === 0
              ? null
              : {
                  type: "object",
                  required: params
                    .filter((param) => param.required === true)
                    .map((param) => param.name),
                  properties: Object.fromEntries(
                    params.map((param) => [
                      param.name,
                      rewriteRefs(param.schema, OPENRPC_PATH)
                    ])
                  ),
                  additionalProperties: false
                },
          resultSchema: rewriteRefs(method.result.schema, OPENRPC_PATH)
        }
      ];
    })
  );
}

function buildNotificationDescriptors(openRpcDocument) {
  return Object.fromEntries(
    openRpcDocument["x-notifications"].map((notification) => [
      notification.name,
      {
        paramsSchema: rewriteRefs(notification.params[0].schema, OPENRPC_PATH)
      }
    ])
  );
}

function computeFingerprint() {
  const hash = createHash("sha256");
  const sourceFiles = [
    OPENRPC_PATH,
    ...readdirSync(SCHEMA_ROOT)
      .sort()
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => resolve(SCHEMA_ROOT, fileName)),
    fileURLToPath(import.meta.url)
  ];

  for (const filePath of sourceFiles) {
    hash.update(readFileSync(filePath));
    hash.update("\0");
  }

  return hash.digest("hex");
}

function renderImportGroups(entries) {
  const grouped = new Map();
  for (const [name, source] of entries) {
    const current = grouped.get(source) ?? [];
    current.push(name);
    grouped.set(source, current);
  }

  return [...grouped.entries()]
    .map(([source, names]) => {
      const uniqueNames = [...new Set(names)].sort();
      return `import type { ${uniqueNames.join(", ")} } from ${JSON.stringify(source)};`;
    })
    .join("\n");
}

function renderMethodsTs(openRpcDocument) {
  const values = {
    discover: "rpc.discover",
    getDocument: "authority.getDocument",
    submitOperation: "authority.submitOperation",
    replaceDocument: "authority.replaceDocument",
    controlRuntime: "authority.controlRuntime"
  };

  const actualMethodNames = openRpcDocument.methods.map((method) => method.name);
  if (
    JSON.stringify([...actualMethodNames].sort()) !==
    JSON.stringify(Object.values(values).sort())
  ) {
    throw new Error("共享 OpenRPC methods 与 editor 预期 methods 不一致，无法生成 methods.ts");
  }

  return (
    createHeader() +
    `export const AUTHORITY_OPENRPC_METHODS = ${toTsLiteral(values)} as const;\n\n` +
    "export type AuthorityOpenRpcMethodName =\n" +
    "  (typeof AUTHORITY_OPENRPC_METHODS)[keyof typeof AUTHORITY_OPENRPC_METHODS];\n\n" +
    "export const AUTHORITY_OPENRPC_METHOD_NAMES =\n" +
    "  Object.freeze(Object.values(AUTHORITY_OPENRPC_METHODS)) as readonly AuthorityOpenRpcMethodName[];\n"
  );
}

function renderNotificationsTs(openRpcDocument) {
  const values = {
    document: "authority.document",
    documentDiff: "authority.documentDiff",
    runtimeFeedback: "authority.runtimeFeedback",
    frontendBundlesSync: "authority.frontendBundlesSync"
  };

  const actualNames = openRpcDocument["x-notifications"].map(
    (notification) => notification.name
  );
  if (
    JSON.stringify([...actualNames].sort()) !==
    JSON.stringify(Object.values(values).sort())
  ) {
    throw new Error(
      "共享 OpenRPC notifications 与 editor 预期 notifications 不一致，无法生成 notifications.ts"
    );
  }

  return (
    createHeader() +
    `export const AUTHORITY_OPENRPC_NOTIFICATIONS = ${toTsLiteral(values)} as const;\n\n` +
    "export type AuthorityOpenRpcNotificationName =\n" +
    "  (typeof AUTHORITY_OPENRPC_NOTIFICATIONS)[keyof typeof AUTHORITY_OPENRPC_NOTIFICATIONS];\n\n" +
    "export const AUTHORITY_OPENRPC_NOTIFICATION_NAMES =\n" +
    "  Object.freeze(Object.values(AUTHORITY_OPENRPC_NOTIFICATIONS)) as readonly AuthorityOpenRpcNotificationName[];\n"
  );
}

function renderOpenRpcDocumentTs(openRpcDocument) {
  return (
    createHeader() +
    `const authorityOpenRpcDocument = ${toTsLiteral(openRpcDocument)} as const;\n\n` +
    "export default authorityOpenRpcDocument;\n" +
    "export { authorityOpenRpcDocument };\n"
  );
}

function renderSchemaBundleTs(schemaBundle, fingerprint) {
  return (
    createHeader() +
    `export const AUTHORITY_OPENRPC_FINGERPRINT = ${JSON.stringify(fingerprint)};\n\n` +
    `export const AUTHORITY_OPENRPC_SCHEMAS = ${toTsLiteral(schemaBundle)} as const;\n\n` +
    "export type AuthorityOpenRpcSchemaKey = keyof typeof AUTHORITY_OPENRPC_SCHEMAS;\n"
  );
}

function renderDescriptorTs(methodDescriptors, notificationDescriptors) {
  return (
    createHeader() +
    `export const AUTHORITY_OPENRPC_METHOD_DESCRIPTORS = ${toTsLiteral(methodDescriptors)} as const;\n\n` +
    `export const AUTHORITY_OPENRPC_NOTIFICATION_DESCRIPTORS = ${toTsLiteral(notificationDescriptors)} as const;\n`
  );
}

function renderTransportTypesTs(openRpcDocument) {
  const knownMethodNames = Object.keys(METHOD_MODEL_MAP).sort();
  const actualMethodNames = openRpcDocument.methods.map((method) => method.name).sort();
  if (JSON.stringify(knownMethodNames) !== JSON.stringify(actualMethodNames)) {
    throw new Error("METHOD_MODEL_MAP 未覆盖全部 OpenRPC methods");
  }

  const knownNotificationNames = Object.keys(NOTIFICATION_MODEL_MAP).sort();
  const actualNotificationNames = openRpcDocument["x-notifications"]
    .map((notification) => notification.name)
    .sort();
  if (JSON.stringify(knownNotificationNames) !== JSON.stringify(actualNotificationNames)) {
    throw new Error("NOTIFICATION_MODEL_MAP 未覆盖全部 OpenRPC notifications");
  }

  return (
    createHeader() +
    renderImportGroups(METHOD_TYPE_IMPORTS) +
    "\n\n" +
    "export interface EditorRemoteAuthorityDiscoverRequest {\n" +
    '  method: "rpc.discover";\n' +
    "  params?: Record<string, never>;\n" +
    "}\n\n" +
    "export interface EditorRemoteAuthorityGetDocumentRequest {\n" +
    '  method: "authority.getDocument";\n' +
    "  params?: Record<string, never>;\n" +
    "}\n\n" +
    "export interface EditorRemoteAuthoritySubmitOperationRequest {\n" +
    '  method: "authority.submitOperation";\n' +
    "  params: {\n" +
    "    operation: GraphOperation;\n" +
    "    context: EditorRemoteAuthorityOperationContext;\n" +
    "  };\n" +
    "}\n\n" +
    "export interface EditorRemoteAuthorityReplaceDocumentRequest {\n" +
    '  method: "authority.replaceDocument";\n' +
    "  params: {\n" +
    "    document: GraphDocument;\n" +
    "    context: EditorRemoteAuthorityReplaceDocumentContext;\n" +
    "  };\n" +
    "}\n\n" +
    "export interface EditorRemoteAuthorityControlRuntimeRequest {\n" +
    '  method: "authority.controlRuntime";\n' +
    "  params: {\n" +
    "    request: EditorRemoteAuthorityRuntimeControlRequest;\n" +
    "  };\n" +
    "}\n\n" +
    "export type EditorRemoteAuthorityTransportRequest =\n" +
    "  | EditorRemoteAuthorityDiscoverRequest\n" +
    "  | EditorRemoteAuthorityGetDocumentRequest\n" +
    "  | EditorRemoteAuthoritySubmitOperationRequest\n" +
    "  | EditorRemoteAuthorityReplaceDocumentRequest\n" +
    "  | EditorRemoteAuthorityControlRuntimeRequest;\n\n" +
    "export type EditorRemoteAuthorityOpenRpcDocument = Record<string, unknown>;\n\n" +
    "export type EditorRemoteAuthorityTransportResponse =\n" +
    "  | EditorRemoteAuthorityOpenRpcDocument\n" +
    "  | GraphDocument\n" +
    "  | EditorRemoteAuthorityOperationResult\n" +
    "  | EditorRemoteAuthorityRuntimeControlResult\n" +
    "  | null;\n\n" +
    "export interface EditorRemoteAuthorityRuntimeFeedbackTransportEvent {\n" +
    '  type: "runtimeFeedback";\n' +
    "  event: RuntimeFeedbackEvent;\n" +
    "}\n\n" +
    "export type EditorRemoteAuthorityFrontendBundleSource = EditorFrontendBundleSource;\n\n" +
    "export interface EditorRemoteAuthorityFrontendBundlePackage {\n" +
    "  packageId: string;\n" +
    "  version: string;\n" +
    "  nodeTypes: string[];\n" +
    "  bundles: EditorRemoteAuthorityFrontendBundleSource[];\n" +
    "}\n\n" +
    "export interface EditorRemoteAuthorityFrontendBundlesSyncEvent {\n" +
    '  type: "frontendBundles.sync";\n' +
    '  mode: "full" | "upsert" | "remove";\n' +
    "  packages?: EditorRemoteAuthorityFrontendBundlePackage[];\n" +
    "  removedPackageIds?: string[];\n" +
    "  emittedAt: number;\n" +
    "}\n\n" +
    "export interface EditorRemoteAuthorityFrontendBundlesSyncTransportEvent {\n" +
    '  type: "frontendBundles.sync";\n' +
    "  event: EditorRemoteAuthorityFrontendBundlesSyncEvent;\n" +
    "}\n\n" +
    "export interface EditorRemoteAuthorityDocumentTransportEvent {\n" +
    '  type: "document";\n' +
    "  document: GraphDocument;\n" +
    "}\n\n" +
    "export interface EditorRemoteAuthorityDocumentDiffTransportEvent {\n" +
    '  type: "documentDiff";\n' +
    "  diff: GraphDocumentDiff;\n" +
    "}\n\n" +
    "export type EditorRemoteAuthorityTransportEvent =\n" +
    "  | EditorRemoteAuthorityRuntimeFeedbackTransportEvent\n" +
    "  | EditorRemoteAuthorityDocumentTransportEvent\n" +
    "  | EditorRemoteAuthorityDocumentDiffTransportEvent\n" +
    "  | EditorRemoteAuthorityFrontendBundlesSyncTransportEvent;\n"
  );
}

function renderModelsTs(openRpcDocument) {
  const modelImports = [
    ["GraphDocument", "leafergraph"],
    [
      "EditorRemoteAuthorityOperationResult",
      "../../graph_document_authority_client"
    ],
    [
      "EditorRemoteAuthorityRuntimeControlResult",
      "../../graph_document_authority_client"
    ]
  ];
  const transportTypeImports = [
    "EditorRemoteAuthorityControlRuntimeRequest",
    "EditorRemoteAuthorityDocumentDiffTransportEvent",
    "EditorRemoteAuthorityDocumentTransportEvent",
    "EditorRemoteAuthorityFrontendBundlesSyncTransportEvent",
    "EditorRemoteAuthorityOpenRpcDocument",
    "EditorRemoteAuthorityReplaceDocumentRequest",
    "EditorRemoteAuthorityRuntimeFeedbackTransportEvent",
    "EditorRemoteAuthoritySubmitOperationRequest"
  ];
  const methodImports = renderImportGroups(
    [
      ...modelImports,
      ...transportTypeImports.map((name) => [name, "./transport_types"])
    ]
  );
  const methodParamsBody = openRpcDocument.methods
    .map((method) => {
      const mapping = METHOD_MODEL_MAP[method.name];
      if (!mapping) {
        throw new Error(`缺少 method 类型映射：${method.name}`);
      }
      return `  ${JSON.stringify(method.name)}: ${mapping.paramsType};`;
    })
    .join("\n");
  const methodResultsBody = openRpcDocument.methods
    .map((method) => {
      const mapping = METHOD_MODEL_MAP[method.name];
      return `  ${JSON.stringify(method.name)}: ${mapping.resultType};`;
    })
    .join("\n");
  const notificationBody = openRpcDocument["x-notifications"]
    .map((notification) => {
      const mapping = NOTIFICATION_MODEL_MAP[notification.name];
      if (!mapping) {
        throw new Error(`缺少 notification 类型映射：${notification.name}`);
      }
      return `  ${JSON.stringify(notification.name)}: ${mapping.paramsType};`;
    })
    .join("\n");

  return (
    createHeader() +
    'import type { AuthorityOpenRpcMethodName } from "./methods";\n' +
    'import type { AuthorityOpenRpcNotificationName } from "./notifications";\n' +
    methodImports +
    "\n\n" +
    "export interface AuthorityMethodParamsByName {\n" +
    methodParamsBody +
    "\n}\n\n" +
    "export interface AuthorityMethodResultByName {\n" +
    methodResultsBody +
    "\n}\n\n" +
    "export interface AuthorityNotificationParamsByName {\n" +
    notificationBody +
    "\n}\n\n" +
    "export type AuthorityMethodParams<TMethod extends AuthorityOpenRpcMethodName> =\n" +
    "  AuthorityMethodParamsByName[TMethod];\n\n" +
    "export type AuthorityMethodResult<TMethod extends AuthorityOpenRpcMethodName> =\n" +
    "  AuthorityMethodResultByName[TMethod];\n\n" +
    "export type AuthorityNotificationParams<TNotification extends AuthorityOpenRpcNotificationName> =\n" +
    "  AuthorityNotificationParamsByName[TNotification];\n"
  );
}

function renderGeneratedIndexTs() {
  return (
    createHeader() +
    'export * from "./descriptor";\n' +
    'export * from "./methods";\n' +
    'export * from "./models";\n' +
    'export * from "./notifications";\n' +
    'export * from "./schema_bundle";\n' +
    'export * from "./transport_types";\n' +
    'export { default as authorityOpenRpcDocument } from "./openrpc_document";\n'
  );
}

function expectedFiles() {
  const openRpcDocument = loadOpenRpcDocument();
  const schemaBundle = loadSchemaBundle();
  const fingerprint = computeFingerprint();
  const methodDescriptors = buildMethodDescriptors(openRpcDocument);
  const notificationDescriptors = buildNotificationDescriptors(openRpcDocument);

  return new Map([
    [resolve(GENERATED_ROOT, "methods.ts"), renderMethodsTs(openRpcDocument)],
    [
      resolve(GENERATED_ROOT, "notifications.ts"),
      renderNotificationsTs(openRpcDocument)
    ],
    [
      resolve(GENERATED_ROOT, "openrpc_document.ts"),
      renderOpenRpcDocumentTs(openRpcDocument)
    ],
    [
      resolve(GENERATED_ROOT, "schema_bundle.ts"),
      renderSchemaBundleTs(schemaBundle, fingerprint)
    ],
    [
      resolve(GENERATED_ROOT, "descriptor.ts"),
      renderDescriptorTs(methodDescriptors, notificationDescriptors)
    ],
    [
      resolve(GENERATED_ROOT, "transport_types.ts"),
      renderTransportTypesTs(openRpcDocument)
    ],
    [resolve(GENERATED_ROOT, "models.ts"), renderModelsTs(openRpcDocument)],
    [resolve(GENERATED_ROOT, "index.ts"), renderGeneratedIndexTs()],
    [resolve(GENERATED_ROOT, ".fingerprint"), `${fingerprint}\n`]
  ]);
}

function writeFiles(files) {
  rmSync(GENERATED_ROOT, {
    recursive: true,
    force: true
  });
  mkdirSync(GENERATED_ROOT, {
    recursive: true
  });
  for (const [filePath, content] of files) {
    writeFileSync(filePath, content, "utf8");
  }
}

function checkFiles(files) {
  if (!existsSync(GENERATED_ROOT)) {
    console.error("authority_openrpc 生成目录不存在，请先执行生成。");
    return 1;
  }

  const staleFiles = [];
  for (const [filePath, expected] of files) {
    if (!existsSync(filePath)) {
      staleFiles.push(filePath);
      continue;
    }
    const actual = readFileSync(filePath, "utf8");
    if (actual !== expected) {
      staleFiles.push(filePath);
    }
  }

  if (staleFiles.length === 0) {
    return 0;
  }

  console.error("以下 authority OpenRPC 生成物需要同步：");
  for (const filePath of staleFiles) {
    console.error(`- ${filePath}`);
  }
  return 1;
}

function main() {
  const files = expectedFiles();
  if (process.argv.includes("--check")) {
    process.exitCode = checkFiles(files);
    return;
  }

  writeFiles(files);
}

main();
