import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LEAFERGRAPH_OPENRPC_ROOT_ENV,
  loadOpenRpcDocument,
  resolveOpenRpcConformanceRoot,
  resolveOpenRpcDocumentPath,
  resolveOpenRpcRoot,
  resolveOpenRpcSchemaRoot
} from "../tools/openrpc_paths";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const EXPECTED_DEFAULT_ROOT = resolve(TEST_DIR, "..", "..", "..", "openrpc");
const TEMPORARY_PATHS: string[] = [];

function trackTemporaryPath(path: string): string {
  TEMPORARY_PATHS.push(path);
  return path;
}

function createOpenRpcRoot(options?: {
  includeDocument?: boolean;
  includeSchemas?: boolean;
  includeConformance?: boolean;
  document?: unknown;
}): string {
  const root = trackTemporaryPath(
    mkdtempSync(resolve(tmpdir(), "leafergraph-openrpc-"))
  );

  if (options?.includeDocument !== false) {
    writeFileSync(
      resolve(root, "authority.openrpc.json"),
      JSON.stringify(
        options?.document ?? {
          openrpc: "1.3.2",
          info: {
            title: "custom-openrpc"
          }
        }
      ),
      "utf8"
    );
  }

  if (options?.includeSchemas !== false) {
    mkdirSync(resolve(root, "schemas"));
  }

  if (options?.includeConformance !== false) {
    mkdirSync(resolve(root, "conformance"));
  }

  return root;
}

afterEach(() => {
  while (TEMPORARY_PATHS.length > 0) {
    const path = TEMPORARY_PATHS.pop();
    if (path) {
      rmSync(path, {
        force: true,
        recursive: true
      });
    }
  }
});

describe("openrpc_paths", () => {
  test("未设置环境变量时应回退到仓库根 openrpc", () => {
    const environment = {};

    expect(resolveOpenRpcRoot(environment)).toBe(EXPECTED_DEFAULT_ROOT);
    expect(resolveOpenRpcDocumentPath(environment)).toBe(
      resolve(EXPECTED_DEFAULT_ROOT, "authority.openrpc.json")
    );
    expect(resolveOpenRpcSchemaRoot(environment)).toBe(
      resolve(EXPECTED_DEFAULT_ROOT, "schemas")
    );
    expect(resolveOpenRpcConformanceRoot(environment)).toBe(
      resolve(EXPECTED_DEFAULT_ROOT, "conformance")
    );
    expect(existsSync(resolveOpenRpcDocumentPath(environment))).toBe(true);
  });

  test("设置环境变量后应从自定义 openrpc 根目录读取文档", () => {
    const customRoot = createOpenRpcRoot({
      document: {
        openrpc: "1.3.2",
        info: {
          title: "custom-openrpc"
        }
      }
    });
    const environment = {
      [LEAFERGRAPH_OPENRPC_ROOT_ENV]: customRoot
    };

    expect(resolveOpenRpcRoot(environment)).toBe(customRoot);
    expect(loadOpenRpcDocument<{ info: { title: string } }>(environment)).toMatchObject({
      info: {
        title: "custom-openrpc"
      }
    });
  });

  test("缺少 authority.openrpc.json 时应报错", () => {
    const customRoot = createOpenRpcRoot({
      includeDocument: false
    });

    expect(() =>
      resolveOpenRpcRoot({
        [LEAFERGRAPH_OPENRPC_ROOT_ENV]: customRoot
      })
    ).toThrow("authority.openrpc.json");
  });

  test("缺少 schemas 目录时应报错", () => {
    const customRoot = createOpenRpcRoot({
      includeSchemas: false
    });

    expect(() =>
      resolveOpenRpcRoot({
        [LEAFERGRAPH_OPENRPC_ROOT_ENV]: customRoot
      })
    ).toThrow("schemas/");
  });

  test("缺少 conformance 目录时应报错", () => {
    const customRoot = createOpenRpcRoot({
      includeConformance: false
    });

    expect(() =>
      resolveOpenRpcRoot({
        [LEAFERGRAPH_OPENRPC_ROOT_ENV]: customRoot
      })
    ).toThrow("conformance/");
  });
});
