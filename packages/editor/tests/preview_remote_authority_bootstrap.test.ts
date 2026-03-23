import "./helpers/install_test_host_polyfills";
import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "leafergraph";
import { resolveEditorAppBootstrap } from "../src/app/editor_app_bootstrap";
import {
  createEditorRemoteAuthorityAppRuntime,
  type EditorRemoteAuthorityAppSource
} from "../src/backend/authority/remote_authority_app_runtime";
import type { EditorRemoteAuthorityHostAdapter } from "../src/backend/authority/remote_authority_host_adapter";
import {
  installPreviewRemoteAuthorityBootstrap,
  PREVIEW_REMOTE_AUTHORITY_ADAPTER_ID,
  PREVIEW_REMOTE_AUTHORITY_QUERY_KEY
} from "../src/demo/preview_remote_authority_bootstrap";

interface PreviewBootstrapHost {
  location?: {
    search?: string;
  };
  LeaferGraphEditorAppBootstrap?: {
    remoteAuthoritySource?: EditorRemoteAuthorityAppSource;
    remoteAuthorityAdapter?: {
      adapterId: string;
      options?: unknown;
    };
    remoteAuthorityHostAdapters?: readonly EditorRemoteAuthorityHostAdapter[];
  };
}

function createDocument(revision: string): GraphDocument {
  return {
    documentId: "preview-bootstrap-doc",
    revision,
    appKind: "preview-test",
    nodes: [],
    links: [],
    meta: {}
  };
}

function createExplicitAuthorityAdapter(): EditorRemoteAuthorityHostAdapter {
  return {
    adapterId: "explicit-authority",
    resolveSource() {
      return {
        label: "Explicit Authority",
        description: "宿主显式提供的 authority source",
        async createClient() {
          return {
            async getDocument() {
              return createDocument("41");
            },
            async submitOperation() {
              return {
                accepted: true,
                changed: false,
                revision: "41"
              };
            },
            async replaceDocument(document: GraphDocument) {
              return structuredClone(document);
            }
          };
        }
      };
    }
  };
}

describe("installPreviewRemoteAuthorityBootstrap", () => {
  test("query 命中时应注入预览 authority adapter，并可创建 runtime", async () => {
    const host: PreviewBootstrapHost = {
      location: {
        search:
          `?${PREVIEW_REMOTE_AUTHORITY_QUERY_KEY}=${PREVIEW_REMOTE_AUTHORITY_ADAPTER_ID}` +
          "&authorityLabel=Preview%20Runtime&authorityName=preview-browser"
      }
    };

    installPreviewRemoteAuthorityBootstrap(host);

    expect(host.LeaferGraphEditorAppBootstrap?.remoteAuthorityAdapter).toEqual({
      adapterId: PREVIEW_REMOTE_AUTHORITY_ADAPTER_ID,
      options: {
        label: "Preview Runtime",
        description: "通过浏览器预览 host adapter 注入的浏览器内 authority service",
        authorityName: "preview-browser"
      }
    });
    expect(
      host.LeaferGraphEditorAppBootstrap?.remoteAuthorityHostAdapters?.map(
        (adapter) => adapter.adapterId
      )
    ).toEqual([PREVIEW_REMOTE_AUTHORITY_ADAPTER_ID]);

    const bootstrap = resolveEditorAppBootstrap(host);
    const source = bootstrap.remoteAuthoritySource;
    if (!source) {
      throw new Error("未解析到预览 authority source");
    }

    const runtime = await createEditorRemoteAuthorityAppRuntime(source);

    expect(runtime.sourceLabel).toBe("Preview Runtime");
    expect(runtime.document.documentId).toBe("demo-worker-doc");
    expect(runtime.document.appKind).toBe("demo-worker");

    runtime.dispose();
  });

  test("未命中 query 时不应污染现有 bootstrap", () => {
    const bootstrap = {};
    const host: PreviewBootstrapHost = {
      location: {
        search: "?authority=other-demo"
      },
      LeaferGraphEditorAppBootstrap: bootstrap
    };

    installPreviewRemoteAuthorityBootstrap(host);

    expect(host.LeaferGraphEditorAppBootstrap).toBe(bootstrap);
    expect(host.LeaferGraphEditorAppBootstrap?.remoteAuthorityAdapter).toBe(
      undefined
    );
    expect(host.LeaferGraphEditorAppBootstrap?.remoteAuthorityHostAdapters).toBe(
      undefined
    );
  });

  test("宿主已有显式 authority 配置时应保留原配置，仅补充预览 adapter", () => {
    const explicitAdapter = createExplicitAuthorityAdapter();
    const host: PreviewBootstrapHost = {
      location: {
        search: `?${PREVIEW_REMOTE_AUTHORITY_QUERY_KEY}=${PREVIEW_REMOTE_AUTHORITY_ADAPTER_ID}`
      },
      LeaferGraphEditorAppBootstrap: {
        remoteAuthorityAdapter: {
          adapterId: explicitAdapter.adapterId
        },
        remoteAuthorityHostAdapters: [explicitAdapter]
      }
    };

    installPreviewRemoteAuthorityBootstrap(host);

    expect(host.LeaferGraphEditorAppBootstrap?.remoteAuthorityAdapter).toEqual({
      adapterId: explicitAdapter.adapterId
    });
    expect(
      host.LeaferGraphEditorAppBootstrap?.remoteAuthorityHostAdapters?.map(
        (adapter) => adapter.adapterId
      )
    ).toEqual([explicitAdapter.adapterId, PREVIEW_REMOTE_AUTHORITY_ADAPTER_ID]);

    const bootstrap = resolveEditorAppBootstrap(host);
    expect(bootstrap.remoteAuthoritySource?.label).toBe("Explicit Authority");
  });
});
