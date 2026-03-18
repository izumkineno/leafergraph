import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "leafergraph";
import type { GraphViewportHostBridge } from "../src/app/GraphViewport";
import {
  installPreviewRemoteAuthorityHostDemoBootstrap,
  PREVIEW_REMOTE_AUTHORITY_HOST_DEMO_AUTHORITY_NAME
} from "../src/demo/preview_remote_authority_host_demo_bootstrap";
import {
  PREVIEW_REMOTE_AUTHORITY_ADAPTER_ID
} from "../src/demo/preview_remote_authority_bootstrap";

interface HostDemoBootstrapHost {
  location?: {
    search?: string;
  };
  console?: {
    info(...args: unknown[]): void;
  };
  LeaferGraphEditorAppBootstrap?: {
    remoteAuthorityAdapter?: {
      adapterId: string;
      options?: unknown;
    };
    remoteAuthorityHostAdapters?: readonly {
      adapterId: string;
    }[];
    onViewportHostBridgeChange?(bridge: GraphViewportHostBridge | null): void;
  };
  LeaferGraphEditorHostDemo?: {
    mode: "host-demo";
    bridge: GraphViewportHostBridge | null;
    authorityLabel: string;
    authorityName: string;
  };
}

function createDocument(revision: string): GraphDocument {
  return {
    documentId: "host-demo-doc",
    revision,
    appKind: "host-demo-test",
    nodes: [],
    links: [],
    meta: {}
  };
}

function createHostBridge(): GraphViewportHostBridge {
  const document = createDocument("9");

  return {
    graph: {} as never,
    executeCommand() {
      throw new Error("not implemented");
    },
    submitOperationWithAuthority() {
      throw new Error("not implemented");
    },
    async resyncAuthorityDocument() {
      return document;
    },
    replaceDocument() {},
    getCurrentDocument() {
      return document;
    },
    subscribeDocument() {
      return () => {};
    },
    getPendingOperationIds() {
      return [];
    },
    getSelectedNodeIds() {
      return [];
    },
    getNodeSnapshot() {
      return undefined;
    },
    getLink() {
      return undefined;
    }
  };
}

describe("installPreviewRemoteAuthorityHostDemoBootstrap", () => {
  test("应通过宿主页提前注入 preview authority bootstrap", () => {
    const infoLogs: unknown[][] = [];
    const host: HostDemoBootstrapHost = {
      location: {
        search:
          "?authorityLabel=Hosted%20Demo&authorityName=browser-host-demo"
      },
      console: {
        info(...args: unknown[]) {
          infoLogs.push(args);
        }
      }
    };

    installPreviewRemoteAuthorityHostDemoBootstrap(host);

    expect(host.LeaferGraphEditorAppBootstrap?.remoteAuthorityAdapter).toEqual({
      adapterId: PREVIEW_REMOTE_AUTHORITY_ADAPTER_ID,
      options: {
        label: "Hosted Demo",
        description: "通过 authority-host-demo.html 在宿主侧预注入的 authority adapter",
        authorityName: "browser-host-demo"
      }
    });
    expect(
      host.LeaferGraphEditorAppBootstrap?.remoteAuthorityHostAdapters?.map(
        (adapter) => adapter.adapterId
      )
    ).toEqual([PREVIEW_REMOTE_AUTHORITY_ADAPTER_ID]);
    expect(host.LeaferGraphEditorHostDemo).toEqual({
      mode: "host-demo",
      bridge: null,
      authorityLabel: "Hosted Demo",
      authorityName: "browser-host-demo"
    });

    const bridge = createHostBridge();
    host.LeaferGraphEditorAppBootstrap?.onViewportHostBridgeChange?.(bridge);

    expect(host.LeaferGraphEditorHostDemo?.bridge).toBe(bridge);
    expect(infoLogs).toEqual([
      ["[authority-host-demo]", "viewport bridge ready for browser-host-demo"]
    ]);
  });

  test("未提供 query 时应使用宿主示例默认 authority 名称", () => {
    const host: HostDemoBootstrapHost = {};

    installPreviewRemoteAuthorityHostDemoBootstrap(host);

    expect(
      host.LeaferGraphEditorAppBootstrap?.remoteAuthorityAdapter?.options
    ).toEqual({
      label: "Host Demo Authority",
      description: "通过 authority-host-demo.html 在宿主侧预注入的 authority adapter",
      authorityName: PREVIEW_REMOTE_AUTHORITY_HOST_DEMO_AUTHORITY_NAME
    });
    expect(host.LeaferGraphEditorHostDemo?.authorityName).toBe(
      PREVIEW_REMOTE_AUTHORITY_HOST_DEMO_AUTHORITY_NAME
    );
  });
});
