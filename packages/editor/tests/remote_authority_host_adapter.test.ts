import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "leafergraph";
import {
  MESSAGE_PORT_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
  resolveEditorRemoteAuthorityHostAdapterSource,
  type EditorRemoteAuthorityHostAdapter
} from "../src/app/remote_authority_host_adapter";

function createDocument(revision: string): GraphDocument {
  return {
    documentId: "adapter-doc",
    revision,
    appKind: "test-app",
    nodes: [],
    links: [],
    meta: {}
  };
}

describe("resolveEditorRemoteAuthorityHostAdapterSource", () => {
  test("应解析内置 MessagePort host adapter", () => {
    const channel = new MessageChannel();

    const source = resolveEditorRemoteAuthorityHostAdapterSource({
      adapterId: MESSAGE_PORT_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
      options: {
        label: "Adapter MessagePort",
        description: "通过内置 adapter 解析 MessagePort source",
        port: channel.port1
      }
    });

    expect(source?.label).toBe("Adapter MessagePort");
    expect(source?.description).toBe(
      "通过内置 adapter 解析 MessagePort source"
    );
    expect(typeof source?.createTransport).toBe("function");

    channel.port1.close();
    channel.port2.close();
  });

  test("应允许自定义 host adapter 覆盖同名内置 adapter", () => {
    const customAdapter: EditorRemoteAuthorityHostAdapter = {
      adapterId: MESSAGE_PORT_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
      resolveSource() {
        return {
          label: "Custom MessagePort Adapter",
          description: "宿主覆盖同名内置 adapter",
          createClient() {
            return {
              async getDocument() {
                return createDocument("99");
              },
              async submitOperation() {
                return {
                  accepted: true,
                  changed: false,
                  revision: "99"
                };
              },
              async replaceDocument(document: GraphDocument) {
                return structuredClone(document);
              },
              subscribe() {
                return () => {};
              }
            };
          }
        };
      }
    };

    const source = resolveEditorRemoteAuthorityHostAdapterSource(
      {
        adapterId: MESSAGE_PORT_REMOTE_AUTHORITY_HOST_ADAPTER_ID,
        options: {}
      },
      {
        adapters: [customAdapter]
      }
    );

    expect(source?.label).toBe("Custom MessagePort Adapter");
    expect(source?.description).toBe("宿主覆盖同名内置 adapter");
    expect(typeof source?.createClient).toBe("function");
  });
});
