import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const LEAFERGRAPH_OPENRPC_ROOT_ENV = "LEAFERGRAPH_OPENRPC_ROOT";
type OpenRpcEnvironment = Record<string, string | undefined>;

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(TOOL_DIR, "..");
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "..", "..");

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertOpenRpcRoot(rootPath: string): void {
  const openRpcPath = resolve(rootPath, "authority.openrpc.json");
  const schemaRoot = resolve(rootPath, "schemas");
  const conformanceRoot = resolve(rootPath, "conformance");

  if (!existsSync(openRpcPath)) {
    throw new Error(
      `${LEAFERGRAPH_OPENRPC_ROOT_ENV} 指向的目录缺少 authority.openrpc.json: ${rootPath}`
    );
  }
  if (!existsSync(schemaRoot)) {
    throw new Error(
      `${LEAFERGRAPH_OPENRPC_ROOT_ENV} 指向的目录缺少 schemas/: ${rootPath}`
    );
  }
  if (!existsSync(conformanceRoot)) {
    throw new Error(
      `${LEAFERGRAPH_OPENRPC_ROOT_ENV} 指向的目录缺少 conformance/: ${rootPath}`
    );
  }
}

export function resolveOpenRpcRoot(
  environment: OpenRpcEnvironment = process.env
): string {
  const configuredRoot = environment[LEAFERGRAPH_OPENRPC_ROOT_ENV];
  const rootPath = isNonEmptyString(configuredRoot)
    ? resolve(configuredRoot)
    : resolve(WORKSPACE_ROOT, "openrpc");

  assertOpenRpcRoot(rootPath);
  return rootPath;
}

export function resolveOpenRpcDocumentPath(
  environment: OpenRpcEnvironment = process.env
): string {
  return resolve(resolveOpenRpcRoot(environment), "authority.openrpc.json");
}

export function resolveOpenRpcSchemaRoot(
  environment: OpenRpcEnvironment = process.env
): string {
  return resolve(resolveOpenRpcRoot(environment), "schemas");
}

export function resolveOpenRpcConformanceRoot(
  environment: OpenRpcEnvironment = process.env
): string {
  return resolve(resolveOpenRpcRoot(environment), "conformance");
}

export function loadOpenRpcDocument<TDocument = unknown>(
  environment: OpenRpcEnvironment = process.env
): TDocument {
  return JSON.parse(
    readFileSync(resolveOpenRpcDocumentPath(environment), "utf8")
  ) as TDocument;
}
